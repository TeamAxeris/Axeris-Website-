"""
Validation data source manifest — Truveta (primary) + Kythera + public APIs.

Truveta Data Model (TDM) is the primary and only EHR/clinical validation
source. Table and field names below follow the TDM data dictionary
(CamelCase, ConceptId-coded fields). Documents which TDM fields Axeris uses
per table, mapped to the 24 clinical checks. Used for transparency on the
live demo and for the clinical validation study.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/data-sources", tags=["data-sources"])


VALIDATION_DATABASES = [
    {
        "id": "truveta",
        "name": "Truveta Data Model (TDM)",
        "vendor": "Truveta",
        "type": "De-identified EHR data with linked claims — primary clinical + validation source",
        "patients": "120M+ de-identified patients · 1.9B records · 87.4M eligible population · ~40 normalized tables (as of 2026-06-03)",
        "license": "Truveta Studio — secure analytics enclave (SQL / Python / R notebooks; no data egress)",
        "access": "Truveta Studio — controlled-access workspace; de-identified per Expert Determination (HIPAA §164.514(b))",
        "primary": True,
        "use_in_axeris": "Primary input for all 3 engines — every patient case, encounter, medication, lab, diagnosis, and claim example maps to TDM tables. Powers the patient-context layer (Engine 3) for false-positive suppression.",
        "tables_used": [
            {"table": "Person", "fields": ["Id", "BirthDateTime", "GenderConceptId", "RaceConceptId", "EthnicityConceptId", "MaritalStatusConceptId", "LanguageConceptId", "DeceasedDateTime"], "purpose": "Demographics for Beers (Check 13), pregnancy (Check 14), pediatric/geriatric (Check 9)"},
            {"table": "PersonAddress", "fields": ["PersonId", "State", "PostalCode", "PeriodStartDateTime", "PeriodEndDateTime"], "purpose": "Geographic outlier feature for pill-mill/network detection (Check 24)"},
            {"table": "Encounter", "fields": ["Id", "PersonId", "ClassConceptId", "StatusConceptId", "StartDateTime", "EndDateTime", "AdmitSourceConceptId", "DischargeDispositionConceptId", "LocationId"], "purpose": "Care-setting context; hospice/palliative exclusion (Check 21 naloxone)"},
            {"table": "Condition", "fields": ["Id", "PersonId", "CodeConceptId", "CategoryConceptId", "OnsetDateTime", "AbatementDateTime", "VerificationStatusConceptId"], "purpose": "Active ICD-10-CM / SNOMED diagnosis list for contraindication + indication checks (Check 12, GLP-1 watch)"},
            {"table": "MedicationRequest", "fields": ["Id", "PersonId", "MedicationCodeConceptId", "AuthoredOnDateTime", "DispenseQuantity", "DaysSupply", "NumberOfRefillsAllowed", "RouteConceptId", "DosageInstructionText"], "purpose": "Prescribed medication (RxNorm/NDC) — DDI, duplication, titration checks (Checks 1-3, 17)"},
            {"table": "MedicationDispense", "fields": ["Id", "PersonId", "MedicationCodeConceptId", "Quantity", "DaysSupply", "WhenHandedOverDateTime", "PharmacyId"], "purpose": "Actual fill for adherence (MPR), refill-too-soon, abandonment (Checks 18, 22)"},
            {"table": "LabResult", "fields": ["Id", "PersonId", "CodeConceptId", "ValueNumeric", "UnitConceptId", "ReferenceRangeLow", "ReferenceRangeHigh", "ResultDateTime", "InterpretationConceptId"], "purpose": "eGFR (renal, Checks 7-8), ALT/AST/INR (hepatic), K/Mg (QT, Check 4) — LOINC-coded"},
            {"table": "Observation", "fields": ["Id", "PersonId", "CodeConceptId", "ValueNumeric", "ValueConceptId", "UnitConceptId", "ObservationDateTime"], "purpose": "Vitals — weight (LOINC 29463-7) for weight-based dosing (Check 9); pain-agreement/palliative notes"},
            {"table": "AllergyIntolerance", "fields": ["Id", "PersonId", "SubstanceConceptId", "ReactionManifestationConceptId", "SeverityConceptId", "CriticalityConceptId", "VerificationStatusConceptId"], "purpose": "Cross-reactivity with severity/criticality (Check 11)"},
            {"table": "Genomic", "fields": ["PersonId", "GeneConceptId", "Diplotype", "PhenotypeConceptId", "AlleleConceptId", "InterpretationConceptId", "TestDateTime"], "purpose": "Pharmacogenomics (Check 15) — CYP2D6, CYP2C19, HLA-B*57:01, TPMT, DPYD"},
            {"table": "Immunization", "fields": ["Id", "PersonId", "VaccineCodeConceptId", "OccurrenceDateTime"], "purpose": "Immunocompromised-state context for biologic safety"},
            {"table": "Procedure", "fields": ["Id", "PersonId", "CodeConceptId", "PerformedDateTime", "StatusConceptId"], "purpose": "Procedure context (CPT/HCPCS) for site-of-care + PA prediction"},
            {"table": "Claim / ClaimLine", "fields": ["Id", "PersonId", "TypeConceptId", "BillingProviderId", "ServiceStartDateTime", "PlaceOfServiceConceptId", "RevenueCodeConceptId", "ChargeAmount", "AllowedAmount", "PaidAmount"], "purpose": "Linked claims for spread-pricing audit, cost-avoidance, and stop-loss forecasting"},
            {"table": "Coverage", "fields": ["Id", "PersonId", "PayerId", "PlanType", "PeriodStartDateTime", "PeriodEndDateTime"], "purpose": "Eligibility windows — post-termination leakage detection (834 lag)"},
        ],
    },
    {
        "id": "kythera",
        "name": "Kythera Wayfinder",
        "vendor": "Kythera Labs",
        "type": "Open claims (broader real-world coverage)",
        "patients": "310M patients · 9.7B claims",
        "license": "Commercial — for production retraining",
        "use_in_axeris": "Production ML retraining (Engine 2) — broadest real-world prescribing patterns",
        "tables_used": [
            {"table": "Practitioner Master", "fields": ["npi", "first_name", "last_name", "specialty_taxonomy", "license", "dea", "graduation_year"], "purpose": "Foundational LEIE cross-ref + ML peer-comparison cohort"},
            {"table": "Organization Master", "fields": ["org_npi", "org_name", "type", "address", "tax_id"], "purpose": "Practice-size proxy for pill mill detection (Check 24)"},
            {"table": "Facility Master", "fields": ["facility_id", "name", "address", "facility_type"], "purpose": "Site-of-care optimization for specialty drugs"},
            {"table": "Pharmacy Claims", "fields": ["fill_date", "ndc", "prescriber_npi", "pharmacy_npi", "pharmacy_ncpdp", "days_supply", "qty_dispensed", "patient_pay", "plan_paid", "drug_brand_indicator"], "purpose": "Primary input for all checks; pharmacy-prescriber-patient network for Check 24 DBSCAN"},
            {"table": "Medical Claims", "fields": ["service_date", "place_of_service", "rendering_npi", "billing_npi", "diagnosis_codes", "procedure_codes", "modifiers"], "purpose": "ICD-10 diagnosis history for contraindication checks (Check 12)"},
            {"table": "Diagnosis Master", "fields": ["icd10_code", "description", "category", "chronic_flag"], "purpose": "Drug-diagnosis match (Check 12)"},
            {"table": "Drug Master", "fields": ["ndc", "rxnorm_rxcui", "atc_code", "ingredient", "strength", "dosage_form", "schedule", "brand_name", "generic_name"], "purpose": "RxNorm normalization for therapeutic duplication (Check 17)"},
        ],
    },
]


PUBLIC_REFERENCE_SOURCES = [
    {"id": "nppes", "name": "NPPES NPI Registry", "url": "https://npiregistry.cms.hhs.gov/api/", "type": "Live REST API", "use": "Real-time prescriber identity verification"},
    {"id": "leie", "name": "HHS-OIG LEIE", "url": "https://oig.hhs.gov/exclusions/", "type": "Monthly CSV", "use": "Federal exclusion screening (every claim)"},
    {"id": "samgov", "name": "SAM.gov Exclusions", "url": "https://sam.gov/data-services", "type": "Daily API", "use": "Federal debarment cross-reference"},
    {"id": "nadac", "name": "CMS NADAC", "url": "https://data.medicaid.gov", "type": "Weekly CSV", "use": "Drug pricing benchmark for cost outliers"},
    {"id": "partd", "name": "CMS Medicare Part D PUF", "url": "https://data.cms.gov", "type": "Annual", "use": "1.2M prescriber peer-comparison baseline"},
    {"id": "rxnorm", "name": "NLM RxNorm", "url": "https://rxnav.nlm.nih.gov/REST/", "type": "Monthly", "use": "Drug normalization (NDC↔ingredient↔brand)"},
    {"id": "dailymed", "name": "FDA DailyMed", "url": "https://dailymed.nlm.nih.gov", "type": "Daily", "use": "FDA SPL labels — DDI, contraindications, REMS"},
    {"id": "orange_book", "name": "FDA Orange Book", "url": "https://www.fda.gov/drugs", "type": "Monthly", "use": "Generic therapeutic equivalence (Check 19)"},
    {"id": "purple_book", "name": "FDA Purple Book", "url": "https://purplebooksearch.fda.gov", "type": "Monthly", "use": "Biosimilar interchangeability (Check 19)"},
    {"id": "credible_meds", "name": "CredibleMeds", "url": "https://crediblemeds.org", "type": "Continuous", "use": "QT prolongation tier classification (Check 4)"},
    {"id": "cpic", "name": "CPIC Guidelines", "url": "https://cpicpgx.org/guidelines/", "type": "Versioned JSON", "use": "Pharmacogenomic clinical actions (Check 15)"},
    {"id": "cdc_2022", "name": "CDC 2022 Opioid Guideline", "url": "https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm", "type": "Static reference", "use": "MME thresholds + naloxone (Checks 20-21)"},
    {"id": "beers", "name": "AGS Beers Criteria 2023", "url": "https://doi.org/10.1111/jgs.18372", "type": "Open access PDF", "use": "Geriatric safety (Check 13)"},
]


@router.get("/manifest")
def data_source_manifest():
    """Full manifest of validation databases + public APIs powering Axeris."""
    return {
        "validation_databases": VALIDATION_DATABASES,
        "public_reference_sources": PUBLIC_REFERENCE_SOURCES,
        "ml_engine": {
            "training_corpus": "Truveta TDM de-identified EHR + linked claims (primary) + Kythera Wayfinder open claims (production breadth)",
            "patient_context_corpus": "Truveta TDM de-identified EHR (~40 normalized tables, accessed in Truveta Studio)",
            "models": [
                {"name": "XGBoost", "purpose": "Claim-level fraud probability (0-1)", "features": "refill timing, time-to-fill, prescriber-drug novelty, patient pharmacy count, geographic distance, NDC vs NADAC"},
                {"name": "LightGBM", "purpose": "Prescriber-level anomaly vs specialty peers", "features": "ATC volume, brand rate, controlled rate, MME per patient, cost deviation, geographic outlier"},
                {"name": "Isolation Forest", "purpose": "Outlier feature for supervised models", "params": "contamination=0.05, 300 estimators"},
                {"name": "DBSCAN", "purpose": "Prescriber-pharmacy-patient network clusters", "params": "Jaccard distance on patient overlap, eps=0.15, min_samples=5"},
                {"name": "Meta-learner (LR)", "purpose": "Combine XGBoost + LightGBM into ANOMALY_SCORE", "features": "stacked predictions"},
                {"name": "BioClinicalBERT + PubMedBERT (Engine 3)", "purpose": "Patient context — false positive suppression", "use": "Dual-model arbitration on flagged claims; restricted to context-reading"},
            ],
            "explainability": "SHAP TreeExplainer per claim",
        },
    }


@router.get("/validation-databases")
def list_validation_databases():
    return VALIDATION_DATABASES


@router.get("/validation-databases/{db_id}")
def get_validation_database(db_id: str):
    db = next((d for d in VALIDATION_DATABASES if d["id"] == db_id), None)
    if not db:
        return {"error": "not_found"}
    return db
