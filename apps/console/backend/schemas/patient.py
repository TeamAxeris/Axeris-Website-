from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from schemas.prescription import (
    DiagnosisSchema, AllergySchema, LabResultSchema,
    PrescriptionResponse, ActiveMedicationSchema
)


class PatientResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: Optional[str] = None
    # Truveta TDM Person / PersonAddress fields
    race: Optional[str] = None
    ethnicity: Optional[str] = None
    marital_status: Optional[str] = None
    preferred_language: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    is_deceased: bool = False
    active_diagnoses: List[DiagnosisSchema] = []
    allergy_count: int = 0
    active_medication_count: int = 0
    polypharmacy_risk_score: Optional[float] = None
    adherence_score: Optional[float] = None
    doctor_shopping_flag: bool = False

    class Config:
        from_attributes = True


class EncounterSchema(BaseModel):
    id: str
    encounter_class: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    facility_name: Optional[str] = None
    admit_source: Optional[str] = None
    discharge_disposition: Optional[str] = None


class MedicationTimelineEntry(BaseModel):
    drug_name: str
    drug_id: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    dose_mg: float
    frequency: str
    status: str


class InteractionMapEntry(BaseModel):
    drug_a: str
    drug_b: str
    severity: str
    description: str


class PatientDetail(PatientResponse):
    allergies: List[AllergySchema] = []
    lab_results: List[LabResultSchema] = []
    prescriptions: List[PrescriptionResponse] = []
    medication_timeline: List[MedicationTimelineEntry] = []
    interaction_map: List[InteractionMapEntry] = []
    encounters: List[EncounterSchema] = []
