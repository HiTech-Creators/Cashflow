#!/usr/bin/env python3
"""
Create (or update) an admin user.

Default behavior (per project request):
- username: novaadmin
- password: NewPassword123!
- email: novaadmin@flowback.local
- role: SuperAdmin (level=1)

This script is idempotent:
- If the user exists, it updates password + role.
- If the role doesn't exist, it creates it.

Usage:
  python flowback/scripts/create_admin.py

Optional overrides:
  NOVAADMIN_USERNAME, NOVAADMIN_PASSWORD, NOVAADMIN_EMAIL, MONGO_URI
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from mongoengine import connect
from werkzeug.security import generate_password_hash


def _ensure_sys_path() -> None:
    """Allow `import src.*` regardless of current working directory."""
    here = Path(__file__).resolve()
    flowback_root = here.parents[1]  # .../flowback
    if str(flowback_root) not in sys.path:
        sys.path.insert(0, str(flowback_root))


def main() -> int:
    _ensure_sys_path()

    # Local imports (after sys.path fix)
    from src.models import Role, User  # noqa: WPS433 (runtime import is intentional)

    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/cashflow_db")
    username = os.environ.get("NOVAADMIN_USERNAME", "novaadmin").strip()
    password = os.environ.get("NOVAADMIN_PASSWORD", "NewPassword123!")
    email = os.environ.get("NOVAADMIN_EMAIL", "novaadmin@flowback.local").strip()

    if not username:
        print("ERROR: NOVAADMIN_USERNAME is empty")
        return 2
    if not email:
        print("ERROR: NOVAADMIN_EMAIL is empty")
        return 2
    if not password:
        print("ERROR: NOVAADMIN_PASSWORD is empty")
        return 2

    # Connect to MongoDB using the same URI as the app.
    connect(host=mongo_uri, alias="default")

    role = Role.objects(name="SuperAdmin", level=1).first()
    if not role:
        role = Role(
            name="SuperAdmin",
            level=1,
            permissions=["manage_companies", "manage_users", "view_all_data", "system_admin"],
        ).save()

    password_hash = generate_password_hash(password)

    user = User.objects(username=username).first() or User.objects(email=email).first()
    if user:
        user.username = username
        user.email = email
        user.password_hash = password_hash
        user.role_id = role
        user.is_active = True
        # Make sure the field exists for older documents
        if user.company_memberships is None:
            user.company_memberships = []
        user.save()
        print(f"Updated admin user: id={user.id} username={user.username} email={user.email} role={role.name}")
        return 0

    user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        role_id=role,
        is_active=True,
        company_memberships=[],
    ).save()

    print(f"Created admin user: id={user.id} username={user.username} email={user.email} role={role.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


