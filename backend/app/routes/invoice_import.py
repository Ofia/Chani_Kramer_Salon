"""
Invoice Import — parse a delivery PDF invoice and create inventory_items.

Routes:
  POST /inventory/invoice-preview   upload PDF → parse → return rows with cost+markup
  POST /inventory/invoice-confirm   accept confirmed rows → bulk-create inventory items

Supported invoice formats:
  - Sary/Rina combined invoice (Sary Wigs, Lakewood NJ)
  - Line format: {line_no} {serial} {description...} {qty} {price} {due_date}

Serial → Provider mapping:
  RINA* → Rina Wigs
  SB*   → Sary
  BK*   → BK Wigs
  RL*   → Rochi Lipsker
"""

import base64
import io
import re
from datetime import date
from typing import Optional
from uuid import UUID

import anthropic
import pdfplumber
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.database import get_db
from app.models.models import (
    InventoryEvent, InventoryItem, InventoryItemType,
    Provider, User, UserRole, WigItemStatus,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _require_bookkeeper_or_owner(current_user: User):
    if current_user.role not in (UserRole.bookkeeper, UserRole.owner):
        raise HTTPException(status_code=403, detail="Bookkeeper or owner role required")


# ── Serial prefix → provider display name ────────────────────────────────────
_SERIAL_PREFIX_TO_PROVIDER: list[tuple[str, str]] = [
    ("RINA",  "Rina Wigs"),
    ("SB",    "Sary"),
    ("BK",    "BK Wigs"),
    ("ROCHI", "Rochi Lipsker"),
    ("RL",    "Rochi Lipsker"),
]


# ── Model type keyword detection (most-specific keywords first) ───────────────
_MODEL_KEYWORDS: list[tuple[list[str], str]] = [
    (["FEATHER CURLY"],                                "Feather Curly"),
    (["FEATHER"],                                      "Feather"),
    (["LACE TOP CURLY", "LACETOP CURLY"],              "Lace Top Curly"),
    (["LACE TOP", "LACETOP"],                          "Lace Top"),
    (["SKIN TOP"],                                     "Skin Top"),
    (["FALL CURLY"],                                   "Fall Curly"),
    (["FALL", "PRECUT"],                               "Fall"),
    (["ELITE CURLY BLONDE"],                           "Elite - Curly Blonde"),
    (["ELITE CURLY BROWN"],                            "Elite - Curly Brown"),
    (["ELITE LACETOP BLONDE", "ELITE LACE TOP BLONDE"],"Elite - Lacetop Blonde"),
    (["ELITE LACETOP BROWN",  "ELITE LACE TOP BROWN"], "Elite - Lacetop Brown"),
    (["ELITE"],                                        "Elite"),
    (["CLASSIC"],                                      "Classic (Skin Top)"),
    (["SKIN"],                                         "Skin Top"),
]

# Regex for a line item: {line_no} {serial} {description...} {qty} {price} {due_date}
_LINE_RE = re.compile(
    r'^\d+\s+(\S+)\s+(.+?)\s+(\d+\.\d{2})\s+([\d,]+\.\d{2})\s+\d{1,2}/\d{1,2}/\d{4}\s*$'
)


def _detect_provider(serial: str) -> Optional[str]:
    upper = serial.upper()
    for prefix, name in _SERIAL_PREFIX_TO_PROVIDER:
        if upper.startswith(prefix):
            return name
    return None


def _detect_model_type(description: str) -> str:
    d = description.upper()
    for keywords, model_name in _MODEL_KEYWORDS:
        if any(kw in d for kw in keywords):
            return model_name
    return "Unknown"


def _extract_length(description: str) -> Optional[str]:
    """Extract length from description prefix. '11M RINA WIG...' → '11\"'"""
    m = re.match(r'^(\d+(?:\.\d+)?)[ML]?\b', description.strip(), re.IGNORECASE)
    if m:
        return f'{m.group(1)}"'
    return None


def _extract_color(description: str) -> str:
    """Extract color from description by removing known brand/type/style tokens."""
    d = description.strip()
    # Strip leading length token (e.g. "11M ")
    d = re.sub(r'^\d+[ML]?\s*', '', d, flags=re.IGNORECASE)
    # Strip brand tokens
    d = re.sub(
        r'\b(RINA WIG|RINA|SARY WIG|SARY PRECUT|SARY|BK WIG|BK|ROCHI|WIG)\b',
        '', d, flags=re.IGNORECASE,
    )
    # Strip model type tokens (most specific first to avoid partial removal)
    d = re.sub(
        r'\b(FEATHER CURLY|FEATHER|LACE TOP CURLY|LACETOP CURLY|LACE TOP|LACETOP'
        r'|SKIN TOP|FALL CURLY|FALL|ELITE|CLASSIC|PRECUT|SKIN)\b',
        '', d, flags=re.IGNORECASE,
    )
    # Strip style tokens
    d = re.sub(r'\b(WAVY|CURLY|STRAIGHT)\b', '', d, flags=re.IGNORECASE)
    return ' '.join(d.split()).strip()


def _parse_invoice_lines(text: str) -> list[dict]:
    """Extract line items from a single page of invoice text.

    The description always starts with a size code like '11M' or '18L'.
    We append that code to the serial so inventory reads 'RINA55361-11M'.
    """
    items = []
    for line in text.splitlines():
        m = _LINE_RE.match(line.strip())
        if not m:
            continue
        serial, description, _qty, price_str = m.group(1), m.group(2), m.group(3), m.group(4)
        cost = float(price_str.replace(',', ''))
        # Append size code (e.g. "11M", "18L") from start of description to serial
        size_m = re.match(r'^(\d+[ML]?)\s', description.strip(), re.IGNORECASE)
        if size_m:
            serial = f"{serial}-{size_m.group(1).upper()}"
        items.append({"serial": serial, "description": description, "cost": cost})
    return items


def _find_markup(provider: Provider, model_type: str) -> Optional[float]:
    """Find markup_usd for the given model type in the provider's wig_models JSONB array."""
    models = provider.wig_models or []
    model_lower = model_type.lower()
    # Exact name match
    for m in models:
        if m.get("name", "").lower() == model_lower:
            return float(m.get("markup_usd", 0))
    # Partial match (model name contains or is contained by detected type)
    for m in models:
        name = m.get("name", "").lower()
        if model_lower in name or name in model_lower:
            return float(m.get("markup_usd", 0))
    return None


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class InvoicePreviewRow(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    serial: str
    provider_name: Optional[str]   # detected from serial prefix
    provider_id: Optional[UUID]    # DB provider UUID if found
    model_type: str                # e.g. "Lace Top", "Fall"
    length: Optional[str]          # e.g. '11"'
    color: str                     # extracted color string
    description: str               # raw description from PDF
    cost: float                    # invoice wholesale price
    markup_usd: Optional[float]    # from provider wig_models rules
    retail: Optional[float]        # cost + markup_usd
    already_exists: bool           # True if serial already in inventory


class InvoiceConfirmRow(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    serial: str
    provider_name: Optional[str]
    provider_id: Optional[UUID]
    model_type: str
    length: Optional[str]
    color: str
    cost: float
    retail: float


class InvoiceConfirmResult(BaseModel):
    created: int
    skipped: int
    errors: list[str]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/invoice-preview", response_model=list[InvoicePreviewRow])
async def invoice_preview(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a PDF delivery invoice → parse line items → return preview rows.
    Each row includes cost from the invoice + markup looked up from provider rules.
    """
    _require_bookkeeper_or_owner(current_user)

    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    contents = await file.read()
    all_lines: list[dict] = []

    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            all_lines.extend(_parse_invoice_lines(text))

    if not all_lines:
        raise HTTPException(
            status_code=422,
            detail="No line items found in this PDF. Make sure it's a delivery invoice.",
        )

    # Load all active providers once
    providers_db: list[Provider] = db.query(Provider).all()
    provider_by_name = {p.name: p for p in providers_db}

    # Check which serials already exist in inventory
    serials = [item["serial"] for item in all_lines]
    existing_serials: set[str] = {
        row[0]
        for row in db.query(InventoryItem.daysmart_serial).filter(
            InventoryItem.daysmart_serial.in_(serials)
        ).all()
        if row[0]
    }

    rows: list[InvoicePreviewRow] = []
    for item in all_lines:
        serial      = item["serial"]
        description = item["description"]
        cost        = item["cost"]

        provider_name = _detect_provider(serial)
        provider      = provider_by_name.get(provider_name) if provider_name else None
        model_type    = _detect_model_type(description)
        length        = _extract_length(description)
        color         = _extract_color(description)
        markup_usd    = _find_markup(provider, model_type) if provider else None
        retail        = (cost + markup_usd) if markup_usd is not None else None

        rows.append(InvoicePreviewRow(
            serial=serial,
            provider_name=provider_name,
            provider_id=provider.id if provider else None,
            model_type=model_type,
            length=length,
            color=color,
            description=description,
            cost=cost,
            markup_usd=markup_usd,
            retail=retail,
            already_exists=serial in existing_serials,
        ))

    return rows


@router.post("/invoice-confirm", response_model=InvoiceConfirmResult)
def invoice_confirm(
    rows: list[InvoiceConfirmRow],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept the confirmed preview rows and bulk-create inventory_items.
    Skips any serial that already exists in inventory.
    """
    _require_bookkeeper_or_owner(current_user)

    created = 0
    skipped = 0
    errors: list[str] = []

    for row in rows:
        existing = db.query(InventoryItem).filter(
            InventoryItem.daysmart_serial == row.serial
        ).first()
        if existing:
            skipped += 1
            continue

        try:
            name_parts = [p for p in [row.model_type, row.length, row.color] if p]
            name = " ".join(name_parts) if name_parts else "Wig"

            item = InventoryItem(
                item_type=InventoryItemType.wig,
                name=name,
                daysmart_serial=row.serial,
                brand=row.provider_name,
                length=row.length,
                color=row.color or None,
                cost_price=row.cost,
                retail_price=row.retail,
                wig_status=WigItemStatus.in_stock,
                supplier=row.provider_name,
                provider_id=row.provider_id,
                arrival_date=date.today(),
                created_by=current_user.id,
            )
            db.add(item)
            db.flush()

            event = InventoryEvent(
                inventory_item_id=item.id,
                event_type="arrived",
                description="Added from delivery invoice.",
                event_date=date.today(),
                created_by=current_user.id,
            )
            db.add(event)
            created += 1

        except Exception as exc:
            db.rollback()
            errors.append(f"{row.serial}: {str(exc)}")
            continue

    db.commit()
    return InvoiceConfirmResult(created=created, skipped=skipped, errors=errors)


# ── Product invoice import (any marketplace — Amazon, Alibaba, etc.) ─────────
#
# Unlike the wig flow above, product invoices come in unknown/varying layouts,
# so there's no fixed regex. Instead the file (PDF or photo) is sent directly to
# Claude, which already reads PDFs/images natively, with a forced tool call so
# the response is guaranteed-shape JSON.

_PRODUCT_MAX_FILE_BYTES = 25 * 1024 * 1024  # 25MB
_PRODUCT_ALLOWED_EXTENSIONS = (".pdf", ".jpg", ".jpeg", ".png")

_PRODUCT_EXTRACT_TOOL = {
    "name": "extract_invoice_items",
    "description": "Extract every purchased line item from this supplier invoice/receipt.",
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {
                            "type": "string",
                            "description": "Product name/description exactly as printed on the invoice.",
                        },
                        "quantity": {
                            "type": "integer",
                            "description": "Quantity purchased for this line. If not stated, use 1.",
                        },
                        "unit_cost": {
                            "type": "number",
                            "description": (
                                "Price PER UNIT in dollars, no currency symbol. If the invoice "
                                "only shows a line total (qty x total), divide line total by "
                                "quantity to get this value."
                            ),
                        },
                    },
                    "required": ["description", "quantity", "unit_cost"],
                },
            },
        },
        "required": ["items"],
    },
}

