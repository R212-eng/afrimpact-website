import math
import re
import unicodedata

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session



def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    return re.sub(r"[-\s_]+", "-", value)[:150] or "item"


def unique_slug(db: Session, model, base: str, exclude_id: int | None = None) -> str:
    slug, n = slugify(base), 2
    candidate = slug
    while True:
        q = select(model.id).where(model.slug == candidate)
        if exclude_id is not None:
            q = q.where(model.id != exclude_id)
        if db.scalar(q) is None:
            return candidate
        candidate = f"{slug}-{n}"
        n += 1


def paginate(db: Session, stmt: Select, page: int, page_size: int) -> dict:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    items = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)),
    }
