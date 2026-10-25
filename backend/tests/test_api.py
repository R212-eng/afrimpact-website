"""API tests. Run against a throwaway PostgreSQL database:

    TEST_DATABASE_URL=postgresql+psycopg://afrimpact:afrimpact@localhost:5432/afrimpact_test pytest
"""
import os
import tempfile

import pytest

os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://afrimpact:afrimpact@localhost:5432/afrimpact_test"
)
os.environ["ADMIN_API_KEY"] = "test-key"
os.environ["ADMIN_EMAIL"] = "admin@afrimpact.test"
os.environ["ADMIN_PASSWORD"] = "s3cret-pass"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp()
for k in ("SMTP_HOST", "NOTIFY_EMAILS"):
    os.environ.pop(k, None)

from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402

get_settings.cache_clear()
get_settings().smtp_host = ""  # never pick up a developer's .env SMTP settings in tests

from app.main import app  # noqa: E402
from app.seed.seed import run as seed  # noqa: E402

H = {"X-Admin-Key": "test-key"}


@pytest.fixture(scope="module")
def client():
    seed(reset=True)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def smtp_server():
    """Real local SMTP server (aiosmtpd) that captures delivered messages."""
    from aiosmtpd.controller import Controller

    class Sink:
        def __init__(self):
            self.messages = []

        async def handle_DATA(self, server, session, envelope):
            self.messages.append(envelope)
            return "250 OK"

    sink = Sink()
    ctrl = Controller(sink, hostname="127.0.0.1", port=8025)
    ctrl.start()
    s = get_settings()
    old = (s.smtp_host, s.smtp_port, s.smtp_use_tls, s.notify_emails, s.notify_itineraries, s.send_confirmation)
    s.smtp_host, s.smtp_port, s.smtp_use_tls = "127.0.0.1", 8025, False
    s.notify_emails, s.notify_itineraries, s.send_confirmation = "team@afrimpact.test", "travel@afrimpact.test", True
    yield sink
    (s.smtp_host, s.smtp_port, s.smtp_use_tls, s.notify_emails, s.notify_itineraries, s.send_confirmation) = old
    ctrl.stop()


def bodies(sink, to):
    return [e.content.decode() for e in sink.messages if e.rcpt_tos == [to]]


# ---------------------------------------------------------------- public API
def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_home(client):
    data = client.get("/api/home").json()
    assert data["site"]["name"] == "Afrimpact Consultancy"
    fresh = data["fresh_opportunities"]
    assert len(fresh) == 8
    assert [o["posted_at"] for o in fresh] == sorted((o["posted_at"] for o in fresh), reverse=True)


def test_opportunity_filters_and_detail(client):
    res = client.get("/api/opportunities", params={"category": "travel", "country": "Ethiopia"}).json()
    assert res["total"] >= 4 and all(o["category"] == "travel" for o in res["items"])
    assert client.get("/api/opportunities", params={"q": "solar"}).json()["total"] == 1
    res = client.get("/api/opportunities", params={"posted_from": "2026-09-15"}).json()
    assert all(o["posted_at"] >= "2026-09-15" for o in res["items"])
    assert "Ethiopia" in client.get("/api/opportunities/filters").json()["countries"]
    detail = client.get("/api/opportunities/entoto-addis-ababa").json()
    assert detail["body"] and detail["related"]
    assert client.get("/api/opportunities/nope").status_code == 404


def test_like_unlike_share(client):
    art = client.get("/api/news/featured").json()
    liked = client.post(f"/api/news/{art['slug']}/like").json()["likes"]
    assert liked == art["likes"] + 1
    assert client.post(f"/api/news/{art['slug']}/unlike").json()["likes"] == art["likes"]
    assert client.post(f"/api/news/{art['slug']}/share").json()["shares"] == art["shares"] + 1


BOTS = ["TelegramBot (like TwitterBot)", "WhatsApp/2.23.20.0", "LinkedInBot/1.0 (compatible; Mozilla/5.0)",
        "Twitterbot/1.0", "facebookexternalhit/1.1"]


