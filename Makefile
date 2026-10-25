# Common tasks. Run `make help`.
BACKEND=cd backend && . .venv/bin/activate &&

.PHONY: help install db-migrate seed api web test build demo up down admin

help:
	@echo "install     venv + pip install, npm install"
	@echo "db-migrate  alembic upgrade head"
	@echo "seed        add missing sample content"
	@echo "api         run FastAPI on :8000 (reload)"
	@echo "web         run Vite dev server on :5173"
	@echo "test        backend tests"
	@echo "build       production frontend build"
	@echo "demo        offline single-file demo build"
	@echo "up / down   docker compose up -d --build / down"
	@echo "admin       make admin EMAIL=x@y.com PASSWORD=secret"

install:
	cd backend && python3.11 -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt
	cd frontend && npm install

db-migrate:
	$(BACKEND) alembic upgrade head

seed:
	$(BACKEND) python -m app.seed.seed

api:
	$(BACKEND) uvicorn app.main:app --reload --port 8000

web:
	cd frontend && npm run dev

test:
	$(BACKEND) pytest -q

build:
	cd frontend && npm run build

demo:
	cd frontend && npm run build:demo

up:
	docker compose up -d --build

down:
	docker compose down

admin:
	$(BACKEND) python -m app.create_admin $(EMAIL) "$(PASSWORD)"
