from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..utils import paginate

router = APIRouter(prefix="/news", tags=["news"])


def _published():
    return select(models.NewsArticle).where(models.NewsArticle.is_published)


@router.get("", response_model=schemas.Page[schemas.NewsCard])
def list_news(
    category: str | None = None,
    q: str | None = Query(default=None, max_length=100),
    exclude_featured: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=9, ge=1, le=50),
    db: Session = Depends(get_db),
):
    N = models.NewsArticle
    stmt = _published()
    if category:
        stmt = stmt.where(N.category == category)
    if exclude_featured:
        stmt = stmt.where(N.is_featured.is_(False))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(N.title.ilike(like), N.excerpt.ilike(like)))
    return paginate(db, stmt.order_by(N.published_at.desc(), N.id.desc()), page, page_size)


@router.get("/categories", response_model=list[str])
def categories(db: Session = Depends(get_db)):
    N = models.NewsArticle
    return sorted(set(db.scalars(select(N.category).where(N.is_published).distinct())))


@router.get("/featured", response_model=schemas.NewsCard | None)
def featured(db: Session = Depends(get_db)):
    N = models.NewsArticle
    return db.scalar(_published().order_by(N.is_featured.desc(), N.published_at.desc()).limit(1))


@router.get("/{slug}", response_model=schemas.NewsDetail)
def get_article(slug: str, db: Session = Depends(get_db)):
    art = db.scalar(_published().where(models.NewsArticle.slug == slug))
    if not art:
        raise HTTPException(404, "Article not found")
    art.view_count += 1
    db.commit()
    N = models.NewsArticle
    related = db.scalars(
        _published().where(N.id != art.id).order_by((N.category == art.category).desc(), N.published_at.desc()).limit(3)
    ).all()
    data = schemas.NewsDetail.model_validate(art)
    data.related = [schemas.NewsCard.model_validate(r) for r in related]
    return data


def _bump(db: Session, slug: str, field: str, delta: int = 1) -> models.NewsArticle:
    art = db.scalar(_published().where(models.NewsArticle.slug == slug))
    if not art:
        raise HTTPException(404, "Article not found")
    setattr(art, field, max(0, getattr(art, field) + delta))
    action = field.rstrip("s") if delta > 0 else "unlike"
    db.add(models.Interaction(entity_type="news", entity_id=slug, action=action))
    db.commit()
    return art


@router.post("/{slug}/like", response_model=schemas.CountOut)
def like(slug: str, db: Session = Depends(get_db)):
    return _bump(db, slug, "likes")


@router.post("/{slug}/unlike", response_model=schemas.CountOut)
def unlike(slug: str, db: Session = Depends(get_db)):
    return _bump(db, slug, "likes", -1)


@router.post("/{slug}/share", response_model=schemas.CountOut)
def share(slug: str, db: Session = Depends(get_db)):
    return _bump(db, slug, "shares")
