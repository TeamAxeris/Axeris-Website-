from pydantic import BaseModel
from typing import Optional, List
from schemas.prescription import PrescriptionResponse


class ProviderResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    specialty: str
    npi: str
    dea_number: Optional[str] = None
    practice_location: Optional[str] = None

    # Clinic / contact info (insurer-facing)
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None
    clinic_city: Optional[str] = None
    clinic_state: Optional[str] = None
    clinic_zip: Optional[str] = None
    clinic_phone: Optional[str] = None
    clinic_fax: Optional[str] = None
    provider_email: Optional[str] = None
    license_state: Optional[str] = None
    board_certified: Optional[bool] = None
    accepting_patients: Optional[bool] = None
    group_practice: Optional[str] = None

    # Computed stats
    total_prescriptions: int = 0
    flagged_prescription_count: int = 0
    controlled_substance_volume: int = 0
    risk_score: float = 0.0

    class Config:
        from_attributes = True


class PeerComparisonSchema(BaseModel):
    specialty: str
    peer_avg_total_rx: float = 0
    peer_avg_controlled: float = 0
    peer_avg_flagged_pct: float = 0
    provider_total_rx: int = 0
    provider_controlled: int = 0
    provider_flagged_pct: float = 0


class FlagHistoryEntry(BaseModel):
    prescription_id: str
    date: Optional[str] = None
    flag_color: Optional[str] = None
    drug_name: str = ""
    flag_summary: str = ""


class ProviderDetail(ProviderResponse):
    prescriptions: List[PrescriptionResponse] = []
    peer_comparison: Optional[PeerComparisonSchema] = None
    flag_history: List[FlagHistoryEntry] = []
