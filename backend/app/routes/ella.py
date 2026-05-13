"""
Ella — AI chat endpoint.

POST /api/v1/ella/chat
  Body:  { "user_id": "<uuid>", "message": "<text>" }
  Returns: { "reply": "<text>" }

How it works (pseudo-code):
  1. Load last 20 messages from ai_conversations for this user (conversation history)
  2. Add the new user message
  3. Enter the Claude tool-use loop:
       → Claude thinks
       → If Claude wants to call a tool, run the DB query, feed result back
       → Repeat until Claude produces a plain text answer
  4. Save the user message + Ella's reply to ai_conversations
  5. Return the reply
"""

import json
from pathlib import Path

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.models.models import AiConversation
from app.services.ella_tools import TOOLS, dispatch_tool

router = APIRouter(prefix="/ella", tags=["Ella"])

# Load the static system prompt once at startup
_SYSTEM_PROMPT_PATH = Path(__file__).parent.parent / "services" / "ella_system.md"
SYSTEM_PROMPT = _SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")

# Max conversation turns to load (keeps the context window manageable)
MAX_HISTORY = 20


# ── Request / Response schemas ───────────────────────────────────────────────

class ChatRequest(BaseModel):
    user_id: str
    message: str


class ChatResponse(BaseModel):
    reply: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _load_history(db: Session, user_id: str) -> list[dict]:
    """
    Load the last MAX_HISTORY messages for this user from the DB.
    Returns them in the format Claude expects: [{"role": "user"|"assistant", "content": "..."}]
    """
    rows = (
        db.query(AiConversation)
        .filter(AiConversation.user_id == user_id)
        .order_by(AiConversation.created_at.desc())
        .limit(MAX_HISTORY)
        .all()
    )
    # Reverse so oldest is first (chronological order for Claude)
    return [{"role": r.role, "content": r.content} for r in reversed(rows)]


def _save_message(db: Session, user_id: str, role: str, content: str) -> None:
    """Persist one message to ai_conversations."""
    import uuid
    msg = AiConversation(
        user_id=uuid.UUID(user_id),
        role=role,
        content=content,
    )
    db.add(msg)
    db.commit()


def _run_ella(
    client: anthropic.Anthropic,
    messages: list[dict],
    db: Session,
    user_id: str,
) -> str:
    """
    The tool-use loop.

    Claude may call tools multiple times before giving a final text answer.
    We keep going until stop_reason is "end_turn" (no more tool calls).

    Returns the final plain-text reply from Ella.
    """
    while True:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        # Claude is done — extract the text reply
        if response.stop_reason == "end_turn":
            text_blocks = [b.text for b in response.content if b.type == "text"]
            return "\n".join(text_blocks)

        # Claude wants to use one or more tools
        if response.stop_reason == "tool_use":
            # Step 1: add Claude's response (including tool_use blocks) to messages
            messages.append({"role": "assistant", "content": response.content})

            # Step 2: execute each tool and collect results
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = dispatch_tool(block.name, block.input, db, user_id)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result),
                    })

            # Step 3: feed the results back as a user message, then loop
            messages.append({"role": "user", "content": tool_results})
            continue

        # Unexpected stop reason — return whatever text we have
        text_blocks = [b.text for b in response.content if b.type == "text"]
        return "\n".join(text_blocks) if text_blocks else "Sorry, I wasn't able to generate a response."


# ── Route ────────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, db: Session = Depends(get_db)):
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    client = anthropic.Anthropic(api_key=api_key)

    # Build the message list: history + new user message
    messages = _load_history(db, body.user_id)
    messages.append({"role": "user", "content": body.message})

    # Run Ella
    reply = _run_ella(client, messages, db, body.user_id)

    # Persist the exchange
    _save_message(db, body.user_id, "user", body.message)
    _save_message(db, body.user_id, "assistant", reply)

    return ChatResponse(reply=reply)
