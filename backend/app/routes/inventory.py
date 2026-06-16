"""
Inventory — unified wig + product stock management.
Accessible by bookkeeper and owner roles only.

Routes:
  GET    /inventory/                    list all items (filter by item_type, wig_status)
  POST   /inventory/                    create item (wig or product)
  GET    /inventory/{id}                get single item
  PATCH  /inventory/{id}                update item fields
  DELETE /inventory/{id}                delete item

  GET    /inventory/{id}/events         get history log for an item
  POST   /inventory/{id}/events         append an event to the history log

  GET    /inventory/brand-markups       list all brand markups
  POST   /inventory/brand-markups       create or update a brand markup
  DELETE /inventory/brand-markups/{id}  delete a brand markup
"""

from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    InventoryItem, InventoryEvent, BrandMarkup,
    InventoryItemType, WigItemStatus, WigStatus, UserRole, User
)
from app.schemas.schemas import (
    InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse,
    BrandMarkupCreate, BrandMarkupUpdate, BrandMarkupResponse,
    InventoryEventCreate, InventoryEventResponse,
)
from app.core.security import get_current_user

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _require_bookkeeper_or_owner(current_user: User):
    if current_user.role not in (UserRole.bookkeeper, UserRole.owner):
        raise HTTPException(status_code=403, detail="Bookkeeper or owner role required")


# ── Items ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[InventoryItemResponse])
def list_inventory(
    item_type: Optional[InventoryItemType] = Query(None),
    wig_status: Optional[WigItemStatus] = Query(None),
    brand: Optional[str] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    serial: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(InventoryItem)
    if item_type:
        q = q.filter(InventoryItem.item_type == item_type)
    if wig_status:
        q = q.filter(InventoryItem.wig_status == wig_status)
    if brand:
        q = q.filter(InventoryItem.brand.ilike(f"%{brand}%"))
    if customer_id:
        q = q.filter(InventoryItem.customer_id == customer_id)
    if serial:
        q = q.filter(InventoryItem.daysmart_serial.ilike(f"%{serial}%"))
    return q.order_by(InventoryItem.created_at.desc()).all()


@router.get("/brand-markups", response_model=List[BrandMarkupResponse])
def list_brand_markups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(BrandMarkup).order_by(BrandMarkup.brand).all()


@router.get("/{item_id}", response_model=InventoryItemResponse)
def get_inventory_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return item


@router.post("/", response_model=InventoryItemResponse, status_code=201)
def create_inventory_item(
    data: InventoryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_bookkeeper_or_owner(current_user)

    # Default wig_status when creating a wig
    payload = data.model_dump()
    if payload["item_type"] == InventoryItemType.wig and payload.get("wig_status") is None:
        # Historical/external wigs (already owned by customer) come in as paid_in_full → mark sold
        if payload.get("sale_status") == WigStatus.paid_in_full:
            payload["wig_status"] = WigItemStatus.sold
        else:
            payload["wig_status"] = WigItemStatus.in_stock

    item = InventoryItem(**payload, created_by=current_user.id)
    db.add(item)
    db.flush()

    # Auto-log an "arrived" event when a wig is created
    if item.item_type == InventoryItemType.wig:
        event = InventoryEvent(
            inventory_item_id=item.id,
            event_type="arrived",
            description=f"Wig added to inventory. Supplier: {item.supplier or '—'}",
            event_date=item.arrival_date or date.today(),
            created_by=current_user.id,
        )
        db.add(event)

    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=InventoryItemResponse)
def update_inventory_item(
    item_id: UUID,
    data: InventoryItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_bookkeeper_or_owner(current_user)
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    old_status = item.wig_status
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    # Auto-log a status change event
    new_status = item.wig_status
    if old_status != new_status and new_status is not None:
        status_event_map = {
            WigItemStatus.sold: "sold",
            WigItemStatus.on_service: "service",
            WigItemStatus.damaged: "damaged",
            WigItemStatus.returned_to_supplier: "returned",
            WigItemStatus.transferred: "transferred",
            WigItemStatus.in_stock: "note",
        }
        event = InventoryEvent(
            inventory_item_id=item.id,
            event_type=status_event_map.get(new_status, "note"),
            description=f"Status changed: {old_status} → {new_status}",
            event_date=date.today(),
            created_by=current_user.id,
        )
        db.add(event)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_inventory_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_bookkeeper_or_owner(current_user)
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    db.delete(item)
    db.commit()


# ── Events (History Log) ──────────────────────────────────────────────────

@router.get("/{item_id}/events", response_model=List[InventoryEventResponse])
def list_item_events(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return (
        db.query(InventoryEvent)
        .filter(InventoryEvent.inventory_item_id == item_id)
        .order_by(InventoryEvent.event_date.asc(), InventoryEvent.created_at.asc())
        .all()
    )


@router.post("/{item_id}/events", response_model=InventoryEventResponse, status_code=201)
def add_item_event(
    item_id: UUID,
    data: InventoryEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_bookkeeper_or_owner(current_user)
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    event = InventoryEvent(
        inventory_item_id=item_id,
        event_date=data.event_date or date.today(),
        created_by=current_user.id,
        **data.model_dump(exclude={"event_date"}),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


# ── Brand Markups ─────────────────────────────────────────────────────────

@router.post("/brand-markups", response_model=BrandMarkupResponse, status_code=201)
def upsert_brand_markup(
    data: BrandMarkupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update markup for a brand (upsert by brand name)."""
    _require_bookkeeper_or_owner(current_user)
    existing = db.query(BrandMarkup).filter(BrandMarkup.brand == data.brand).first()
    if existing:
        existing.markup_pct = data.markup_pct
        db.commit()
        db.refresh(existing)
        return existing
    markup = BrandMarkup(**data.model_dump())
    db.add(markup)
    db.commit()
    db.refresh(markup)
    return markup


@router.delete("/brand-markups/{markup_id}", status_code=204)
def delete_brand_markup(
    markup_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_bookkeeper_or_owner(current_user)
    markup = db.query(BrandMarkup).filter(BrandMarkup.id == markup_id).first()
    if not markup:
        raise HTTPException(status_code=404, detail="Brand markup not found")
    db.delete(markup)
    db.commit()
