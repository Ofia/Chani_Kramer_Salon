from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import BoardPost, User
from app.schemas.schemas import BoardPostCreate, BoardPostResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/board-posts", tags=["board-posts"])


@router.get("/", response_model=List[BoardPostResponse])
def list_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    posts = db.query(BoardPost).order_by(BoardPost.created_at.desc()).limit(50).all()
    return [
        BoardPostResponse(
            id=p.id,
            author_id=p.author_id,
            author_name=p.author.name if p.author else "Unknown",
            content=p.content,
            created_at=p.created_at,
        )
        for p in posts
    ]


@router.post("/", response_model=BoardPostResponse, status_code=201)
def create_post(
    data: BoardPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = BoardPost(content=data.content, author_id=current_user.id)
    db.add(post)
    db.commit()
    db.refresh(post)
    return BoardPostResponse(
        id=post.id,
        author_id=post.author_id,
        author_name=current_user.name,
        content=post.content,
        created_at=post.created_at,
    )


@router.delete("/{post_id}", status_code=204)
def delete_post(
    post_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(BoardPost).filter(BoardPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    # Authors can delete their own; owners can delete any
    if post.author_id != current_user.id and current_user.role.value != "owner":
        raise HTTPException(status_code=403, detail="Can only delete your own posts")
    db.delete(post)
    db.commit()
