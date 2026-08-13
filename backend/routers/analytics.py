from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List
from datetime import datetime, timedelta
import numpy as np

from database.database import get_db
from database.models import (
    Prescription, Drug, Provider, Patient, InsuranceClaim, Pharmacy,
    TherapeuticEquivalence
)
from schemas.analytics import (
    OverviewMetrics, SavingsData, TrendData, FraudMetrics,
    FlaggedPrescriberSchema, DoctorShoppingSchema, PharmacyAnomalySchema
)
from config import DOCTOR_SHOPPING_PROVIDER_THRESHOLD

router = APIRouter(prefix="/analytics", tags=["analytics"])

CONTROLLED_SCHEDULES = {"II", "III", "IV"}


@router.get("/overview", response_model=OverviewMetrics)
def get_overview(db: Session = Depends(get_db)):
    total = db.query(Prescription).count()
    green = db.query(Prescription).filter(Prescription.flag_color == "GREEN").count()
    yellow = db.query(Prescription).filter(Prescription.flag_color == "YELLOW").count()
    red = db.query(Prescription).filter(Prescription.flag_color == "RED").count()
    flagged = yellow + red
    pending = db.query(Prescription).filter(Prescription.status == "pending", Prescription.flag_color.in_(["YELLOW", "RED"])).count()

    # Estimate cost savings from yellow flags (cost optimization).
    # Batch-load drugs + therapeutic equivalences instead of one query per
    # yellow rx — was firing 2 round-trips per yellow row.
    yellow_rxs = db.query(Prescription).filter(Prescription.flag_color == "YELLOW").all()
    drug_ids = {rx.drug_id for rx in yellow_rxs if rx.drug_id}
    drugs_by_id = (
        {d.id: d for d in db.query(Drug).filter(Drug.id.in_(drug_ids)).all()}
        if drug_ids else {}
    )
    eqs_by_drug: dict = {}
    if drug_ids:
        all_eqs = db.query(TherapeuticEquivalence).filter(
            (TherapeuticEquivalence.drug_a_id.in_(drug_ids)) |
            (TherapeuticEquivalence.drug_b_id.in_(drug_ids))
        ).all()
        for eq in all_eqs:
            eqs_by_drug.setdefault(eq.drug_a_id, []).append(eq)
            eqs_by_drug.setdefault(eq.drug_b_id, []).append(eq)

    total_savings = 0.0
    for rx in yellow_rxs:
        drug = drugs_by_id.get(rx.drug_id)
        if drug:
            for eq in eqs_by_drug.get(drug.id, []):
                if eq.cost_difference_pct and eq.cost_difference_pct > 0:
                    total_savings += drug.average_cost_per_unit * rx.quantity * (eq.cost_difference_pct / 100)
                    break

    return OverviewMetrics(
        total_prescriptions=total,
        flagged_count=flagged,
        flagged_percentage=round(flagged / max(total, 1) * 100, 1),
        green_count=green,
        yellow_count=yellow,
        red_count=red,
        total_cost_savings=round(total_savings, 2),
        safety_catches=red,
        pending_review_count=pending,
    )


