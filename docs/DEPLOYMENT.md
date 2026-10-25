# Deployment

Two options. Both end with: nginx serving the React build and proxying `/api/` to FastAPI, PostgreSQL, HTTPS.

## A. Docker Compose (single server)

```bash
git clone <repo> afrimpact && cd afrimpact
cp .env.example .env                    # set POSTGRES_PASSWORD, WEB_PORT
cp backend/.env.example backend/.env    # set ENVIRONMENT=production, SECRET_KEY, ADMIN_*, SITE_URL, SMTP_*
docker compose up -d --build
docker compose logs -f backend          # first start: migrations + seed on empty DB + admin account
```
Put a TLS reverse proxy in front of `WEB_PORT` (host nginx + certbot below, Caddy, or a cloud load balancer).

Update: `git pull && docker compose up -d --build` (migrations run automatically).

## B. Bare VPS (Ubuntu 22.04/24.04)

```bash
# packages
sudo apt update && sudo apt install -y python3.11 python3.11-venv postgresql nginx certbot python3-certbot-nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs

# database
sudo -u postgres psql -c "CREATE USER afrimpact WITH PASSWORD 'STRONG_DB_PASSWORD';"
sudo -u postgres createdb -O afrimpact afrimpact

# code
sudo mkdir -p /srv/afrimpact && sudo chown $USER /srv/afrimpact
git clone <repo> /srv/afrimpact && cd /srv/afrimpact

# backend
cd backend
python3.11 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # ENVIRONMENT=production, DATABASE_URL, SECRET_KEY, ADMIN_*, SITE_URL=https://your-domain, SMTP_*
mkdir -p uploads
alembic upgrade head && python -m app.seed.seed --if-empty
deactivate

# frontend
cd ../frontend && npm ci && npm run build      # -> frontend/dist
```

### systemd — `/etc/systemd/system/afrimpact-api.service`
```ini
[Unit]
Description=Afrimpact API
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/srv/afrimpact/backend
EnvironmentFile=/srv/afrimpact/backend/.env
ExecStart=/srv/afrimpact/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 --proxy-headers
Restart=always

[Install]
WantedBy=multi-user.target
```
```bash
sudo chown -R www-data /srv/afrimpact/backend/uploads
sudo systemctl daemon-reload && sudo systemctl enable --now afrimpact-api
```

### nginx — `/etc/nginx/sites-available/afrimpact`
```nginx
server {
  server_name your-domain.com www.your-domain.com;
  root /srv/afrimpact/frontend/dist;
  index index.html;
  client_max_body_size 10m;

  location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
  location / { try_files $uri /index.html; }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/afrimpact /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### Update
```bash
cd /srv/afrimpact && git pull
cd backend && . .venv/bin/activate && pip install -r requirements.txt && alembic upgrade head && deactivate
cd ../frontend && npm ci && npm run build
sudo systemctl restart afrimpact-api
```

## Backups

```bash
# nightly (crontab -e)
0 2 * * * pg_dump -U afrimpact -Fc afrimpact > /var/backups/afrimpact-$(date +\%F).dump
0 2 * * * tar czf /var/backups/afrimpact-uploads-$(date +\%F).tgz -C /srv/afrimpact/backend uploads
```
Restore: `pg_restore -U afrimpact -d afrimpact --clean <file>.dump`. Docker: `docker compose exec db pg_dump -U afrimpact -Fc afrimpact > backup.dump`; uploads live in the `uploads` volume.

## Go-live checklist

- [ ] `ENVIRONMENT=production`, strong `SECRET_KEY`, strong admin password, DB password changed
- [ ] `SITE_URL=https://your-domain` (emails, share previews, unsubscribe links)
- [ ] HTTPS working; `/api/health` returns `{"status":"ok"}`
- [ ] SMTP set; Admin → Email forwarding → Send test email succeeds; SPF/DKIM set for the `EMAIL_FROM` domain
- [ ] Real photos, logo, client logos and testimonials in place
- [ ] Share preview checked (Telegram @WebpageBot, LinkedIn Post Inspector)
- [ ] Backups scheduled
