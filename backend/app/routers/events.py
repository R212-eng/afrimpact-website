from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..notifications import queue

router = APIRouter(prefix="/events", tags=["events"])


def _published():
    return select(models.Event).where(models.Event.is_published)


@router.get("", response_model=list[schemas.EventCard])
def list_events(
    when: str = Query(default="upcoming", pattern="^(upcoming|past|all)$"),
    limit: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    E = models.Event
    now = datetime.now(timezone.utc)
    stmt = _published()
    if when == "upcoming":
        stmt = stmt.where(E.start_at >= now).order_by(E.start_at.asc())
    elif when == "past":
        stmt = stmt.where(E.start_at < now).order_by(E.start_at.desc())
    else:
        stmt = stmt.order_by(E.start_at.desc())
    return db.scalars(stmt.limit(limit)).all()


def _count(db: Session, event_id: int) -> int:
    return db.scalar(
        select(func.count()).select_from(models.EventRegistration).where(models.EventRegistration.event_id == event_id)
    ) or 0


@router.get("/{slug}", response_model=schemas.EventDetail)
def get_event(slug: str, db: Session = Depends(get_db)):
    ev = db.scalar(_published().where(models.Event.slug == slug))
    if not ev:
        raise HTTPException(404, "Event not found")
    data = schemas.EventDetail.model_validate(ev)
    data.registered = _count(db, ev.id)
    data.seats_left = None if ev.capacity is None else max(0, ev.capacity - data.registered)
    return data


@router.post("/{slug}/register", response_model=schemas.Ack, status_code=201)
def register(slug: str, payload: schemas.RegistrationIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    ev = db.scalar(_published().where(models.Event.slug == slug))
    if not ev:
        raise HTTPException(404, "Event not found")
    if ev.start_at < datetime.now(timezone.utc):
        raise HTTPException(400, "Registration for this event has closed")
    if ev.capacity is not None and _count(db, ev.id) >= ev.capacity:
        raise HTTPException(409, "This event is fully booked")
    exists = db.scalar(
        select(models.EventRegistration.id).where(
            models.EventRegistration.event_id == ev.id, func.lower(models.EventRegistration.email) == payload.email.lower()
        )
    )
    if exists:
        return {"message": "You are already registered for this event.", "id": exists}
    row = models.EventRegistration(event_id=ev.id, **payload.model_dump())
    db.add(row)
    db.commit()
    queue(bg, "registrations", row.id, {
        "Event": f"{ev.title} ({ev.start_at:%d %b %Y})", "Name": payload.full_name, "Email": payload.email,
        "Phone": payload.phone, "Organisation": payload.organization,
    }, payload.email, payload.full_name, f"{ev.title} — {payload.full_name}")
    return {"message": f"You're registered for {ev.title}! A confirmation will be sent to {payload.email}.", "id": row.id}
