from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..config import get_settings
from ..notifications import queue, send_contact_now, send_visitor_confirmation

router = APIRouter(tags=["forms"])


@router.post("/contact", response_model=schemas.Ack, status_code=201)
def contact(payload: schemas.ContactIn, bg: BackgroundTasks):
    """Contact messages are emailed straight to the team and are not stored in the database."""
    name = f"{payload.first_name} {payload.last_name}"
    try:
        send_contact_now({"Name": name, "Email": payload.email, "Phone": payload.phone, "Message": payload.message},
                         payload.email, name)
    except Exception:
        email = get_settings().site_contact_email
        raise HTTPException(503, f"We couldn't send your message right now. Please email us directly at {email}.")
    if get_settings().send_confirmation:
        bg.add_task(send_visitor_confirmation, "contact", None, payload.email, name)
    return {"message": "Thanks for reaching out! We'll get back to you within one working day."}


@router.post("/consultations", response_model=schemas.Ack, status_code=201)
def consultation(payload: schemas.ConsultationIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    row = models.ConsultationRequest(**payload.model_dump())
    db.add(row)
    db.commit()
    queue(bg, "consultations", row.id, {
        "Name": payload.full_name, "Email": payload.email, "Phone": payload.phone, "Company": payload.company,
        "Interested in": payload.service_interest.title(), "Topic": payload.topic or "General enquiry",
        "Preferred date": payload.preferred_date,
        "Message": payload.message, "Sent from page": payload.source_page,
    }, payload.email, payload.full_name, f"{payload.topic or payload.service_interest.title()} — {payload.full_name}")
    return {"message": "Your consultation request has been received. An advisor will contact you shortly.", "id": row.id}


@router.post("/newsletter", response_model=schemas.Ack, status_code=201)
def newsletter(payload: schemas.NewsletterIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    email = payload.email.lower()
    existing = db.scalar(select(models.NewsletterSubscriber).where(func.lower(models.NewsletterSubscriber.email) == email))
    if existing and existing.is_active:
        return {"message": "You're already subscribed — thank you!", "id": existing.id}
    if existing:  # re-subscribe
        existing.is_active, existing.unsubscribed_at = True, None
        db.commit()
        return {"message": "Welcome back! You're subscribed again.", "id": existing.id}
    row = models.NewsletterSubscriber(email=email, source=payload.source)
    db.add(row)
    db.commit()
    queue(bg, "newsletter", row.id, {"Email": row.email, "Signed up from": payload.source}, None, None, row.email)
    return {"message": "Subscribed! You'll get an email whenever we publish news.", "id": row.id}


@router.get("/newsletter/unsubscribe", response_class=HTMLResponse)
def unsubscribe(token: str = Query(max_length=64), db: Session = Depends(get_db)):
    sub = db.scalar(select(models.NewsletterSubscriber).where(models.NewsletterSubscriber.token == token))
    if sub and sub.is_active:
        sub.is_active, sub.unsubscribed_at = False, datetime.now(timezone.utc)
        db.commit()
    msg = "You have been unsubscribed from the Afrimpact newsletter." if sub else "This unsubscribe link is not valid."
    site = get_settings().site_url
    return f"""<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Afrimpact newsletter</title>
<div style="font-family:Arial,sans-serif;max-width:480px;margin:80px auto;text-align:center;padding:0 20px">
<div style="width:64px;height:64px;border-radius:50%;background:#e45a59;margin:0 auto 18px"></div>
<h1 style="font-size:22px;color:#222">{msg}</h1><p style="color:#666">You can subscribe again at any time from the News &amp; Events page.</p>
<a href="{site}" style="color:#e45a59">Back to afrimpact.com</a></div>"""


@router.post("/write-for-us", response_model=schemas.Ack, status_code=201)
def write_for_us(payload: schemas.PitchIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    row = models.WriterPitch(**payload.model_dump())
    db.add(row)
    db.commit()
    queue(bg, "pitches", row.id, {"Name": payload.full_name, "Email": payload.email, "Topic": payload.topic,
                                  "Pitch": payload.pitch, "Review": "Approve or reject in Admin → Writer pitches"},
          payload.email, payload.full_name, payload.topic)
    return {"message": "Thanks for your pitch! Our editors will review it and email you with a decision.", "id": row.id}


@router.post("/track", response_model=schemas.Ack, status_code=202)
def track(payload: schemas.TrackIn, request: Request, db: Session = Depends(get_db)):
    row = models.Interaction(**payload.model_dump(), user_agent=(request.headers.get("user-agent") or "")[:300])
    db.add(row)
    db.commit()
    return {"message": "tracked", "id": row.id}
