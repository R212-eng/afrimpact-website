import html
from datetime import datetime, timezone

import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import get_settings
from ..database import get_db

router = APIRouter(tags=["content"])


def get_setting(db: Session, key: str, default=None):
    row = db.get(models.SiteSetting, key)
    return row.value if row else default


@router.get("/site")
def site(db: Session = Depends(get_db)) -> dict:
    return {
        "site": get_setting(db, "site", {}),
        "service_categories": get_setting(db, "service_categories", []),
    }


@router.get("/home", response_model=schemas.HomeOut)
def home(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    ticker = db.scalars(
        select(models.Event)
        .where(models.Event.is_published, models.Event.start_at >= now)
        .order_by(models.Event.start_at)
        .limit(5)
    ).all()
    fresh = db.scalars(
        select(models.Opportunity)
        .where(models.Opportunity.is_published)
        .order_by(models.Opportunity.posted_at.desc(), models.Opportunity.id.desc())
        .limit(8)
    ).all()
    news = db.scalars(
        select(models.NewsArticle)
        .where(models.NewsArticle.is_published)
        .order_by(models.NewsArticle.published_at.desc())
        .limit(6)
    ).all()
    return {
        "site": get_setting(db, "site", {}),
        "home_cards": get_setting(db, "home_cards", []),
        "ticker": ticker,
        "fresh_opportunities": fresh,
        "testimonials": db.scalars(
            select(models.Testimonial).where(models.Testimonial.is_active).order_by(models.Testimonial.order)
        ).all(),
        "clients": db.scalars(select(models.Client).order_by(models.Client.order)).all(),
        "latest_news": news,
    }


@router.get("/services", response_model=list[schemas.ServiceOut])
def services(category: schemas.Category | None = Query(default=None), db: Session = Depends(get_db)):
    stmt = select(models.Service).where(models.Service.is_active)
    if category:
        stmt = stmt.where(models.Service.category == category)
    return db.scalars(stmt.order_by(models.Service.category, models.Service.order)).all()


@router.get("/testimonials", response_model=list[schemas.TestimonialOut])
def testimonials(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Testimonial).where(models.Testimonial.is_active).order_by(models.Testimonial.order)
    ).all()


@router.get("/clients", response_model=list[schemas.ClientOut])
def clients(db: Session = Depends(get_db)):
    return db.scalars(select(models.Client).order_by(models.Client.order)).all()


SHARE = {
    "news": (models.NewsArticle, "news", "excerpt"),
    "opportunities": (models.Opportunity, "opportunities", "summary"),
    "events": (models.Event, "events", "excerpt"),
}


# Link-preview crawlers of the apps we share to (plus common ones)
PREVIEW_BOTS = re.compile(
    r"TelegramBot|WhatsApp|LinkedInBot|Twitterbot|facebookexternalhit|Facebot|Slackbot|Discordbot|"
    r"SkypeUriPreview|Pinterest|redditbot|Applebot|Googlebot|bingbot|Embedly|vkShare|Iframely",
    re.I,
)


@router.get("/share/{kind}/{slug}", response_class=HTMLResponse, include_in_schema=False)
def share_page(kind: str, slug: str, request: Request, db: Session = Depends(get_db)):
    """Link given to Telegram / WhatsApp / LinkedIn / X.

    Preview crawlers get a small page with Open Graph / Twitter Card tags
    (title, summary, image, site name "Afrimpact Consultancy") and no redirect,
    so they never wander off to the JavaScript app. People get an instant 302
    redirect to the real page.
    """
    if kind not in SHARE:
        raise HTTPException(404)
    model, path, summary_field = SHARE[kind]
    row = db.scalar(select(model).where(model.slug == slug, model.is_published))
    if not row:
        raise HTTPException(404, "Not found")
    site = get_settings().site_url.rstrip("/")
    target = f"{site}/{path}/{row.slug}"
    image = row.image or ""
    if image and not image.startswith(("http://", "https://")):
        image = f"{site}/{image.lstrip('/')}"
    if not PREVIEW_BOTS.search(request.headers.get("user-agent", "")):
        return RedirectResponse(target, status_code=302)
    e = html.escape
    title, desc = e(row.title), e((getattr(row, summary_field) or "")[:300])
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>{title} | Afrimpact Consultancy</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Afrimpact Consultancy">
<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
<meta property="og:url" content="{e(target)}">{f'<meta property="og:image" content="{e(image)}">' if image else ''}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">{f'<meta name="twitter:image" content="{e(image)}">' if image else ''}
{f'<meta property="og:image:alt" content="{title}">' if image else ''}
<link rel="canonical" href="{e(target)}">
</head><body><h1>{title}</h1><p>{desc}</p><p>Source: Afrimpact Consultancy — <a href="{e(target)}">{e(target)}</a></p></body></html>"""
