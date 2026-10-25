"""Admin portal API (CMS + submissions).

Sign in with POST /api/admin/login (staff accounts in `admin_users`) and send
`Authorization: Bearer <token>`. Scripts may use the X-Admin-Key header instead.
"""
import csv
import io
import secrets
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import make_token, require_admin, verify_password
from ..config import get_settings
from ..database import get_db
from ..notifications import send_email, send_newsletter, send_pitch_decision
from ..utils import unique_slug

auth_router = APIRouter(prefix="/admin", tags=["admin"])
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

SUBMISSIONS = {
    "consultations": models.ConsultationRequest,
    "interests": models.OpportunityInterest,
    "itineraries": models.ItineraryRequest,
    "registrations": models.EventRegistration,
    "pitches": models.WriterPitch,
    "newsletter": models.NewsletterSubscriber,
}

CONTENT = {
    "news": (models.NewsArticle, schemas.NewsIn),
    "opportunities": (models.Opportunity, schemas.OpportunityIn),
    "events": (models.Event, schemas.EventIn),
}

FORM_LABELS = {
    "contact": "Contact form (email only)", "consultations": "Consultation requests",
    "interests": "Investment interest", "itineraries": "Itinerary requests",
    "registrations": "Event registrations", "pitches": "Writer pitches", "newsletter": "Newsletter sign-ups",
}


def _row_to_dict(row) -> dict:
    out = {c.name: getattr(row, c.name) for c in row.__table__.columns}
    out.pop("password_hash", None)
    out.pop("token", None)
    if isinstance(row, models.OpportunityInterest):
        out["opportunity"] = row.opportunity.title if row.opportunity else None
    if isinstance(row, models.EventRegistration):
        out["event"] = row.event.title if row.event else None
    return out


def _count(db: Session, model, *where) -> int:
    stmt = select(func.count()).select_from(model)
    for w in where:
        stmt = stmt.where(w)
    return db.scalar(stmt) or 0


# ---------------------------------------------------------------- auth
@auth_router.post("/login")
def login(payload: schemas.LoginIn, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(models.AdminUser).where(models.AdminUser.email == payload.email.lower()))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    return {"token": make_token(user.id), "user": {"id": user.id, "email": user.email, "name": user.name}}


@router.get("/me")
def me(user=Depends(require_admin)) -> dict:
    if user is None:
        return {"id": 0, "email": "api-key", "name": "API key"}
    return {"id": user.id, "email": user.email, "name": user.name}


# ---------------------------------------------------------------- dashboard
@router.get("/stats")
def stats(db: Session = Depends(get_db)) -> dict:
    top = lambda m: [{"title": t, "views": v} for t, v in db.execute(  # noqa: E731
        select(m.title, m.view_count).order_by(m.view_count.desc()).limit(5)).all()]
    return {
        "counts": {
            "consultations": _count(db, models.ConsultationRequest),
            "interests": _count(db, models.OpportunityInterest),
            "itineraries": _count(db, models.ItineraryRequest),
            "registrations": _count(db, models.EventRegistration),
            "pitches_pending": _count(db, models.WriterPitch, models.WriterPitch.status == "pending"),
            "subscribers": _count(db, models.NewsletterSubscriber, models.NewsletterSubscriber.is_active),
            "news": _count(db, models.NewsArticle),
            "opportunities": _count(db, models.Opportunity),
            "events": _count(db, models.Event),
            "emails_sent": _count(db, models.EmailLog, models.EmailLog.status == "sent"),
        },
        "new": {k: _count(db, m, m.status == "new") for k, m in SUBMISSIONS.items() if hasattr(m, "status") and k != "pitches"},
        "top_news": top(models.NewsArticle),
        "top_opportunities": top(models.Opportunity),
    }


# ---------------------------------------------------------------- submissions
@router.get("/submissions/{kind}")
def list_submissions(kind: str, event_id: int | None = None, status: str | None = None,
                     limit: int = Query(default=200, le=1000), db: Session = Depends(get_db)):
    model = SUBMISSIONS.get(kind)
    if not model:
        raise HTTPException(404, "Unknown submission type")
    stmt = select(model)
    if event_id is not None and kind == "registrations":
        stmt = stmt.where(models.EventRegistration.event_id == event_id)
    if status and hasattr(model, "status"):
        stmt = stmt.where(model.status == status)
    rows = db.scalars(stmt.order_by(model.created_at.desc()).limit(limit)).all()
    return [_row_to_dict(r) for r in rows]


@router.get("/submissions/{kind}/export.csv")
def export_csv(kind: str, event_id: int | None = None, db: Session = Depends(get_db)):
    rows = list_submissions(kind, event_id=event_id, status=None, limit=1000, db=db)
    buf = io.StringIO()
    if rows:
        w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="afrimpact-{kind}.csv"'})


