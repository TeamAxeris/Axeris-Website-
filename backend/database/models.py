from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Date, DateTime, JSON,
    ForeignKey, Text
)
from sqlalchemy.orm import relationship
from database.database import Base


class Patient(Base):
    __tablename__ = "patients"
    id = Column(String, primary_key=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String)
    weight_kg = Column(Float)
    height_cm = Column(Float)

    # Truveta TDM Person / PersonAddress alignment
    race = Column(String, nullable=True)                # TDM Person.RaceConceptId (OMB category)
    ethnicity = Column(String, nullable=True)           # TDM Person.EthnicityConceptId
    marital_status = Column(String, nullable=True)      # TDM Person.MaritalStatusConceptId
    preferred_language = Column(String, nullable=True)  # TDM Person.LanguageConceptId
    state = Column(String, nullable=True)               # TDM PersonAddress.State
    postal_code = Column(String, nullable=True)         # TDM PersonAddress.PostalCode
    is_deceased = Column(Boolean, default=False)        # TDM Person.DeathDateTime presence

    diagnoses = relationship("Diagnosis", back_populates="patient")
    allergies = relationship("Allergy", back_populates="patient")
    lab_results = relationship("LabResult", back_populates="patient")
    prescriptions = relationship("Prescription", back_populates="patient")
    insurance_claims = relationship("InsuranceClaim", back_populates="patient")
    pgx_results = relationship("PGxResult", back_populates="patient")
    rems_enrollments = relationship("REMSEnrollment", back_populates="patient")


class Encounter(Base):
    """Truveta TDM Encounter — visit context (class, facility, disposition)."""
    __tablename__ = "encounters"
    id = Column(String, primary_key=True)
    patient_id = Column(String, ForeignKey("patients.id"), index=True)
    encounter_class = Column(String)                    # TDM ClassConceptId: ambulatory/emergency/inpatient/telehealth
    status = Column(String, default="finished")         # TDM StatusConceptId
    start_date = Column(DateTime)                       # TDM StartDateTime
    end_date = Column(DateTime, nullable=True)          # TDM EndDateTime
    facility_name = Column(String, nullable=True)       # TDM LocationId → Location.Name
    admit_source = Column(String, nullable=True)        # TDM AdmitSourceConceptId
    discharge_disposition = Column(String, nullable=True)  # TDM DischargeDispositionConceptId

    patient = relationship("Patient")


class PGxResult(Base):
    """Pharmacogenomics test results — Check 15 (CPIC Level A guidelines)."""
    __tablename__ = "pgx_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"))
    gene = Column(String, nullable=False)  # CYP2D6, CYP2C19, CYP2C9, SLCO1B1, HLA-B*57:01, TPMT, DPYD
    phenotype = Column(String, nullable=False)  # poor_metabolizer, intermediate, normal, rapid, ultrarapid, positive, negative
    diplotype = Column(String, nullable=True)  # e.g., "*1/*4"
    test_date = Column(Date, nullable=True)
    cpic_level = Column(String, default="A")  # CPIC evidence level
    source = Column(String, default="lab_report")

    patient = relationship("Patient", back_populates="pgx_results")


class REMSEnrollment(Base):
    """REMS program enrollment — Check 16 (iPLEDGE, clozapine REMS, etc)."""
    __tablename__ = "rems_enrollments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"))
    rems_program = Column(String, nullable=False)  # iPLEDGE, CLOZAPINE_REMS, TIRF_REMS, SODIUM_OXYBATE_REMS
    enrollment_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    last_monitoring_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    patient = relationship("Patient", back_populates="rems_enrollments")


class Diagnosis(Base):
    __tablename__ = "diagnoses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"))
    icd10_code = Column(String, nullable=False)
    description = Column(String)
    date_diagnosed = Column(Date)
    is_active = Column(Boolean, default=True)

    patient = relationship("Patient", back_populates="diagnoses")


