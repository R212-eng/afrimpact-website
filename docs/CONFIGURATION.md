# Configuration reference

All backend settings are environment variables (or `backend/.env`, loaded by pydantic-settings). Names are case-insensitive. Restart the API after changes.

## Backend — core

| Variable | Default | Notes |
|---|---|---|
| `ENVIRONMENT` | `development` | `production` refuses to start with a default `SECRET_KEY` |
| `DATABASE_URL` | `postgresql+psycopg://afrimpact:afrimpact@localhost:5432/afrimpact` | psycopg 3 driver |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Only needed when frontend and API are on different origins |
| `SITE_URL` | `http://localhost:5173` | Public site URL — used in emails, unsubscribe links, share previews and redirects. **Must be the real https domain in production.** |

## Backend — admin portal

| Variable | Default | Notes |
|---|---|---|
| `SECRET_KEY` | `dev-secret-change-me` | Signs login tokens. `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `TOKEN_HOURS` | `12` | Login session length |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | empty | Creates the first admin on startup **only if no admin exists**. Change the password afterwards with `python -m app.create_admin` |
| `ADMIN_API_KEY` | empty (disabled) | Optional key for scripts via `X-Admin-Key` header |
| `UPLOAD_DIR` | `uploads` | Where admin image uploads are stored; served at `/api/uploads/*`. Persist/back it up |
| `MAX_UPLOAD_MB` | `8` | Upload limit (images are resized to max 1600px on save). Keep nginx `client_max_body_size` ≥ this |

Staff accounts: `python -m app.create_admin email "password" --name "Name"` (creates or resets). Deactivate by setting `admin_users.is_active = false`.

## Backend — email (SMTP)

| Variable | Default | Notes |
|---|---|---|
| `SMTP_HOST` | empty | Empty = email disabled (forms still stored; Contact returns an error to the visitor) |
| `SMTP_PORT` | `587` | |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | empty | Leave empty for unauthenticated relays |
| `SMTP_USE_TLS` | `true` | STARTTLS (port 587) |
| `SMTP_USE_SSL` | `false` | Implicit TLS (port 465) — then set `SMTP_USE_TLS=false` |
| `SMTP_TIMEOUT` | `20` | Seconds |
| `EMAIL_FROM` | `Afrimpact Website <SMTP_USERNAME>` | Quote it in `.env` if it has spaces. Must be allowed by your provider (SPF/DKIM) |
| `NOTIFY_EMAILS` | empty | Default inbox(es), comma separated |
| `NOTIFY_CONTACT`, `NOTIFY_CONSULTATIONS`, `NOTIFY_INTERESTS`, `NOTIFY_ITINERARIES`, `NOTIFY_REGISTRATIONS`, `NOTIFY_PITCHES`, `NOTIFY_NEWSLETTER` | empty | Per-form inbox; empty falls back to `NOTIFY_EMAILS` |
| `SEND_CONFIRMATION` | `true` | Visitor receives a short acknowledgement |
| `SITE_CONTACT_EMAIL` | `info@afrimpact.com` | Shown to visitors if the Contact form cannot send |

Form behaviour: Contact is **email-only** (sent synchronously, not stored). All other forms are stored first, then emailed in a background task. Every attempt is logged in `email_logs` (Admin → Email forwarding).

### SMTP presets

| Provider | Host | Port / flags | Notes |
|---|---|---|---|
| Google Workspace / Gmail | `smtp.gmail.com` | 587, TLS | Needs 2FA + App Password |
| Microsoft 365 | `smtp.office365.com` | 587, TLS | SMTP AUTH must be enabled for the mailbox |
| Zoho Mail | `smtp.zoho.com` | 465, SSL | |
| cPanel / hosting mail | `mail.yourdomain.com` | 465 SSL or 587 TLS | |
| SendGrid | `smtp.sendgrid.net` | 587, TLS | user `apikey`, password = API key |
| Mailgun | `smtp.mailgun.org` | 587, TLS | Recommended for large newsletter lists |
| Amazon SES | `email-smtp.<region>.amazonaws.com` | 587, TLS | SMTP credentials from SES console |

Verify: Admin → Email forwarding → **Send test email**.

## Frontend (`frontend/.env`, build-time)

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `/api` | Keep `/api` when nginx serves the site and proxies the API (recommended). Use a full URL only if the API is on another domain (then add that origin to `CORS_ORIGINS`) |
| `VITE_DEMO_MODE` | `false` | `true` = offline demo with in-browser data (used by `npm run build:demo`) |

## Docker Compose (`.env` in project root)

| Variable | Default |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `afrimpact` / `afrimpact` / `afrimpact` |
| `WEB_PORT` | `8080` |

App settings for the container come from `backend/.env` (`env_file`); `DATABASE_URL` and `UPLOAD_DIR` are overridden by compose.

## Content & branding

| What | Where |
|---|---|
| News, opportunities, events, images | Admin portal (`/admin`) |
| Site copy (intro, about, vision/mission/values, contact details, socials) | `backend/app/seed/seed_data.json` → `site`; apply with `python -m app.seed.seed --update` and rebuild the frontend (footer/contact read it at build time) |
| Services list and consultation topics | `seed_data.json` → `services`, `service_categories` |
| Testimonials / client logos | `seed_data.json` → `testimonials`, `clients`; logo files in `frontend/public/images/clients/` |
| Static photos | `frontend/public/images/` (same file names = no code change) |
| Colours / fonts | `frontend/src/styles/base.css` (`:root` tokens) |
| Logo | `frontend/src/components/Logo.jsx` (vector recreation — swap for the official SVG) |

## Sharing previews

Share links point to `/api/share/{news|opportunities|events}/{slug}`. Link-preview bots receive Open Graph/Twitter tags; people get a 302 to the page. Requirements: HTTPS, correct `SITE_URL`, nginx proxying `/api/`. Debug with Telegram @WebpageBot, LinkedIn Post Inspector, Facebook Sharing Debugger.