@router.get("/savings", response_model=List[SavingsData])
def get_savings(db: Session = Depends(get_db)):
    # Group prescriptions by month
    rxs = db.query(Prescription).filter(
        Prescription.date_written.isnot(None)
    ).order_by(Prescription.date_written).all()

    # Batch drugs + EQs across the flagged rxs (was 2 round-trips per row).
    flagged_drug_ids = {rx.drug_id for rx in rxs if rx.flag_color in ("YELLOW", "RED") and rx.drug_id}
    drugs_by_id = (
        {d.id: d for d in db.query(Drug).filter(Drug.id.in_(flagged_drug_ids)).all()}
        if flagged_drug_ids else {}
    )
    eqs_by_drug: dict = {}
    if flagged_drug_ids:
        all_eqs = db.query(TherapeuticEquivalence).filter(
            (TherapeuticEquivalence.drug_a_id.in_(flagged_drug_ids)) |
            (TherapeuticEquivalence.drug_b_id.in_(flagged_drug_ids))
        ).all()
        for eq in all_eqs:
            eqs_by_drug.setdefault(eq.drug_a_id, []).append(eq)
            eqs_by_drug.setdefault(eq.drug_b_id, []).append(eq)

    monthly = {}
    for rx in rxs:
        period = rx.date_written.strftime("%Y-%m")
        if period not in monthly:
            monthly[period] = {"potential": 0.0, "realized": 0.0, "count": 0}
        monthly[period]["count"] += 1

        if rx.flag_color in ("YELLOW", "RED"):
            drug = drugs_by_id.get(rx.drug_id)
            if drug:
                for eq in eqs_by_drug.get(drug.id, []):
                    if eq.cost_difference_pct and eq.cost_difference_pct > 0:
                        saving = drug.average_cost_per_unit * rx.quantity * (eq.cost_difference_pct / 100)
                        monthly[period]["potential"] += saving
                        if rx.status in ("denied", "approved"):
                            monthly[period]["realized"] += saving * 0.6
                        break

    return [SavingsData(
        period=k,
        potential_savings=round(v["potential"], 2),
        realized_savings=round(v["realized"], 2),
        prescription_count=v["count"],
    ) for k, v in sorted(monthly.items())]


@router.get("/trends", response_model=List[TrendData])
def get_trends(db: Session = Depends(get_db)):
    rxs = db.query(Prescription).filter(
        Prescription.date_written.isnot(None),
        Prescription.flag_color.isnot(None),
    ).order_by(Prescription.date_written).all()

    monthly = {}
    for rx in rxs:
        period = rx.date_written.strftime("%Y-%m")
        if period not in monthly:
            monthly[period] = {"green": 0, "yellow": 0, "red": 0}
        if rx.flag_color == "GREEN":
            monthly[period]["green"] += 1
        elif rx.flag_color == "YELLOW":
            monthly[period]["yellow"] += 1
        elif rx.flag_color == "RED":
            monthly[period]["red"] += 1

    return [TrendData(
        period=k,
        green_count=v["green"],
        yellow_count=v["yellow"],
        red_count=v["red"],
        total=v["green"] + v["yellow"] + v["red"],
    ) for k, v in sorted(monthly.items())]


