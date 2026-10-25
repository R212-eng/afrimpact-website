"""SQLAlchemy ORM models.

Designed for PostgreSQL. JSONB columns keep list-like content (bullets, tags,
paragraphs) flexible, and the `interactions` table records user behaviour in a
shape that is ready for future machine-learning work (recommendations,
demand forecasting, lead scoring).
"""
import secrets
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# ---------------------------------------------------------------- content
class SiteSetting(Base):
    """Key/value store for editable site copy (intro, about, contact, socials...)."""

    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict | list | str] = mapped_column(JSONB)


class Service(TimestampMixin, Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(30), index=True)  # investment | travel | other
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text, default="")
    bullets: Mapped[list] = mapped_column(JSONB, default=list)
    image: Mapped[str | None] = mapped_column(String(300))
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Opportunity(TimestampMixin, Base):
    __tablename__ = "opportunities"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(30), index=True)  # investment | travel | other
    type: Mapped[str] = mapped_column(String(60), index=True)  # Investment | Travel | Partnership | Advisory
    country: Mapped[str] = mapped_column(String(80), index=True)
    location: Mapped[str | None] = mapped_column(String(160))
    sector: Mapped[str | None] = mapped_column(String(120), index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    bullets: Mapped[list] = mapped_column(JSONB, default=list)
    body: Mapped[list] = mapped_column(JSONB, default=list)
    highlights: Mapped[list] = mapped_column(JSONB, default=list)
    image: Mapped[str | None] = mapped_column(String(300))
    investment_range: Mapped[str | None] = mapped_column(String(80))
    deadline: Mapped[date | None] = mapped_column(Date)
    posted_at: Mapped[date] = mapped_column(Date, server_default=func.current_date(), index=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    view_count: Mapped[int] = mapped_column(Integer, default=0)

    interests: Mapped[list["OpportunityInterest"]] = relationship(
        back_populates="opportunity", cascade="all, delete-orphan"
    )


class NewsArticle(TimestampMixin, Base):
    __tablename__ = "news_articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(250))
    category: Mapped[str] = mapped_column(String(80), index=True)
    excerpt: Mapped[str] = mapped_column(Text, default="")
    body: Mapped[list] = mapped_column(JSONB, default=list)
    image: Mapped[str | None] = mapped_column(String(300))
    author: Mapped[str] = mapped_column(String(120), default="Afrimpact Team")
    author_image: Mapped[str | None] = mapped_column(String(300))
    read_minutes: Mapped[int] = mapped_column(Integer, default=3)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    newsletter_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Event(TimestampMixin, Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(250))
    subtitle: Mapped[str | None] = mapped_column(String(250))
    excerpt: Mapped[str] = mapped_column(Text, default="")
    body: Mapped[list] = mapped_column(JSONB, default=list)
    image: Mapped[str | None] = mapped_column(String(300))
    location: Mapped[str | None] = mapped_column(String(160))
    venue: Mapped[str | None] = mapped_column(String(200))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    capacity: Mapped[int | None] = mapped_column(Integer)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    registrations: Mapped[list["EventRegistration"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )


class Testimonial(Base):
    __tablename__ = "testimonials"

    id: Mapped[int] = mapped_column(primary_key=True)
    quote: Mapped[str] = mapped_column(Text)
    author: Mapped[str] = mapped_column(String(160))
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    logo: Mapped[str | None] = mapped_column(String(300))
    website: Mapped[str | None] = mapped_column(String(300))
    order: Mapped[int] = mapped_column(Integer, default=0)


# ---------------------------------------------------------------- submissions / leads
# NOTE: the contact form is intentionally NOT stored — it is emailed straight to the team inbox.


class ConsultationRequest(Base):
    __tablename__ = "consultation_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200), index=True)
    phone: Mapped[str | None] = mapped_column(String(40))
    company: Mapped[str | None] = mapped_column(String(200))
    service_interest: Mapped[str] = mapped_column(String(60))  # investment | travel | other
    topic: Mapped[str | None] = mapped_column(String(200))  # e.g. "Market Entry Strategies", "Tailored Itineraries"
    preferred_date: Mapped[date | None] = mapped_column(Date)
    message: Mapped[str] = mapped_column(Text, default="")
    source_page: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OpportunityInterest(Base):
    __tablename__ = "opportunity_interests"

    id: Mapped[int] = mapped_column(primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40))
    organization: Mapped[str | None] = mapped_column(String(200))
    budget: Mapped[str | None] = mapped_column(String(80))
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    opportunity: Mapped[Opportunity] = relationship(back_populates="interests")


class ItineraryRequest(Base):
    """'Plan this trip' requests from travel attractions (and tailored itinerary enquiries)."""

    __tablename__ = "itinerary_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    opportunity_id: Mapped[int | None] = mapped_column(ForeignKey("opportunities.id", ondelete="SET NULL"), index=True)
    destination: Mapped[str] = mapped_column(String(200))
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40))
    travel_date: Mapped[date | None] = mapped_column(Date)
    travelers: Mapped[int | None] = mapped_column(Integer)
    budget: Mapped[str | None] = mapped_column(String(80))
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EventRegistration(Base):
    __tablename__ = "event_registrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40))
    organization: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped[Event] = relationship(back_populates="registrations")


