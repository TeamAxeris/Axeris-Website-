"""
Mock data seeder — generates 50 patients, 20 providers, 12 pharmacies,
200+ prescriptions with deliberate RED/YELLOW/GREEN scenarios.
"""

import hashlib
import json
import random
import os
from datetime import datetime, timedelta, date
from database.database import SessionLocal
from database.models import (
    Patient, Diagnosis, Allergy, LabResult, Provider, Pharmacy,
    Drug, DrugInteraction, TherapeuticEquivalence, Prescription,
    InsuranceClaim, PGxResult, REMSEnrollment, ExcludedProvider, Encounter
)

random.seed(42)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

FIRST_NAMES_M = ["James", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Daniel",
                  "Matthew", "Anthony", "Mark", "Steven", "Paul", "Andrew", "Kenneth", "George", "Edward", "Brian"]
FIRST_NAMES_F = ["Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Elizabeth", "Susan", "Jessica", "Sarah", "Karen",
                  "Lisa", "Nancy", "Betty", "Margaret", "Sandra", "Ashley", "Dorothy", "Kimberly", "Emily", "Donna"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
              "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
              "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"]

SPECIALTIES = ["Internal Medicine", "Family Medicine", "Pain Management", "Cardiology",
               "Endocrinology", "Psychiatry", "Pulmonology", "Rheumatology"]


def _rand_date(start_year=2024, end_year=2025):
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def _rand_dob(min_age, max_age):
    now = date.today()
    age = random.randint(min_age, max_age)
    return date(now.year - age, random.randint(1, 12), random.randint(1, 28))


