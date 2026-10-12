import importlib.util
import json
from pathlib import Path
import tempfile
import sqlite3
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("backup_platform", Path(__file__).resolve().parents[1] / "scripts/backup-platform.py")
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
SQL = b"CREATE TABLE visits(file_key TEXT); CREATE TABLE workshop_claims(file_key TEXT); CREATE TABLE evidence_uploads(file_key TEXT); INSERT INTO visits VALUES ('private/one');"
OBJECT = {"key": "private/one", "size": 3, "etag": "abc", "last_modified": "2026-10-12T00:00:00Z", "custom_metadata": {"owner": "synthetic"}, "http_metadata": {"contentType": "image/png"}}


class PlatformBackupTests(unittest.TestCase):
    def test_complete_cloudflare_snapshot_and_metadata(self):
        calls = []
        def request(url, token=None, body=None):
            calls.append((url, token, body))
            if url.endswith("/objects?per_page=1000"):
                return json.dumps({"success": True, "result": [OBJECT], "result_info": {"is_truncated": False}}).encode(), {}
            if url.endswith("/export"):
                return json.dumps({"success": True, "result": {"status": "complete", "success": True, "at_bookmark": "synthetic", "result": {"signed_url": "https://synthetic.r2.cloudflarestorage.com/dump"}}}).encode(), {}
            if url.endswith("/dump"):
                self.assertIsNone(token)
                return SQL, {}
            return b"123", {"ETag": '"abc"'}
        with tempfile.TemporaryDirectory() as directory, patch.object(backup, "request", request), patch.object(backup, "export_d1", return_value=(SQL, None)):
            backup.collect_cloudflare(Path(directory), "synthetic-token")
            manifest = json.loads((Path(directory) / "cloudflare.json").read_text())
            self.assertEqual(manifest["objects"][0]["metadata"], OBJECT)
            self.assertEqual((Path(directory) / "r2/000000.bin").read_bytes(), b"123")
            self.assertEqual(manifest["tableCounts"]["visits"], 1)
            self.assertEqual(sum("/objects?" in url for url, _, _ in calls), 2)

    def test_pagination_and_missing_cursor(self):
        pages = [{"success": True, "result": [OBJECT], "result_info": {"is_truncated": True, "cursor": "next"}}, {"success": True, "result": [], "result_info": {"is_truncated": False}}]
        with patch.object(backup, "cf", side_effect=pages):
            self.assertEqual(backup.inventory("synthetic"), [OBJECT])
        with patch.object(backup, "cf", return_value={"success": True, "result": [], "result_info": {"is_truncated": True}}):
            with self.assertRaises(RuntimeError):
                backup.inventory("synthetic")

    def test_changed_object_or_inventory_rejected(self):
        for changed_inventory, etag in [(True, '"abc"'), (False, '"changed"')]:
            with tempfile.TemporaryDirectory() as directory, patch.object(backup, "inventory", side_effect=[[OBJECT], [] if changed_inventory else [OBJECT]]), patch.object(backup, "export_d1", return_value=(SQL, "snapshot")), patch.object(backup, "request", return_value=(b"123", {"ETag": etag})):
                with self.assertRaises(RuntimeError):
                    backup.collect_cloudflare(Path(directory), "synthetic")

    def test_missing_private_file_and_external_sql_rejected(self):
        with self.assertRaises(RuntimeError):
            backup.validate_d1(SQL, set())
        with self.assertRaises(Exception):
            backup.validate_d1(b"ATTACH DATABASE '/tmp/should-not-open' AS unsafe;", set())

    def test_auth_config_templates_retained(self):
        config = {"site_url": "https://example.invalid", "uri_allow_list": "https://example.invalid/**", "mailer_templates_recovery_content": "synthetic-template", "smtp_pass": "synthetic-secret"}
        with tempfile.TemporaryDirectory() as directory, patch.object(backup, "request", return_value=(json.dumps(config).encode(), {})):
            backup.collect_auth_config(Path(directory), "synthetic")
            self.assertEqual(json.loads((Path(directory) / "supabase-auth-config.json").read_text()), config)

    def test_read_snapshot_preserves_blob_and_nul_text(self):
        with sqlite3.connect(":memory:") as source:
            source.row_factory = sqlite3.Row
            source.setlimit(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT, 1)
            source.executescript(SQL.decode())
            source.execute("CREATE TABLE synthetic(payload TEXT, bytes BLOB, missing TEXT)")
            source.execute("INSERT INTO synthetic VALUES(?,?,NULL)", ("a\0'尾", b"\x00\xff"))
            def cf(path, token, body=None):
                self.assertTrue(path.endswith('/query'))
                return {"result": [{"success": True, "results": [dict(row) for row in source.execute(body['sql'])]}]}
            with patch.object(backup, "cf", cf):
                exported, _ = backup.export_d1("synthetic")
            with sqlite3.connect(":memory:") as restored:
                restored.executescript(exported.decode())
                self.assertEqual(restored.execute("SELECT * FROM synthetic").fetchone(), ("a\0'尾", b"\x00\xff", None))


if __name__ == "__main__":
    unittest.main()
