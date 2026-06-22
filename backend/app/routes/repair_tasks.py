"""
Repair Tasks routes — /api/v1/repair-tasks

Each task is one service on a wig within a repair order.
Creating a task also creates a pending_cart_item so POS sees it immediately.
Deleting a task removes the linked cart item too.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import get_current_user
from app.models.models import (
    RepairTask, RepairOrder,
    PendingCartItem, CartItemType,
)
from app.schemas.schemas import RepairTaskCreate, RepairTaskUpdate, RepairTaskResponse

router = APIRouter(prefix="/repair-tasks", tags=["repair-tasks"])


def _build(task: RepairTask) -> RepairTaskResponse:
    data = RepairTaskResponse.model_validate(task)
    if task.assigned_provider:
        data.assigned_provider_name = task.assigned_provider.name
    return data


@router.post("/", response_model=RepairTaskResponse, status_code=201)
def create_repair_task(
    payload: RepairTaskCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    order = db.get(RepairOrder, payload.repair_order_id)
    if not order:
        raise HTTPException(404, "Repair order not found")

    task = RepairTask(**payload.model_dump(), created_by=current_user.id)
    db.add(task)
    db.flush()  # get task.id before cart item

    # Mirror to pending_cart_items so POS / Active Carts sees it immediately
    if order.customer_id:
        db.add(PendingCartItem(
            customer_id=order.customer_id,
            item_type=CartItemType.service,
            description=payload.description,
            price=payload.price,
            tax_rate=payload.tax_rate,
            notes=payload.notes,
            department="repairs",
            repair_order_id=order.id,
            repair_task_id=task.id,
            created_by=current_user.id,
        ))

    db.commit()
    db.refresh(task)
    return _build(task)


@router.patch("/{task_id}", response_model=RepairTaskResponse)
def update_repair_task(
    task_id: UUID,
    payload: RepairTaskUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    task = db.get(RepairTask, task_id)
    if not task:
        raise HTTPException(404, "Repair task not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(task, field, value)

    # Keep the linked cart item in sync for price/description changes
    if "price" in updates or "description" in updates:
        cart_item = db.query(PendingCartItem).filter(
            PendingCartItem.repair_task_id == task_id
        ).first()
        if cart_item:
            if "price" in updates:
                cart_item.price = updates["price"]
            if "description" in updates:
                cart_item.description = updates["description"]

    db.commit()
    db.refresh(task)
    return _build(task)


@router.delete("/{task_id}", status_code=204)
def delete_repair_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    task = db.get(RepairTask, task_id)
    if not task:
        raise HTTPException(404, "Repair task not found")

    db.query(PendingCartItem).filter(
        PendingCartItem.repair_task_id == task_id
    ).delete()

    db.delete(task)
    db.commit()