def seed_if_empty():
    db = SessionLocal()
    if db.query(Patient).count() > 0:
        db.close()
        return

    print("[Axeris] Seeding database with mock data...")

    # ─── Load drug data ───
    with open(os.path.join(DATA_DIR, "drug_database.json"), "r") as f:
        drug_data = json.load(f)
    with open(os.path.join(DATA_DIR, "interactions.json"), "r") as f:
        interaction_data = json.load(f)

    # Insert drugs
    for d in drug_data:
        db.add(Drug(
            id=d["id"], generic_name=d["generic_name"], brand_name=d.get("brand_name"),
            drug_class=d["drug_class"], therapeutic_category=d["therapeutic_category"],
            schedule=d["schedule"], formulation=d["formulation"], strength=d["strength"],
            route=d["route"], bioavailability=d.get("bioavailability"),
            half_life_hours=d.get("half_life_hours"),
            requires_titration=d.get("requires_titration", False),
            titration_schedule=d.get("titration_schedule"),
            max_daily_dose_mg=d.get("max_daily_dose_mg"),
            min_daily_dose_mg=d.get("min_daily_dose_mg"),
            renal_adjustment_required=d.get("renal_adjustment_required", False),
            hepatic_adjustment_required=d.get("hepatic_adjustment_required", False),
            egfr_threshold=d.get("egfr_threshold"),
            average_cost_per_unit=d.get("average_cost_per_unit", 1.0),
            generic_available=d.get("generic_available", False),
            approved_indications=d.get("approved_indications"),
            cross_reactivity_groups=d.get("cross_reactivity_groups"),
            # New spec-aligned fields
            qt_prolongation_risk=d.get("qt_prolongation_risk", False),
            serotonergic=d.get("serotonergic", False),
            beers_criteria=d.get("beers_criteria", False),
            pregnancy_risk=d.get("pregnancy_risk"),
            is_specialty=d.get("is_specialty", False),
            mme_conversion_factor=d.get("mme_conversion_factor"),
            narrow_therapeutic_index=d.get("narrow_therapeutic_index", False),
            # v8 fields
            pgx_gene=d.get("pgx_gene"),
            pgx_risk_phenotype=d.get("pgx_risk_phenotype"),
            pgx_clinical_action=d.get("pgx_clinical_action"),
            pgx_evidence=d.get("pgx_evidence"),
            rems_program=d.get("rems_program"),
            is_opioid=d.get("is_opioid", False),
            is_naloxone=d.get("is_naloxone", False),
            nadac_price=d.get("nadac_price"),
            biosimilar_available=d.get("biosimilar_available", False),
            vial_sizes_mg=d.get("vial_sizes_mg"),
            is_interchangeable=d.get("is_interchangeable", False),
        ))

    # Insert interactions
    for inter in interaction_data:
        db.add(DrugInteraction(
            drug_a_id=inter["drug_a"], drug_b_id=inter["drug_b"],
            severity=inter["severity"], description=inter["description"],
            clinical_effect=inter["clinical_effect"], management=inter["management"],
        ))

    # Insert therapeutic equivalences
    equivalences = [
        ("DRUG-020", "DRUG-021", "therapeutic_alternative", 0.5, "clinical_guideline", 33, "Atorvastatin 20mg ~ Rosuvastatin 10mg"),
        ("DRUG-020", "DRUG-022", "therapeutic_alternative", 1.0, "clinical_guideline", 20, "Atorvastatin 20mg ~ Simvastatin 20mg"),
        ("DRUG-020", "DRUG-023", "therapeutic_alternative", 0.5, "clinical_guideline", -16, "Atorvastatin 20mg ~ Pravastatin 40mg"),
        ("DRUG-080", "DRUG-081", "AB-rated generic", 2.0, "FDA AB-rated", 0, "Omeprazole 20mg ~ Pantoprazole 40mg"),
        ("DRUG-082", "DRUG-080", "therapeutic_alternative", 1.0, "clinical_guideline", 90, "Nexium 40mg → generic omeprazole saves ~90%"),
        ("DRUG-070", "DRUG-072", "therapeutic_alternative", 0.5, "clinical_guideline", 0, "Sertraline 100mg ~ Escitalopram 10mg"),
        ("DRUG-070", "DRUG-071", "therapeutic_alternative", 0.5, "clinical_guideline", 25, "Sertraline 100mg ~ Fluoxetine 20mg"),
        ("DRUG-130", "DRUG-131", "biosimilar", 1.0, "FDA biosimilar", 42, "Humira → Amjevita biosimilar saves ~42%"),
        ("DRUG-051", "DRUG-052", "therapeutic_alternative", 1.0, "clinical_guideline", -5, "Apixaban ~ Rivaroxaban"),
        ("DRUG-090", "DRUG-091", "therapeutic_alternative", 2.5, "clinical_guideline", -50, "Ibuprofen 400mg ~ Naproxen 500mg"),
        ("DRUG-140", "DRUG-141", "therapeutic_alternative", 0.25, "clinical_guideline", -700, "Gabapentin 300mg ~ Pregabalin 75mg"),
        # ── Expanded catalog: brand → generic / within-class / biosimilar ──
        ("DRUG-082", "DRUG-304", "AB-rated generic", 0.67, "FDA AB-rated", 94, "Nexium 40mg → generic lansoprazole 30mg saves ~94%"),
        ("DRUG-306", "DRUG-081", "therapeutic_alternative", 1.0, "clinical_guideline", 92, "Rabeprazole → generic pantoprazole (PPI class)"),
        ("DRUG-303", "DRUG-022", "therapeutic_alternative", 1.0, "clinical_guideline", 88, "Vytorin → generic simvastatin + ezetimibe components"),
        ("DRUG-301", "DRUG-021", "therapeutic_alternative", 2.5, "clinical_guideline", 82, "Livalo (pitavastatin) → generic rosuvastatin"),
        ("DRUG-310", "DRUG-311", "therapeutic_alternative", 1.0, "clinical_guideline", 85, "Pristiq (desvenlafaxine) → generic venlafaxine class alt"),
        ("DRUG-317", "DRUG-313", "therapeutic_alternative", 0.25, "clinical_guideline", 78, "Latuda → generic aripiprazole (atypical antipsychotic)"),
        ("DRUG-314", "DRUG-315", "AB-rated generic", 1.0, "FDA AB-rated", 0, "Quetiapine ~ olanzapine (both generic atypicals)"),
        ("DRUG-318", "DRUG-051", "therapeutic_alternative", 1.0, "clinical_guideline", -5, "Pradaxa (dabigatran) ~ apixaban (DOAC class)"),
        ("DRUG-319", "DRUG-052", "therapeutic_alternative", 1.0, "clinical_guideline", 15, "Savaysa (edoxaban) ~ rivaroxaban (factor Xa)"),
        ("DRUG-322", "DRUG-323", "therapeutic_alternative", 1.0, "clinical_guideline", 3, "Humalog (lispro) ~ Novolog (aspart) rapid insulin"),
        ("DRUG-324", "DRUG-321", "therapeutic_alternative", 1.0, "clinical_guideline", 88, "Tresiba → glargine-yfgn (Semglee) long-acting insulin"),
        ("DRUG-325", "DRUG-326", "therapeutic_alternative", 1.0, "clinical_guideline", -8, "Advair ~ Symbicort (ICS/LABA class)"),
        ("DRUG-329", "DRUG-330", "biosimilar", 1.0, "FDA biosimilar", 31, "Enbrel → Erelzi (etanercept-szzs) biosimilar saves ~31%"),
        ("DRUG-331", "DRUG-332", "biosimilar", 1.0, "FDA biosimilar", 37, "Remicade → Inflectra (infliximab-dyyb) biosimilar saves ~37%"),
        ("DRUG-334", "DRUG-335", "biosimilar", 1.0, "FDA biosimilar", 28, "Rituxan → Truxima (rituximab-abbs) biosimilar saves ~28%"),
        ("DRUG-353", "DRUG-354", "therapeutic_alternative", 1.0, "clinical_guideline", 12, "Farxiga (SGLT2) ~ Tradjenta (DPP-4) — class review"),
        ("DRUG-356", "DRUG-357", "AB-rated generic", 0.1, "FDA AB-rated", -20, "Sumatriptan 100mg ~ rizatriptan 10mg (triptan class)"),
        ("DRUG-341", "DRUG-339", "therapeutic_alternative", 0.35, "clinical_guideline", 94, "Imbruvica → generic imatinib (oral oncology TKI)"),
        ("DRUG-367", "DRUG-368", "therapeutic_alternative", 0.26, "clinical_guideline", 95, "Entresto → generic carvedilol + ACE (HFrEF step)"),
    ]
    for eq in equivalences:
        db.add(TherapeuticEquivalence(
            drug_a_id=eq[0], drug_b_id=eq[1], equivalence_type=eq[2],
            dose_conversion_factor=eq[3], evidence_level=eq[4],
            cost_difference_pct=eq[5], notes=eq[6],
        ))

    # ─── Pharmacies ───
    pharmacy_names = [
        ("CVS Pharmacy #1234", "retail"), ("Walgreens #5678", "retail"),
        ("Rite Aid #9012", "retail"), ("Walmart Pharmacy", "retail"),
        ("Costco Pharmacy", "retail"), ("Kroger Pharmacy", "retail"),
        ("Express Scripts Mail", "mail_order"), ("OptumRx Mail", "mail_order"),
        ("Community Pharmacy A", "retail"), ("Community Pharmacy B", "retail"),
        ("Discount Drug Mart", "retail"), ("Quick Fill Pharmacy", "retail"),
    ]
    pharmacies = []
    for i, (name, ptype) in enumerate(pharmacy_names):
        p = Pharmacy(id=f"PHARM-{i+1:03d}", name=name,
                     address=f"{random.randint(100,9999)} Main St",
                     ncpdp_id=f"{random.randint(1000000,9999999)}", pharmacy_type=ptype)
        db.add(p)
        pharmacies.append(p)

    # ─── Providers (with full clinic/contact info for insurer review) ───
    CLINIC_DATA = [
        # (clinic_name, address, city, state, zip, phone, fax, group_practice)
        ("Riverside Internal Medicine", "450 Medical Pkwy, Suite 200", "Austin", "TX", "78701", "(512) 555-0142", "(512) 555-0143", "Austin Health Partners"),
        ("Lakeview Family Practice", "1200 Lake Shore Dr, Bldg C", "Chicago", "IL", "60601", "(312) 555-0187", "(312) 555-0188", "Midwest Family Care Network"),
        ("Pinnacle Pain & Spine Center", "3300 N Central Expy, Suite 410", "Dallas", "TX", "75204", "(214) 555-0234", "(214) 555-0235", None),
        ("Heart & Vascular Associates", "900 Cardiology Ln, Floor 3", "Houston", "TX", "77030", "(713) 555-0312", "(713) 555-0313", "Texas Cardiology Group"),
        ("Meridian Diabetes & Endocrine", "2100 Wellness Blvd, Suite 105", "Phoenix", "AZ", "85004", "(602) 555-0456", "(602) 555-0457", "Southwest Endocrine Partners"),
        ("Behavioral Health Associates", "775 Elm St, Suite 300", "Philadelphia", "PA", "19104", "(215) 555-0521", "(215) 555-0522", "Penn Behavioral Health Network"),
        ("Breathe Easy Pulmonary Clinic", "5600 Respiratory Way", "Denver", "CO", "80202", "(303) 555-0634", "(303) 555-0635", "Rocky Mountain Lung Center"),
        ("Summit Rheumatology Center", "890 Joint Care Blvd, Suite 220", "Seattle", "WA", "98101", "(206) 555-0745", "(206) 555-0746", "Pacific NW Rheumatology Group"),
        ("Prestige Internal Medicine", "1400 Park Ave, Suite 500", "New York", "NY", "10029", "(212) 555-0812", "(212) 555-0813", "Manhattan Medical Associates"),
        ("Family First Health Clinic", "250 Main St", "Portland", "OR", "97201", "(503) 555-0923", "(503) 555-0924", "Oregon Family Health Network"),
        ("Southwest Pain Management", "6100 Desert Ridge Pkwy", "Scottsdale", "AZ", "85254", "(480) 555-1034", "(480) 555-1035", None),
        ("Beacon Cardiology Group", "2200 Beacon Hill Rd", "Boston", "MA", "02108", "(617) 555-1145", "(617) 555-1146", "New England Cardiac Partners"),
        ("Metro Endocrine Specialists", "333 Skyline Blvd, Suite 800", "San Francisco", "CA", "94102", "(415) 555-1256", "(415) 555-1257", "Bay Area Endocrine Group"),
        ("Harmony Psychiatry & Wellness", "420 Serenity Ln", "Nashville", "TN", "37203", "(615) 555-1367", "(615) 555-1368", "Tennessee Behavioral Health"),
        ("Eastside Internal Medicine", "1500 E Madison St, Suite 250", "Seattle", "WA", "98122", "(206) 555-1478", "(206) 555-1479", "Pacific NW Medical Group"),
        ("Prairie Hematology & Oncology", "800 Prairie View Rd, Suite 400", "Omaha", "NE", "68102", "(402) 555-1589", "(402) 555-1590", "Great Plains Cancer Care"),
        # Outlier providers (suspicious high-volume pain clinics)
        ("QuickScript Pain Clinic", "9900 Cash Only Blvd, Unit B", "Miami", "FL", "33101", "(305) 555-1601", None, None),
        ("Express Pain Relief Center", "7700 Strip Mall Ave, Suite 3", "Las Vegas", "NV", "89101", "(702) 555-1712", None, None),
        ("Rapid Relief Pain Management", "5500 Industrial Park Dr", "Tampa", "FL", "33602", "(813) 555-1823", None, None),
        ("24/7 Pain Solutions LLC", "3200 Highway 1, Unit 9", "Fort Lauderdale", "FL", "33301", "(954) 555-1934", None, None),
    ]

    def _npi(seed_int: int) -> str:
        """Structurally valid NPI: 10 digits, Luhn check over the 80840 prefix.

        Fictional, but it passes the same validation NPPES applies, so it does
        not fail an obvious check on screen.
        """
        base = f"1{seed_int % 900000000 + 100000000}"[:9]
        payload = "80840" + base
        total, dbl = 0, True
        for ch in reversed(payload):
            n = int(ch)
            if dbl:
                n *= 2
                if n > 9:
                    n -= 9
            total += n
            dbl = not dbl
        return base + str((10 - total % 10) % 10)

    def _dea(last_name: str, seed_int: int) -> str:
        """Structurally valid DEA: registrant-type letter, last-initial letter,
        six digits, then the standard check digit."""
        six = f"{seed_int % 900000 + 100000}"
        odd = int(six[0]) + int(six[2]) + int(six[4])
        even = int(six[1]) + int(six[3]) + int(six[5])
        check = (odd + 2 * even) % 10
        return f"A{(last_name or 'X')[0].upper()}{six}{check}"

    providers = []
    for i in range(20):
        spec = SPECIALTIES[i % len(SPECIALTIES)]
        if i >= 16:
            spec = "Pain Management"  # Outlier providers
        if i == 15:
            spec = "Hematology/Oncology"  # infused-biologic prescriber
        clinic = CLINIC_DATA[i]
        fname = random.choice(FIRST_NAMES_M + FIRST_NAMES_F)
        lname = random.choice(LAST_NAMES)
        prov = Provider(
            id=f"PRV-{i+1:03d}",
            first_name=fname,
            last_name=lname,
            npi=_npi(random.randint(100000000, 999999999)),
            specialty=spec,
            dea_number=_dea(lname, random.randint(100000, 999999)),
            practice_location=f"{clinic[2]}, {clinic[3]}",
            clinic_name=clinic[0],
            clinic_address=clinic[1],
            clinic_city=clinic[2],
            clinic_state=clinic[3],
            clinic_zip=clinic[4],
            clinic_phone=clinic[5],
            clinic_fax=clinic[6],
            provider_email=f"dr.{fname.lower()}.{lname.lower()}@{clinic[0].lower().split()[0]}med.com",
            license_state=clinic[3],
            board_certified=i < 16,  # Outlier providers NOT board certified
            accepting_patients=True,
            group_practice=clinic[7],
        )
        db.add(prov)
        providers.append(prov)

    db.flush()

    # ─── Patients ───
    patients = []
    rx_counter = [0]

    def make_rx(patient_id, provider_id, drug_id, dose, freq, qty, days, pharmacy_id=None,
                is_refill=False, orig_id=None, date_written=None, date_filled=None, status="pending"):
        rx_counter[0] += 1
        if not date_written:
            date_written = _rand_date()
        if not date_filled:
            date_filled = date_written + timedelta(days=random.randint(0, 2))
        if not pharmacy_id:
            pharmacy_id = random.choice(pharmacies).id
        rx = Prescription(
            id=f"RX-{rx_counter[0]:04d}",
            patient_id=patient_id, provider_id=provider_id, drug_id=drug_id,
            pharmacy_id=pharmacy_id,
            dose_mg=dose, frequency=freq, quantity=qty, days_supply=days,
            refills_authorized=random.randint(0, 3),
            date_written=date_written, date_filled=date_filled,
            is_refill=is_refill, original_rx_id=orig_id, status=status,
        )
        db.add(rx)
        return rx

    # ─── Market-structure price signal ───
    # Real pharmacy claims carry two systematic effects that pure noise does
    # not, and both are what a TPA is hired to find. First, the PBM holds
    # unilateral control of the MAC list and resets generic reimbursement
    # partway through a contract year without touching acquisition cost.
    # Second, pharmacies the PBM owns are reimbursed above independents for
    # the same drug. Both are seeded here so the detectors find real signal
    # instead of sampling noise.
    pharm_by_id = {p.id: p for p in pharmacies}
    MAC_REPRICE_DATE = datetime(2025, 10, 1)
    PBM_OWNED_CHAINS = ("cvs", "express scripts", "optumrx", "optum rx")

    def _mac_multiplier(drug_id, claim_date):
        """Unilateral MAC reset applied to a subset of drugs after the reset date."""
        if not claim_date or claim_date < MAC_REPRICE_DATE:
            return 1.0
        h = int(hashlib.sha256(f"macreprice:{drug_id}".encode()).hexdigest()[:8], 16)
        if h % 100 < 30:                      # ~30% of the catalog repriced
            return 1.0 + 0.14 + (h % 37) / 100.0    # +14% to +50%
        return 1.0

    def _affiliated_multiplier(pharmacy_id):
        """PBM-owned pharmacies reimbursed above independents for the same drug."""
        ph = pharm_by_id.get(pharmacy_id)
        if not ph:
            return 1.0
        name = (ph.name or "").lower()
        owned = any(c in name for c in PBM_OWNED_CHAINS) or \
            (ph.pharmacy_type or "") in ("mail_order", "specialty")
        if not owned:
            return 1.0
        h = int(hashlib.sha256(f"affilprem:{ph.id}".encode()).hexdigest()[:8], 16)
        return 1.0 + 0.08 + (h % 22) / 100.0        # +8% to +30%

    def make_claim(rx, pharmacy_id, billed_mult=1.0):
        base = db.get(Drug, rx.drug_id)
        base_cost = (base.average_cost_per_unit if base else 1.0) * rx.quantity
        claim_date = rx.date_filled or rx.date_written
        pid = pharmacy_id or rx.pharmacy_id
        billed = (base_cost * billed_mult * random.uniform(1.0, 1.3)
                  * _mac_multiplier(rx.drug_id, claim_date)
                  * _affiliated_multiplier(pid))
        cl = InsuranceClaim(
            id=f"CLM-{rx.id}",
            prescription_id=rx.id, patient_id=rx.patient_id,
            billed_amount=round(billed, 2),
            allowed_amount=round(billed * 0.85, 2),
            paid_amount=round(billed * 0.70, 2),
            copay_amount=round(billed * 0.15, 2),
            claim_date=rx.date_filled or rx.date_written,
            claim_status="paid", pharmacy_id=pharmacy_id or rx.pharmacy_id,
        )
        db.add(cl)
        # Return it: the session runs with autoflush off, so a caller that
        # wants to adjust the claim cannot query it back before the next flush.
        return cl

    # ── Archetype 1: Healthy/Normal (10 patients) ──
    for i in range(10):
        gender = random.choice(["M", "F"])
        fname = random.choice(FIRST_NAMES_M if gender == "M" else FIRST_NAMES_F)
        pat = Patient(
            id=f"PAT-{i+1:03d}", first_name=fname, last_name=random.choice(LAST_NAMES),
            date_of_birth=_rand_dob(25, 45), gender=gender,
            weight_kg=round(random.uniform(55, 95), 1), height_cm=round(random.uniform(155, 190), 1),
        )
        db.add(pat)
        patients.append(pat)

        # 1-2 mild diagnoses
        db.add(Diagnosis(patient_id=pat.id, icd10_code="J06.9", description="Acute upper respiratory infection",
                         date_diagnosed=_rand_date().date(), is_active=True))
        if random.random() > 0.5:
            db.add(Diagnosis(patient_id=pat.id, icd10_code="M54.5", description="Low back pain",
                             date_diagnosed=_rand_date().date(), is_active=True))

        # Normal labs
        db.add(LabResult(patient_id=pat.id, test_name="eGFR", value=round(random.uniform(80, 120), 0),
                         unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                         date_collected=_rand_date(), is_abnormal=False))
        db.add(LabResult(patient_id=pat.id, test_name="ALT", value=round(random.uniform(15, 35), 0),
                         unit="U/L", reference_range_low=7, reference_range_high=56,
                         date_collected=_rand_date(), is_abnormal=False))

        # 1-2 appropriate prescriptions (GREEN)
        prov = random.choice(providers[:14])
        rx1 = make_rx(pat.id, prov.id, "DRUG-060", 500, "TID", 21, 7, status="approved")
        make_claim(rx1, rx1.pharmacy_id)

    # ── Archetype 2: Chronic Disease Managed (10 patients) ──
    for i in range(10, 20):
        gender = random.choice(["M", "F"])
        fname = random.choice(FIRST_NAMES_M if gender == "M" else FIRST_NAMES_F)
        pat = Patient(
            id=f"PAT-{i+1:03d}", first_name=fname, last_name=random.choice(LAST_NAMES),
            date_of_birth=_rand_dob(50, 70), gender=gender,
            weight_kg=round(random.uniform(65, 110), 1), height_cm=round(random.uniform(155, 185), 1),
        )
        db.add(pat)
        patients.append(pat)

        # Diabetes + Hypertension + Hyperlipidemia
        db.add(Diagnosis(patient_id=pat.id, icd10_code="E11.9", description="Type 2 diabetes mellitus without complications",
                         date_diagnosed=_rand_date(2020, 2022).date(), is_active=True))
        db.add(Diagnosis(patient_id=pat.id, icd10_code="I10", description="Essential hypertension",
                         date_diagnosed=_rand_date(2019, 2021).date(), is_active=True))
        db.add(Diagnosis(patient_id=pat.id, icd10_code="E78.5", description="Hyperlipidemia",
                         date_diagnosed=_rand_date(2020, 2022).date(), is_active=True))

        # Normal-ish labs
        db.add(LabResult(patient_id=pat.id, test_name="eGFR", value=round(random.uniform(60, 90), 0),
                         unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                         date_collected=_rand_date(), is_abnormal=False))
        db.add(LabResult(patient_id=pat.id, test_name="HbA1c", value=round(random.uniform(6.5, 8.0), 1),
                         unit="%", reference_range_low=4.0, reference_range_high=5.7,
                         date_collected=_rand_date(), is_abnormal=True))
        db.add(LabResult(patient_id=pat.id, test_name="ALT", value=round(random.uniform(20, 45), 0),
                         unit="U/L", reference_range_low=7, reference_range_high=56,
                         date_collected=_rand_date(), is_abnormal=False))

        # Appropriate medications (mostly GREEN, some YELLOW for cost)
        prov = random.choice(providers[:14])
        rx1 = make_rx(pat.id, prov.id, "DRUG-001", 500, "BID", 60, 30, status="approved")
        rx2 = make_rx(pat.id, prov.id, "DRUG-010", 10, "QD", 30, 30, status="approved")
        rx3 = make_rx(pat.id, prov.id, "DRUG-020", 20, "QD", 30, 30, status="approved")
        make_claim(rx1, rx1.pharmacy_id)
        make_claim(rx2, rx2.pharmacy_id)
        make_claim(rx3, rx3.pharmacy_id)

        # Some get brand Nexium instead of generic omeprazole (YELLOW - cost)
        if i % 3 == 0:
            db.add(Diagnosis(patient_id=pat.id, icd10_code="K21.0", description="GERD with esophagitis",
                             date_diagnosed=_rand_date(2021, 2023).date(), is_active=True))
            rx4 = make_rx(pat.id, prov.id, "DRUG-082", 40, "QD", 30, 30, status="pending")
            make_claim(rx4, rx4.pharmacy_id)

    # ── Archetype 3: Complex/Polypharmacy (10 patients) ──
    for i in range(20, 30):
        gender = random.choice(["M", "F"])
        fname = random.choice(FIRST_NAMES_M if gender == "M" else FIRST_NAMES_F)
        pat = Patient(
            id=f"PAT-{i+1:03d}", first_name=fname, last_name=random.choice(LAST_NAMES),
            date_of_birth=_rand_dob(65, 85), gender=gender,
            weight_kg=round(random.uniform(55, 100), 1), height_cm=round(random.uniform(150, 180), 1),
        )
        db.add(pat)
        patients.append(pat)

        # Many diagnoses
        diags = [
            ("E11.65", "Type 2 DM with hyperglycemia"),
            ("I10", "Essential hypertension"),
            ("I50.9", "Heart failure, unspecified"),
            ("E78.5", "Hyperlipidemia"),
            ("I48.91", "Atrial fibrillation"),
            ("N18.3", "CKD stage 3"),
            ("K21.0", "GERD"),
            ("F32.1", "Major depressive disorder, moderate"),
        ]
        for code, desc in diags[:random.randint(5, 8)]:
            db.add(Diagnosis(patient_id=pat.id, icd10_code=code, description=desc,
                             date_diagnosed=_rand_date(2018, 2022).date(), is_active=True))

        # Some have allergies
        if i % 2 == 0:
            db.add(Allergy(patient_id=pat.id, allergen="Penicillin", reaction_type="rash",
                           severity="moderate", cross_reactivity_group="penicillins"))

        # Impaired labs
        egfr_val = round(random.uniform(35, 55), 0)
        db.add(LabResult(patient_id=pat.id, test_name="eGFR", value=egfr_val,
                         unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                         date_collected=_rand_date(), is_abnormal=True))
        # Trending down
        db.add(LabResult(patient_id=pat.id, test_name="eGFR", value=egfr_val + 8,
                         unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                         date_collected=_rand_date(2024, 2024), is_abnormal=True))
        db.add(LabResult(patient_id=pat.id, test_name="eGFR", value=egfr_val + 15,
                         unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                         date_collected=_rand_date(2023, 2023), is_abnormal=False))
        db.add(LabResult(patient_id=pat.id, test_name="HbA1c", value=round(random.uniform(7.5, 10.0), 1),
                         unit="%", reference_range_low=4.0, reference_range_high=5.7,
                         date_collected=_rand_date(), is_abnormal=True))
        db.add(LabResult(patient_id=pat.id, test_name="ALT", value=round(random.uniform(25, 60), 0),
                         unit="U/L", reference_range_low=7, reference_range_high=56,
                         date_collected=_rand_date(), is_abnormal=False))
        db.add(LabResult(patient_id=pat.id, test_name="INR", value=round(random.uniform(2.0, 3.5), 1),
                         unit="", reference_range_low=2.0, reference_range_high=3.0,
                         date_collected=_rand_date(), is_abnormal=random.random() > 0.5))

        # Many medications (6-10) — polypharmacy triggers
        prov = random.choice(providers[:14])
        meds = [
            ("DRUG-001", 500, "BID", 60, 30),
            ("DRUG-010", 20, "QD", 30, 30),
            ("DRUG-012", 50, "QD", 30, 30),
            ("DRUG-020", 20, "QD", 30, 30),
            ("DRUG-050", 5, "QD", 30, 30),
            ("DRUG-080", 20, "QD", 30, 30),
            ("DRUG-070", 50, "QD", 30, 30),
        ]
        for drug_id, dose, freq, qty, days in meds[:random.randint(6, 7)]:
            rx = make_rx(pat.id, prov.id, drug_id, dose, freq, qty, days, status="approved")
            make_claim(rx, rx.pharmacy_id)

        # Some get NSAID on top of warfarin (RED - interaction)
        if i % 3 == 0:
            db.add(Diagnosis(patient_id=pat.id, icd10_code="M54.5", description="Low back pain",
                             date_diagnosed=_rand_date().date(), is_active=True))
            # Meloxicam, not OTC ibuprofen: prescription-only NSAID so the
            # claim is one a plan would actually adjudicate.
            rx_bad = make_rx(pat.id, prov.id, "DRUG-093", 15, "QD", 30, 30, status="pending")
            make_claim(rx_bad, rx_bad.pharmacy_id)

    # ── Archetype 4: High-Risk/Unsafe Patterns (10 patients) ──
    for i in range(30, 40):
        gender = random.choice(["M", "F"])
        fname = random.choice(FIRST_NAMES_M if gender == "M" else FIRST_NAMES_F)
        pat = Patient(
            id=f"PAT-{i+1:03d}", first_name=fname, last_name=random.choice(LAST_NAMES),
            date_of_birth=_rand_dob(30, 60), gender=gender,
            weight_kg=round(random.uniform(55, 100), 1), height_cm=round(random.uniform(155, 185), 1),
        )
        db.add(pat)
        patients.append(pat)

        scenario = i % 5

        if scenario == 0:
            # Allergy violation: patient allergic to penicillin, prescribed amoxicillin
            db.add(Allergy(patient_id=pat.id, allergen="Penicillin", reaction_type="anaphylaxis",
                           severity="severe", cross_reactivity_group="penicillins"))
            db.add(Diagnosis(patient_id=pat.id, icd10_code="J06.9", description="Acute upper respiratory infection",
                             date_diagnosed=_rand_date().date(), is_active=True))
            db.add(LabResult(patient_id=pat.id, test_name="eGFR", value=90,
                             unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                             date_collected=_rand_date(), is_abnormal=False))
            prov = random.choice(providers[:14])
            rx = make_rx(pat.id, prov.id, "DRUG-060", 500, "TID", 21, 7, status="pending")
            make_claim(rx, rx.pharmacy_id)

        elif scenario == 1:
            # Opioid + benzo concurrent use
            db.add(Diagnosis(patient_id=pat.id, icd10_code="M54.5", description="Low back pain",
                             date_diagnosed=_rand_date(2022, 2023).date(), is_active=True))
            db.add(Diagnosis(patient_id=pat.id, icd10_code="F41.1", description="Generalized anxiety disorder",
                             date_diagnosed=_rand_date(2021, 2023).date(), is_active=True))
            db.add(LabResult(patient_id=pat.id, test_name="eGFR", value=85,
                             unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                             date_collected=_rand_date(), is_abnormal=False))
            prov = random.choice(providers[:14])
            rx1 = make_rx(pat.id, prov.id, "DRUG-040", 0.5, "BID", 60, 30, status="approved")
            make_claim(rx1, rx1.pharmacy_id)
            rx2 = make_rx(pat.id, prov.id, "DRUG-030", 10, "Q6H", 120, 30, status="pending")
            make_claim(rx2, rx2.pharmacy_id)

        elif scenario == 2:
            # Dose above max: metformin 3000mg/day
            db.add(Diagnosis(patient_id=pat.id, icd10_code="E11.9", description="Type 2 diabetes",
                             date_diagnosed=_rand_date(2020, 2022).date(), is_active=True))
            db.add(LabResult(patient_id=pat.id, test_name="eGFR", value=75,
                             unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                             date_collected=_rand_date(), is_abnormal=False))
            db.add(LabResult(patient_id=pat.id, test_name="HbA1c", value=9.5,
                             unit="%", reference_range_low=4.0, reference_range_high=5.7,
                             date_collected=_rand_date(), is_abnormal=True))
            prov = random.choice(providers[:14])
            rx = make_rx(pat.id, prov.id, "DRUG-001", 1000, "TID", 90, 30, status="pending")
            make_claim(rx, rx.pharmacy_id)

        elif scenario == 3:
            # Renal contraindication: eGFR 22 + metformin
            db.add(Diagnosis(patient_id=pat.id, icd10_code="E11.9", description="Type 2 diabetes",
                             date_diagnosed=_rand_date(2018, 2020).date(), is_active=True))
            db.add(Diagnosis(patient_id=pat.id, icd10_code="N18.4", description="CKD stage 4",
                             date_diagnosed=_rand_date(2022, 2024).date(), is_active=True))
            db.add(LabResult(patient_id=pat.id, test_name="eGFR", value=22,
                             unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                             date_collected=_rand_date(), is_abnormal=True))
            db.add(LabResult(patient_id=pat.id, test_name="ALT", value=30,
                             unit="U/L", reference_range_low=7, reference_range_high=56,
                             date_collected=_rand_date(), is_abnormal=False))
            prov = random.choice(providers[:14])
            rx = make_rx(pat.id, prov.id, "DRUG-001", 500, "BID", 60, 30, status="pending")
            make_claim(rx, rx.pharmacy_id)

        elif scenario == 4:
            # Duplicate therapy: two SSRIs
            db.add(Diagnosis(patient_id=pat.id, icd10_code="F32.1", description="Major depressive disorder, moderate",
                             date_diagnosed=_rand_date(2021, 2023).date(), is_active=True))
            db.add(LabResult(patient_id=pat.id, test_name="eGFR", value=95,
                             unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                             date_collected=_rand_date(), is_abnormal=False))
            prov1 = random.choice(providers[:14])
            prov2 = random.choice(providers[:14])
            rx1 = make_rx(pat.id, prov1.id, "DRUG-070", 50, "QD", 30, 30, status="approved")
            make_claim(rx1, rx1.pharmacy_id)
            rx2 = make_rx(pat.id, prov2.id, "DRUG-072", 10, "QD", 30, 30, status="pending")
            make_claim(rx2, rx2.pharmacy_id)

    # ── Archetype 5: Fraud/Abuse Indicators (10 patients) ──
    for i in range(40, 50):
        gender = random.choice(["M", "F"])
        fname = random.choice(FIRST_NAMES_M if gender == "M" else FIRST_NAMES_F)
        pat = Patient(
            id=f"PAT-{i+1:03d}", first_name=fname, last_name=random.choice(LAST_NAMES),
            date_of_birth=_rand_dob(25, 50), gender=gender,
            weight_kg=round(random.uniform(55, 95), 1), height_cm=round(random.uniform(155, 185), 1),
        )
        db.add(pat)
        patients.append(pat)

        db.add(Diagnosis(patient_id=pat.id, icd10_code="M54.5", description="Low back pain",
                         date_diagnosed=_rand_date(2021, 2023).date(), is_active=True))
        db.add(Diagnosis(patient_id=pat.id, icd10_code="G89.29", description="Other chronic pain",
                         date_diagnosed=_rand_date(2020, 2022).date(), is_active=True))
        db.add(LabResult(patient_id=pat.id, test_name="eGFR", value=round(random.uniform(70, 110), 0),
                         unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                         date_collected=_rand_date(), is_abnormal=False))

        # Multiple prescribers for controlled substances (doctor shopping)
        opioid_drugs = ["DRUG-030", "DRUG-031", "DRUG-032", "DRUG-034"]
        # Use outlier providers (PRV-017 to PRV-020) for controlled substances
        outlier_provs = providers[16:]
        for j, drug_id in enumerate(opioid_drugs[:random.randint(3, 4)]):
            prov = outlier_provs[j % len(outlier_provs)]
            base_date = datetime(2025, 6, 1) + timedelta(days=j * 15)
            rx = make_rx(pat.id, prov.id, drug_id, 10, "Q6H", 120, 30,
                        date_written=base_date, date_filled=base_date + timedelta(days=1),
                        status="pending")
            make_claim(rx, rx.pharmacy_id)

            # Early refills
            if j > 0:
                refill_date = base_date + timedelta(days=15)  # 15 days early
                rx_refill = make_rx(pat.id, prov.id, drug_id, 10, "Q6H", 120, 30,
                                   is_refill=True, orig_id=rx.id,
                                   date_written=refill_date, date_filled=refill_date,
                                   status="pending")
                make_claim(rx_refill, rx_refill.pharmacy_id)

        # Billing anomaly pharmacy
        if i % 2 == 0:
            anomaly_pharm = pharmacies[-1]  # Quick Fill Pharmacy
            rx_anom = make_rx(pat.id, outlier_provs[0].id, "DRUG-030", 10, "QID", 120, 30,
                            pharmacy_id=anomaly_pharm.id, status="pending")
            make_claim(rx_anom, anomaly_pharm.id, billed_mult=3.5)

    # ─── Additional Scenarios for Spec-Aligned Checks ───
    # These modify existing patients to trigger new clinical checks

    # --- QT Prolongation Stacking (patients in Archetype 3: PAT-021 to PAT-030) ---
    # Give PAT-021 ciprofloxacin + amiodarone (both QT prolonging)
    prov = random.choice(providers[:14])
    rx_qt1 = make_rx("PAT-021", prov.id, "DRUG-111", 200, "BID", 60, 30, status="approved")  # amiodarone
    make_claim(rx_qt1, rx_qt1.pharmacy_id)
    rx_qt2 = make_rx("PAT-021", prov.id, "DRUG-062", 500, "BID", 14, 7, status="pending")  # ciprofloxacin (QT)
    make_claim(rx_qt2, rx_qt2.pharmacy_id)
    # Also add escitalopram to make 3 QT agents
    rx_qt3 = make_rx("PAT-021", prov.id, "DRUG-072", 20, "QD", 30, 30, status="approved")  # escitalopram (QT)
    make_claim(rx_qt3, rx_qt3.pharmacy_id)

    # --- Serotonergic Syndrome (PAT-022) ---
    # sertraline + tramadol + venlafaxine = 3 serotonergic agents
    db.add(Diagnosis(patient_id="PAT-022", icd10_code="F32.1", description="Major depressive disorder, moderate",
                     date_diagnosed=_rand_date(2021, 2023).date(), is_active=True))
    rx_sero1 = make_rx("PAT-022", prov.id, "DRUG-070", 100, "QD", 30, 30, status="approved")  # sertraline
    make_claim(rx_sero1, rx_sero1.pharmacy_id)
    rx_sero2 = make_rx("PAT-022", prov.id, "DRUG-034", 50, "BID", 60, 30, status="approved")  # tramadol
    make_claim(rx_sero2, rx_sero2.pharmacy_id)
    rx_sero3 = make_rx("PAT-022", prov.id, "DRUG-073", 75, "BID", 60, 30, status="pending")  # venlafaxine
    make_claim(rx_sero3, rx_sero3.pharmacy_id)

    # --- Beers Criteria (Archetype 3 patients are all 65+) ---
    # PAT-023 gets a benzodiazepine (Beers flagged in elderly)
    db.add(Diagnosis(patient_id="PAT-023", icd10_code="F41.1", description="Generalized anxiety disorder",
                     date_diagnosed=_rand_date(2022, 2024).date(), is_active=True))
    rx_beers = make_rx("PAT-023", prov.id, "DRUG-040", 0.5, "TID", 90, 30, status="pending")  # alprazolam
    make_claim(rx_beers, rx_beers.pharmacy_id)

    # PAT-024 gets meloxicam (Beers-flagged NSAID in elderly + has CKD/HF)
    rx_beers2 = make_rx("PAT-024", prov.id, "DRUG-093", 15, "QD", 30, 30, status="pending")  # meloxicam
    make_claim(rx_beers2, rx_beers2.pharmacy_id)

    # --- Pregnancy/Lactation Safety ---
    # Create a specific female patient of childbearing age with pregnancy risk scenario
    pat_preg = Patient(
        id="PAT-051", first_name="Sarah", last_name="Mitchell",
        date_of_birth=_rand_dob(25, 35), gender="F",
        weight_kg=65.0, height_cm=165.0,
    )
    db.add(pat_preg)
    patients.append(pat_preg)
    db.add(Diagnosis(patient_id="PAT-051", icd10_code="I10", description="Essential hypertension",
                     date_diagnosed=_rand_date(2023, 2024).date(), is_active=True))
    db.add(Diagnosis(patient_id="PAT-051", icd10_code="E78.5", description="Hyperlipidemia",
                     date_diagnosed=_rand_date(2023, 2024).date(), is_active=True))
    db.add(LabResult(patient_id="PAT-051", test_name="eGFR", value=95,
                     unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                     date_collected=_rand_date(), is_abnormal=False))
    # Statin (pregnancy category X) prescribed to woman of childbearing age
    rx_preg1 = make_rx("PAT-051", prov.id, "DRUG-020", 20, "QD", 30, 30, status="pending")  # atorvastatin (X)
    make_claim(rx_preg1, rx_preg1.pharmacy_id)
    # ACE inhibitor (pregnancy category D)
    rx_preg2 = make_rx("PAT-051", prov.id, "DRUG-010", 10, "QD", 30, 30, status="pending")  # lisinopril (D)
    make_claim(rx_preg2, rx_preg2.pharmacy_id)

    # --- Opioid Stewardship / High MME ---
    # Create a patient with dangerously high opioid load
    pat_opioid = Patient(
        id="PAT-052", first_name="Marcus", last_name="Webb",
        date_of_birth=_rand_dob(35, 55), gender="M",
        weight_kg=82.0, height_cm=178.0,
    )
    db.add(pat_opioid)
    patients.append(pat_opioid)
    db.add(Diagnosis(patient_id="PAT-052", icd10_code="M54.5", description="Low back pain",
                     date_diagnosed=_rand_date(2021, 2022).date(), is_active=True))
    db.add(Diagnosis(patient_id="PAT-052", icd10_code="G89.29", description="Other chronic pain",
                     date_diagnosed=_rand_date(2020, 2022).date(), is_active=True))
    db.add(LabResult(patient_id="PAT-052", test_name="eGFR", value=88,
                     unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                     date_collected=_rand_date(), is_abnormal=False))
    # Oxycodone 40mg QID = 160mg/day * 1.5 MME = 240 MME/day (dangerously high)
    rx_mme1 = make_rx("PAT-052", providers[16].id, "DRUG-030", 40, "QID", 120, 30, status="approved")  # oxycodone
    make_claim(rx_mme1, rx_mme1.pharmacy_id)
    # Add a concurrent benzodiazepine (FDA black box warning)
    rx_mme2 = make_rx("PAT-052", providers[17].id, "DRUG-041", 1, "BID", 60, 30, status="approved")  # lorazepam
    make_claim(rx_mme2, rx_mme2.pharmacy_id)
    # New opioid being prescribed on top (pending)
    rx_mme3 = make_rx("PAT-052", providers[18].id, "DRUG-032", 30, "Q6H", 120, 30, status="pending")  # morphine
    make_claim(rx_mme3, rx_mme3.pharmacy_id)

    # --- Specialty Drug without indication ---
    pat_spec = Patient(
        id="PAT-053", first_name="Diana", last_name="Cruz",
        date_of_birth=_rand_dob(40, 60), gender="F",
        weight_kg=68.0, height_cm=163.0,
    )
    db.add(pat_spec)
    patients.append(pat_spec)
    db.add(Diagnosis(patient_id="PAT-053", icd10_code="M06.9", description="Rheumatoid arthritis, unspecified",
                     date_diagnosed=_rand_date(2022, 2024).date(), is_active=True))
    db.add(LabResult(patient_id="PAT-053", test_name="eGFR", value=82,
                     unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                     date_collected=_rand_date(), is_abnormal=False))
    # Adalimumab (specialty biologic) — brand when biosimilar exists
    rx_spec = make_rx("PAT-053", prov.id, "DRUG-130", 40, "Q12H", 2, 30, status="pending")  # Humira
    make_claim(rx_spec, rx_spec.pharmacy_id, billed_mult=1.0)

    # --- Age-Based Dosing (geriatric patient with adult-dose gabapentin) ---
    # PAT-025 is already 65+, give them high-dose gabapentin (1200mg TID = 3600mg/day, geriatric max ~2700)
    rx_age = make_rx("PAT-025", prov.id, "DRUG-140", 1200, "TID", 90, 30, status="pending")  # gabapentin exceeds geriatric max
    make_claim(rx_age, rx_age.pharmacy_id)

    # Also add high-dose NSAID for another elderly patient (PAT-026).
    # Meloxicam 15mg BID = 30mg/day against a 15mg/day label maximum.
    rx_age2 = make_rx("PAT-026", prov.id, "DRUG-093", 15, "BID", 60, 30, status="pending")  # meloxicam 30mg/day
    make_claim(rx_age2, rx_age2.pharmacy_id)

    # --- Cumulative Moderate Interaction Risk ---
    # PAT-027 already has many meds. Add drugs that create 3+ moderate interaction pairs:
    # warfarin(050)+celecoxib(092)=moderate, warfarin(050)+azithromycin(061)=moderate,
    # metformin(001)+ciprofloxacin(062)=moderate, ibuprofen(090)+lisinopril(010)=moderate
    db.add(Diagnosis(patient_id="PAT-027", icd10_code="M17.9", description="Osteoarthritis of knee",
                     date_diagnosed=_rand_date(2021, 2023).date(), is_active=True))
    rx_cum1 = make_rx("PAT-027", prov.id, "DRUG-092", 200, "BID", 60, 30, status="approved")  # celecoxib
    make_claim(rx_cum1, rx_cum1.pharmacy_id)
    rx_cum2 = make_rx("PAT-027", prov.id, "DRUG-061", 250, "QD", 6, 5, status="pending")  # azithromycin
    make_claim(rx_cum2, rx_cum2.pharmacy_id)
    rx_cum3 = make_rx("PAT-027", prov.id, "DRUG-062", 500, "BID", 14, 7, status="approved")  # ciprofloxacin
    make_claim(rx_cum3, rx_cum3.pharmacy_id)

    # --- Drug Wastage Detection Scenarios ---
    # PAT-054: Patient with multiple abandoned medications (early discontinuation pattern)
    pat_waste = Patient(
        id="PAT-054", first_name="Gregory", last_name="Hoffman",
        date_of_birth=_rand_dob(45, 65), gender="M",
        weight_kg=88.0, height_cm=175.0,
    )
    db.add(pat_waste)
    patients.append(pat_waste)
    db.add(Diagnosis(patient_id="PAT-054", icd10_code="I10", description="Essential hypertension",
                     date_diagnosed=_rand_date(2021, 2023).date(), is_active=True))
    db.add(Diagnosis(patient_id="PAT-054", icd10_code="E11.9", description="Type 2 diabetes mellitus",
                     date_diagnosed=_rand_date(2020, 2022).date(), is_active=True))
    db.add(Diagnosis(patient_id="PAT-054", icd10_code="E78.5", description="Hyperlipidemia",
                     date_diagnosed=_rand_date(2021, 2023).date(), is_active=True))
    db.add(LabResult(patient_id="PAT-054", test_name="eGFR", value=78,
                     unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                     date_collected=_rand_date(), is_abnormal=False))

    # Filled lisinopril 4 months ago but never refilled (abandoned)
    rx_waste1 = make_rx("PAT-054", prov.id, "DRUG-010", 10, "QD", 30, 30,
                        date_written=datetime(2025, 1, 15),
                        date_filled=datetime(2025, 1, 16), status="approved")
    make_claim(rx_waste1, rx_waste1.pharmacy_id)
    # Filled metformin 5 months ago but never refilled (abandoned)
    rx_waste2 = make_rx("PAT-054", prov.id, "DRUG-001", 500, "BID", 60, 30,
                        date_written=datetime(2024, 12, 10),
                        date_filled=datetime(2024, 12, 11), status="approved")
    make_claim(rx_waste2, rx_waste2.pharmacy_id)
    # Filled atorvastatin 3 months ago but never refilled (abandoned)
    rx_waste3 = make_rx("PAT-054", prov.id, "DRUG-020", 20, "QD", 30, 30,
                        date_written=datetime(2025, 2, 5),
                        date_filled=datetime(2025, 2, 6), status="approved")
    make_claim(rx_waste3, rx_waste3.pharmacy_id)
    # Filled losartan 4 months ago but never refilled (abandoned)
    rx_waste4 = make_rx("PAT-054", prov.id, "DRUG-012", 50, "QD", 30, 30,
                        date_written=datetime(2025, 1, 20),
                        date_filled=datetime(2025, 1, 21), status="approved")
    make_claim(rx_waste4, rx_waste4.pharmacy_id)
    # Now re-prescribing lisinopril (should trigger wastage flag)
    rx_waste5 = make_rx("PAT-054", prov.id, "DRUG-010", 10, "QD", 30, 30, status="pending")
    make_claim(rx_waste5, rx_waste5.pharmacy_id)
    # Also re-prescribing metformin (should trigger wastage + early discontinuation pattern)
    rx_waste6 = make_rx("PAT-054", prov.id, "DRUG-001", 500, "BID", 60, 30, status="pending")
    make_claim(rx_waste6, rx_waste6.pharmacy_id)

    # --- Prior Authorization Intelligence Scenarios ---
    # PAT-055: Brand drug with no generic trial (PA likely to be denied)
    pat_pa = Patient(
        id="PAT-055", first_name="Rachel", last_name="Nguyen",
        date_of_birth=_rand_dob(35, 55), gender="F",
        weight_kg=62.0, height_cm=160.0,
    )
    db.add(pat_pa)
    patients.append(pat_pa)
    db.add(Diagnosis(patient_id="PAT-055", icd10_code="K21.0", description="GERD with esophagitis",
                     date_diagnosed=_rand_date(2023, 2024).date(), is_active=True))
    db.add(LabResult(patient_id="PAT-055", test_name="eGFR", value=92,
                     unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                     date_collected=_rand_date(), is_abnormal=False))
    # Prescribing brand Nexium (DRUG-082) without ever trying generic omeprazole (DRUG-080)
    rx_pa1 = make_rx("PAT-055", prov.id, "DRUG-082", 40, "QD", 30, 30, status="pending")
    make_claim(rx_pa1, rx_pa1.pharmacy_id)

    # PAT-056: Specialty drug with no diagnosis match + no prior treatment (worst case PA)
    pat_pa2 = Patient(
        id="PAT-056", first_name="Kevin", last_name="Park",
        date_of_birth=_rand_dob(40, 55), gender="M",
        weight_kg=80.0, height_cm=178.0,
    )
    db.add(pat_pa2)
    patients.append(pat_pa2)
    # Only has hypertension diagnosis, but being prescribed adalimumab (RA drug)
    db.add(Diagnosis(patient_id="PAT-056", icd10_code="I10", description="Essential hypertension",
                     date_diagnosed=_rand_date(2022, 2024).date(), is_active=True))
    # No recent labs (last labs > 6 months ago)
    db.add(LabResult(patient_id="PAT-056", test_name="eGFR", value=85,
                     unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                     date_collected=datetime(2024, 6, 15), is_abnormal=False))
    # Prescribing Humira (specialty biologic) - no matching diagnosis, no prior treatment, no recent labs
    rx_pa2 = make_rx("PAT-056", prov.id, "DRUG-130", 40, "Q12H", 2, 30, status="pending")
    make_claim(rx_pa2, rx_pa2.pharmacy_id, billed_mult=1.0)

    # ─── v8 Scenarios (Spec April 2026) ───

    # --- Check 15: Pharmacogenomics ---
    # PAT-057: CYP2D6 PM prescribed codeine (CONTRAINDICATED — no morphine conversion)
    pat_pgx1 = Patient(
        id="PAT-057", first_name="Allison", last_name="Park",
        date_of_birth=_rand_dob(28, 42), gender="F",
        weight_kg=64.0, height_cm=165.0,
    )
    db.add(pat_pgx1)
    patients.append(pat_pgx1)
    db.add(Diagnosis(patient_id="PAT-057", icd10_code="M54.5", description="Low back pain",
                     date_diagnosed=_rand_date(2024, 2025).date(), is_active=True))
    db.add(LabResult(patient_id="PAT-057", test_name="eGFR", value=98,
                     unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                     date_collected=_rand_date(), is_abnormal=False))
    db.add(PGxResult(
        patient_id="PAT-057", gene="CYP2D6", phenotype="poor_metabolizer",
        diplotype="*4/*4", test_date=date(2024, 8, 15), cpic_level="A",
        source="JHM PGx panel"
    ))
    rx_pgx1 = make_rx("PAT-057", prov.id, "DRUG-201", 30, "QID", 120, 30, status="pending")  # codeine
    make_claim(rx_pgx1, rx_pgx1.pharmacy_id)

    # PAT-058: CYP2C19 PM prescribed clopidogrel (FDA black box - reduced efficacy)
    pat_pgx2 = Patient(
        id="PAT-058", first_name="Robert", last_name="Chen",
        date_of_birth=_rand_dob(58, 68), gender="M",
        weight_kg=88.0, height_cm=178.0,
    )
    db.add(pat_pgx2)
    patients.append(pat_pgx2)
    db.add(Diagnosis(patient_id="PAT-058", icd10_code="I25.10", description="ASCVD - native artery",
                     date_diagnosed=_rand_date(2023, 2024).date(), is_active=True))
    db.add(Diagnosis(patient_id="PAT-058", icd10_code="I21.9", description="Acute MI, post-PCI",
                     date_diagnosed=_rand_date(2024, 2024).date(), is_active=True))
    db.add(LabResult(patient_id="PAT-058", test_name="eGFR", value=72,
                     unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                     date_collected=_rand_date(), is_abnormal=False))
    db.add(PGxResult(
        patient_id="PAT-058", gene="CYP2C19", phenotype="poor_metabolizer",
        diplotype="*2/*2", test_date=date(2024, 6, 10), cpic_level="A",
        source="Cardiology PGx panel"
    ))
    rx_pgx2 = make_rx("PAT-058", prov.id, "DRUG-202", 75, "QD", 30, 30, status="pending")  # clopidogrel
    make_claim(rx_pgx2, rx_pgx2.pharmacy_id)

    # PAT-059: HLA-B*57:01 positive prescribed abacavir (ABSOLUTE CONTRAINDICATION)
    pat_pgx3 = Patient(
        id="PAT-059", first_name="Marcus", last_name="Thompson",
        date_of_birth=_rand_dob(35, 50), gender="M",
        weight_kg=75.0, height_cm=180.0,
    )
    db.add(pat_pgx3)
    patients.append(pat_pgx3)
    db.add(Diagnosis(patient_id="PAT-059", icd10_code="B20", description="HIV disease",
                     date_diagnosed=_rand_date(2022, 2024).date(), is_active=True))
    db.add(LabResult(patient_id="PAT-059", test_name="eGFR", value=92,
                     unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                     date_collected=_rand_date(), is_abnormal=False))
    db.add(PGxResult(
        patient_id="PAT-059", gene="HLA-B*57:01", phenotype="positive",
        diplotype="HLA-B*57:01 positive", test_date=date(2024, 9, 1), cpic_level="A",
        source="HIV pre-treatment screening"
    ))
    rx_pgx3 = make_rx("PAT-059", prov.id, "DRUG-203", 600, "QD", 30, 30, status="pending")  # abacavir
    make_claim(rx_pgx3, rx_pgx3.pharmacy_id)

    # --- Check 16: REMS Compliance ---
    # PAT-060: Female prescribed isotretinoin without iPLEDGE enrollment
    pat_rems1 = Patient(
        id="PAT-060", first_name="Mia", last_name="Rodriguez",
        date_of_birth=_rand_dob(18, 25), gender="F",
        weight_kg=55.0, height_cm=162.0,
    )
    db.add(pat_rems1)
    patients.append(pat_rems1)
    db.add(Diagnosis(patient_id="PAT-060", icd10_code="L70.0", description="Acne vulgaris",
                     date_diagnosed=_rand_date(2024, 2025).date(), is_active=True))
    # NO REMS enrollment — should trigger Check 16 critical flag
    rx_rems1 = make_rx("PAT-060", prov.id, "DRUG-204", 40, "QD", 30, 30, status="pending")
    make_claim(rx_rems1, rx_rems1.pharmacy_id)

    # PAT-061: Schizophrenia patient prescribed clozapine WITH active enrollment + recent monitoring
    pat_rems2 = Patient(
        id="PAT-061", first_name="Daniel", last_name="Kim",
        date_of_birth=_rand_dob(30, 50), gender="M",
        weight_kg=82.0, height_cm=175.0,
    )
    db.add(pat_rems2)
    patients.append(pat_rems2)
    db.add(Diagnosis(patient_id="PAT-061", icd10_code="F20.9", description="Schizophrenia",
                     date_diagnosed=_rand_date(2020, 2022).date(), is_active=True))
    db.add(REMSEnrollment(
        patient_id="PAT-061", rems_program="CLOZAPINE_REMS",
        enrollment_date=date(2024, 1, 15), is_active=True,
        last_monitoring_date=date(2025, 11, 1),  # OVERDUE — should trigger overdue monitoring
        notes="ANC monitoring overdue"
    ))
    rx_rems2 = make_rx("PAT-061", prov.id, "DRUG-205", 200, "BID", 60, 30, status="pending")
    make_claim(rx_rems2, rx_rems2.pharmacy_id)

    # --- Check 21: Naloxone Co-Prescribing Absence ---
    # PAT-052 already has high MME — make sure no naloxone exists (it doesn't)
    # Also create a clean scenario: high-dose opioid patient with no naloxone
    pat_nalox = Patient(
        id="PAT-062", first_name="Vanessa", last_name="Williams",
        date_of_birth=_rand_dob(40, 60), gender="F",
        weight_kg=70.0, height_cm=168.0,
    )
    db.add(pat_nalox)
    patients.append(pat_nalox)
    db.add(Diagnosis(patient_id="PAT-062", icd10_code="M54.5", description="Low back pain",
                     date_diagnosed=_rand_date(2022, 2024).date(), is_active=True))
    db.add(LabResult(patient_id="PAT-062", test_name="eGFR", value=82,
                     unit="mL/min/1.73m2", reference_range_low=60, reference_range_high=120,
                     date_collected=_rand_date(), is_abnormal=False))
    # 30 mg oxycodone QID = 120mg/day * 1.5 = 180 MME/day, well above 50 MME trigger
    rx_nalox1 = make_rx("PAT-062", prov.id, "DRUG-030", 30, "QID", 120, 30, status="approved")
    make_claim(rx_nalox1, rx_nalox1.pharmacy_id)
    # Plus benzo — opioid+benzo black box requires naloxone
    rx_nalox2 = make_rx("PAT-062", prov.id, "DRUG-040", 0.5, "BID", 60, 30, status="approved")  # alprazolam
    make_claim(rx_nalox2, rx_nalox2.pharmacy_id)

    # --- Check 24: Pill Mill / Fraud Network Detection ---
    # Create extra patients prescribed controlled substances by outlier providers
    # to amplify pill mill signal
    for i in range(63, 70):
        pat = Patient(
            id=f"PAT-{i:03d}", first_name=random.choice(FIRST_NAMES_M + FIRST_NAMES_F),
            last_name=random.choice(LAST_NAMES),
            date_of_birth=_rand_dob(28, 55), gender=random.choice(["M", "F"]),
            weight_kg=round(random.uniform(60, 95), 1), height_cm=round(random.uniform(160, 185), 1),
        )
        db.add(pat)
        patients.append(pat)
        db.add(Diagnosis(patient_id=f"PAT-{i:03d}", icd10_code="M54.5", description="Low back pain",
                         date_diagnosed=_rand_date(2023, 2024).date(), is_active=True))
        # All seen by same outlier provider for high-volume controlled Rx
        outlier = providers[16 + (i % 4)]  # PRV-017 to PRV-020
        rx_pm = make_rx(f"PAT-{i:03d}", outlier.id, "DRUG-030", 20, "QID", 120, 30, status="pending")
        make_claim(rx_pm, rx_pm.pharmacy_id, billed_mult=2.5)

    # --- Foundational: Excluded Provider (LEIE/SAM.gov) ---
    # Mark one outlier provider as on the LEIE list
    excluded_prv = providers[19]  # PRV-020
    excluded_prv.is_excluded = True
    excluded_prv.exclusion_source = "LEIE"
    excluded_prv.exclusion_date = date(2025, 6, 15)
    excluded_prv.exclusion_reason = "Conviction for healthcare fraud — 42 USC § 1320a-7(a)(1)"
    excluded_prv.exclusion_reinstatement_date = None  # Permanent

    # Also seed a few other LEIE entries (for the screening dashboard view)
    leie_entries = [
        ("1234567890", "Garcia", "Roberto", "LEIE", "mandatory",
         date(2024, 3, 10), None, "1128(a)(1)", "Conviction of program-related crimes", "FL"),
        ("9876543210", "Patel", "Anita", "LEIE", "mandatory",
         date(2025, 1, 5), None, "1128(a)(2)", "Patient abuse or neglect", "TX"),
        ("5555512345", "Jackson", "Marcus", "LEIE", "permissive",
         date(2024, 11, 20), date(2027, 11, 20), "1128(b)(7)", "Fraud, kickbacks, other prohibited activities", "NV"),
        ("4444498765", "Brown", "Stephanie", "SAM_GOV", "mandatory",
         date(2025, 4, 1), None, "Federal Award", "Debarment from federal contracts", "OH"),
        # Self-link to the actively-prescribing PRV-020
        (excluded_prv.npi, excluded_prv.last_name, excluded_prv.first_name,
         "LEIE", "mandatory", date(2025, 6, 15), None, "1128(a)(1)",
         "Conviction for healthcare fraud", "FL"),
    ]
    for npi, ln, fn, src, ext, edate, rdate, rcode, rdesc, st in leie_entries:
        db.add(ExcludedProvider(
            npi=npi, last_name=ln, first_name=fn,
            exclusion_source=src, exclusion_type=ext,
            exclusion_date=edate, reinstatement_date=rdate,
            reason_code=rcode, reason_description=rdesc,
            state=st, last_synced=datetime.now(),
        ))

    db.flush()

    # ─── GLP-1 utilization cohort (TPA cost-containment story) ───
    # 12 members on GLP-1 therapy: 7 with a T2DM diagnosis (appropriate),
    # 5 weight-loss-only (no E11 code) — the avoidable-spend population the
    # /tpa/glp1-watch endpoint surfaces for indication review.
    print("[Axeris] Seeding GLP-1 utilization cohort...")
    glp1_drugs = ["DRUG-007", "DRUG-206", "DRUG-208", "DRUG-207"]
    # 5 chronic members (metformin history + T2DM) = appropriate use;
    # 2 healthy members given a T2DM dx but no first-line trial = step-therapy gap;
    # 5 healthy members with obesity-only coding = indication review (weight-loss use).
    glp1_cohort = patients[10:15] + patients[0:2] + patients[3:8]
    for gi, pat in enumerate(glp1_cohort):
        prov = providers[gi % 14]
        drug_id = glp1_drugs[gi % len(glp1_drugs)]
        has_t2dm = gi < 7
        if has_t2dm:
            db.add(Diagnosis(patient_id=pat.id, icd10_code="E11.9",
                             description="Type 2 diabetes mellitus without complications",
                             date_diagnosed=_rand_date().date(), is_active=True))
        else:
            db.add(Diagnosis(patient_id=pat.id, icd10_code="E66.9",
                             description="Obesity, unspecified",
                             date_diagnosed=_rand_date().date(), is_active=True))
        # 3 monthly fills each (initial + 2 refills) for a utilization trend
        first_fill = datetime.now() - timedelta(days=random.randint(70, 90))
        orig_rx = None
        for fill in range(3):
            fill_date = first_fill + timedelta(days=28 * fill)
            rx = make_rx(
                pat.id, prov.id, drug_id, 1, "QW", 4, 28,
                is_refill=fill > 0, orig_id=orig_rx.id if orig_rx else None,
                date_written=fill_date, date_filled=fill_date,
                status="approved" if has_t2dm else ("approved" if fill < 2 else "pending"),
            )
            if fill == 0:
                orig_rx = rx
            db.flush()
            make_claim(rx, rx.pharmacy_id)

    db.flush()

    # ─── IV-infusion specialty cohort (site-of-care optimization) ───
    # 6 members on clinic-infused IV biologics currently administered at the
    # highest-cost hospital-outpatient department (HOPD). These feed the
    # /pba/site-of-care worklist — same drug, ~52% cheaper at home/office.
    print("[Axeris] Seeding IV-infusion specialty cohort...")
    infusion_drugs = ["DRUG-331", "DRUG-334", "DRUG-338"]  # infliximab, rituximab, vedolizumab
    # Label-accurate per-infusion dosing: (dose_mg, vials dispensed). Quantity
    # is vials because that is what the claim is billed on and what drives the
    # vial-wastage check. Rituximab is the interesting one: 700mg drawn from
    # 500mg vials means two vials billed and 300mg discarded every cycle.
    # Per-infusion dose and the number of billed units. Units are 100mg for
    # rituximab and infliximab and one 300mg vial for vedolizumab, so quantity
    # multiplied by the drug's unit price reconciles to the acquisition cost of
    # the claim rather than floating free of it.
    INFUSION_DOSING = {
        "DRUG-331": (400, 4),   # infliximab 5 mg/kg at ~80kg, 4 x 100mg
        "DRUG-334": (700, 7),   # rituximab 375 mg/m2 at ~1.87 m2, 7 x 100mg
        "DRUG-338": (300, 1),   # vedolizumab 300mg flat, 1 x 300mg
    }
    # HCPCS for the buy-and-bill side. These are provider-administered drugs
    # adjudicated on the medical benefit, not at a retail pharmacy counter.
    INFUSION_HCPCS = {"DRUG-331": "J1745", "DRUG-334": "J9312", "DRUG-338": "J3380"}
    infusion_cohort = patients[22:28]  # complex/high-risk archetypes
    # Infused oncology and autoimmune biologics are prescribed by the
    # hematology/oncology specialist, not a family medicine physician.
    for ii, pat in enumerate(infusion_cohort):
        prov = providers[15]
        drug_id = infusion_drugs[ii % len(infusion_drugs)]
        # Autoimmune/oncology diagnosis to justify the biologic
        dx_code, dx_desc = [
            ("K50.90", "Crohn's disease, unspecified"),
            ("C85.90", "Non-Hodgkin lymphoma, unspecified"),
            ("K51.90", "Ulcerative colitis, unspecified"),
        ][ii % 3]
        db.add(Diagnosis(patient_id=pat.id, icd10_code=dx_code, description=dx_desc,
                         date_diagnosed=_rand_date().date(), is_active=True))
        first = datetime.now() - timedelta(days=random.randint(120, 160))
        orig = None
        for fill in range(3):  # ~8-week infusion cycle
            fd = first + timedelta(days=56 * fill)
            # The two earlier cycles already adjudicated. The most recent one
            # arrived on this week's file and is still awaiting review, which
            # is what puts these high-dollar biologics in the pend queue.
            fill_status = "approved" if fill < 2 else "pending"
            inf_dose, inf_units = INFUSION_DOSING[drug_id]
            rx = make_rx(pat.id, prov.id, drug_id, inf_dose, "Q8W", inf_units, 56,
                         is_refill=fill > 0, orig_id=orig.id if orig else None,
                         date_written=fd, date_filled=fd, status=fill_status)
            if fill == 0:
                orig = rx
            db.flush()
            # HOPD billing: infusion biologics billed at ~2.1x acquisition
            cl = make_claim(rx, rx.pharmacy_id, billed_mult=2.1)
            # These adjudicate on the medical benefit at a hospital outpatient
            # department, not through a retail pharmacy. Tagging them that way
            # keeps the claim consistent with the site-of-care finding.
            if cl is not None:
                cl.claim_type = "Medical"
                cl.place_of_service = "22 — On-Campus Hospital Outpatient"
                cl.hcpcs_code = INFUSION_HCPCS.get(drug_id)

    db.flush()

    # ─── Medication adherence cohort (PDC longitudinal fill history) ───
    # 12 members each on one CMS Star maintenance drug, with a deterministic
    # PDC target (0.42–0.95) realized as evenly-spaced 30-day fills over a
    # 360-day window. Feeds /tpa/adherence — non-adherence to chronic meds is
    # the single largest avoidable-cost driver (downstream hospitalizations).
    print("[Axeris] Seeding medication adherence cohort...")
    ADH_TARGETS = [0.42, 0.55, 0.50, 0.61, 0.68, 0.73, 0.78, 0.83, 0.88, 0.91, 0.95, 0.65]
    # statin, metformin (T2DM), lisinopril (RAS antagonist), apixaban, dapagliflozin
    ADH_DRUGS = [("DRUG-020", 20, "QD"), ("DRUG-001", 500, "BID"), ("DRUG-010", 10, "QD"),
                 ("DRUG-051", 5, "BID"), ("DRUG-353", 10, "QD")]
    ADH_WINDOW = 360
    adh_cohort = patients[10:22]
    for adi, pat in enumerate(adh_cohort):
        prov = providers[adi % 14]
        drug_id, dose, freq = ADH_DRUGS[adi % len(ADH_DRUGS)]
        target = ADH_TARGETS[adi % len(ADH_TARGETS)]
        n_fills = max(2, round(target * ADH_WINDOW / 30))  # 30-day fills; gaps => low PDC
        spacing = ADH_WINDOW / n_fills
        start = datetime.now() - timedelta(days=ADH_WINDOW)
        orig = None
        for f in range(n_fills):
            fd = start + timedelta(days=int(f * spacing))
            rx = make_rx(pat.id, prov.id, drug_id, dose, freq, 30, 30,
                         is_refill=f > 0, orig_id=orig.id if orig else None,
                         date_written=fd, date_filled=fd, status="approved")
            if f == 0:
                orig = rx
            db.flush()
            make_claim(rx, rx.pharmacy_id)

    db.flush()

    # ─── Truveta TDM enrichment ───
    # Populate Person / PersonAddress / Encounter / MedicationRequest /
    # Claim fields so every patient and claim carries TDM-aligned data.
    print("[Axeris] Enriching records with Truveta TDM fields...")
    RACES = ["White", "Black or African American", "Asian",
             "American Indian or Alaska Native", "Native Hawaiian or Other Pacific Islander", "Other Race"]
    ETHNICITIES = ["Not Hispanic or Latino", "Not Hispanic or Latino", "Not Hispanic or Latino", "Hispanic or Latino"]
    LANGS = ["English", "English", "English", "English", "Spanish", "Mandarin", "Arabic"]
    MARITAL = ["Married", "Never Married", "Divorced", "Widowed"]
    STATES_ZIP = [("TX", "75001"), ("IL", "60601"), ("CA", "94103"), ("OK", "73101"),
                  ("WA", "98101"), ("IA", "50309"), ("FL", "33101"), ("CO", "80202")]
    FACILITIES = ["Axeris Health Partners — Main Campus", "Lakeside Family Medicine",
                  "Metro Endocrinology Associates", "Riverbend Urgent Care", "Summit Behavioral Health"]
    ENC_CLASSES = ["ambulatory", "ambulatory", "ambulatory", "telehealth", "emergency", "inpatient"]
    FREQ_SIG = {
        "QD": "Take 1 dose by mouth once daily",
        "BID": "Take 1 dose by mouth twice daily",
        "TID": "Take 1 dose by mouth three times daily",
        "QID": "Take 1 dose by mouth four times daily",
        "Q6H": "Take 1 dose by mouth every 6 hours as needed",
        "QW": "Inject 1 dose subcutaneously once weekly",
        "PRN": "Take 1 dose by mouth as needed",
    }

    enc_counter = 0
    for pat in db.query(Patient).all():
        prng = random.Random(f"tdm:{pat.id}")
        pat.race = prng.choice(RACES)
        pat.ethnicity = prng.choice(ETHNICITIES)
        pat.marital_status = prng.choice(MARITAL)
        pat.preferred_language = prng.choice(LANGS)
        st, zp = prng.choice(STATES_ZIP)
        pat.state = st
        pat.postal_code = zp
        pat.is_deceased = False
        for _ in range(prng.randint(1, 3)):
            enc_counter += 1
            cls = prng.choice(ENC_CLASSES)
            start = _rand_date()
            db.add(Encounter(
                id=f"ENC-{enc_counter:04d}", patient_id=pat.id,
                encounter_class=cls, status="finished", start_date=start,
                end_date=start + timedelta(hours=prng.randint(24, 96) if cls == "inpatient" else prng.randint(1, 3)),
                facility_name=prng.choice(FACILITIES),
                admit_source="emergency_room" if cls == "emergency" else "physician_referral",
                discharge_disposition="home",
            ))

    for rx in db.query(Prescription).all():
        drug = db.get(Drug, rx.drug_id)
        # NDC-11 and RXCUI are product-level — keyed by drug id so every fill
        # of the same product carries the same codes.
        drng = random.Random(f"ndc:{rx.drug_id}")
        rx.ndc11 = f"{drng.randint(10000, 69999):05d}-{drng.randint(100, 9999):04d}-{drng.randint(1, 99):02d}"
        rx.rxnorm_code = str(random.Random(f"rxcui:{rx.drug_id}").randint(198000, 2599999))
        rx.route = (drug.route if drug and drug.route else "oral")
        rx.sig = FREQ_SIG.get(rx.frequency, f"Take as directed ({rx.frequency})")

    # Default everything to the pharmacy benefit, but leave alone the claims
    # already tagged Medical. Provider-administered infusions adjudicate on the
    # medical side at a hospital outpatient department, and overwriting that
    # here would contradict their own site-of-care finding.
    for cl in db.query(InsuranceClaim).all():
        if cl.claim_type == "Medical":
            continue
        cl.claim_type = "Pharmacy"
        cl.place_of_service = "01 — Pharmacy"
    db.flush()

    # ─── Run analysis on all prescriptions ───
    print("[Axeris] Running analysis on all prescriptions...")
    from engines import rules_engine, ml_engine, patient_engine

    all_rxs = db.query(Prescription).all()
    for rx in all_rxs:
        patient = db.get(Patient, rx.patient_id)
        drug = db.get(Drug, rx.drug_id)
        if not patient or not drug:
            continue

        all_flags = []
        try:
            all_flags.extend(rules_engine.evaluate(rx, patient, drug, db))
        except Exception as e:
            print(f"  Rules engine error on {rx.id}: {e}")
        try:
            all_flags.extend(ml_engine.evaluate(rx, patient, drug, db))
        except Exception as e:
            print(f"  ML engine error on {rx.id}: {e}")
        try:
            all_flags.extend(patient_engine.evaluate(rx, patient, drug, db))
        except Exception as e:
            print(f"  Patient engine error on {rx.id}: {e}")

        if not all_flags:
            risk_score = 0.0
        else:
            total_weight = sum(f["weight"] for f in all_flags)
            risk_score = min(1.0, total_weight / 2.0)

        if risk_score >= 0.7:
            flag_color = "RED"
        elif risk_score >= 0.3:
            flag_color = "YELLOW"
        else:
            flag_color = "GREEN"

        # v8: APPROVE/REVIEW/FLAG disposition + soft/hard hold
        if flag_color == "GREEN":
            disposition, hold_type, sla_deadline = "APPROVE", None, None
        elif flag_color == "YELLOW":
            disposition, hold_type = "REVIEW", "soft_hold"
            sla_deadline = datetime.now() + timedelta(hours=24)
        else:
            disposition, hold_type, sla_deadline = "FLAG", "hard_hold", None

        # ERISA audit trail
        by_engine = {}
        for f in all_flags:
            eng = f.get("engine", "unknown")
            by_engine.setdefault(eng, []).append({
                "flag_id": f.get("flag_id"),
                "category": f.get("category"),
                "severity": f.get("severity"),
                "weight": f.get("weight"),
                "evidence_source": f.get("evidence_source"),
            })

        rx.flags = all_flags
        rx.risk_score = risk_score
        rx.flag_color = flag_color
        rx.disposition = disposition
        rx.hold_type = hold_type
        rx.sla_deadline = sla_deadline
        rx.operating_mode = "TPA"
        rx.processing_time_ms = random.randint(45, 180)  # synthetic latency
        rx.audit_trail = {
            "engines_fired": list(by_engine.keys()),
            "flags_by_engine": by_engine,
            "total_flags": len(all_flags),
            # Same 0-100 scale the header renders, so the audit trail and the
            # score above it do not disagree on screen.
            "risk_score": round(risk_score * 100),
            "risk_score_raw": round(risk_score, 3),
            "disposition": disposition,
            "hold_type": hold_type,
            "operating_mode": "TPA",
            "erisa_section": "404(a)(1)(B) — fiduciary duty audit trail",
        }
        rx.analysis_timestamp = datetime.now()

    db.commit()
    db.close()

    # Summary
    db2 = SessionLocal()
    total = db2.query(Prescription).count()
    green = db2.query(Prescription).filter(Prescription.flag_color == "GREEN").count()
    yellow = db2.query(Prescription).filter(Prescription.flag_color == "YELLOW").count()
    red = db2.query(Prescription).filter(Prescription.flag_color == "RED").count()
    print(f"[Axeris] Seeding complete: {total} prescriptions ({green} GREEN, {yellow} YELLOW, {red} RED)")
    db2.close()
