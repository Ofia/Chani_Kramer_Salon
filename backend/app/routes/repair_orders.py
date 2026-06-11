"""
Repair Orders routes — /api/v1/repair-orders

Repairs staff creates a repair order (customer + wig + metadata).
Services are added to the customer's pending cart linked to this order.
Front desk checks out the cart at POS.
"""

from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import get_current_user
from app.models.models import (
    RepairOrder, RepairOrderStatus,
    PendingCartItem, CartItemType, CartItemStatus,
    Customer, InventoryItem, Provider,
)
from app.schemas.schemas import (
    RepairOrderCreate, RepairOrderUpdate, RepairOrderResponse,
    CartItemCreate, CartItemResponse,
)

router = APIRouter(prefix="/repair-orders", tags=["repair-orders"])


def _build_response(order: RepairOrder, db: Session) -> RepairOrderResponse:
    data = RepairOrderResponse.model_validate(order)

    # Resolve customer full name (from FK or stored text)
    if order.customer:
        data.customer_full_name = f"{order.customer.first_name} {order.customer.last_name}"
    elif order.customer_name:
        data.customer_full_name = order.customer_name

    # Wig serial from inventory link
    if order.inventory_item:
        data.wig_serial = order.inventory_item.daysmart_serial

    # External provider name
    if order.external_provider:
        data.external_provider_name = order.external_provider.name

    # Count linked pending cart items
    data.cart_item_count = (
        db.query(PendingCartItem)
        .filter(
            PendingCartItem.repair_order_id == order.id,
            PendingCartItem.status == CartItemStatus.pending,
        )
        .count()
    )
    return data


@router.post("/", response_model=RepairOrderResponse, status_code=201)
def create_repair_order(
    payload: RepairOrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Open a new repair order."""
    if payload.customer_id:
        if not db.get(Customer, payload.customer_id):
            raise HTTPException(status_code=404, detail="Customer not found")

    if payload.inventory_item_id:
        if not db.get(InventoryItem, payload.inventory_item_id):
            raise HTTPException(status_code=404, detail="Inventory item not found")

    if payload.external_provider_id:
        if not db.get(Provider, payload.external_provider_id):
            raise HTTPException(status_code=404, detail="Provider not found")

    order = RepairOrder(
        **payload.model_dump(),
        created_by=current_user.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return _build_response(order, db)


@router.get("/", response_model=list[RepairOrderResponse])
def list_repair_orders(
    status: Optional[RepairOrderStatus] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """List repair orders, optionally filtered by status."""
    q = db.query(RepairOrder)
    if status:
        q = q.filter(RepairOrder.status == status)
    orders = q.order_by(RepairOrder.created_at.desc()).all()
    return [_build_response(o, db) for o in orders]


@router.get("/{order_id}", response_model=RepairOrderResponse)
def get_repair_order(
    order_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    order = db.get(RepairOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return _build_response(order, db)


@router.patch("/{order_id}", response_model=RepairOrderResponse)
def update_repair_order(
    order_id: UUID,
    payload: RepairOrderUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    order = db.get(RepairOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Repair order not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(order, field, value)

    db.commit()
    db.refresh(order)
    return _build_response(order, db)


@router.delete("/{order_id}", status_code=204)
def delete_repair_order(
    order_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Delete a repair order and unlink its cart items."""
    order = db.get(RepairOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Repair order not found")

    # Unlink cart items (repair_order_id → NULL, items stay in cart)
    db.query(PendingCartItem).filter(
        PendingCartItem.repair_order_id == order_id
    ).update({"repair_order_id": None})

    db.delete(order)
    db.commit()