class NewsletterSubscriber(Base):
    __tablename__ = "newsletter_subscribers"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    source: Mapped[str | None] = mapped_column(String(60))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, default=lambda: secrets.token_urlsafe(24))
    unsubscribed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NewsletterSend(Base):
    """One row per newsletter mailing (an article sent to the subscriber list)."""

    __tablename__ = "newsletter_sends"

    id: Mapped[int] = mapped_column(primary_key=True)
    article_id: Mapped[int | None] = mapped_column(ForeignKey("news_articles.id", ondelete="SET NULL"), index=True)
    subject: Mapped[str] = mapped_column(String(300))
    recipients: Mapped[int] = mapped_column(Integer, default=0)
    delivered: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | sent | partial | failed | skipped
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WriterPitch(Base):
    __tablename__ = "writer_pitches"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    topic: Mapped[str] = mapped_column(String(250))
    pitch: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending")  # pending | approved | rejected
    review_note: Mapped[str | None] = mapped_column(Text)
    article_id: Mapped[int | None] = mapped_column(ForeignKey("news_articles.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EmailLog(Base):
    """One row per email the site tried to send (notification or visitor confirmation)."""

    __tablename__ = "email_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(40), index=True)  # contact | consultations | interests | ...
    submission_id: Mapped[int | None] = mapped_column(Integer)
    recipient: Mapped[str] = mapped_column(String(300))
    subject: Mapped[str] = mapped_column(String(300))
    purpose: Mapped[str] = mapped_column(String(20), default="notify")  # notify | confirm | test
    status: Mapped[str] = mapped_column(String(20), index=True)  # sent | failed | skipped
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class AdminUser(Base):
    """Staff account for the admin portal (password stored as PBKDF2 hash)."""

    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    name: Mapped[str] = mapped_column(String(120), default="Admin")
    password_hash: Mapped[str] = mapped_column(String(300))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------- analytics (ML-ready)
class Interaction(Base):
    """Append-only behavioural log.

    One row per user action (view, like, share, bookmark, click, apply...).
    `session_id` is an anonymous browser id so sequences can be modelled later
    (e.g. collaborative-filtering recommendations for news and opportunities).
    """

    __tablename__ = "interactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(40))  # news | opportunity | event | service | page
    entity_id: Mapped[str] = mapped_column(String(200))  # slug or path
    action: Mapped[str] = mapped_column(String(40))  # view | like | share | bookmark | click | apply | filter
    session_id: Mapped[str | None] = mapped_column(String(80), index=True)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    user_agent: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (Index("ix_interactions_entity", "entity_type", "entity_id", "action"),)