@router.get("/registrations/by-event")
def registrations_by_event(db: Session = Depends(get_db)):
    E, R = models.Event, models.EventRegistration
    rows = db.execute(
        select(E.id, E.title, E.subtitle, E.start_at, E.capacity, func.count(R.id))
        .outerjoin(R, R.event_id == E.id).group_by(E.id).order_by(E.start_at.desc())
    ).all()
    return [{"id": i, "title": t, "subtitle": st, "start_at": s, "capacity": c, "registrations": n}
            for i, t, st, s, c, n in rows]


@router.patch("/submissions/{kind}/{item_id}")
def update_status(kind: str, item_id: int, status: str = Query(pattern="^(new|in_progress|done|archived)$"),
                  db: Session = Depends(get_db)):
    model = SUBMISSIONS.get(kind)
    if not model or not hasattr(model, "status") or kind == "pitches":
        raise HTTPException(404, "Unknown submission type")
    row = db.get(model, item_id)
    if not row:
        raise HTTPException(404, "Not found")
    row.status = status
    db.commit()
    return _row_to_dict(row)


@router.patch("/newsletter/{sub_id}")
def toggle_subscriber(sub_id: int, active: bool, db: Session = Depends(get_db)):
    sub = db.get(models.NewsletterSubscriber, sub_id)
    if not sub:
        raise HTTPException(404, "Not found")
    sub.is_active = active
    sub.unsubscribed_at = None if active else datetime.now(timezone.utc)
    db.commit()
    return _row_to_dict(sub)