_PRODUCT_EXTRACT_SYSTEM_PROMPT = """You are an invoice line-item extractor for a hair salon's inventory system.

You will be given a supplier invoice or order receipt (Amazon, Alibaba, or any other
marketplace/vendor — the layout is unknown and may vary). Extract ONLY the actual
purchased product line items, then call the extract_invoice_items tool exactly once
with the result.

Rules:
- Read every page. If there are multiple pages, combine line items from ALL pages into one list.
- Each row in your output must correspond to one distinct product line item that was purchased.
- DO NOT include: shipping/freight charges, taxes, duties, discounts, promotions, gift wrap,
  "subtotal", "total", "amount due", "balance", or any header/footer/account/billing-address text.
- If a line shows a quantity and a line TOTAL (not a per-unit price), compute
  unit_cost = line_total / quantity. Round to 2 decimals.
- If quantity is not explicitly stated for a line, assume quantity = 1.
- If a price cannot be determined for a line item at all, omit that line item rather than guessing.
- Keep the description exactly as printed (product name/title), without added commentary.
- If the file contains no purchasable line items at all (e.g. it's not an invoice), call the
  tool with an empty items array.
"""


class ProductInvoicePreviewRow(BaseModel):
    description: str
    category: Optional[str] = None
    quantity: int
    cost: float                                # per-unit cost from invoice
    unit_price: float                          # default = cost
    existing_item_id: Optional[UUID] = None    # set if a name match was found
    existing_quantity: Optional[int] = None    # current stock, for the inline copy