class Allergy(Base):
    __tablename__ = "allergies"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"))
    allergen = Column(String, nullable=False)
    reaction_type = Column(String)
    severity = Column(String)
    cross_reactivity_group = Column(String)

    patient = relationship("Patient", back_populates="allergies")


class LabResult(Base):
    __tablename__ = "lab_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"))
    test_name = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String)
    reference_range_low = Column(Float)
    reference_range_high = Column(Float)
    date_collected = Column(DateTime)
    is_abnormal = Column(Boolean, default=False)

    patient = relationship("Patient", back_populates="lab_results")


class Provider(Base):
    __tablename__ = "providers"
    id = Column(String, primary_key=True)
    first_name = Column(String)
    last_name = Column(String)
    npi = Column(String, unique=True)
    specialty = Column(String)
    dea_number = Column(String)
    practice_location = Column(String)

    # Enhanced fields for insurer context
    clinic_name = Column(String, nullable=True)
    clinic_address = Column(String, nullable=True)
    clinic_city = Column(String, nullable=True)
    clinic_state = Column(String, nullable=True)
    clinic_zip = Column(String, nullable=True)
    clinic_phone = Column(String, nullable=True)
    clinic_fax = Column(String, nullable=True)
    provider_email = Column(String, nullable=True)
    license_state = Column(String, nullable=True)
    board_certified = Column(Boolean, default=True)
    accepting_patients = Column(Boolean, default=True)
    group_practice = Column(String, nullable=True)  # Medical group affiliation

    # v8: HHS-OIG LEIE / SAM.gov exclusion screening
    is_excluded = Column(Boolean, default=False)             # On federal exclusion list
    exclusion_source = Column(String, nullable=True)         # LEIE, SAM_GOV, STATE_BOARD
    exclusion_date = Column(Date, nullable=True)
    exclusion_reason = Column(String, nullable=True)         # E.g., "Medicare fraud (1128(a)(1))"
    exclusion_reinstatement_date = Column(Date, nullable=True)

    prescriptions = relationship("Prescription", back_populates="provider")


class ExcludedProvider(Base):
    """HHS-OIG LEIE and SAM.gov federal exclusion list (Foundational Layer screening)."""
    __tablename__ = "excluded_providers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    npi = Column(String, index=True)
    last_name = Column(String)
    first_name = Column(String)
    business_name = Column(String, nullable=True)
    exclusion_source = Column(String, nullable=False)        # LEIE, SAM_GOV
    exclusion_type = Column(String, nullable=False)          # mandatory, permissive
    exclusion_date = Column(Date, nullable=True)
    reinstatement_date = Column(Date, nullable=True)
    reason_code = Column(String, nullable=True)              # E.g., "1128(a)(1)" - Medicare fraud
    reason_description = Column(String, nullable=True)
    state = Column(String, nullable=True)
    last_synced = Column(DateTime, nullable=True)


class Pharmacy(Base):
    __tablename__ = "pharmacies"
    id = Column(String, primary_key=True)
    name = Column(String)
    address = Column(String)
    ncpdp_id = Column(String)
    pharmacy_type = Column(String)


