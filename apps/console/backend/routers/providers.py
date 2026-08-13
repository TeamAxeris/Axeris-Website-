from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import numpy as np

from database.database import get_db
from database.models import Prescription, Provider, Drug
from schemas.provider import (
    ProviderResponse, ProviderDetail, PeerComparisonSchema, FlagHistoryEntry
)
from config import CONTROLLED_SUBSTANCE_VOLUME_ZSCORE

router = APIRouter(prefix="/providers", tags=["providers"])

CONTROLLED_SCHEDULES = {"II", "III", "IV"}


def _provider_to_response(prov: Provider, db: Session) -> ProviderResponse:
    total_rx = db.query(Prescription).filter(Prescription.provider_id == prov.id).count()

    flagged_rx = db.query(Prescription).filter(
        Prescription.provider_id == prov.id,
        Prescription.flag_color.in_(["YELLOW", "RED"]),
    ).count()

    controlled = db.query(Prescription).filter(
        Prescription.provider_id == prov.id,
    ).join(Drug).filter(
        Drug.schedule.in_(CONTROLLED_SCHEDULES)
    ).count()

    # Risk score based on flagged percentage and controlled volume
    flagged_pct = flagged_rx / max(total_rx, 1)

    # Compare controlled volume to peers
    peers = db.query(Provider).filter(Provider.specialty == prov.specialty).all()
    peer_controlled = []
    for p in peers:
        c = db.query(Prescription).filter(
            Prescription.provider_id == p.id,
        ).join(Drug).filter(
            Drug.schedule.in_(CONTROLLED_SCHEDULES)
        ).count()
        peer_controlled.append(c)

    z_score = 0
    if len(peer_controlled) > 1:
        arr = np.array(peer_controlled, dtype=float)
        std = np.std(arr)
        if std > 0:
            z_score = (controlled - np.mean(arr)) / std

    risk_score = min(1.0, flagged_pct * 0.5 + max(0, z_score / 4))

    return ProviderResponse(
        id=prov.id,
        first_name=prov.first_name,
        last_name=prov.last_name,
        specialty=prov.specialty,
        npi=prov.npi,
        dea_number=prov.dea_number,
        practice_location=prov.practice_location,
        clinic_name=prov.clinic_name,
        clinic_address=prov.clinic_address,
        clinic_city=prov.clinic_city,
        clinic_state=prov.clinic_state,
        clinic_zip=prov.clinic_zip,
        clinic_phone=prov.clinic_phone,
        clinic_fax=prov.clinic_fax,
        provider_email=prov.provider_email,
        license_state=prov.license_state,
        board_certified=prov.board_certified,
        accepting_patients=prov.accepting_patients,
        group_practice=prov.group_practice,
        total_prescriptions=total_rx,
        flagged_prescription_count=flagged_rx,
        controlled_substance_volume=controlled,
        risk_score=round(risk_score, 3),
    )


@router.get("/", response_model=List[ProviderResponse])
def list_providers(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    skip, limit = max(0, skip), max(1, min(limit, 500))
    providers = db.query(Provider).offset(skip).limit(limit).all()
    return [_provider_to_response(p, db) for p in providers]


@router.get("/{provider_id}", response_model=ProviderDetail)
def get_provider(provider_id: str, db: Session = Depends(get_db)):
    prov = db.get(Provider, provider_id)
    if not prov:
        raise HTTPException(404, "Provider not found")

    base = _provider_to_response(prov, db)

    # Prescriptions
    from routers.prescriptions import _rx_to_response
    rxs = db.query(Prescription).filter(Prescription.provider_id == prov.id).all()
    rx_responses = [_rx_to_response(rx, db) for rx in rxs]

    # Peer comparison
    peers = db.query(Provider).filter(Provider.specialty == prov.specialty).all()
    peer_totals = []
    peer_controlled_list = []
    peer_flagged_pcts = []
    for p in peers:
        total = db.query(Prescription).filter(Prescription.provider_id == p.id).count()
        controlled = db.query(Prescription).filter(
            Prescription.provider_id == p.id
        ).join(Drug).filter(Drug.schedule.in_(CONTROLLED_SCHEDULES)).count()
        flagged = db.query(Prescription).filter(
            Prescription.provider_id == p.id,
            Prescription.flag_color.in_(["YELLOW", "RED"]),
        ).count()
        peer_totals.append(total)
        peer_controlled_list.append(controlled)
        peer_flagged_pcts.append(flagged / max(total, 1))

    peer_comparison = PeerComparisonSchema(
        specialty=prov.specialty,
        peer_avg_total_rx=float(np.mean(peer_totals)) if peer_totals else 0,
        peer_avg_controlled=float(np.mean(peer_controlled_list)) if peer_controlled_list else 0,
        peer_avg_flagged_pct=float(np.mean(peer_flagged_pcts)) if peer_flagged_pcts else 0,
        provider_total_rx=base.total_prescriptions,
        provider_controlled=base.controlled_substance_volume,
        provider_flagged_pct=base.flagged_prescription_count / max(base.total_prescriptions, 1),
    )

    # Flag history
    flagged_rxs = db.query(Prescription).filter(
        Prescription.provider_id == prov.id,
        Prescription.flag_color.in_(["YELLOW", "RED"]),
    ).order_by(Prescription.date_written.desc()).limit(20).all()

    flag_history = []
    for rx in flagged_rxs:
        drug = db.get(Drug, rx.drug_id)
        summary = ""
        if rx.flags and len(rx.flags) > 0:
            summary = rx.flags[0].get("title", "")
        flag_history.append(FlagHistoryEntry(
            prescription_id=rx.id,
            date=rx.date_written.strftime("%Y-%m-%d") if rx.date_written else None,
            flag_color=rx.flag_color,
            drug_name=drug.generic_name if drug else "",
            flag_summary=summary,
        ))

    return ProviderDetail(
        **base.model_dump(),
        prescriptions=rx_responses,
        peer_comparison=peer_comparison,
        flag_history=flag_history,
    )
