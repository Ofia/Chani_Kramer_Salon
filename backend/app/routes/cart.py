"""
Pending Cart routes — /api/v1/cart

Each department adds items to a customer's open cart here.
Front desk loads the cart at POS checkout via GET /cart/{customer_id}.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import get_current_user
from app.models.models import PendingCartItem, CartItemStatus, Customer, InventoryItem
from app.schemas.schemas import CartItemCreate, CartItemUpdate, CartItemResponse

router = APIRouter(prefix="/cart", tags=["cart"])


def _build_response(item: PendingCartItem) -> CartItemResponse:
    """Resolve convenience fields from relationships before serialising."""
    data = CartItemResponse.model_validate(item)
    if item.customer:
        data.customer_name = f"{item.customer.first_name} {item.customer.last_name}"
    if item.inventory_item:
        data.inventory_item_name = item.inventory_item.name
        # Populate wig specs so POS can pre-fill cart rows without extra fetches
        if item.item_type.value == "wig":
            data.wig_serial = item.inventory_item.daysmart_serial
            data.wig_brand  = item.inventory_item.brand
            data.wig_length = item.inventory_item.length
            data.wig_color  = item.inventory_item.color
            data.wig_size   = item.inventory_item.size
            data.wig_front  = item.inventory_item.front
    # For repair/service items linked to a repair order that has a wig — surface the serial
    if not data.wig_serial and item.repair_order and item.repair_order.inventory_item:
        data.wig_serial = item.repair_order.inventory_item.daysmart_serial
    if item.sales_rep:
        data.sales_rep_name = f"{item.sales_rep.first_name} {item.sales_rep.last_name}"
    return data


@router.post("/", response_model=CartItemResponse, status_code=201)
def add_cart_item(
    payload: CartItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Add one item to a customer's pending cart."""
    # Validate customer exists
    customer = db.get(Customer, payload.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Validate inventory item exists when provided
    if payload.inventory_item_id:
        inv = db.get(InventoryItem, payload.inventory_item_id)
        if not inv:
            raise HTTPException(status_code=404, detail="Inventory item not found")

    item = PendingCartItem(
        customer_id=payload.customer_id,
        item_type=payload.item_type,
        inventory_item_id=payload.inventory_item_id,
        description=payload.description,
        price=payload.price,
        tax_rate=payload.tax_rate,
        discount_amount=payload.discount_amount,
        notes=payload.notes,
        department=payload.department,
        sales_rep_id=payload.sales_rep_id,
        repair_order_id=payload.repair_order_id,
        created_by=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _build_response(item)


@router.get("/active", response_model=list[CartItemResponse])
def list_all_active(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Return all pending cart items across all customers (for Active Carts view)."""
    items = (
        db.query(PendingCartItem)
        .filter(PendingCartItem.status == CartItemStatus.pending)
        .order_by(PendingCartItem.customer_id, PendingCartItem.created_at)
        .all()
    )
    return [_build_response(i) for i in items]


@router.get("/{customer_id}", response_model=list[CartItemResponse])
def get_cart(
    customer_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Return all pending cart items for a customer."""
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    items = (
        db.query(PendingCartItem)
        .filter(
            PendingCartItem.customer_id == customer_id,
            PendingCartItem.status == CartItemStatus.pending,
        )
        .order_by(PendingCartItem.created_at)
        .all()
    )
    return [_build_response(i) for i in items]


@router.patch("/{item_id}", response_model=CartItemResponse)
def update_cart_item(
    item_id: UUID,
    payload: CartItemUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Edit price, tax, discount, notes, or status on a cart item."""
    item = db.get(PendingCartItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return _build_response(item)


@router.delete("/{item_id}", status_code=204)
def remove_cart_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Remove an item from the pending cart."""
    item = db.get(PendingCartItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    db.delete(item)
    db.commit()
