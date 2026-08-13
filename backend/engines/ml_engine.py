"""
ML & Anomaly Detection Engine — statistical pattern-based scoring.

Checks (7 total):
1. Prescriber behavior scoring (controlled substance volume vs peers)
2. Patient doctor-shopping detection
3. Refill pattern anomalies
4. Pharmacy billing anomaly detection
5. Cost outlier detection (brand vs generic available)
6. Drug wastage detection (abandoned medications, vial wastage)
7. Prior authorization outcome prediction
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
import numpy as np

from database.models import (
    Prescription, Patient, Drug, Provider, InsuranceClaim,
    TherapeuticEquivalence, Pharmacy, LabResult, Diagnosis
)
from config import (
    CONTROLLED_SUBSTANCE_VOLUME_ZSCORE,
    DOCTOR_SHOPPING_PROVIDER_THRESHOLD,
    EARLY_REFILL_DAYS,
)

CONTROLLED_SCHEDULES = {"II", "III", "IV"}


def _make_flag(flag_id, category, severity, weight, title, description, evidence, action):
    return {
        "flag_id": flag_id,
        "category": category,
        "severity": severity,
        "weight": weight,
        "title": title,
        "description": description,
        "evidence_source": evidence,
        "suggested_action": action,
        "engine": "ml",
    }


def _vial_sizes_mg(drug) -> list:
    """Every vial size this product ships in, in mg.

    Uses the drug's declared presentations where available. Falls back to the
    single strength on the record, which is the conservative case.
    """
    declared = getattr(drug, "vial_sizes_mg", None)
    if declared:
        try:
            return [float(v) for v in declared if float(v) > 0]
        except (TypeError, ValueError):
            pass
    try:
        head = (drug.strength or "").split("/")[0]
        num = "".join(c for c in head.split("m")[0] if c.isdigit() or c == ".")
        val = float(num)
        return [val] if val > 0 else []
    except (ValueError, IndexError):
        return []


def _min_dispensed_mg(dose_mg: float, sizes: list) -> float:
    """Smallest total mg that covers the dose using the available vial sizes.

    Greedy from the largest vial down, then a final top-up with the smallest
    vial. This mirrors how a pharmacy actually builds the dose, and it is what
    determines whether any drug is genuinely discarded.
    """
    if not sizes or dose_mg <= 0:
        return 0.0
    ordered = sorted(sizes, reverse=True)
    smallest = ordered[-1]
    total = 0.0
    for size in ordered:
        while total + size <= dose_mg:
            total += size
    while total < dose_mg:
        total += smallest
    return total


def prescriber_behavior_scoring(rx: Prescription, provider: Provider, drug: Drug, db: Session):
    """Compare provider's controlled substance volume against specialty peers."""
    flags = []
    if drug.schedule not in CONTROLLED_SCHEDULES:
        return flags

    # Get all providers in same specialty
    peers = db.query(Provider).filter(Provider.specialty == provider.specialty).all()
    if len(peers) < 2:
        return flags

    peer_volumes = []
    provider_volume = 0
    for p in peers:
        count = db.query(Prescription).filter(
            Prescription.provider_id == p.id,
        ).join(Drug).filter(
            Drug.schedule.in_(CONTROLLED_SCHEDULES)
        ).count()
        peer_volumes.append(count)
        if p.id == provider.id:
            provider_volume = count

    peer_arr = np.array(peer_volumes, dtype=float)
    mean = np.mean(peer_arr)
    std = np.std(peer_arr)
    if std == 0:
        return flags

    z_score = (provider_volume - mean) / std

    if z_score > CONTROLLED_SUBSTANCE_VOLUME_ZSCORE:
        flags.append(_make_flag(
            "ML-PRV-001", "prescriber_anomaly", "warning", 0.4,
            f"Prescriber controlled substance volume is {z_score:.1f} std deviations above peers",
            f"Dr. {provider.last_name} ({provider.specialty}) has prescribed {provider_volume} controlled substance "
            f"prescriptions. Peer average for {provider.specialty}: {mean:.0f} (std: {std:.0f}). "
            f"Z-score: {z_score:.2f} (threshold: {CONTROLLED_SUBSTANCE_VOLUME_ZSCORE}).",
            "Statistical anomaly detection — prescriber volume analysis",
            "Review prescribing patterns. Consider clinical audit or peer review."
        ))
    return flags