# ---------------------------------------------------------------- writer pitches → news
@router.post("/pitches/{pitch_id}/approve")
def approve_pitch(pitch_id: int, payload: schemas.ReviewIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    p = db.get(models.WriterPitch, pitch_id)
    if not p:
        raise HTTPException(404, "Not found")
    if p.status == "approved" and p.article_id:
        return {"pitch": _row_to_dict(p), "article_id": p.article_id}
    paragraphs = [x.strip() for x in p.pitch.split("\n") if x.strip()]
    article = models.NewsArticle(
        slug=unique_slug(db, models.NewsArticle, p.topic), title=p.topic, category="Contributors",
        excerpt=paragraphs[0][:280] if paragraphs else "", body=paragraphs, author=p.full_name,
        read_minutes=max(2, len(p.pitch.split()) // 200), is_published=False, tags=["contributor"],
        published_at=datetime.now(timezone.utc),
    )
    db.add(article)
    db.flush()
    p.status, p.article_id, p.review_note, p.reviewed_at = "approved", article.id, payload.note, datetime.now(timezone.utc)
    db.commit()
    bg.add_task(send_pitch_decision, p.id, True)
    return {"pitch": _row_to_dict(p), "article_id": article.id,
            "message": "Pitch approved. A draft article was created in News — edit it and publish when ready."}


@router.post("/pitches/{pitch_id}/reject")
def reject_pitch(pitch_id: int, payload: schemas.ReviewIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    p = db.get(models.WriterPitch, pitch_id)
    if not p:
        raise HTTPException(404, "Not found")
    p.status, p.review_note, p.reviewed_at = "rejected", payload.note, datetime.now(timezone.utc)
    db.commit()
    bg.add_task(send_pitch_decision, p.id, False)
    return {"pitch": _row_to_dict(p), "message": "Pitch rejected. The writer will be notified by email."}


# ---------------------------------------------------------------- email settings
@router.get("/email")
def email_status(db: Session = Depends(get_db)) -> dict:
    s = get_settings()
    logs = db.scalars(select(models.EmailLog).order_by(models.EmailLog.id.desc()).limit(60)).all()
    sends = db.scalars(select(models.NewsletterSend).order_by(models.NewsletterSend.id.desc()).limit(20)).all()
    return {
        "configured": s.smtp_enabled,
        "smtp_host": s.smtp_host or None,
        "smtp_port": s.smtp_port,
        "default_recipients": s.notify_list,
        "routes": [{"kind": k, "label": v, "recipients": s.recipients_for(k),
                    "custom": bool(getattr(s, f"notify_{k}", ""))} for k, v in FORM_LABELS.items()],
        "send_confirmation": s.send_confirmation,
        "logs": [_row_to_dict(r) for r in logs],
        "newsletter_sends": [_row_to_dict(r) for r in sends],
    }


@router.post("/email/test")
def email_test(db: Session = Depends(get_db)) -> dict:
    s = get_settings()
    to = s.notify_list
    if not s.smtp_enabled or not to:
        raise HTTPException(400, "SMTP is not configured. Set SMTP_HOST and NOTIFY_EMAILS in the backend .env and restart.")
    subject = "[Afrimpact] Test email"
    try:
        send_email(to, subject, "SMTP is working. Website submissions will be forwarded to this inbox.")
    except Exception as exc:
        db.add(models.EmailLog(kind="test", recipient=",".join(to), subject=subject, purpose="test",
                               status="failed", error=str(exc)[:2000]))
        db.commit()
        raise HTTPException(502, f"Sending failed: {exc}")
    db.add(models.EmailLog(kind="test", recipient=",".join(to), subject=subject, purpose="test", status="sent"))
    db.commit()
    return {"ok": True, "message": f"Test email sent to {', '.join(to)}"}


# ---------------------------------------------------------------- uploads
ALLOWED = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}


@router.post("/upload")
async def upload(file: UploadFile = File(...)) -> dict:
    s = get_settings()
    ext = ALLOWED.get(file.content_type or "")
    if not ext:
        raise HTTPException(415, "Please upload a JPG, PNG, WebP or GIF image")
    data = await file.read()
    if len(data) > s.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"Image is larger than {s.max_upload_mb} MB")
    folder = Path(s.upload_dir)
    folder.mkdir(parents=True, exist_ok=True)
    data, ext = _optimise(data, ext)
    name = f"{datetime.now():%Y%m}-{secrets.token_hex(6)}{ext}"
    (folder / name).write_bytes(data)
    return {"url": f"api/uploads/{name}"}


def _optimise(data: bytes, ext: str) -> tuple[bytes, str]:
    """Resize large photos (max 1600px) and re-compress, so pages load fast and
    social-app previews (WhatsApp needs small images) always show the picture."""
    try:
        from PIL import Image, ImageOps

        im = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
        if ext == ".gif":
            return data, ext
        im.thumbnail((1600, 1600))
        out = io.BytesIO()
        if im.mode in ("RGBA", "LA", "P") and ext == ".png":
            im.save(out, "PNG", optimize=True)
            return out.getvalue(), ".png"
        im.convert("RGB").save(out, "JPEG", quality=82, optimize=True, progressive=True)
        return out.getvalue(), ".jpg"
    except Exception:
        return data, ext  # not a readable image: keep the original bytes


# ---------------------------------------------------------------- content (news / opportunities / events)
def _content(kind: str):
    if kind not in CONTENT:
        raise HTTPException(404, "Unknown content type")
    return CONTENT[kind]


@router.get("/content/{kind}")
def list_content(kind: str, db: Session = Depends(get_db)):
    model, _ = _content(kind)
    rows = db.scalars(select(model).order_by(model.id.desc())).all()
    return [_row_to_dict(r) for r in rows]


@router.get("/content/{kind}/{item_id}")
def get_content(kind: str, item_id: int, db: Session = Depends(get_db)):
    model, _ = _content(kind)
    row = db.get(model, item_id)
    if not row:
        raise HTTPException(404, "Not found")
    return _row_to_dict(row)


def _apply(kind: str, row, data: dict):
    data = {k: v for k, v in data.items() if k not in ("slug", "notify_subscribers")}
    if kind == "news" and not data.get("published_at"):
        data["published_at"] = row.published_at or datetime.now(timezone.utc)
    if kind == "opportunities" and not data.get("posted_at"):
        data["posted_at"] = row.posted_at or date.today()
    for k, v in data.items():
        setattr(row, k, v)


def _maybe_newsletter(kind: str, row, data: dict, bg: BackgroundTasks) -> bool:
    if kind == "news" and row.is_published and not row.newsletter_sent_at and data.get("notify_subscribers", True):
        bg.add_task(send_newsletter, row.id)
        return True
    return False


@router.post("/content/{kind}", status_code=201)
def create_content(kind: str, payload: dict, bg: BackgroundTasks, db: Session = Depends(get_db)):
    model, schema_in = _content(kind)
    data = schema_in.model_validate(payload).model_dump()
    row = model()
    row.slug = unique_slug(db, model, data.get("slug") or data["title"])
    _apply(kind, row, data)
    db.add(row)
    db.commit()
    out = _row_to_dict(row)
    out["newsletter_queued"] = _maybe_newsletter(kind, row, data, bg)
    return out


@router.put("/content/{kind}/{item_id}")
def update_content(kind: str, item_id: int, payload: dict, bg: BackgroundTasks, db: Session = Depends(get_db)):
    model, schema_in = _content(kind)
    row = db.get(model, item_id)
    if not row:
        raise HTTPException(404, "Not found")
    data = schema_in.model_validate(payload).model_dump()
    if data.get("slug"):
        row.slug = unique_slug(db, model, data["slug"], exclude_id=row.id)
    _apply(kind, row, data)
    db.commit()
    out = _row_to_dict(row)
    out["newsletter_queued"] = _maybe_newsletter(kind, row, data, bg)
    return out


@router.post("/news/{item_id}/send-newsletter")
def resend_newsletter(item_id: int, db: Session = Depends(get_db)):
    art = db.get(models.NewsArticle, item_id)
    if not art or not art.is_published:
        raise HTTPException(400, "Publish the article before emailing it")
    result = send_newsletter(art.id, force=True)
    return {"message": f"Newsletter {result['status']}" + (f": {result.get('reason')}" if result.get("reason") else
                                                          f" to {result.get('delivered', 0)} subscribers"), **result}


@router.delete("/content/{kind}/{item_id}", status_code=204)
def delete_content(kind: str, item_id: int, db: Session = Depends(get_db)):
    model, _ = _content(kind)
    row = db.get(model, item_id)
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row)
    db.commit()
