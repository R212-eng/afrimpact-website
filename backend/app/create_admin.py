"""Create or reset an admin portal account.

    python -m app.create_admin admin@afrimpact.com "a-strong-password" --name "Dagm"
"""
import argparse

from sqlalchemy import select

from . import models
from .auth import hash_password
from .database import SessionLocal

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("email")
    ap.add_argument("password")
    ap.add_argument("--name", default="Admin")
    a = ap.parse_args()
    with SessionLocal() as db:
        user = db.scalar(select(models.AdminUser).where(models.AdminUser.email == a.email.lower()))
        if user is None:
            user = models.AdminUser(email=a.email.lower())
            db.add(user)
        user.name, user.password_hash, user.is_active = a.name, hash_password(a.password), True
        db.commit()
    print(f"Admin account ready: {a.email}")
