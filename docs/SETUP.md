# Setup — local development

## Stack

| Layer | Tech | Version |
|---|---|---|
| Frontend | React 18, React Router 6, Vite 5, plain CSS, self-hosted Sora font | Node 18+ (20 LTS recommended) |
| Backend | FastAPI, SQLAlchemy 2, Pydantic 2, Alembic, Uvicorn | Python 3.11+ |
| Database | PostgreSQL (JSONB used) | 14+ (16 recommended) |
| Email | Any SMTP server (stdlib `smtplib`) | — |
| Optional | Docker + Compose v2 | 24+ |

## 1. Install the toolchain

**Ubuntu / Debian**
```bash
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3-pip postgresql postgresql-contrib curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
```

**macOS (Homebrew)**
```bash
brew install python@3.11 node@20 postgresql@16
brew services start postgresql@16
```

**Windows**
```powershell
winget install Python.Python.3.11 OpenJS.NodeJS.LTS PostgreSQL.PostgreSQL.16
# or use WSL2 + the Ubuntu steps (recommended)
```

Check: `python3 --version`, `node -v`, `psql --version`.

## 2. Database

```bash
sudo -u postgres psql -c "CREATE USER afrimpact WITH PASSWORD 'afrimpact' CREATEDB;"
sudo -u postgres createdb -O afrimpact afrimpact
sudo -u postgres createdb -O afrimpact afrimpact_test      # used by pytest
```
(macOS/Windows: run the same SQL in `psql -U postgres`.)

## 3. Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                   # edit as needed, see docs/CONFIGURATION.md
alembic upgrade head                   # create tables
python -m app.seed.seed                # load site content (safe to re-run)
uvicorn app.main:app --reload --port 8000
```
- API docs: http://localhost:8000/api/docs
- First admin account is created on startup from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Tests: `pytest` (needs the `afrimpact_test` database; spins up a local SMTP server itself).

## 4. Frontend

```bash
cd frontend
npm install
npm run dev                            # http://localhost:5173, /api proxied to :8000
```
- Admin portal: http://localhost:5173/admin
- `npm run build` → production bundle in `frontend/dist/`
- `npm run build:demo` → single-file offline demo in `frontend/dist-demo/` (no backend; admin `admin@afrimpact.com` / `demo1234`)

## 5. Docker instead (all-in-one)

```bash
cp .env.example .env                   # DB credentials / port for compose
cp backend/.env.example backend/.env   # app settings
docker compose up -d --build
```
Website http://localhost:8080 · Admin http://localhost:8080/admin · API http://localhost:8000/api/docs

## Useful commands

| Task | Command (from `backend/`, venv active) |
|---|---|
| New migration after model change | `alembic revision --autogenerate -m "msg"` then `alembic upgrade head` |
| Roll back one migration | `alembic downgrade -1` |
| Add / reset admin account | `python -m app.create_admin you@x.com "password" --name "You"` |
| Re-apply seed text over existing items | `python -m app.seed.seed --update` |
| Wipe and reseed (destroys data) | `python -m app.seed.seed --reset` |

Shortcuts for most of these are in the root `Makefile` (`make help`).
