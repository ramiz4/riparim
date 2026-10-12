#!/usr/bin/env python3
"""Create an encrypted auth-schema snapshot. Never emit database output."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

PROJECT = "opbnfdwmunyfzqplcfjw"
ROOT = Path(__file__).resolve().parent
MAX_BYTES = 16 * 1024 * 1024


def run(command, **kwargs):
    result = subprocess.run(command, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        # pg_dump errors can contain data, connection details, or SQL.
        raise RuntimeError(f"{Path(command[0]).name} failed; no complete backup published")
    return result.stdout


def backup(destination):
    os.umask(0o077)
    destination = Path(destination)
    if destination.exists():
        raise RuntimeError("Use a new backup destination")
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    env = os.environ.copy()
    if not env.get("PGPASSWORD"):
        raise RuntimeError("Database password is required")
    env.update(PGHOST="aws-0-eu-west-1.pooler.supabase.com", PGPORT="5432",
               PGUSER=f"postgres.{PROJECT}", PGDATABASE="postgres",
               PGSSLMODE="verify-full", PGSSLROOTCERT=str(ROOT / "certs/supabase-prod-ca-2021.crt"),
               PGCONNECT_TIMEOUT="15", PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=120000")
    with tempfile.TemporaryDirectory(prefix="riparim-auth-") as temporary:
        dump = Path(temporary) / "auth.dump"
        run(["pg_dump", "--format=custom", "--schema=auth", "--no-owner",
             "--no-privileges", "--lock-wait-timeout=15s", "--file", str(dump)], env=env)
        size = dump.stat().st_size
        if not 0 < size <= MAX_BYTES:
            raise RuntimeError("Backup size exceeds the free-storage safety limit")
        toc = run(["pg_restore", "--list", str(dump)]).decode()
        for table in ("users", "identities", "schema_migrations"):
            if f"TABLE DATA auth {table} " not in toc:
                raise RuntimeError("Auth archive is incomplete")
        encrypted = Path(temporary) / "auth.dump.cms"
        run(["openssl", "cms", "-encrypt", "-binary", "-aes-256-gcm",
             "-in", str(dump), "-out", str(encrypted), "-outform", "DER",
             str(ROOT / "certs/auth-backup-recipient.pem")])
        # Publish only after dump validation and encryption both succeeded.
        destination.mkdir(mode=0o700)
        try:
            payload = encrypted.read_bytes()
            (destination / "auth.dump.cms").write_bytes(payload)
            manifest = {"format": "riparim-auth-cms-v1", "project": PROJECT,
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                        "schema": "auth", "encryptedBytes": len(payload),
                        "sha256": hashlib.sha256(payload).hexdigest(),
                        "pgDumpVersion": run(["pg_dump", "--version"]).decode().strip()}
            (destination / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        except BaseException:
            for file in destination.iterdir():
                file.unlink()
            destination.rmdir()
            raise
    print("Encrypted Supabase auth backup completed")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise RuntimeError("Supply one new output directory")
        backup(sys.argv[1])
    except Exception as error:
        # Only our fixed messages are safe to publish in public workflow logs.
        print(str(error) if isinstance(error, RuntimeError) else "Backup failed; inspect protected runtime", file=sys.stderr)
        sys.exit(1)
