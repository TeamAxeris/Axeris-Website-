from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


class FlagSchema(BaseModel):
    flag_id: str
    category: str
    severity: str
    weight: float
    title: str
    description: str
    evidence_source: str
    suggested_action: str
    engine: str

    class Config:
        from_attributes = True


class AlternativeSchema(BaseModel):
    drug_id: str
    generic_name: str
    brand_name: Optional[str] = None
    equivalence_type: str
    dose_conversion: float
    evidence_level: str
    estimated_savings_pct: float
    notes: Optional[str] = None


class PrescriptionCreate(BaseModel):
    patient_id: str
    provider_id: str
    drug_id: str
    dose_mg: float
    frequency: str
    quantity: int
    days_supply: int
    refills_authorized: int = 0
    pharmacy_id: Optional[str] = None


class PrescriptionResponse(BaseModel):
    id: str
    patient_id: str
    provider_id: str
    drug_id: str
    dose_mg: float
    frequency: str
    quantity: int
    days_supply: int
    refills_authorized: int
    date_written: Optional[datetime] = None
    flag_color: Optional[str] = None
    risk_score: Optional[float] = None
    flags: Optional[List[FlagSchema]] = None
    status: str
    patient_name: str = ""
    provider_name: str = ""
    drug_name: str = ""
    # v8 fields
    disposition: Optional[str] = None
    hold_type: Optional[str] = None
    sla_deadline: Optional[datetime] = None
    operating_mode: Optional[str] = None
    processing_time_ms: Optional[int] = None
    # Truveta TDM MedicationRequest / MedicationDispense coding
    ndc11: Optional[str] = None
    rxnorm_code: Optional[str] = None
    sig: Optional[str] = None
    route: Optional[str] = None

    class Config:
        from_attributes = True


class DiagnosisSchema(BaseModel):
    icd10_code: str
    description: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class AllergySchema(BaseModel):
    allergen: str
    reaction_type: Optional[str] = None
    severity: Optional[str] = None

    class Config:
        from_attributes = True


class LabResultSchema(BaseModel):
    test_name: str
    value: float
    unit: Optional[str] = None
    date_collected: Optional[datetime] = None
    is_abnormal: bool = False

    class Config:
        from_attributes = True


class ActiveMedicationSchema(BaseModel):
    drug_id: str
    drug_name: str
    dose_mg: float
    frequency: str
    status: str

    class Config:
        from_attributes = True


class PatientContext(BaseModel):
    diagnoses: List[DiagnosisSchema] = []
    allergies: List[AllergySchema] = []
    recent_labs: List[LabResultSchema] = []
    active_medications: List[ActiveMedicationSchema] = []


class PrescriberInfo(BaseModel):
    """Full prescriber context for insurer review."""
    provider_id: str
    first_name: str
    last_name: str
    specialty: str
    npi: str
    dea_number: Optional[str] = None
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
    group_practice: Optional[str] = None
    # v8: federal exclusion screening
    is_excluded: Optional[bool] = False
    exclusion_source: Optional[str] = None
    exclusion_date: Optional[date] = None
    exclusion_reason: Optional[str] = None

    class Config:
        from_attributes = True


class PGxResultSchema(BaseModel):
    """v8: Pharmacogenomic test result for Patient context."""
    gene: str
    phenotype: str
    diplotype: Optional[str] = None
    test_date: Optional[date] = None
    cpic_level: str = "A"

    class Config:
        from_attributes = True


class REMSEnrollmentSchema(BaseModel):
    """v8: REMS program enrollment for Patient context."""
    rems_program: str
    enrollment_date: Optional[date] = None
    is_active: bool = True
    last_monitoring_date: Optional[date] = None

    class Config:
        from_attributes = True


class PrescriptionDetail(PrescriptionResponse):
    alternatives: List[AlternativeSchema] = []
    patient_context: Optional[PatientContext] = None
    prescriber_info: Optional[PrescriberInfo] = None
    polypharmacy_score: Optional[float] = None
    titration_info: Optional[dict] = None
    # v8 detail fields
    pgx_results: List[PGxResultSchema] = []
    rems_enrollments: List[REMSEnrollmentSchema] = []
    audit_trail: Optional[dict] = None


class PrescriptionActionRequest(BaseModel):
    action: str
    reason: Optional[str] = None