@pytest.mark.parametrize("ua", BOTS)
def test_share_page_gives_crawlers_open_graph(client, ua):
    r = client.get("/api/share/news/afrimpact-consultancy-launched-officially", headers={"User-Agent": ua})
    assert r.status_code == 200
    assert 'og:site_name" content="Afrimpact Consultancy"' in r.text
    assert 'og:image" content="http' in r.text and 'twitter:card" content="summary_large_image"' in r.text
    assert "refresh" not in r.text  # crawlers must not be redirected away from the tags


def test_share_page_redirects_people(client):
    r = client.get("/api/share/opportunities/wonchi-oromia", headers={"User-Agent": "Mozilla/5.0 (iPhone)"},
                   follow_redirects=False)
    assert r.status_code == 302 and r.headers["location"].endswith("/opportunities/wonchi-oromia")
    assert client.get("/api/share/news/nope").status_code == 404


def test_forms_are_stored(client):
    assert client.post("/api/consultations", json={"full_name": "Ab Cd", "email": "a@b.co", "service_interest": "travel",
                                                   "topic": "Tailored Itineraries"}).status_code == 201
    assert client.post("/api/opportunities/agro-processing-hub-oromia/interest",
                       json={"full_name": "Test Investor", "email": "t@example.com"}).status_code == 201
    assert client.post("/api/opportunities/wonchi-oromia/itinerary",
                       json={"full_name": "Trip Planner", "email": "trip@example.com", "travelers": 3,
                             "travel_date": "2026-12-20"}).status_code == 201
    assert client.post("/api/newsletter", json={"email": "A@b.co"}).status_code == 201
    assert "already" in client.post("/api/newsletter", json={"email": "a@b.co"}).json()["message"]
    assert client.post("/api/write-for-us", json={"full_name": "Writer One", "email": "w@b.co", "topic": "Coffee routes",
                                                  "pitch": "A long enough pitch about coffee."}).status_code == 201
    assert client.post("/api/opportunities/agro-processing-hub-oromia/interest",
                       json={"full_name": "x", "email": "bad"}).status_code == 422
    c = client.get("/api/admin/submissions/consultations", headers=H).json()[0]
    assert c["topic"] == "Tailored Itineraries"
    it = client.get("/api/admin/submissions/itineraries", headers=H).json()[0]
    assert it["travelers"] == 3 and "Wonchi" in it["destination"]


def test_contact_without_smtp_is_not_lost_silently(client):
    r = client.post("/api/contact", json={"first_name": "No", "last_name": "Smtp", "email": "n@example.com",
                                          "message": "Hello there"})
    assert r.status_code == 503 and "info@afrimpact.com" in r.json()["detail"]


def test_unsubscribe(client):
    client.post("/api/newsletter", json={"email": "leaver@example.com"})
    from app import models
    from app.database import SessionLocal
    with SessionLocal() as db:
        token = db.query(models.NewsletterSubscriber).filter_by(email="leaver@example.com").one().token
    assert "unsubscribed" in client.get("/api/newsletter/unsubscribe", params={"token": token}).text
    assert "Welcome back" in client.post("/api/newsletter", json={"email": "leaver@example.com"}).json()["message"]


# ---------------------------------------------------------------- admin portal
def test_login_and_token(client):
    assert client.get("/api/admin/stats").status_code == 401
    assert client.post("/api/admin/login", json={"email": "admin@afrimpact.test", "password": "nope"}).status_code == 401
    tok = client.post("/api/admin/login", json={"email": "admin@afrimpact.test", "password": "s3cret-pass"}).json()["token"]
    me = client.get("/api/admin/me", headers={"Authorization": f"Bearer {tok}"}).json()
    assert me["email"] == "admin@afrimpact.test"
    assert client.get("/api/admin/me", headers={"Authorization": "Bearer forged.token"}).status_code == 401


