from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables or a .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Afrimpact Consultancy API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://afrimpact:afrimpact@localhost:5432/afrimpact"
    admin_api_key: str = ""               # optional machine key (X-Admin-Key header) for scripts; empty = disabled
    secret_key: str = "dev-secret-change-me"  # signs admin login tokens
    token_hours: int = 12
    admin_email: str = ""                 # first admin account is created from these on startup
    admin_password: str = ""
    upload_dir: str = "uploads"
    max_upload_mb: int = 8
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ---- email (SMTP). Leave SMTP_HOST empty to disable sending; submissions are still stored.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True      # STARTTLS (port 587)
    smtp_use_ssl: bool = False     # implicit TLS (port 465)
    smtp_timeout: int = 20
    email_from: str = ""           # e.g. "Afrimpact Website <no-reply@afrimpact.com>"
    notify_emails: str = ""        # default inbox(es) (comma separated) for every form
    # Optional per-form inboxes; empty = use NOTIFY_EMAILS
    notify_contact: str = ""
    notify_consultations: str = ""
    notify_interests: str = ""
    notify_itineraries: str = ""
    notify_registrations: str = ""
    notify_pitches: str = ""
    notify_newsletter: str = ""
    send_confirmation: bool = True # also send a short "we received your message" email to the visitor
    site_url: str = "http://localhost:5173"
    site_contact_email: str = "info@afrimpact.com"  # shown to visitors if the contact form can't send

    @property
    def notify_list(self) -> list[str]:
        return [e.strip() for e in self.notify_emails.split(",") if e.strip()]

    def recipients_for(self, kind: str) -> list[str]:
        specific = getattr(self, f"notify_{kind}", "") or ""
        lst = [e.strip() for e in specific.split(",") if e.strip()]
        return lst or self.notify_list

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


INSECURE_SECRETS = {"", "dev-secret-change-me", "change-me", "change-me-to-a-long-random-string"}


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.environment == "production" and s.secret_key in INSECURE_SECRETS:
        raise RuntimeError("Set SECRET_KEY to a long random value before running with ENVIRONMENT=production")
    return s
