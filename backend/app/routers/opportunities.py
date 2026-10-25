from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..notifications import queue
from ..utils import paginate

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


def _published():
    return select(models.Opportunity).where(models.Opportunity.is_published)


@router.get("", response_model=schemas.Page[schemas.OpportunityCard])
def list_opportunities(
    category: schemas.Category | None = None,
    country: str | None = None,
    type: str | None = None,
    sector: str | None = None,
    q: str | None = Query(default=None, max_length=100),
    posted_from: date | None = None,
    posted_to: date | None = None,
    sort: str = Query(default="newest", pattern="^(newest|oldest|deadline|title)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    O = models.Opportunity
    stmt = _published()
    if category:
        stmt = stmt.where(O.category == category)
    if country:
        stmt = stmt.where(O.country == country)
    if type:
        stmt = stmt.where(O.type == type)
    if sector:
        stmt = stmt.where(O.sector == sector)
    if posted_from:
        stmt = stmt.where(O.posted_at >= posted_from)
    if posted_to:
        stmt = stmt.where(O.posted_at <= posted_to)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(O.title.ilike(like), O.summary.ilike(like), O.location.ilike(like), O.sector.ilike(like)))
    order = {
        "newest": (O.posted_at.desc(), O.id.desc()),
        "oldest": (O.posted_at.asc(), O.id.asc()),
        "deadline": (O.deadline.asc().nulls_last(), O.id.asc()),
        "title": (O.title.asc(),),
    }[sort]
    return paginate(db, stmt.order_by(*order), page, page_size)


@router.get("/filters", response_model=schemas.FilterOptions)
def filter_options(db: Session = Depends(get_db)):
    O = models.Opportunity
    col = lambda c: sorted({v for v in db.scalars(select(c).where(O.is_published).distinct()) if v})  # noqa: E731
    return {"countries": col(O.country), "types": col(O.type), "sectors": col(O.sector)}


@router.get("/{slug}", response_model=schemas.OpportunityDetail)
def get_opportunity(slug: str, db: Session = Depends(get_db)):
    opp = db.scalar(_published().where(models.Opportunity.slug == slug))
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    opp.view_count += 1
    db.commit()
    related = db.scalars(
        _published()
        .where(models.Opportunity.id != opp.id, models.Opportunity.category == opp.category)
        .order_by(models.Opportunity.posted_at.desc())
        .limit(3)
    ).all()
    data = schemas.OpportunityDetail.model_validate(opp)
    data.related = [schemas.OpportunityCard.model_validate(r) for r in related]
    return data


@router.post("/{slug}/interest", response_model=schemas.Ack, status_code=201)
def express_interest(slug: str, payload: schemas.InterestIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    opp = db.scalar(_published().where(models.Opportunity.slug == slug))
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    row = models.OpportunityInterest(opportunity_id=opp.id, **payload.model_dump())
    db.add(row)
    db.add(models.Interaction(entity_type="opportunity", entity_id=slug, action="apply"))
    db.commit()
    queue(bg, "interests", row.id, {
        "Opportunity": f"{opp.title} ({opp.location}, {opp.country})", "Category": opp.category.title(),
        "Name": payload.full_name, "Email": payload.email, "Phone": payload.phone,
        "Organisation": payload.organization, "Budget": payload.budget, "Message": payload.message,
    }, payload.email, payload.full_name, f"{opp.title} — {payload.full_name}")
    return {"message": "Thank you! An Afrimpact advisor will contact you within two working days.", "id": row.id}


@router.post("/{slug}/itinerary", response_model=schemas.Ack, status_code=201)
def request_itinerary(slug: str, payload: schemas.ItineraryIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    """'Plan this trip' form on travel attractions."""
    opp = db.scalar(_published().where(models.Opportunity.slug == slug))
    if not opp:
        raise HTTPException(404, "Destination not found")
    row = models.ItineraryRequest(opportunity_id=opp.id, destination=f"{opp.title} ({opp.location})",
                                  **payload.model_dump())
    db.add(row)
    db.add(models.Interaction(entity_type="opportunity", entity_id=slug, action="itinerary"))
    db.commit()
    queue(bg, "itineraries", row.id, {
        "Destination": row.destination, "Name": payload.full_name, "Email": payload.email, "Phone": payload.phone,
        "Travel date": payload.travel_date, "Travellers": payload.travelers, "Budget": payload.budget,
        "Message": payload.message,
    }, payload.email, payload.full_name, f"{opp.title} — {payload.full_name}")
    return {"message": "Thank you! A travel advisor will send you a tailored itinerary within two working days.", "id": row.id}