@router.get("/fraud", response_model=FraudMetrics)
def get_fraud(db: Session = Depends(get_db)):
    """Fraud analytics — re-built with grouped queries.

    Previous implementation issued 3 count queries per provider, 2 per
    patient, and re-pulled the entire InsuranceClaim table on every
    iteration of the pharmacy loop. This rewrite collapses each section
    into ~1-3 grouped queries total.
    """
    # ── Flagged prescribers — single grouped scan over Prescription.
    total_per_prov = dict(
        db.query(Prescription.provider_id, func.count(Prescription.id))
          .group_by(Prescription.provider_id)
          .all()
    )
    flagged_per_prov = dict(
        db.query(Prescription.provider_id, func.count(Prescription.id))
          .filter(Prescription.flag_color.in_(["YELLOW", "RED"]))
          .group_by(Prescription.provider_id)
          .all()
    )
    controlled_per_prov = dict(
        db.query(Prescription.provider_id, func.count(Prescription.id))
          .join(Drug, Prescription.drug_id == Drug.id)
          .filter(Drug.schedule.in_(CONTROLLED_SCHEDULES))
          .group_by(Prescription.provider_id)
          .all()
    )

    flagged_prescribers = []
    interesting_prov_ids = {
        pid for pid in total_per_prov
        if (flagged_per_prov.get(pid, 0) > 2 or controlled_per_prov.get(pid, 0) > 5)
    }
    if interesting_prov_ids:
        prov_rows = (
            db.query(Provider)
              .filter(Provider.id.in_(interesting_prov_ids))
              .all()
        )
        for prov in prov_rows:
            total = total_per_prov.get(prov.id, 0)
            flagged = flagged_per_prov.get(prov.id, 0)
            controlled = controlled_per_prov.get(prov.id, 0)
            flagged_pct = flagged / max(total, 1)
            risk = min(1.0, flagged_pct * 0.5 + controlled * 0.02)
            flagged_prescribers.append(FlaggedPrescriberSchema(
                provider_id=prov.id,
                provider_name=f"Dr. {prov.first_name} {prov.last_name}",
                specialty=prov.specialty,
                risk_score=round(risk, 3),
                controlled_volume=controlled,
                flagged_rx_count=flagged,
            ))
    flagged_prescribers.sort(key=lambda x: x.risk_score, reverse=True)

    # ── Doctor-shopping patients — two grouped queries.
    ninety_days_ago = datetime.now() - timedelta(days=90)
    distinct_provs_per_patient = dict(
        db.query(
            Prescription.patient_id,
            func.count(func.distinct(Prescription.provider_id)),
        )
          .join(Drug, Prescription.drug_id == Drug.id)
          .filter(
              Prescription.date_written >= ninety_days_ago,
              Drug.schedule.in_(CONTROLLED_SCHEDULES),
          )
          .group_by(Prescription.patient_id)
          .all()
    )
    controlled_per_patient = dict(
        db.query(Prescription.patient_id, func.count(Prescription.id))
          .join(Drug, Prescription.drug_id == Drug.id)
          .filter(Drug.schedule.in_(CONTROLLED_SCHEDULES))
          .group_by(Prescription.patient_id)
          .all()
    )

    shopping_patient_ids = {
        pid for pid, n in distinct_provs_per_patient.items()
        if n >= DOCTOR_SHOPPING_PROVIDER_THRESHOLD
    }
    shopping_patients = []
    if shopping_patient_ids:
        for pat in db.query(Patient).filter(Patient.id.in_(shopping_patient_ids)).all():
            shopping_patients.append(DoctorShoppingSchema(
                patient_id=pat.id,
                patient_name=f"{pat.first_name} {pat.last_name}",
                provider_count=distinct_provs_per_patient.get(pat.id, 0),
                controlled_rx_count=controlled_per_patient.get(pat.id, 0),
            ))

    # ── Pharmacy anomalies — pull every claim ONCE, group in Python.
    all_claims = db.query(InsuranceClaim.pharmacy_id, InsuranceClaim.billed_amount).all()
    if all_claims:
        amounts_by_pharm: dict = {}
        for pharm_id, amt in all_claims:
            if amt is None:
                continue
            amounts_by_pharm.setdefault(pharm_id, []).append(amt)
        avg_all = float(np.mean([a for amts in amounts_by_pharm.values() for a in amts])) if amounts_by_pharm else 0.0
    else:
        amounts_by_pharm = {}
        avg_all = 0.0

    pharmacy_anomalies = []
    if avg_all > 0 and amounts_by_pharm:
        candidate_ids = [
            pid for pid, amts in amounts_by_pharm.items()
            if pid is not None and len(amts) >= 2 and float(np.mean(amts)) > avg_all * 1.3
        ]
        if candidate_ids:
            pharm_rows = db.query(Pharmacy).filter(Pharmacy.id.in_(candidate_ids)).all()
            for pharm in pharm_rows:
                amts = amounts_by_pharm.get(pharm.id, [])
                if len(amts) < 2:
                    continue
                avg_pharm = float(np.mean(amts))
                overcharge = ((avg_pharm - avg_all) / avg_all) * 100
                pharmacy_anomalies.append(PharmacyAnomalySchema(
                    pharmacy_id=pharm.id,
                    pharmacy_name=pharm.name,
                    anomaly_count=len(amts),
                    avg_overcharge_pct=round(overcharge, 1),
                ))

    return FraudMetrics(
        flagged_prescribers=flagged_prescribers[:10],
        doctor_shopping_patients=shopping_patients,
        pharmacy_anomalies=pharmacy_anomalies,
    )