class Drug(Base):
    __tablename__ = "drugs"
    id = Column(String, primary_key=True)
    generic_name = Column(String, nullable=False)
    brand_name = Column(String)
    drug_class = Column(String)
    therapeutic_category = Column(String)
    schedule = Column(String)
    formulation = Column(String)
    strength = Column(String)
    route = Column(String)
    bioavailability = Column(Float)
    half_life_hours = Column(Float)
    requires_titration = Column(Boolean, default=False)
    titration_schedule = Column(JSON, nullable=True)
    max_daily_dose_mg = Column(Float)
    min_daily_dose_mg = Column(Float)
    renal_adjustment_required = Column(Boolean, default=False)
    hepatic_adjustment_required = Column(Boolean, default=False)
    egfr_threshold = Column(Float, nullable=True)
    average_cost_per_unit = Column(Float)
    generic_available = Column(Boolean, default=False)
    approved_indications = Column(JSON, nullable=True)
    cross_reactivity_groups = Column(JSON, nullable=True)

    # New fields for spec-aligned clinical checks
    qt_prolongation_risk = Column(Boolean, default=False)       # QT prolongation stacking check
    serotonergic = Column(Boolean, default=False)               # Serotonergic syndrome risk check
    beers_criteria = Column(Boolean, default=False)             # Potentially inappropriate for elderly (AGS Beers 2023)
    pregnancy_risk = Column(String, nullable=True)              # X=contraindicated, D=positive evidence of risk, C=risk not ruled out, B=no risk, A=safe
    is_specialty = Column(Boolean, default=False)               # High-cost specialty drug (>$1000/month)
    mme_conversion_factor = Column(Float, nullable=True)        # Morphine milligram equivalent factor for opioids
    narrow_therapeutic_index = Column(Boolean, default=False)   # NTI drugs where brand-to-generic consistency matters

    # v8 fields: PGx (Check 15) and REMS (Check 16)
    pgx_gene = Column(String, nullable=True)                    # Gene that affects metabolism (e.g., CYP2D6, CYP2C19)
    pgx_risk_phenotype = Column(String, nullable=True)          # Phenotype that triggers risk (e.g., "poor_metabolizer")
    pgx_clinical_action = Column(String, nullable=True)         # Required action: avoid, dose_reduce, alternative, monitor
    pgx_evidence = Column(String, nullable=True)                # CPIC level + citation
    rems_program = Column(String, nullable=True)                # REMS program required (iPLEDGE, CLOZAPINE_REMS, etc.)
    is_opioid = Column(Boolean, default=False)                  # True for opioid analgesics (for Naloxone Check 21)
    is_naloxone = Column(Boolean, default=False)                # True for naloxone products
    nadac_price = Column(Float, nullable=True)                  # CMS NADAC weekly benchmark price
    biosimilar_available = Column(Boolean, default=False)
    vial_sizes_mg = Column(JSON, nullable=True)             # every vial presentation in mg, for waste math
    is_interchangeable = Column(Boolean, default=False)     # FDA interchangeable biosimilar (Purple Book)       # FDA Purple Book biosimilar exists


class DrugInteraction(Base):
    __tablename__ = "drug_interactions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    drug_a_id = Column(String, ForeignKey("drugs.id"))
    drug_b_id = Column(String, ForeignKey("drugs.id"))
    severity = Column(String)
    description = Column(Text)
    clinical_effect = Column(Text)
    management = Column(Text)

    drug_a = relationship("Drug", foreign_keys=[drug_a_id])
    drug_b = relationship("Drug", foreign_keys=[drug_b_id])


class TherapeuticEquivalence(Base):
    __tablename__ = "therapeutic_equivalences"
    id = Column(Integer, primary_key=True, autoincrement=True)
    drug_a_id = Column(String, ForeignKey("drugs.id"))
    drug_b_id = Column(String, ForeignKey("drugs.id"))
    equivalence_type = Column(String)
    dose_conversion_factor = Column(Float)
    evidence_level = Column(String)
    cost_difference_pct = Column(Float)
    notes = Column(Text)

    drug_a = relationship("Drug", foreign_keys=[drug_a_id])
    drug_b = relationship("Drug", foreign_keys=[drug_b_id])


