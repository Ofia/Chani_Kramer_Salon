"""
Repair Services — lookup table for repair types used in POS dropdowns.

Routes:
  GET  /repair-services/   list all active repair services (sorted)
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import RepairService, User
from app.schemas.schemas import RepairServiceResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/repair-services", tags=["repair services"])


@router.get("/", response_model=List[RepairServiceResponse])
def list_repair_services(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(RepairService)
        .filter(RepairService.is_active == True)
        .order_by(RepairService.sort_order)
        .all()
    )