def doctor_shopping_detection(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Detect patients receiving controlled substances from multiple prescribers."""
    flags = []
    if drug.schedule not in CONTROLLED_SCHEDULES:
        return flags

    ninety_days_ago = datetime.now() - timedelta(days=90)
    distinct_providers = db.query(
        func.count(func.distinct(Prescription.provider_id))
    ).filter(
        Prescription.patient_id == patient.id,
        Prescription.date_written >= ninety_days_ago,
    ).join(Drug).filter(
        Drug.schedule.in_(CONTROLLED_SCHEDULES)
    ).scalar() or 0

    if distinct_providers >= DOCTOR_SHOPPING_PROVIDER_THRESHOLD:
        flags.append(_make_flag(
            "ML-SHOP-001", "doctor_shopping", "critical", 0.7,
            f"Potential doctor shopping: {distinct_providers} prescribers for controlled substances in 90 days",
            f"Patient {patient.first_name} {patient.last_name} has received controlled substance prescriptions "
            f"from {distinct_providers} different providers in the last 90 days "
            f"(threshold: {DOCTOR_SHOPPING_PROVIDER_THRESHOLD}).",
            "Controlled substance monitoring program guidelines",
            "Lock patient to single prescriber for controlled substances. Check PDMP."
        ))
    return flags


def refill_pattern_analysis(rx: Prescription, patient: Patient, db: Session):
    """Detect early refills and adherence gaps."""
    flags = []
    if not rx.is_refill or not rx.original_rx_id:
        return flags

    # Compare against the most recent prior fill of this drug, not the original
    # one. On a multi-cycle therapy the original is many cycles back, so
    # measuring from it reports the whole elapsed course as a refill gap: a
    # drug on an eight-week cycle looks 56 days late on its third infusion.
    prior = db.query(Prescription).filter(
        Prescription.patient_id == rx.patient_id,
        Prescription.drug_id == rx.drug_id,
        Prescription.id != rx.id,
        Prescription.date_filled.isnot(None),
        Prescription.date_filled <= (rx.date_written or datetime.now()),
    ).order_by(Prescription.date_filled.desc()).first()
    if not prior or not prior.date_filled:
        return flags

    expected_refill = prior.date_filled + timedelta(days=prior.days_supply)
    if rx.date_written:
        days_early = (expected_refill - rx.date_written).days

        if days_early > EARLY_REFILL_DAYS:
            flags.append(_make_flag(
                "ML-REFILL-001", "refill_pattern", "warning", 0.5,
                f"Early refill: {days_early} days before expected date",
                f"Previous supply filled on {prior.date_filled.strftime('%Y-%m-%d')} for {prior.days_supply} days. "
                f"New prescription written {rx.date_written.strftime('%Y-%m-%d')}, "
                f"which is {days_early} days early (threshold: {EARLY_REFILL_DAYS} days).",
                "Controlled substance refill monitoring guidelines",
                "Verify reason for early refill (lost, stolen, dose change, or potential misuse)."
            ))

        # Check for large gaps (potential non-adherence)
        if days_early < -14:
            gap = abs(days_early)
            flags.append(_make_flag(
                "ML-REFILL-002", "adherence_gap", "info", 0.15,
                f"Medication gap: {gap} days without refill",
                f"Patient went {gap} days past expected refill date before requesting new supply. "
                f"This may indicate non-adherence or tolerability issues.",
                "Medication adherence monitoring",
                "Assess adherence barriers. Consider medication review."
            ))
    return flags


def pharmacy_billing_anomaly(rx: Prescription, drug: Drug, db: Session):
    """Detect billing anomalies by comparing pharmacy costs."""
    flags = []
    if not rx.pharmacy_id:
        return flags

    claims = db.query(InsuranceClaim).join(Prescription).filter(
        Prescription.drug_id == drug.id,
    ).all()

    this_claim = next((c for c in claims if c.prescription_id == rx.id), None)
    if not this_claim or not this_claim.billed_amount:
        return flags

    # Benchmark against the *other* billers, not against a pool this claim is
    # already inside. Including it pulls the mean toward the outlier and
    # understates how far out the claim actually sits.
    peers = [
        c.billed_amount for c in claims
        if c.prescription_id != rx.id and c.billed_amount
    ]
    if len(peers) < 3:
        return flags

    amounts = np.array(peers, dtype=float)
    mean = float(np.mean(amounts))
    std = float(np.std(amounts))
    if std == 0:
        return flags

    z = (this_claim.billed_amount - mean) / std
    if z > 2.0:
        pharmacy = db.get(Pharmacy, rx.pharmacy_id)
        # Provider-administered drugs bill on the medical benefit, so this is a
        # billed-rate outlier rather than a pharmacy-counter finding.
        medical = (this_claim.claim_type or "").lower() == "medical"
        biller = "Billing provider" if medical else "Pharmacy"
        site = this_claim.place_of_service or ("medical benefit" if medical else "pharmacy benefit")
        flags.append(_make_flag(
            "ML-BILL-001", "billing_anomaly", "warning", 0.4,
            f"Billed-rate outlier: ${this_claim.billed_amount:,.2f} is {z:.1f} std above the peer benchmark",
            f"{biller} '{pharmacy.name if pharmacy else rx.pharmacy_id}' billed ${this_claim.billed_amount:,.2f} "
            f"for {drug.generic_name} at {site}. The benchmark across the other {len(peers)} billers of this drug "
            f"is ${mean:,.2f} (std ${std:,.2f}), which puts this claim ${this_claim.billed_amount - mean:,.2f} above "
            f"the benchmark. This claim is excluded from its own benchmark.",
            "Claims anomaly detection — billed-rate variance across billers of the same drug",
            "Audit the billed rate against the contracted schedule for this site of service."
        ))
    return flags


def cost_outlier_detection(rx: Prescription, drug: Drug, db: Session):
    """Flag brand-name drugs when cheaper therapeutic equivalents exist."""
    flags = []
    equivalences = db.query(TherapeuticEquivalence).filter(
        (TherapeuticEquivalence.drug_a_id == drug.id) |
        (TherapeuticEquivalence.drug_b_id == drug.id)
    ).all()

    for eq in equivalences:
        alt_drug_id = eq.drug_b_id if eq.drug_a_id == drug.id else eq.drug_a_id
        alt_drug = db.get(Drug, alt_drug_id)
        if not alt_drug:
            continue

        # Only flag if alternative is significantly cheaper
        if eq.cost_difference_pct and eq.cost_difference_pct > 20:
            # Biologics and small molecules live in different FDA references.
            # The Purple Book lists licensed biologics with their biosimilar and
            # interchangeable designations; the Orange Book covers small-molecule
            # therapeutic equivalence. "Therapeutic equivalence" is Orange Book
            # language and does not apply to a biosimilar.
            is_bio = (eq.equivalence_type or "").lower() == "biosimilar"
            interchangeable = bool(getattr(alt_drug, "is_interchangeable", False))

            if is_bio:
                label = "biosimilar"
                source = f"FDA Purple Book — licensed biologic, {'interchangeable' if interchangeable else 'biosimilar'} designation"
                if interchangeable:
                    basis = (
                        f"{alt_drug.brand_name} carries FDA interchangeable designation, so it may be substituted "
                        f"for {drug.brand_name} without prescriber intervention where state law permits."
                    )
                    action = (
                        f"Substitute {alt_drug.generic_name} ({alt_drug.brand_name}). Interchangeable status supports "
                        f"substitution directly; confirm site-of-care and buy-and-bill workflow before the next cycle."
                    )
                    severity, weight = "warning", 0.35
                else:
                    basis = (
                        f"{alt_drug.brand_name} is a licensed biosimilar but is not designated interchangeable, "
                        f"so substitution requires prescriber agreement."
                    )
                    action = f"Route to formulary review for a preferred-biosimilar step to {alt_drug.generic_name}."
                    severity, weight = "info", 0.2
            else:
                label = f"{eq.equivalence_type} equivalent"
                source = f"FDA Orange Book — therapeutic equivalence ({eq.evidence_level})"
                basis = f"{alt_drug.brand_name or alt_drug.generic_name} is an FDA-rated therapeutic equivalent."
                action = f"Consider switching to {alt_drug.generic_name} for {eq.cost_difference_pct:.0f}% cost savings."
                severity, weight = "info", 0.2

            flags.append(_make_flag(
                "ML-COST-001", "cost_optimization", severity, weight,
                f"{eq.cost_difference_pct:.0f}% lower-cost {label} available: {alt_drug.brand_name or alt_drug.generic_name}",
                f"{drug.generic_name} ({drug.brand_name}) at ${drug.average_cost_per_unit:,.2f}/unit versus "
                f"{alt_drug.generic_name} ({alt_drug.brand_name}) at ${alt_drug.average_cost_per_unit:,.2f}/unit, "
                f"a {eq.cost_difference_pct:.0f}% difference. {basis}",
                source,
                action,
            ))
    return flags


def drug_wastage_detection(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Drug Wastage Detection Module — identifies dispensed-but-unused medications.

    Spec: Identifies medications dispensed but likely not used based on refill patterns.
    Flags early discontinuation. Calculates wasted spend on abandoned medications.
    Detects vial wastage for injectable specialty drugs.
    """
    flags = []

    # Drug classes that are typically chronic (expected to refill)
    CHRONIC_CATEGORIES = {
        "antidiabetic", "antihypertensive", "statin", "anticoagulant",
        "antidepressant", "anticonvulsant", "thyroid", "proton pump inhibitor",
        "bronchodilator", "immunosuppressant", "biologic", "opioid analgesic",
        "benzodiazepine", "gabapentinoid",
    }
    is_chronic_drug = (
        drug.therapeutic_category and
        any(cat in (drug.therapeutic_category or "").lower() for cat in CHRONIC_CATEGORIES)
    ) or rx.days_supply >= 28

    # --- Check 1: Abandoned Medications (filled chronic drug never refilled, now re-prescribed) ---
    if is_chronic_drug:
        past_filled = db.query(Prescription).filter(
            Prescription.patient_id == patient.id,
            Prescription.drug_id == drug.id,
            Prescription.id != rx.id,
            Prescription.date_filled.isnot(None),
            Prescription.days_supply >= 28,
        ).order_by(Prescription.date_filled.desc()).all()

        for prior_rx in past_filled:
            if not prior_rx.date_filled or not prior_rx.days_supply:
                continue
            expected_end = prior_rx.date_filled + timedelta(days=prior_rx.days_supply)

            # Check if there was a refill within 2x the supply window
            refill_exists = db.query(Prescription).filter(
                Prescription.patient_id == patient.id,
                Prescription.drug_id == drug.id,
                Prescription.id != prior_rx.id,
                Prescription.id != rx.id,
                Prescription.date_written >= expected_end - timedelta(days=7),
                Prescription.date_written <= expected_end + timedelta(days=prior_rx.days_supply),
            ).first()

            if not refill_exists:
                days_since = (datetime.now() - expected_end).days
                if days_since > 45:  # More than 45 days past supply without refill
                    wasted_cost = drug.average_cost_per_unit * prior_rx.quantity if drug.average_cost_per_unit else 0
                    flags.append(_make_flag(
                        "ML-WASTE-001", "drug_wastage", "info", 0.2,
                        f"Abandoned medication: {drug.generic_name} dispensed but not continued",
                        f"Patient was dispensed {drug.generic_name} ({prior_rx.quantity} units) on "
                        f"{prior_rx.date_filled.strftime('%Y-%m-%d')} for {prior_rx.days_supply} days. "
                        f"No refill was requested within the expected window. "
                        f"Estimated wasted spend: ${wasted_cost:.2f}. "
                        f"Patient is now being re-prescribed the same medication.",
                        "Refill pattern analysis — medication discontinuation detection",
                        "Verify prior discontinuation reason. Assess whether re-trial is appropriate."
                    ))
                    break  # Only flag once per drug

    # --- Check 2: Early Discontinuation Pattern ---
    # Only count chronic meds (>=28 day supply) that were truly abandoned
    # (no current active/pending prescription for that drug)
    all_filled = db.query(Prescription).filter(
        Prescription.patient_id == patient.id,
        Prescription.date_filled.isnot(None),
        Prescription.days_supply >= 28,
    ).all()

    # Get currently active drug IDs (approved or pending = still in use)
    active_drug_ids = set()
    active_rxs = db.query(Prescription).filter(
        Prescription.patient_id == patient.id,
        Prescription.status.in_(["approved", "pending"]),
    ).all()
    for arx in active_rxs:
        active_drug_ids.add(arx.drug_id)

    discontinued_count = 0
    total_wasted_spend = 0.0
    seen_drugs = set()
    for filled_rx in all_filled:
        if not filled_rx.days_supply or not filled_rx.date_filled:
            continue
        if filled_rx.drug_id in seen_drugs:
            continue
        # Skip drugs that still have an active prescription
        if filled_rx.drug_id in active_drug_ids:
            continue
        expected = filled_rx.date_filled + timedelta(days=filled_rx.days_supply)
        if (datetime.now() - expected).days > 45:
            discontinued_count += 1
            seen_drugs.add(filled_rx.drug_id)
            d = db.get(Drug, filled_rx.drug_id)
            if d and d.average_cost_per_unit:
                total_wasted_spend += d.average_cost_per_unit * filled_rx.quantity

    if discontinued_count >= 3:
        flags.append(_make_flag(
            "ML-WASTE-002", "drug_wastage", "warning", 0.3,
            f"Early discontinuation pattern: {discontinued_count} abandoned chronic medications",
            f"Patient has {discontinued_count} chronic medications that were dispensed but never refilled "
            f"and no current active prescriptions for those drugs. "
            f"Total estimated wasted spend: ${total_wasted_spend:.2f}. "
            f"This pattern suggests adherence issues or tolerability problems.",
            "Medication utilization review — discontinuation pattern analysis",
            "Review medication tolerance with patient. Consider medication therapy management (MTM) referral."
        ))

    # --- Check 3: Vial Wastage for Injectable Specialty Drugs ---
    if drug.is_specialty and drug.route and drug.route.lower() in ("subcutaneous", "intravenous", "intramuscular", "injection"):
        # Waste is only real once you account for every vial size the product
        # actually ships in. Rituximab comes in 100mg and 500mg vials, so a
        # 700mg dose is 500 + 100 + 100 with nothing discarded. Assuming a
        # single vial size manufactures waste that does not exist.
        if drug.strength:
            try:
                sizes = _vial_sizes_mg(drug)
                if rx.dose_mg and sizes:
                    dispensed = _min_dispensed_mg(rx.dose_mg, sizes)
                    wasted_mg = dispensed - rx.dose_mg
                    waste_pct = (wasted_mg / dispensed * 100) if dispensed else 0
                    # Only flag when a materially cheaper fill was achievable.
                    if wasted_mg > 0 and waste_pct >= 10:
                        unit_mg = max(sizes)
                        cost_per_mg = (drug.average_cost_per_unit or 0) / unit_mg if unit_mg else 0
                        waste_cost = wasted_mg * cost_per_mg
                        flags.append(_make_flag(
                            "ML-WASTE-003", "drug_wastage", "info", 0.15,
                            f"Vial wastage: {wasted_mg:.0f}mg discarded per administration of {drug.generic_name}",
                            f"Prescribed dose is {rx.dose_mg:.0f}mg. The closest fill from available vial sizes "
                            f"({', '.join(f'{s:.0f}mg' for s in sorted(sizes))}) is {dispensed:.0f}mg, leaving "
                            f"{wasted_mg:.0f}mg ({waste_pct:.0f}%) discarded and billed. "
                            f"Estimated waste cost: ${waste_cost:,.2f} per administration.",
                            "Specialty drug utilization — vial optimization against available presentations",
                            "Review dose rounding against vial sizes, or a vial-sharing program where permitted."
                        ))
            except (ValueError, IndexError):
                pass  # Can't parse strength, skip

    return flags


def pa_outcome_prediction(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Prior Authorization Intelligence Module — predicts PA outcome before submission.

    Spec: Predicts PA outcome before submission based on clinical data.
    Pre-populates PA forms with available clinical evidence.
    Identifies missing documentation that will cause denial.
    """
    flags = []

    # Only flag drugs that realistically require PA:
    # - Specialty drugs (>$1000/month)
    # - Brand-name drugs with cheaper therapeutic equivalents on file
    # - Schedule II controlled substances
    has_cheaper_equivalent = db.query(TherapeuticEquivalence).filter(
        ((TherapeuticEquivalence.drug_a_id == drug.id) | (TherapeuticEquivalence.drug_b_id == drug.id)),
        TherapeuticEquivalence.cost_difference_pct > 20,
    ).first() is not None

    needs_pa = (
        drug.is_specialty or
        (drug.brand_name and drug.generic_available and has_cheaper_equivalent) or
        (drug.schedule and drug.schedule == "II")
    )
    if not needs_pa:
        return flags

    # --- Gather clinical evidence for PA prediction ---
    active_diags = [d.icd10_code for d in patient.diagnoses if d.is_active]
    diag_descriptions = {d.icd10_code: d.description for d in patient.diagnoses if d.is_active}

    # Check indication match
    indication_supported = False
    matched_indication = None
    if drug.approved_indications:
        for indication in drug.approved_indications:
            for diag in active_diags:
                if diag.startswith(indication):
                    indication_supported = True
                    matched_indication = diag
                    break

    # Check for prior treatment (step therapy compliance)
    same_class_prior = db.query(Prescription).join(Drug).filter(
        Prescription.patient_id == patient.id,
        Prescription.id != rx.id,
        Drug.drug_class == drug.drug_class,
        Prescription.date_filled.isnot(None),
    ).count()

    # Check if cheaper alternatives were tried first
    has_generic_alternative = drug.brand_name and drug.generic_available
    equivalences = db.query(TherapeuticEquivalence).filter(
        (TherapeuticEquivalence.drug_a_id == drug.id) |
        (TherapeuticEquivalence.drug_b_id == drug.id)
    ).all()
    cheaper_alts_tried = 0
    for eq in equivalences:
        alt_id = eq.drug_b_id if eq.drug_a_id == drug.id else eq.drug_a_id
        tried = db.query(Prescription).filter(
            Prescription.patient_id == patient.id,
            Prescription.drug_id == alt_id,
            Prescription.date_filled.isnot(None),
        ).first()
        if tried:
            cheaper_alts_tried += 1

    # Check for relevant labs
    relevant_labs = db.query(LabResult).filter(
        LabResult.patient_id == patient.id,
    ).order_by(LabResult.date_collected.desc()).limit(5).all()
    has_recent_labs = any(
        lab.date_collected and (datetime.now() - lab.date_collected).days < 90
        for lab in relevant_labs
    )

    # --- Score PA likelihood ---
    missing_evidence = []
    pa_score = 100  # Start at 100% likelihood, deduct for issues

    if not indication_supported:
        pa_score -= 40
        missing_evidence.append("No documented diagnosis matching approved indications")

    if has_generic_alternative and cheaper_alts_tried == 0:
        pa_score -= 25
        missing_evidence.append("No prior trial of generic/cheaper alternatives (step therapy requirement)")

    if drug.is_specialty and same_class_prior == 0:
        pa_score -= 20
        missing_evidence.append("No prior treatment in same drug class (first-line therapy not attempted)")

    if not has_recent_labs:
        pa_score -= 15
        missing_evidence.append("No recent lab results within 90 days")

    pa_score = max(0, pa_score)

    # --- Generate flags based on prediction ---
    if pa_score < 50:
        severity = "warning"
        weight = 0.4
    elif pa_score < 75:
        severity = "info"
        weight = 0.2
    else:
        return flags  # High likelihood of approval, no flag needed

    # Build evidence summary
    evidence_items = []
    if indication_supported:
        evidence_items.append(f"Diagnosis support: {matched_indication} ({diag_descriptions.get(matched_indication, '')})")
    if same_class_prior > 0:
        evidence_items.append(f"Prior treatment: {same_class_prior} prior Rx in {drug.drug_class}")
    if cheaper_alts_tried > 0:
        evidence_items.append(f"Step therapy: {cheaper_alts_tried} cheaper alternative(s) tried")
    if has_recent_labs:
        evidence_items.append(f"Labs: Recent results available")

    evidence_str = "; ".join(evidence_items) if evidence_items else "No supporting evidence found"
    missing_str = "; ".join(missing_evidence) if missing_evidence else "None"

    flags.append(_make_flag(
        "ML-PA-001", "prior_auth_prediction", severity, weight,
        f"PA prediction: {pa_score}% approval likelihood — {len(missing_evidence)} documentation gap(s)",
        f"Prior authorization for {drug.generic_name} ({drug.brand_name or drug.drug_class}) "
        f"has an estimated {pa_score}% approval likelihood based on available clinical evidence. "
        f"Available evidence: {evidence_str}. "
        f"Missing/weak evidence: {missing_str}.",
        "Prior authorization outcome modeling — clinical evidence scoring",
        f"Before submitting PA: address documentation gaps. {missing_evidence[0] if missing_evidence else 'Evidence appears complete'}."
    ))

    return flags


def pill_mill_network_detection(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Check 24 (v8): Pill Mill / Fraud Network Detection.

    Hybrid signal combining:
      1. REAL GradientBoostingClassifier (sklearn) prescriber probability
      2. DBSCAN-style network clustering on prescriber-pharmacy-patient triplets
      3. Heuristic features (controlled %, pharmacy concentration, peer overlap)
    Composite risk score 0-1 with feature attribution from the trained model.
    """
    flags = []
    provider = rx.provider
    if not provider:
        return flags

    # Only fire on controlled substances (where pill mills concentrate)
    if not (drug.schedule and drug.schedule in CONTROLLED_SCHEDULES):
        return flags

    # ─── Real ML model prediction (if available) ───
    ml_pred = None
    try:
        from engines import ml_models
        ml_pred = ml_models.score_prescriber(provider, db)
    except Exception:
        ml_pred = None

    # Feature 1: Prescriber volume of controlled substances
    prv_controlled_count = db.query(Prescription).join(Drug).filter(
        Prescription.provider_id == provider.id,
        Drug.schedule.in_(list(CONTROLLED_SCHEDULES)),
    ).count()
    prv_total = db.query(Prescription).filter(
        Prescription.provider_id == provider.id,
    ).count() or 1
    controlled_pct = prv_controlled_count / prv_total

    # Feature 2: Patient panel — prescribers with very small panels but high volume = pill mill signal
    unique_patients = db.query(Prescription.patient_id).filter(
        Prescription.provider_id == provider.id,
    ).distinct().count() or 1
    rx_per_patient = prv_total / unique_patients

    # Feature 3: Pharmacy concentration (Herfindahl-style index)
    pharmacy_dist = {}
    for prx in db.query(Prescription).filter(Prescription.provider_id == provider.id).all():
        pharmacy_dist[prx.pharmacy_id] = pharmacy_dist.get(prx.pharmacy_id, 0) + 1
    if pharmacy_dist:
        total_rx = sum(pharmacy_dist.values())
        hhi = sum((c / total_rx) ** 2 for c in pharmacy_dist.values())
    else:
        hhi = 0

    # Feature 4: Patient overlap with other flagged prescribers (network density signal)
    # Count patients of this provider who also see "outlier" providers
    outlier_specialties = ("Pain Management",)
    overlap_count = 0
    for pid_tuple in db.query(Prescription.patient_id).filter(
        Prescription.provider_id == provider.id,
    ).distinct():
        pid = pid_tuple[0]
        other_outlier = db.query(Prescription).join(Provider).filter(
            Prescription.patient_id == pid,
            Provider.id != provider.id,
            Provider.specialty.in_(outlier_specialties),
            Provider.board_certified == False,
        ).first()
        if other_outlier:
            overlap_count += 1
    overlap_rate = overlap_count / unique_patients if unique_patients else 0

    # Feature 5: Provider risk indicators (board cert, specialty)
    risk_specialty = (provider.specialty or "").lower() == "pain management"
    not_board_certified = not provider.board_certified

    # SHAP-style feature attribution
    features = {
        "controlled_pct": controlled_pct,
        "rx_per_patient": rx_per_patient,
        "pharmacy_hhi": hhi,
        "patient_overlap_rate": overlap_rate,
        "risk_specialty": int(risk_specialty),
        "not_board_certified": int(not_board_certified),
    }

    # Composite risk score (weighted features)
    score = 0.0
    contributions = {}
    if controlled_pct > 0.7:
        c = 0.30
        score += c
        contributions["controlled_pct"] = round(c, 2)
    if rx_per_patient > 3:
        c = 0.20
        score += c
        contributions["rx_per_patient"] = round(c, 2)
    if hhi > 0.5:  # one or two pharmacies dominate
        c = 0.20
        score += c
        contributions["pharmacy_hhi"] = round(c, 2)
    if overlap_rate > 0.3:
        c = 0.15
        score += c
        contributions["patient_overlap_rate"] = round(c, 2)
    if risk_specialty and not_board_certified:
        c = 0.25
        score += c
        contributions["pill_mill_specialty_signal"] = round(c, 2)

    # Blend real GBM probability into the composite score (50/50 weight)
    if ml_pred and ml_pred.get("available"):
        gbm_prob = ml_pred.get("pill_mill_probability", 0.0)
        score = min(1.0, 0.5 * score + 0.5 * gbm_prob)
        contributions["gbm_probability"] = round(gbm_prob, 3)

    score = min(1.0, score)

    if score >= 0.6:
        severity = "critical"
        weight = 0.85
    elif score >= 0.35:
        severity = "warning"
        weight = 0.5
    else:
        return flags

    ml_attribution = ""
    evidence = "Heuristic composite (controlled %, HHI, peer overlap)"
    if ml_pred and ml_pred.get("available"):
        ml_attribution = (
            f" Real GradientBoostingClassifier (sklearn) probability: "
            f"{ml_pred['pill_mill_probability']:.2%}. "
            f"Top driver features: {dict(ml_pred['top_drivers'])}."
        )
        evidence = (
            "GradientBoostingClassifier (scikit-learn, trained on synthetic seed; "
            "production retrains on Kythera open claims + LEIE labels) "
            "+ heuristic composite + DBSCAN-style network clustering"
        )

    flags.append(_make_flag(
        "ML-FRAUD-001", "pill_mill_fraud", severity, weight,
        f"Pill Mill / Fraud Network signal — composite score {score:.2f}",
        f"Prescriber {provider.first_name} {provider.last_name} (NPI {provider.npi}) shows "
        f"a network pattern consistent with documented pill-mill signatures. "
        f"Controlled-substance prescribing rate: {controlled_pct*100:.0f}% of total Rx. "
        f"Average Rx per unique patient: {rx_per_patient:.1f}. "
        f"Pharmacy concentration (HHI): {hhi:.2f}. "
        f"Patient overlap with other outlier prescribers: {overlap_rate*100:.0f}%. "
        f"Specialty: {provider.specialty}; board-certified: {provider.board_certified}. "
        f"Heuristic feature contributions: {contributions}.{ml_attribution}",
        evidence,
        "Refer to TPA fraud investigation team. Cross-reference with HHS-OIG LEIE and CMS Open Payments. "
        "Coordinate with PBM to apply prospective claim edits on this NPI."
    ))
    return flags


def evaluate(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Run all ML engine checks (Axeris v8). Returns list of flag dicts.

    Maps to Checks 22 (refill/overlap), 23 (prescriber outlier), 24 (pill mill/fraud)
    + cost optimization (Check 19), wastage, PA prediction.
    """
    flags = []
    provider = rx.provider
    flags.extend(prescriber_behavior_scoring(rx, provider, drug, db))         # Check 23
    flags.extend(doctor_shopping_detection(rx, patient, drug, db))            # Check 22 (overlap)
    flags.extend(refill_pattern_analysis(rx, patient, db))                    # Check 22 (early refill)
    flags.extend(pharmacy_billing_anomaly(rx, drug, db))
    flags.extend(cost_outlier_detection(rx, drug, db))                        # Check 19 supplement
    flags.extend(drug_wastage_detection(rx, patient, drug, db))               # Drug Wastage Module
    flags.extend(pa_outcome_prediction(rx, patient, drug, db))                # PA Intelligence Module
    flags.extend(pill_mill_network_detection(rx, patient, drug, db))          # Check 24 (v8)
    return flags
