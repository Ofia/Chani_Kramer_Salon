"""
Wash & Set Services — lookup table for W&S service types used in the Wash & Set page.

Routes:
  GET  /wash-set-services/   list all active wash & set services (sorted)
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import WashSetService, User
from app.schemas.schemas import WashSetServiceResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/wash-set-services", tags=["wash set services"])


@router.get("/", response_model=List[WashSetServiceResponse])
def list_wash_set_services(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(WashSetService)
        .filter(WashSetService.is_active == True)
        .order_by(WashSetService.sort_order)
        .all()
    )
