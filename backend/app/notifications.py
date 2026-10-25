"""Email: form forwarding, visitor confirmations, newsletter mailings.

* Every form except Contact is saved to PostgreSQL first, then emailed in a
  background task to its own inbox (NOTIFY_<FORM>, falling back to NOTIFY_EMAILS).
* The Contact form is not stored: it is emailed synchronously, and the visitor
  sees an error if SMTP is missing or the send fails, so no message is lost silently.
* Publishing a news article emails every active newsletter subscriber, each with
  a personal unsubscribe link.
Every attempt is recorded in `email_logs`.
"""
from __future__ import annotations

import html
import logging
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from fastapi import BackgroundTasks
from sqlalchemy import select

from . import models
from .config import get_settings
from .database import SessionLocal

log = logging.getLogger("afrimpact.email")

TITLES = {
    "contact": "New contact message",
    "consultations": "New consultation request",
    "interests": "New investment opportunity interest",
    "itineraries": "New itinerary request",
    "registrations": "New event registration",
    "newsletter": "New newsletter subscriber",
    "pitches": "New 'Write for Us' pitch",
    "test": "Test email",
}


class EmailNotConfigured(RuntimeError):
    pass


# ---------------------------------------------------------------- low level
def _sender(settings) -> str:
    if settings.email_from:
        return settings.email_from
    return formataddr(("Afrimpact Website", settings.smtp_username or "no-reply@afrimpact.com"))


def _connect():
    s = get_settings()
    if s.smtp_use_ssl:
        server = smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=s.smtp_timeout, context=ssl.create_default_context())
    else:
        server = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=s.smtp_timeout)
    if s.smtp_use_tls and not s.smtp_use_ssl:
        server.starttls(context=ssl.create_default_context())
    if s.smtp_username:
        server.login(s.smtp_username, s.smtp_password)
    return server


def _message(to: list[str], subject: str, text: str, html_body: str | None, reply_to: str | None,
             headers: dict | None = None) -> EmailMessage:
    s = get_settings()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = _sender(s)
    msg["To"] = ", ".join(to)
    msg["Message-ID"] = make_msgid(domain="afrimpact.com")
    if reply_to:
        msg["Reply-To"] = reply_to
    for k, v in (headers or {}).items():
        msg[k] = v
    msg.set_content(text)
    if html_body:
        msg.add_alternative(html_body, subtype="html")
    return msg


def send_email(to: list[str], subject: str, text: str, html_body: str | None = None, reply_to: str | None = None) -> None:
    """Send one message. Raises on failure (callers log the error)."""
    if not get_settings().smtp_enabled:
        raise EmailNotConfigured("SMTP is not configured")
    with _connect() as server:
        server.send_message(_message(to, subject, text, html_body, reply_to))


def _log(kind, submission_id, recipient, subject, purpose, status, error=None) -> None:
    try:
        with SessionLocal() as db:
            db.add(models.EmailLog(kind=kind, submission_id=submission_id, recipient=(recipient or "-")[:300],
                                   subject=subject[:300], purpose=purpose, status=status,
                                   error=(error or None) and str(error)[:2000]))
            db.commit()
    except Exception:  # pragma: no cover - logging must never break a request
        log.exception("could not write email log")


def _render(title: str, fields: dict, footer: str) -> tuple[str, str]:
    rows = [(k, "" if v is None else str(v)) for k, v in fields.items() if v not in (None, "")]
    text = f"{title}\n\n" + "\n".join(f"{k}: {v}" for k, v in rows) + f"\n\n{footer}\n"
    tr = "".join(
        f'<tr><td style="padding:8px 12px;color:#777;white-space:nowrap;vertical-align:top">{html.escape(k)}</td>'
        f'<td style="padding:8px 12px;color:#222">{html.escape(v).replace(chr(10), "<br>")}</td></tr>'
        for k, v in rows
    )
    body = f"""<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #eee">
  <div style="background:#e45a59;color:#fff;padding:18px 22px;font-size:18px;font-weight:bold">{html.escape(title)}</div>
  <table style="border-collapse:collapse;width:100%;font-size:14px">{tr}</table>
  <div style="padding:14px 22px;color:#999;font-size:12px;border-top:1px solid #eee">{html.escape(footer)}</div>
</div>"""
    return text, body


def _subject(kind: str, summary: str | None) -> str:
    return f"[Afrimpact] {TITLES.get(kind, 'New website submission')}" + (f": {summary}" if summary else "")