class ProductInvoiceConfirmRow(BaseModel):
    description: str
    category: Optional[str] = None
    quantity: int
    cost: float
    unit_price: float
    merge_into_id: Optional[UUID] = None       # only set when the user chose "Merge"


class ProductInvoiceConfirmResult(BaseModel):
    created: int
    merged: int
    errors: list[str]


def _extract_product_items_via_claude(file_bytes: bytes, filename: str) -> list[dict]:
    """Send the raw file (PDF or image) to Claude and get back structured line items."""
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    ext = filename.lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        block = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": base64.standard_b64encode(file_bytes).decode("utf-8")},
        }
    else:
        media_type = "image/png" if ext == "png" else "image/jpeg"
        block = {
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": base64.standard_b64encode(file_bytes).decode("utf-8")},
        }

    client = anthropic.Anthropic(api_key=api_key)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=_PRODUCT_EXTRACT_SYSTEM_PROMPT,
            tools=[_PRODUCT_EXTRACT_TOOL],
            tool_choice={"type": "tool", "name": "extract_invoice_items"},
            messages=[{
                "role": "user",
                "content": [
                    block,
                    {"type": "text", "text": "Extract the invoice line items using the extract_invoice_items tool."},
                ],
            }],
        )
    except anthropic.APIError as exc:
        raise HTTPException(status_code=502, detail=f"AI extraction failed: {exc}")

    for content_block in response.content:
        if content_block.type == "tool_use" and content_block.name == "extract_invoice_items":
            return content_block.input.get("items", [])
    return []


