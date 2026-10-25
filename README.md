# Afrimpact Consultancy — Website + Admin Portal

React (Vite) frontend · FastAPI (Python) backend · PostgreSQL database.
Built from the Figma file *Afrimpact Consultancy Website Design*. Web font: Sora (self-hosted).

```
afrimpact/
├── backend/                 FastAPI + SQLAlchemy 2 + Alembic
│   ├── app/
│   │   ├── main.py          app, CORS, routers, /api/uploads static files
│   │   ├── models.py        content, submissions, newsletter, admin users, email log, ML interactions
│   │   ├── notifications.py SMTP forwarding, visitor confirmations, newsletter mailings
│   │   ├── auth.py          admin login (PBKDF2 passwords + signed tokens)
│   │   ├── create_admin.py  CLI: create/reset admin accounts
│   │   ├── routers/         content, opportunities, news, events, forms, admin (CMS)
│   │   └── seed/            seed_data.json (all site copy) + seed.py
│   ├── alembic/             migrations 0001–0003
│   ├── .env.example         all backend settings
│   └── tests/               pytest (Postgres + a real local SMTP server)
├── frontend/                React 18 + React Router 6, plain CSS
│   ├── src/pages/           Home, Opportunities, Services, NewsEvents, Contact, detail pages, 404
│   ├── src/admin/           Admin portal / CMS (dashboard, submissions, content editor, email)
│   ├── src/components/      header, footer, cards, filters + calendar, forms, icons, logo
│   ├── src/api/             http client + in-browser mock (static demo)
│   └── public/images/       photos (placeholders — replace with your own)
├── docs/                    SETUP, CONFIGURATION, DEPLOYMENT guides
├── Makefile                 common tasks (make help)
├── .env.example             docker compose variables
└── docker-compose.yml       db + backend + frontend (nginx)
```

## Docs

| Guide | Contents |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | Toolchain install (Linux/macOS/Windows), database, backend, frontend, Docker, common commands |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Every environment variable, SMTP presets, per-form inboxes, content/branding locations, share previews |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker Compose or bare VPS (systemd + nginx + certbot), updates, backups, go-live checklist |

## Quick start

```bash
# Docker
cp .env.example .env && cp backend/.env.example backend/.env
docker compose up -d --build          # site :8080, admin :8080/admin, API docs :8000/api/docs

# or local dev (Python 3.11, Node 20, PostgreSQL 16 installed — see docs/SETUP.md)
make install && cp backend/.env.example backend/.env
make db-migrate seed
make api            # terminal 1 → http://localhost:8000/api/docs
make web            # terminal 2 → http://localhost:5173 (admin: /admin)
make test
```

## Website features

| Page | What it does |
|---|---|
| Home | Figma layout: event ticker, hero + **Fresh Opportunities carousel** (newest first, post dates, 2 tiles per slide, swipe/arrows/dots), intro with typewriter, Explore Africa cards, About + Vision/Mission/Values, Clients & Testimonials, consultation CTA, Latest News carousel |
| Opportunities | Country / Type / Post-date filters (calendar with **clickable month & year pickers**) + search, synced to the URL; **Investment / Travel / Advisory tag** on every card |
| Opportunity detail | Overview, highlights, "At a glance" facts with deadline countdown. Investment → **Express interest**; travel → **Plan this trip** (itinerary request with date and travellers) |
| Services | Every card opens the consultation pop-up with its **topic pre-selected** (e.g. Market Entry Strategies, Tailored Itineraries) |
| News & Events | Featured story, Recent Stories (tabs, search, load more), **like / unlike**, **share menu** (Telegram, WhatsApp, LinkedIn, X, Copy link — shared text ends with "Source: Afrimpact Consultancy"), bookmark, Events, newsletter sign-up, Write for Us pitches |
| Contact | Validated form, emailed straight to the team (see below) |

## Forms: storage and email

| Form | Saved in database | Emailed to |
|---|---|---|
| Contact | **No** — email only | `NOTIFY_CONTACT` or `NOTIFY_EMAILS` |
| Consultation pop-ups (with topic) | `consultation_requests` | `NOTIFY_CONSULTATIONS` |
| Investment "Express interest" | `opportunity_interests` | `NOTIFY_INTERESTS` |
| Travel "Plan this trip" | `itinerary_requests` | `NOTIFY_ITINERARIES` |
| Event registration | `event_registrations` | `NOTIFY_REGISTRATIONS` |
| Write for Us pitch | `writer_pitches` | `NOTIFY_PITCHES` |
| Newsletter sign-up | `newsletter_subscribers` | `NOTIFY_NEWSLETTER` |

Empty `NOTIFY_<FORM>` values fall back to `NOTIFY_EMAILS`. Team emails set Reply-To to the visitor. With `SEND_CONFIRMATION=true` the visitor also gets a short "we received your message" email. Because Contact is not stored, the visitor sees an error with your email address if SMTP is missing or down, so no message is lost silently.

