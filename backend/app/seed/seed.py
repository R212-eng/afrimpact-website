"""Load sample content into the database.

Usage (from the backend folder):
    python -m app.seed.seed            # add sample content that is missing (never overwrites admin edits)
    python -m app.seed.seed --update   # also overwrite existing items with seed_data.json
    python -m app.seed.seed --reset    # DROP & recreate all tables first (destroys data)
    python -m app.seed.seed --if-empty # only seed a brand-new database (used by the Docker image)
"""
import argparse
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from .. import models
from ..database import Base, SessionLocal, engine

DATA_FILE = Path(__file__).with_name("seed_data.json")
EAT = timezone(timedelta(hours=3))


UPDATE_EXISTING = False


def _upsert(db, model, slug: str, values: dict):
    row = db.scalar(select(model).where(model.slug == slug))
    if row is not None and not UPDATE_EXISTING:
        return row
    if row is None:
        row = model(slug=slug)
        db.add(row)
    for k, v in values.items():
        setattr(row, k, v)
    return row


def _d(v):
    return date.fromisoformat(v) if v else None


def _dt(v):
    """Seed times are written in East Africa Time (UTC+3)."""
    if not v:
        return None
    dt = datetime.fromisoformat(v)
    return dt if dt.tzinfo else dt.replace(tzinfo=EAT)


def run(reset: bool = False, update: bool = False, if_empty: bool = False) -> None:
    global UPDATE_EXISTING
    if if_empty and not reset:
        with SessionLocal() as db:
            if db.scalar(select(models.SiteSetting.key).limit(1)):
                print("Database already has content — seed skipped.")
                return
    UPDATE_EXISTING = update or reset
    if reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))

    with SessionLocal() as db:
        for key in ("site", "home_cards", "service_categories"):
            row = db.get(models.SiteSetting, key)
            if row is None or UPDATE_EXISTING:
                db.merge(models.SiteSetting(key=key, value=data[key]))

        for s in data["services"]:
            _upsert(db, models.Service, s["slug"], {k: v for k, v in s.items() if k != "slug"})

        for o in data["opportunities"]:
            vals = {k: v for k, v in o.items() if k != "slug"}
            vals["deadline"] = _d(o.get("deadline"))
            vals["posted_at"] = _d(o.get("posted_at")) or date.today()
            _upsert(db, models.Opportunity, o["slug"], vals)

        for n in data["news"]:
            vals = {k: v for k, v in n.items() if k != "slug"}
            vals["published_at"] = _dt(n["published_at"])
            _upsert(db, models.NewsArticle, n["slug"], vals)

        for e in data["events"]:
            vals = {k: v for k, v in e.items() if k != "slug"}
            vals["start_at"] = _dt(e["start_at"])
            vals["end_at"] = _dt(e.get("end_at"))
            _upsert(db, models.Event, e["slug"], vals)

        if not db.scalar(select(models.Testimonial.id).limit(1)):
            db.add_all(models.Testimonial(**t) for t in data["testimonials"])
        if not db.scalar(select(models.Client.id).limit(1)):
            db.add_all(models.Client(**c) for c in data["clients"])

        db.commit()
    print("Seed complete." + (" (existing items updated)" if UPDATE_EXISTING else " (missing items added)"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="drop and recreate all tables first (destroys data)")
    parser.add_argument("--update", action="store_true", help="overwrite existing items with seed_data.json")
    parser.add_argument("--if-empty", action="store_true", help="skip if the database already has content")
    a = parser.parse_args()
    run(a.reset, a.update, a.if_empty)
