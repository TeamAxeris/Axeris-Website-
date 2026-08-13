"""
Aggregated notifications feed for the header bell.

Pulls from multiple existing data sources and returns a single
sorted-by-severity-and-time list. Used by the frontend
NotificationsBell to show what needs the reviewer's attention right
now without making them poll five different pages.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import Prescription, PrescriptionAction

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationItem(BaseModel):
    id: str
    type: str        # "fraud" | "safety" | "breach" | "safeguard" | "callback" | "info"
    severity: str    # "alert" | "warn" | "info"
    title: str
    body: str
    link: Optional[str] = None
    timestamp: str


class NotificationsResponse(BaseModel):
    unread_count: int
    items: List[NotificationItem]
    last_updated: str


SEV_ORDER = {"alert": 0, "warn": 1, "info": 2}


@router.get("", response_model=NotificationsResponse)
def list_notifications(db: Session = Depends(get_db), limit: int = 20):
    items: List[NotificationItem] = []
    now = datetime.now()

    # 1. Pend queue breach-risk and overdue (TPA)
    pendings = db.query(Prescription).filter(Prescription.status == "pending").all()
    overdue, at_risk = 0, 0
    for rx in pendings:
        if not rx.date_written:
            continue
        # Treat anything pending > 24h as overdue, > 20h as at risk (demo heuristic)
        age = now - rx.date_written
        if age > timedelta(hours=24):
            overdue += 1
        elif age > timedelta(hours=20):
            at_risk += 1
    if overdue:
        items.append(NotificationItem(
            id=f"pend-overdue-{overdue}",
            type="breach",
            severity="alert",
            title=f"{overdue} pend{'s' if overdue != 1 else ''} overdue",
            body="SLA breach — review or escalate to avoid ERISA §404 audit finding.",
            link="/tpa/pend-queue?breach=overdue",
            timestamp=now.isoformat(),
        ))
    if at_risk:
        items.append(NotificationItem(
            id=f"pend-atrisk-{at_risk}",
            type="breach",
            severity="warn",
            title=f"{at_risk} pend{'s' if at_risk != 1 else ''} at risk in next 4h",
            body="Approaching 24h SLA deadline. Review now to stay compliant.",
            link="/tpa/pend-queue?breach=at_risk",
            timestamp=now.isoformat(),
        ))

    # 2. RED-flagged prescriptions still pending (any mode)
    red_pending = [rx for rx in pendings if rx.flag_color == "RED"]
    if red_pending:
        sample = red_pending[:3]
        items.append(NotificationItem(
            id=f"red-pending-{len(red_pending)}",
            type="safety",
            severity="alert",
            title=f"{len(red_pending)} HIGH-RISK prescription{'s' if len(red_pending) != 1 else ''} pending",
            body=f"Latest: {', '.join(rx.id for rx in sample)}{' …' if len(red_pending) > 3 else ''}",
            link="/prescriptions",
            timestamp=now.isoformat(),
        ))

    # 3. Recent denials blocked by safeguards (last 7d)
    cutoff = now - timedelta(days=7)
    recent_denies = db.query(PrescriptionAction).filter(
        PrescriptionAction.action == "deny",
        PrescriptionAction.timestamp >= cutoff,
    ).all()
    if recent_denies:
        # Show a generic surveillance ping if any recent denials exist (audit signal)
        items.append(NotificationItem(
            id=f"deny-audit-{len(recent_denies)}",
            type="safeguard",
            severity="info",
            title="Denial surveillance active",
            body=f"{len(recent_denies)} denial{'s' if len(recent_denies) != 1 else ''} in last 7 days. Review fairness metrics.",
            link="/safeguards",
            timestamp=now.isoformat(),
        ))

    # 4. Polypharmacy signal — single grouped query instead of N+1.
    # Counts members with ≥5 concurrent active or pending prescriptions.
    try:
        polypharm_subq = (
            db.query(Prescription.patient_id, func.count(Prescription.id).label("rx_count"))
              .filter(Prescription.status.in_(("pending", "approved")))
              .group_by(Prescription.patient_id)
              .having(func.count(Prescription.id) >= 5)
              .subquery()
        )
        cnt = db.query(func.count()).select_from(polypharm_subq).scalar() or 0
        if cnt:
            items.append(NotificationItem(
                id=f"polypharm-{cnt}",
                type="safety",
                severity="warn",
                title=f"{cnt} member{'s' if cnt != 1 else ''} on 5+ concurrent meds",
                body="Polypharmacy review recommended. Check member safety queue.",
                link="/pba/member-safety",
                timestamp=now.isoformat(),
            ))
    except Exception as exc:
        logger.warning("polypharmacy notification failed: %s", exc)

    # Sort by severity then timestamp
    items.sort(key=lambda i: (SEV_ORDER.get(i.severity, 9), i.timestamp), reverse=False)
    items = items[:limit]

    unread = sum(1 for i in items if i.severity in ("alert", "warn"))
    return NotificationsResponse(
        unread_count=unread,
        items=items,
        last_updated=now.isoformat(),
    )