```env
SMTP_HOST=smtp.gmail.com        # or Zoho / Office365 / cPanel mail
SMTP_PORT=587                   # 465 -> SMTP_USE_SSL=true, SMTP_USE_TLS=false
SMTP_USERNAME=you@yourdomain.com
SMTP_PASSWORD=app-password
EMAIL_FROM=Afrimpact Website <no-reply@afrimpact.com>
NOTIFY_EMAILS=info@afrimpact.com
NOTIFY_ITINERARIES=travel@afrimpact.com
SITE_URL=https://afrimpact.com  # used for links in emails
```
Then open **Admin → Email forwarding → Send test email**. Every attempt is logged in `email_logs`.

## Sharing

Share buttons on news, opportunities and events open Telegram, WhatsApp, LinkedIn, X or Copy link. The shared message ends with **Source: Afrimpact Consultancy**, and the link points to `/api/share/{news|opportunities|events}/{slug}`, a small page with Open Graph tags (title, summary, image, site name "Afrimpact Consultancy") so the preview card in each app shows the source too, then forwards people to the real page. Set `SITE_URL` to your domain so previews and redirects use it.

Preview crawlers (TelegramBot, WhatsApp, LinkedInBot, Twitterbot, facebookexternalhit…) receive the tags with no redirect; people get an instant 302 to the page. Uploaded images are resized to max 1600px so WhatsApp and LinkedIn previews always load.

**Sharing checklist when you go live**
1. Serve the site over **HTTPS** (Copy link and most previews need it).
2. Set `SITE_URL=https://your-domain` in the backend environment and restart.
3. Keep nginx proxying `/api/` to the backend (already in `frontend/nginx.conf`).
4. Test a link with Telegram's @WebpageBot, the LinkedIn Post Inspector and the Facebook Sharing Debugger (also refreshes cached previews after you change an image).

## Newsletter

Visitors subscribe from News & Events or any article. When an article is **published** from the admin portal (new, or a draft switched to published), every active subscriber is emailed the headline, summary, cover image and a link, each with a personal **unsubscribe** link (`/api/newsletter/unsubscribe?token=…`). An article is only mailed once; use **Send again** in the editor to resend. Mailings are recorded in `newsletter_sends`.

## Admin portal (`/admin`)

- **Sign-in** with staff accounts (`admin_users`, PBKDF2-hashed passwords, 12-hour signed tokens). The first account comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD`; add more with `python -m app.create_admin`.
- **Dashboard**: new-submission counts, content totals, most-read stories and most-viewed opportunities.
- **Submissions by type**: Consultations (grouped by service area / topic), Investment interest (by opportunity), Itinerary requests (by destination), Event registrations (**grouped per event** with seat usage), Writer pitches, Newsletter subscribers. Search, status workflow (new → in progress → done → archived), detail drawer, CSV export.
- **Writer pitches**: Approve creates a **draft news article** (title, body, author prefilled) and emails the writer; Reject emails a polite note. Publish the draft from News when it's ready (this also emails subscribers).
- **Content**: create / edit / delete News, Opportunities and Events with every field the site uses — image upload (drag & drop, JPG/PNG/WebP up to 8 MB, stored in `backend/uploads`, served at `/api/uploads`), list editors for bullets and highlights, paragraph editor with preview, publish / draft, featured, dates.
- **Email forwarding**: SMTP status, which inbox each form goes to, test email, newsletter mailings, recent email log.

## API overview

Public: `GET /api/home` · `/api/site` · `/api/services` · `/api/opportunities` (+ `/filters`, `/{slug}`) · `POST /api/opportunities/{slug}/interest|itinerary` · `GET /api/news` (+ `/featured`, `/categories`, `/{slug}`) · `POST /api/news/{slug}/like|unlike|share` · `GET /api/events` (+ `/{slug}`) · `POST /api/events/{slug}/register` · `POST /api/contact|consultations|newsletter|write-for-us|track` · `GET /api/newsletter/unsubscribe`

Admin (`Authorization: Bearer <token>` from `POST /api/admin/login`): `/api/admin/stats`, `/submissions/{kind}` (+ `export.csv`), `/registrations/by-event`, `/pitches/{id}/approve|reject`, `/newsletter/{id}`, `/content/{news|opportunities|events}`, `/news/{id}/send-newsletter`, `/upload`, `/email`, `/email/test`.

## Ready for machine learning

- `interactions` logs every view / like / unlike / share / bookmark / filter / apply / itinerary request with an anonymous `session_id` and JSONB `meta` — raw material for recommendations, lead scoring and demand forecasting.
- `view_count` on news and opportunities, statuses on every lead table, JSONB tags/sectors for features. Add `pgvector` later for semantic search.

## Before going live

- Replace placeholder photos in `frontend/public/images/` and client logos in `images/clients/` (upload new ones from the admin portal). Travel photos are stand-ins, not the real locations.
- Testimonials still carry the template text from the design — replace with real client quotes.
- Set strong `ADMIN_PASSWORD` and `SECRET_KEY`, configure SMTP, and set `SITE_URL` to the real domain.
- Serve over HTTPS; for large newsletter lists consider a transactional email provider (SendGrid, Mailgun, Amazon SES) as the SMTP host.