# ---------------------------------------------------------------- forms
def send_contact_now(fields: dict, visitor_email: str, summary: str) -> None:
    """Contact form: email immediately (not stored). Raises if it cannot be delivered."""
    s = get_settings()
    to = s.recipients_for("contact")
    subject = _subject("contact", summary)
    if not s.smtp_enabled or not to:
        _log("contact", None, ",".join(to), subject, "notify", "failed", "SMTP not configured")
        raise EmailNotConfigured("SMTP is not configured")
    text, body = _render(TITLES["contact"], fields, f"Sent from the contact form · {s.site_url}")
    try:
        send_email(to, subject, text, body, reply_to=visitor_email)
    except Exception as exc:
        _log("contact", None, ",".join(to), subject, "notify", "failed", exc)
        raise
    _log("contact", None, ",".join(to), subject, "notify", "sent")


def deliver_submission(kind: str, submission_id: int | None, fields: dict, visitor_email: str | None,
                       visitor_name: str | None = None, summary: str | None = None) -> None:
    """Background job: email the form's inbox (and optionally confirm to the visitor)."""
    s = get_settings()
    to = s.recipients_for(kind)
    subject = _subject(kind, summary)
    if not s.smtp_enabled or not to:
        _log(kind, submission_id, ",".join(to) or "-", subject, "notify", "skipped",
             "SMTP not configured (set SMTP_HOST and NOTIFY_EMAILS)")
        return

    text, body = _render(TITLES.get(kind, subject), fields,
                         f"Submission #{submission_id} · saved in the Afrimpact database · {s.site_url}/admin")
    try:
        send_email(to, subject, text, body, reply_to=visitor_email)
        _log(kind, submission_id, ",".join(to), subject, "notify", "sent")
    except Exception as exc:
        log.warning("notification email failed: %s", exc)
        _log(kind, submission_id, ",".join(to), subject, "notify", "failed", exc)

    if s.send_confirmation and visitor_email and kind != "newsletter":
        send_visitor_confirmation(kind, submission_id, visitor_email, visitor_name)


def send_visitor_confirmation(kind, submission_id, visitor_email, visitor_name) -> None:
    s = get_settings()
    name = (visitor_name or "").split(" ")[0] or "there"
    what = TITLES.get(kind, "message").lower().replace("new ", "")
    subject = "We received your message — Afrimpact Consultancy"
    text = (f"Hi {name},\n\nThank you for contacting Afrimpact Consultancy. We have received your {what} "
            f"and an advisor will get back to you within one to two working days.\n\nAfrimpact Consultancy\n{s.site_url}\n")
    try:
        send_email([visitor_email], subject, text)
        _log(kind, submission_id, visitor_email, subject, "confirm", "sent")
    except Exception as exc:
        _log(kind, submission_id, visitor_email, subject, "confirm", "failed", exc)


def queue(bg: BackgroundTasks, kind: str, submission_id: int | None, fields: dict,
          visitor_email: str | None = None, visitor_name: str | None = None, summary: str | None = None) -> None:
    bg.add_task(deliver_submission, kind, submission_id, fields, visitor_email, visitor_name, summary)


# ---------------------------------------------------------------- pitch decisions
def send_pitch_decision(pitch_id: int, approved: bool) -> None:
    s = get_settings()
    with SessionLocal() as db:
        p = db.get(models.WriterPitch, pitch_id)
        if not p:
            return
        subject = f"Your article pitch \"{p.topic}\" — {'approved' if approved else 'update'}"
        if approved:
            text = (f"Hi {p.full_name.split(' ')[0]},\n\nGood news: our editors approved your pitch \"{p.topic}\". "
                    "We'll be in touch about the final draft and images before it is published on the Afrimpact news page.\n\n"
                    f"{p.review_note or ''}\n\nAfrimpact Consultancy\n{s.site_url}\n")
        else:
            text = (f"Hi {p.full_name.split(' ')[0]},\n\nThank you for pitching \"{p.topic}\". We won't be taking it forward "
                    f"this time.\n\n{p.review_note or ''}\n\nAfrimpact Consultancy\n{s.site_url}\n")
        email = p.email
    if not s.smtp_enabled:
        _log("pitches", pitch_id, email, subject, "confirm", "skipped", "SMTP not configured")
        return
    try:
        send_email([email], subject, text)
        _log("pitches", pitch_id, email, subject, "confirm", "sent")
    except Exception as exc:
        _log("pitches", pitch_id, email, subject, "confirm", "failed", exc)


