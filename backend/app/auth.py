"""Admin authentication: PBKDF2 password hashes + HMAC-signed bearer tokens (stdlib only)."""
import base64
import hashlib
import hmac
import json
import secrets
import time

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .config import get_settings
from .database import get_db

ITERATIONS = 260_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS).hex()
    return f"pbkdf2_sha256${ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iters, salt, digest = stored.split("$")
    except ValueError:
        return False
    test = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iters)).hex()
    return hmac.compare_digest(test, digest)


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def make_token(user_id: int) -> str:
    s = get_settings()
    payload = _b64(json.dumps({"uid": user_id, "exp": int(time.time()) + s.token_hours * 3600}).encode())
    sig = _b64(hmac.new(s.secret_key.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def read_token(token: str) -> int | None:
    s = get_settings()
    try:
        payload, sig = token.split(".")
        good = _b64(hmac.new(s.secret_key.encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, good):
            return None
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return data["uid"] if data["exp"] > time.time() else None
    except Exception:
        return None


def require_admin(
    authorization: str | None = Header(default=None),
    x_admin_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Accept a staff bearer token (portal) or the machine X-Admin-Key (scripts/tests)."""
    s = get_settings()
    if x_admin_key and s.admin_api_key and hmac.compare_digest(x_admin_key, s.admin_api_key):
        return None
    if authorization and authorization.lower().startswith("bearer "):
        uid = read_token(authorization[7:])
        if uid:
            user = db.get(models.AdminUser, uid)
            if user and user.is_active:
                return user
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in again")


def ensure_bootstrap_admin(db: Session) -> None:
    s = get_settings()
    if s.admin_email and s.admin_password and not db.scalar(select(models.AdminUser.id).limit(1)):
        db.add(models.AdminUser(email=s.admin_email.lower(), name="Administrator",
                                password_hash=hash_password(s.admin_password)))
        db.commit()