class Prescription(Base):
    __tablename__ = "prescriptions"
    id = Column(String, primary_key=True)
    patient_id = Column(String, ForeignKey("patients.id"))
    provider_id = Column(String, ForeignKey("providers.id"))
    pharmacy_id = Column(String, ForeignKey("pharmacies.id"), nullable=True)
    drug_id = Column(String, ForeignKey("drugs.id"))
    dose_mg = Column(Float)
    frequency = Column(String)
    quantity = Column(Integer)
    days_supply = Column(Integer)
    refills_authorized = Column(Integer, default=0)
    date_written = Column(DateTime)
    date_filled = Column(DateTime, nullable=True)
    is_refill = Column(Boolean, default=False)
    original_rx_id = Column(String, nullable=True)

    flag_color = Column(String, nullable=True)
    risk_score = Column(Float, nullable=True)
    flags = Column(JSON, nullable=True)
    analysis_timestamp = Column(DateTime, nullable=True)
    status = Column(String, default="pending")

    # v8: Disposition (APPROVE/REVIEW/FLAG) + hold logic
    disposition = Column(String, nullable=True)              # APPROVE, REVIEW, FLAG
    hold_type = Column(String, nullable=True)                # soft_hold (auto-release SLA), hard_hold (explicit resolution)
    sla_deadline = Column(DateTime, nullable=True)           # Auto-release deadline for soft holds
    auto_released = Column(Boolean, default=False)
    operating_mode = Column(String, default="TPA")           # TPA or PBA mode
    processing_time_ms = Column(Integer, nullable=True)      # Total engine pipeline latency
    audit_trail = Column(JSON, nullable=True)                # Full evidence chain for ERISA

    # Truveta TDM MedicationRequest / MedicationDispense coding
    ndc11 = Column(String, nullable=True)                    # TDM MedicationCodeConceptMap → NDC-11
    rxnorm_code = Column(String, nullable=True)              # TDM RxNorm RXCUI
    sig = Column(String, nullable=True)                      # TDM MedicationRequest dosage instruction
    route = Column(String, nullable=True)                    # TDM RouteConceptId

    patient = relationship("Patient", back_populates="prescriptions")
    provider = relationship("Provider", back_populates="prescriptions")
    drug = relationship("Drug")
    pharmacy = relationship("Pharmacy")


class InsuranceClaim(Base):
    __tablename__ = "insurance_claims"
    id = Column(String, primary_key=True)
    prescription_id = Column(String, ForeignKey("prescriptions.id"))
    patient_id = Column(String, ForeignKey("patients.id"))
    billed_amount = Column(Float)
    allowed_amount = Column(Float)
    paid_amount = Column(Float)
    copay_amount = Column(Float)
    claim_date = Column(DateTime)
    claim_status = Column(String)
    denial_reason = Column(String, nullable=True)
    pharmacy_id = Column(String, ForeignKey("pharmacies.id"))

    # Truveta TDM Claim / ClaimLine alignment
    claim_type = Column(String, default="Pharmacy")     # TDM Claim.TypeConceptId
    place_of_service = Column(String, nullable=True)    # TDM ClaimLine.PlaceOfServiceConceptId
    hcpcs_code = Column(String, nullable=True)          # J-code for provider-administered drugs

    patient = relationship("Patient", back_populates="insurance_claims")
    prescription = relationship("Prescription")


class PrescriptionAction(Base):
    __tablename__ = "prescription_actions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_id = Column(String, ForeignKey("prescriptions.id"))
    action = Column(String)
    reason = Column(String, nullable=True)
    performed_by = Column(String)
    timestamp = Column(DateTime)


class PbaActionEvent(Base):
    """PBA workflow actions — callback resolutions, pharmacy audit scheduling,
    member outreach, savings conversions. Gives the PBA mode's buttons real,
    persistent effect. New table: create_all adds it on startup without
    touching existing data."""
    __tablename__ = "pba_action_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String)                 # callback | pharmacy | member | savings
    entity_id = Column(String, index=True)       # rx_id / pharmacy_id / patient_id
    action = Column(String)                      # resolve | schedule_audit | care_outreach | escalate_md | convert
    detail = Column(String, nullable=True)
    savings_usd = Column(Float, nullable=True)   # realized annualized savings (convert actions)
    performed_by = Column(String, default="demo.pharmacist")
    created_at = Column(DateTime)
