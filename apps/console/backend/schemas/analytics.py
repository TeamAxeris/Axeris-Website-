from pydantic import BaseModel
from typing import Optional, List


class OverviewMetrics(BaseModel):
    total_prescriptions: int = 0
    flagged_count: int = 0
    flagged_percentage: float = 0.0
    green_count: int = 0
    yellow_count: int = 0
    red_count: int = 0
    total_cost_savings: float = 0.0
    safety_catches: int = 0
    pending_review_count: int = 0


class SavingsData(BaseModel):
    period: str
    potential_savings: float = 0.0
    realized_savings: float = 0.0
    prescription_count: int = 0


class TrendData(BaseModel):
    period: str
    green_count: int = 0
    yellow_count: int = 0
    red_count: int = 0
    total: int = 0


class FlaggedPrescriberSchema(BaseModel):
    provider_id: str
    provider_name: str
    specialty: str
    risk_score: float
    controlled_volume: int
    flagged_rx_count: int


class DoctorShoppingSchema(BaseModel):
    patient_id: str
    patient_name: str
    provider_count: int
    controlled_rx_count: int


class PharmacyAnomalySchema(BaseModel):
    pharmacy_id: str
    pharmacy_name: str
    anomaly_count: int
    avg_overcharge_pct: float


class FraudMetrics(BaseModel):
    flagged_prescribers: List[FlaggedPrescriberSchema] = []
    doctor_shopping_patients: List[DoctorShoppingSchema] = []
    pharmacy_anomalies: List[PharmacyAnomalySchema] = []
