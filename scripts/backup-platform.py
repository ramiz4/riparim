#!/usr/bin/env python3
"""Encrypted off-provider backups; no provider payloads in logs."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
PROJECT = "opbnfdwmunyfzqplcfjw"
ACCOUNT = "ec181b3a61c7c3da13910600953fc3ea"
DATABASE = "b395ea3a-5316-4b0b-bdee-533bdb68d6a0"
BUCKET = "riparim-evidence-production"
CF_BASE = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}"
MAX_BYTES = 8 * 1024 * 1024
MAX_OBJECTS = 1000


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, url):
        return None


def request(url, token=None, body=None):
    headers = {"Accept": "application/json", "Accept-Encoding": "identity"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(body).encode()
    try:
        with urllib.request.build_opener(NoRedirect()).open(
                urllib.request.Request(url, data=body, headers=headers), timeout=30) as response:
            data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise RuntimeError("Provider response exceeds free-storage safety limit")
            return data, response.headers
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError("Provider request failed; no complete backup published") from None


def cf(path, token, body=None):
    data, _ = request(CF_BASE + path, token, body)
    response = json.loads(data)
    if response.get("success") is not True:
        raise RuntimeError("Cloudflare operation failed")
    return response


def inventory(token):
    objects = []
    cursor = None
    seen = set()
    while True:
        query = {"per_page": 1000}
        if cursor:
            query["cursor"] = cursor
        response = cf(f"/r2/buckets/{BUCKET}/objects?" + urllib.parse.urlencode(query), token)
        objects.extend(response["result"])
        if len(objects) > MAX_OBJECTS or sum(o["size"] for o in objects) > MAX_BYTES // 2:
            raise RuntimeError("R2 inventory exceeds free-backup safety limits")
        info = response.get("result_info", {})
        cursor = info.get("cursor")
        if "is_truncated" not in info and not cursor and len(response["result"]) >= 1000:
            raise RuntimeError("R2 inventory pagination is ambiguous")
        if not info.get("is_truncated", bool(cursor)):
            break
        if not cursor or cursor in seen:
            raise RuntimeError("R2 inventory pagination is incomplete")
        seen.add(cursor)
    if len({o["key"] for o in objects}) != len(objects):
        raise RuntimeError("Duplicate R2 inventory keys")
    return sorted(objects, key=lambda o: o["key"])


def validate_d1(sql, keys):
    # Validate only in memory. Never allow SQL to open files or load extensions.
    with sqlite3.connect(":memory:") as db:
        def authorize(action, arg1, arg2, *_):
            if action in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH, sqlite3.SQLITE_CREATE_VTABLE):
                return sqlite3.SQLITE_DENY
            if action == sqlite3.SQLITE_FUNCTION and arg2 == "load_extension":
                return sqlite3.SQLITE_DENY
            if action == sqlite3.SQLITE_PRAGMA and arg1 not in ("foreign_keys", "defer_foreign_keys"):
                return sqlite3.SQLITE_DENY
            return sqlite3.SQLITE_OK
        db.set_authorizer(authorize)
        db.executescript(sql.decode("utf-8"))
        db.set_authorizer(None)
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("D1 restore integrity check failed")
        if db.execute("PRAGMA foreign_key_check").fetchone():
            raise RuntimeError("D1 restore foreign-key check failed")
        for table in ("visits", "workshop_claims", "evidence_uploads"):
            for (key,) in db.execute(f'SELECT file_key FROM "{table}" WHERE file_key IS NOT NULL'):
                if key not in keys:
                    raise RuntimeError("D1 references a missing R2 object; backup is incomplete")
        return {name: db.execute(f'SELECT count(*) FROM "{name}"').fetchone()[0]
                for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                if name.replace("_", "").isalnum()}


def export_d1(token):
    body = {"output_format": "polling"}
    for _ in range(60):
        response = cf(f"/d1/database/{DATABASE}/export", token, body)["result"]
        if response.get("status") == "complete" and response.get("success") is True:
            url = response["result"]["signed_url"]
            parsed = urllib.parse.urlparse(url)
            if parsed.scheme != "https" or parsed.username or parsed.password or not (
                    parsed.hostname.endswith(".r2.cloudflarestorage.com") or
                    parsed.hostname.endswith(".cloudflarestorage.com")):
                raise RuntimeError("Unexpected D1 export download origin")
            return request(url)[0], response.get("at_bookmark")
        if response.get("status") != "active" or not response.get("at_bookmark"):
            raise RuntimeError("D1 export did not complete")
        body["current_bookmark"] = response["at_bookmark"]
        time.sleep(1)
    raise RuntimeError("D1 export polling timed out")


def collect_cloudflare(directory, token):
    before = inventory(token)
    sql, bookmark = export_d1(token)
    (directory / "d1.sql").write_bytes(sql)
    (directory / "r2").mkdir(mode=0o700)
    records = []
    for index, obj in enumerate(before):
        path = "/r2/buckets/" + BUCKET + "/objects/" + urllib.parse.quote(obj["key"], safe="/")
        data, headers = request(CF_BASE + path, token)
        if len(data) != obj["size"] or headers.get("ETag", "").strip('"') != obj["etag"]:
            raise RuntimeError("R2 object changed during backup")
        name = f"r2/{index:06d}.bin"
        (directory / name).write_bytes(data)
        records.append({"metadata": obj, "file": name, "sha256": hashlib.sha256(data).hexdigest()})
    if before != inventory(token):
        raise RuntimeError("R2 inventory changed during backup; retry later")
    counts = validate_d1(sql, {o["key"] for o in before})
    manifest = {"account": ACCOUNT, "database": DATABASE, "bucket": BUCKET,
                "bookmark": bookmark, "tableCounts": counts, "objects": records,
                "d1Sha256": hashlib.sha256(sql).hexdigest()}
    (directory / "cloudflare.json").write_text(json.dumps(manifest, indent=2))


def collect_auth_config(directory, token):
    data, _ = request(f"https://api.supabase.com/v1/projects/{PROJECT}/config/auth", token)
    config = json.loads(data)
    if not isinstance(config, dict) or not isinstance(config.get("site_url"), str) or "uri_allow_list" not in config:
        raise RuntimeError("Supabase auth configuration is incomplete")
    # Retain exactly what the API returns, including templates/provider/SMTP settings.
    (directory / "supabase-auth-config.json").write_bytes(data)


def backup(destination):
    os.umask(0o077)
    destination = Path(destination)
    if destination.exists():
        raise RuntimeError("Use a new backup destination")
    cf_token = os.environ.get("CLOUDFLARE_BACKUP_TOKEN")
    auth_token = os.environ.get("SUPABASE_AUTH_CONFIG_TOKEN")
    if not cf_token or not auth_token:
        raise RuntimeError("Scoped Cloudflare and Supabase backup credentials are required")
    with tempfile.TemporaryDirectory(prefix="riparim-platform-") as temporary:
        directory = Path(temporary) / "payload"
        directory.mkdir(mode=0o700)
        collect_auth_config(directory, auth_token)
        collect_cloudflare(directory, cf_token)
        (directory / "snapshot.json").write_text(json.dumps({"format": "riparim-platform-v1",
            "project": PROJECT, "completedAt": datetime.now(timezone.utc).isoformat()}))
        archive = Path(temporary) / "platform.tar.gz"
        with tarfile.open(archive, "w:gz") as tar:
            tar.add(directory, arcname="snapshot")
        if archive.stat().st_size > MAX_BYTES:
            raise RuntimeError("Platform archive exceeds free-storage safety limit")
        encrypted = Path(temporary) / "platform.cms"
        result = subprocess.run(["openssl", "cms", "-encrypt", "-binary", "-aes-256-gcm",
            "-in", str(archive), "-out", str(encrypted), "-outform", "DER",
            str(ROOT / "certs/auth-backup-recipient.crt")], capture_output=True)
        if result.returncode:
            raise RuntimeError("Backup encryption failed")
        destination.mkdir(parents=True, mode=0o700)
        try:
            payload = encrypted.read_bytes()
            (destination / "platform.tar.gz.cms").write_bytes(payload)
            (destination / "manifest.json").write_text(json.dumps({"format": "riparim-platform-cms-v1",
                "encryptedBytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}))
        except BaseException:
            for file in destination.iterdir():
                file.unlink()
            destination.rmdir()
            raise
    print("Encrypted platform backup completed")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise RuntimeError("Supply one new output directory")
        backup(sys.argv[1])
    except Exception as error:
        print(str(error) if isinstance(error, RuntimeError) else "Platform backup failed; no complete backup published", file=sys.stderr)
        sys.exit(1)
