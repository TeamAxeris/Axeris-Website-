from pydantic import BaseModel
from typing import Optional, List
from schemas.prescription import AlternativeSchema


class DrugResponse(BaseModel):
    id: str
    generic_name: str
    brand_name: Optional[str] = None
    drug_class: str
    therapeutic_category: str
    schedule: str
    formulation: str
    strength: str
    route: Optional[str] = None
    average_cost_per_unit: float = 0.0
    generic_available: bool = False
    requires_titration: bool = False
    max_daily_dose_mg: Optional[float] = None
    min_daily_dose_mg: Optional[float] = None

    class Config:
        from_attributes = True


class DrugAlternatives(BaseModel):
    drug: DrugResponse
    alternatives: List[AlternativeSchema] = []