# ---------------------------------------------------------------- newsletter
def _article_email(article: models.NewsArticle, unsubscribe_url: str) -> tuple[str, str]:
    s = get_settings()
    url = f"{s.site_url.rstrip('/')}/news/{article.slug}"
    img = article.image or ""
    if img and not img.startswith("http"):
        img = f"{s.site_url.rstrip('/')}/{img.lstrip('/')}"
    text = (f"{article.title}\n\n{article.excerpt}\n\nRead the full story: {url}\n\n"
            f"You receive this because you subscribed to the Afrimpact newsletter.\nUnsubscribe: {unsubscribe_url}\n")
    body = f"""<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #eee">
  <div style="background:#e45a59;color:#fff;padding:14px 22px;font-size:13px;letter-spacing:.1em">AFRIMPACT CONSULTANCY · NEWSLETTER</div>
  {f'<img src="{html.escape(img)}" alt="" style="width:100%;max-height:300px;object-fit:cover;display:block">' if img else ''}
  <div style="padding:22px">
    <div style="color:#e45a59;font-size:12px;font-weight:bold;text-transform:uppercase">{html.escape(article.category)}</div>
    <h1 style="font-size:22px;color:#222;margin:8px 0 12px">{html.escape(article.title)}</h1>
    <p style="font-size:15px;color:#444;line-height:1.6">{html.escape(article.excerpt)}</p>
    <a href="{html.escape(url)}" style="display:inline-block;background:#e45a59;color:#fff;padding:12px 22px;text-decoration:none;font-weight:bold;margin-top:8px">Read the full story</a>
  </div>
  <div style="padding:14px 22px;color:#999;font-size:12px;border-top:1px solid #eee">
    You receive this because you subscribed on afrimpact.com. <a href="{html.escape(unsubscribe_url)}" style="color:#999">Unsubscribe</a>
  </div>
</div>"""
    return text, body


def send_newsletter(article_id: int, force: bool = False) -> dict:
    """Email one article to every active subscriber. Safe to call twice (skips if already sent)."""
    s = get_settings()
    with SessionLocal() as db:
        article = db.get(models.NewsArticle, article_id)
        if not article or not article.is_published:
            return {"status": "skipped", "reason": "article not published"}
        if article.newsletter_sent_at and not force:
            return {"status": "skipped", "reason": "already sent"}
        subs = db.scalars(select(models.NewsletterSubscriber).where(models.NewsletterSubscriber.is_active)).all()
        subject = f"Afrimpact news: {article.title}"
        send = models.NewsletterSend(article_id=article.id, subject=subject, recipients=len(subs))
        db.add(send)
        if not subs:
            send.status = "skipped"
            db.commit()
            return {"status": "skipped", "reason": "no subscribers"}
        if not s.smtp_enabled:
            send.status = "skipped"
            db.commit()
            _log("newsletter", article.id, f"{len(subs)} subscribers", subject, "newsletter", "skipped", "SMTP not configured")
            return {"status": "skipped", "reason": "SMTP not configured"}

        ok = bad = 0
        try:
            server = _connect()
        except Exception as exc:
            send.status, send.failed = "failed", len(subs)
            db.commit()
            _log("newsletter", article.id, f"{len(subs)} subscribers", subject, "newsletter", "failed", exc)
            return {"status": "failed", "reason": str(exc)}
        with server:
            for sub in subs:
                unsub = f"{s.site_url.rstrip('/')}/api/newsletter/unsubscribe?token={sub.token}"
                text, body = _article_email(article, unsub)
                try:
                    server.send_message(_message([sub.email], subject, text, body, None,
                                                 {"List-Unsubscribe": f"<{unsub}>"}))
                    ok += 1
                except Exception as exc:  # keep going for the rest of the list
                    bad += 1
                    log.warning("newsletter to %s failed: %s", sub.email, exc)
        send.delivered, send.failed = ok, bad
        send.status = "sent" if bad == 0 else ("partial" if ok else "failed")
        article.newsletter_sent_at = datetime.now(timezone.utc)
        db.commit()
        _log("newsletter", article.id, f"{ok}/{len(subs)} subscribers", subject, "newsletter", send.status)
        return {"status": send.status, "delivered": ok, "failed": bad}