@router.post("/product-invoice-preview", response_model=list[ProductInvoicePreviewRow])
async def product_invoice_preview(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a supplier invoice (PDF or photo) → Claude extracts line items → return
    preview rows. Unlike the wig flow, layouts are unknown/varying, so there's no regex.
    """
    _require_bookkeeper_or_owner(current_user)

    filename = (file.filename or "").lower()
    if not filename.endswith(_PRODUCT_ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Only PDF or image (JPG/PNG) files are supported.")

    contents = await file.read()
    if len(contents) > _PRODUCT_MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail="File is too large — please upload a smaller invoice (max 25MB).")

    raw_items = _extract_product_items_via_claude(contents, filename)

    if not raw_items:
        raise HTTPException(
            status_code=422,
            detail="No line items found in this file. Make sure it's a supplier invoice or receipt.",
        )

    # Merge duplicate descriptions within this invoice (sum qty, weighted-average cost)
    # so there's exactly one preview row per distinct product before matching against inventory.
    merged_by_desc: dict[str, dict] = {}
    order: list[str] = []
    for raw in raw_items:
        desc = (raw.get("description") or "").strip()
        if not desc:
            continue
        key = desc.lower()
        qty = int(raw.get("quantity") or 1)
        cost = float(raw.get("unit_cost") or 0)
        if key in merged_by_desc:
            existing = merged_by_desc[key]
            total_qty = existing["quantity"] + qty
            existing["cost"] = ((existing["cost"] * existing["quantity"]) + (cost * qty)) / total_qty
            existing["quantity"] = total_qty
        else:
            merged_by_desc[key] = {"description": desc, "quantity": qty, "cost": cost}
            order.append(key)

    existing_products = {
        p.name.lower(): p
        for p in db.query(InventoryItem).filter(InventoryItem.item_type == InventoryItemType.product).all()
    }

    rows: list[ProductInvoicePreviewRow] = []
    for key in order:
        item = merged_by_desc[key]
        existing = existing_products.get(key)
        rows.append(ProductInvoicePreviewRow(
            description=item["description"],
            category=existing.category if existing else None,
            quantity=item["quantity"],
            cost=round(item["cost"], 2),
            unit_price=round(item["cost"], 2),
            existing_item_id=existing.id if existing else None,
            existing_quantity=existing.quantity if existing else None,
        ))

    return rows


@router.post("/product-invoice-confirm", response_model=ProductInvoiceConfirmResult)
def product_invoice_confirm(
    rows: list[ProductInvoiceConfirmRow],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept the confirmed preview rows. Rows with merge_into_id add their quantity
    to that existing product; all other rows create a new product (default — two
    rows with the same name may genuinely be different items/batches).
    """
    _require_bookkeeper_or_owner(current_user)

    created = 0
    merged = 0
    errors: list[str] = []

    for row in rows:
        try:
            if row.merge_into_id:
                item = db.query(InventoryItem).filter(InventoryItem.id == row.merge_into_id).first()
                if not item:
                    errors.append(f"{row.description}: existing item no longer found, skipped.")
                    continue
                item.quantity = (item.quantity or 0) + row.quantity
                item.cost_price = row.cost
                item.unit_price = row.unit_price
                if row.category:
                    item.category = row.category
                merged += 1
            else:
                item = InventoryItem(
                    item_type=InventoryItemType.product,
                    name=row.description,
                    category=row.category or None,
                    quantity=row.quantity,
                    cost_price=row.cost,
                    unit_price=row.unit_price,
                    created_by=current_user.id,
                )
                db.add(item)
                created += 1
        except Exception as exc:
            db.rollback()
            errors.append(f"{row.description}: {str(exc)}")
            continue

    db.commit()
    return ProductInvoiceConfirmResult(created=created, merged=merged, errors=errors)
