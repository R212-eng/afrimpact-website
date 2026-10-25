from datetime import date, datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

T = TypeVar("T")

Category = Literal["investment", "travel", "other"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


# ---------------------------------------------------------------- content out
class ServiceOut(ORM):
    id: int
    slug: str
    category: str
    title: str
    summary: str
    bullets: list[str]
    image: str | None
    order: int


class OpportunityCard(ORM):
    id: int
    slug: str
    title: str
    category: str
    type: str
    country: str
    location: str | None
    sector: str | None
    summary: str
    bullets: list[str]
    image: str | None
    investment_range: str | None
    deadline: date | None
    posted_at: date
    is_featured: bool


class OpportunityDetail(OpportunityCard):
    body: list[str]
    highlights: list[str]
    view_count: int
    related: list[OpportunityCard] = []


class NewsCard(ORM):
    id: int
    slug: str
    title: str
    category: str
    excerpt: str
    image: str | None
    author: str
    author_image: str | None
    read_minutes: int
    likes: int
    shares: int
    is_featured: bool
    published_at: datetime
    tags: list[str]


class NewsDetail(NewsCard):
    body: list[str]
    view_count: int
    related: list[NewsCard] = []


class EventCard(ORM):
    id: int
    slug: str
    title: str
    subtitle: str | None
    excerpt: str
    image: str | None
    location: str | None
    venue: str | None
    start_at: datetime
    end_at: datetime | None
    capacity: int | None
    is_featured: bool


class EventDetail(EventCard):
    body: list[str]
    registered: int = 0
    seats_left: int | None = None


class TestimonialOut(ORM):
    id: int
    quote: str
    author: str


class ClientOut(ORM):
    id: int
    name: str
    logo: str | None
    website: str | None


class HomeOut(BaseModel):
    site: dict
    home_cards: list[dict]
    ticker: list[EventCard]
    fresh_opportunities: list[OpportunityCard]
    testimonials: list[TestimonialOut]
    clients: list[ClientOut]
    latest_news: list[NewsCard]


class FilterOptions(BaseModel):
    countries: list[str]
    types: list[str]
    sectors: list[str]


# ---------------------------------------------------------------- forms in
class ContactIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    message: str = Field(min_length=5, max_length=5000)


class ConsultationIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    company: str | None = Field(default=None, max_length=200)
    service_interest: Category = "investment"
    topic: str | None = Field(default=None, max_length=200)
    preferred_date: date | None = None
    message: str = Field(default="", max_length=5000)
    source_page: str | None = Field(default=None, max_length=200)


class InterestIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    organization: str | None = Field(default=None, max_length=200)
    budget: str | None = Field(default=None, max_length=80)
    message: str = Field(default="", max_length=5000)


class ItineraryIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    travel_date: date | None = None
    travelers: int | None = Field(default=None, ge=1, le=500)
    budget: str | None = Field(default=None, max_length=80)
    message: str = Field(default="", max_length=5000)


class RegistrationIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    organization: str | None = Field(default=None, max_length=200)


class NewsletterIn(BaseModel):
    email: EmailStr
    source: str | None = Field(default=None, max_length=60)


class PitchIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    topic: str = Field(min_length=3, max_length=250)
    pitch: str = Field(min_length=10, max_length=5000)


class TrackIn(BaseModel):
    entity_type: str = Field(max_length=40)
    entity_id: str = Field(max_length=200)
    action: str = Field(max_length=40)
    session_id: str | None = Field(default=None, max_length=80)
    meta: dict = {}


class Ack(BaseModel):
    ok: bool = True
    message: str
    id: int | None = None


class CountOut(BaseModel):
    likes: int
    shares: int


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)


class ReviewIn(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


# ---------------------------------------------------------------- admin in
class NewsIn(BaseModel):
    title: str
    slug: str | None = None
    category: str = "Company News"
    excerpt: str = ""
    body: list[str] = []
    image: str | None = None
    author: str = "Afrimpact Team"
    author_image: str | None = None
    read_minutes: int = 3
    tags: list[str] = []
    is_featured: bool = False
    is_published: bool = True
    published_at: datetime | None = None
    notify_subscribers: bool = True  # email the newsletter list when this article is (first) published


class OpportunityIn(BaseModel):
    title: str
    slug: str | None = None
    category: Category = "investment"
    type: str = "Investment"
    country: str
    location: str | None = None
    sector: str | None = None
    summary: str = ""
    bullets: list[str] = []
    body: list[str] = []
    highlights: list[str] = []
    image: str | None = None
    investment_range: str | None = None
    deadline: date | None = None
    posted_at: date | None = None
    is_featured: bool = False
    is_published: bool = True


class EventIn(BaseModel):
    title: str
    slug: str | None = None
    subtitle: str | None = None
    excerpt: str = ""
    body: list[str] = []
    image: str | None = None
    location: str | None = None
    venue: str | None = None
    start_at: datetime
    end_at: datetime | None = None
    capacity: int | None = None
    is_featured: bool = False
    is_published: bool = True