def test_content_crud_and_upload(client):
    import io as _io
    from PIL import Image
    big = _io.BytesIO()
    Image.new("RGB", (4000, 2500), (228, 90, 89)).save(big, "JPEG")
    up = client.post("/api/admin/upload", headers=H, files={"file": ("big.jpg", big.getvalue(), "image/jpeg")}).json()
    saved = Image.open(_io.BytesIO(client.get("/" + up["url"]).content))
    assert max(saved.size) == 1600  # resized for fast pages and social previews
    assert up["url"].startswith("api/uploads/")
    assert client.get("/" + up["url"]).status_code == 200
    assert client.post("/api/admin/upload", headers=H, files={"file": ("x.txt", b"hi", "text/plain")}).status_code == 415
    opp = client.post("/api/admin/content/opportunities", headers=H, json={
        "title": "Test Opportunity", "category": "investment", "country": "Kenya", "image": up["url"],
        "bullets": ["one"], "body": ["para"], "highlights": ["h"]}).json()
    assert client.get(f"/api/opportunities/{opp['slug']}").json()["image"] == up["url"]
    created = client.post("/api/admin/content/news", headers=H,
                          json={"title": "Brand New Story", "excerpt": "x", "body": ["p1"], "is_published": False}).json()
    assert created["slug"] == "brand-new-story" and created["newsletter_queued"] is False
    assert client.get("/api/news/brand-new-story").status_code == 404  # draft
    assert client.delete(f"/api/admin/content/news/{created['id']}", headers=H).status_code == 204


def test_registrations_grouped_by_event(client):
    ev = client.get("/api/events").json()[0]
    client.post(f"/api/events/{ev['slug']}/register", json={"full_name": "Guest One", "email": "g1@example.com"})
    groups = client.get("/api/admin/registrations/by-event", headers=H).json()
    g = next(x for x in groups if x["id"] == ev["id"])
    assert g["registrations"] >= 1
    rows = client.get("/api/admin/submissions/registrations", params={"event_id": ev["id"]}, headers=H).json()
    assert rows and all(r["event_id"] == ev["id"] for r in rows)
    assert "full_name" in client.get("/api/admin/submissions/registrations/export.csv", headers=H).text


def test_pitch_approval_creates_draft_news(client):
    pitch = next(p for p in client.get("/api/admin/submissions/pitches", headers=H).json() if p["status"] == "pending")
    res = client.post(f"/api/admin/pitches/{pitch['id']}/approve", headers=H, json={"note": "Great idea"}).json()
    art = client.get(f"/api/admin/content/news/{res['article_id']}", headers=H).json()
    assert art["title"] == pitch["topic"] and art["is_published"] is False and art["author"] == pitch["full_name"]


# ---------------------------------------------------------------- email
def test_each_form_goes_to_its_inbox(client, smtp_server):
    r = client.post("/api/consultations", json={"full_name": "Abebe Kebede", "email": "abebe@example.com",
                                                "service_interest": "investment", "topic": "Market Entry Strategies"})
    assert r.status_code == 201
    team = bodies(smtp_server, "team@afrimpact.test")
    assert any("Market Entry Strategies" in b and "Reply-To: abebe@example.com" in b for b in team)
    assert bodies(smtp_server, "abebe@example.com")  # visitor confirmation
    client.post("/api/opportunities/jegol-harar/itinerary", json={"full_name": "Hana T", "email": "hana@example.com"})
    assert any("New itinerary request" in b for b in bodies(smtp_server, "travel@afrimpact.test"))
    ok = client.post("/api/contact", json={"first_name": "A", "last_name": "B", "email": "c1@example.com",
                                           "message": "Hello there"})
    assert ok.status_code == 201
    assert any("New contact message" in b for b in bodies(smtp_server, "team@afrimpact.test"))
    assert client.post("/api/admin/email/test", headers=H).status_code == 200
    routes = {r["kind"]: r for r in client.get("/api/admin/email", headers=H).json()["routes"]}
    assert routes["itineraries"]["recipients"] == ["travel@afrimpact.test"]


def test_publishing_news_emails_subscribers(client, smtp_server):
    client.post("/api/newsletter", json={"email": "reader@example.com"})
    art = client.post("/api/admin/content/news", headers=H, json={
        "title": "Newsletter Story", "excerpt": "Fresh news for readers", "body": ["p"], "is_published": True}).json()
    assert art["newsletter_queued"] is True
    mails = bodies(smtp_server, "reader@example.com")
    assert any("Newsletter Story" in m and "unsubscribe?token=" in m for m in mails)
    # editing again does not re-send
    client.put(f"/api/admin/content/news/{art['id']}", headers=H,
               json={"title": "Newsletter Story", "excerpt": "edited", "body": ["p"], "is_published": True})
    assert len(bodies(smtp_server, "reader@example.com")) == len(mails)
