# Supabase-Auth sichern

Der Workflow `Supabase Auth Backup` sichert täglich um **03:23 UTC** (04:23 Uhr
Schweizer Winterzeit, 05:23 Uhr Sommerzeit) das vollständige `auth`-Schema des
bestehenden Riparim-Projekts. Dazu gehören Benutzer samt Passwort-Hashes,
Provideridentitäten, MFA-Daten, Sitzungen, Tokens und Auth-Migrationshistorie.
`pg_dump` verwendet einen konsistenten Datenbanksnapshot; die App bleibt verfügbar.
Dies ist kein Export der Admin-Userliste, die keine vollständigen Passwort-Hashes enthält.

## Schutz, Aufbewahrung und Kosten

- Vollständig geprüftes TLS über den kostenlosen Session-Pooler (Port 5432).
- Temporäre Klartextdateien ausschließlich im privaten Arbeitsverzeichnis des
  kurzlebigen Runners. Fehler/SQL/Daten werden nicht in öffentliche Logs geschrieben.
- Vor Upload Verschlüsselung mit OpenSSL CMS, RSA-3072 und AES-256-GCM.
  GitHub enthält ausschließlich verschlüsselte Authdaten und einen Abschlussbeleg.
- Der private Entschlüsselungsschlüssel liegt im bestehenden Projekt-Eintrag in
  1Password, Feld **`SUPABASE_AUTH_BACKUP_PRIVATE_KEY`**. Der öffentliche
  Empfängerzertifikat-Fingerabdruck kann gegen das Feld
  `SUPABASE_AUTH_BACKUP_RECIPIENT_CERT` geprüft werden. Niemals den privaten Schlüssel
  in Git, GitHub-Secrets, Workflowlogs oder Befehlsargumente aufnehmen.
- Das Environment `auth-backup` erlaubt ausschließlich `main`. Sein Datenbankpasswort
  liegt im Secret `SUPABASE_AUTH_BACKUP_DATABASE_PASSWORD`. Es ist ein privilegierter
  Datenbankzugang: Zugriff auf Environment/Workflows sorgfältig beschränken. Der Job
  verwendet read-only Transaktionen, die Zugangsdaten selbst sind nicht read-only.
- 14 Tage GitHub-Artifact-Aufbewahrung. Maximal 16 MiB pro Dump; tatsächliche
  Authdaten sind derzeit wesentlich kleiner. Standardrunner sind im öffentlichen
  Repository kostenlos. Artifact-Speicher und Supabase-Egress teilen die jeweiligen
  Kontofreimengen mit anderen Nutzern; daher kein uneingeschränktes Kostenversprechen.
  Bei wachsender Nutzung zuerst Speicher/Traffic prüfen, kein Paid-Upgrade automatisch.
- Ein fehlgeschlagener Run veröffentlicht kein neues Backup. GitHub kann geplante
  Runs verzögern; in öffentlichen inaktiven Repositories werden Zeitpläne nach
  60 Tagen ohne Repositoryaktivität deaktiviert. Runstatus und Backupalter kontrollieren;
  die vorhandenen GitHub-Actions-Benachrichtigungen nutzen. Keine weitere Automation
  oder Mailgebühr eingerichtet.

## Wiederherstellung

1. Artifact eines erfolgreichen Runs herunterladen. Im privaten Verzeichnis
   (`0700`, Dateien `0600`) arbeiten. `manifest.json` muss das erwartete Projekt
   nennen; SHA-256 von `auth.dump.cms` gegen den Beleg prüfen.
2. Privaten Schlüssel aus 1Password in eine temporäre private Datei lesen, ohne
   Anzeige, Clipboard oder Argumentwert. Entschlüsseln:

   ```sh
   umask 077
   openssl cms -decrypt -binary -inform DER -in auth.dump.cms \
     -inkey /geschuetzter/pfad/private-key.pem -out auth.dump
   pg_restore --list auth.dump > archive-list.txt
   ```

   Bei Authentifizierungsfehlern den gesamten entschlüsselten Output verwerfen;
   ein fehlgeschlagener GCM-Lauf kann unbestätigte Klartextbytes geschrieben haben.
3. Zuerst in einer isolierten Umgebung mit kompatibler PostgreSQL-/Supabase-Authversion
   prüfen. Das Archiv enthält Schema und Daten, aber keine Ownership/ACLs.
   Ein leeres lokales PostgreSQL kann die Archivstruktur und Daten wiederherstellen;
   für einen echten Supabase-Restore die vom Provider bereitgestellten Tabellen und
   Rollen bewahren und einen geprüften Datenübernahmeplan verwenden. Nicht blind
   `--clean` gegen Produktion ausführen. Migrationstand, Tabellenverträge,
   Benutzer-IDs, Passwort-Hashes, Provideridentitäten und MFA prüfen.
4. Authkonfiguration, OAuth-/SMTP-Zugangsdaten, Redirects und JWT/API-Keys sind
   **kein Bestandteil dieses Datenbanksnapshots**. Bestehende 1Password-Konfiguration
   und [Auth-Provider-Anleitung](auth-provider.md) separat abgleichen. Auch
   Cloudflare-D1/R2-Appdaten brauchen ihren eigenen konsistenten Restore; alte
   Authkonten dürfen keine zwischenzeitlich gelöschten Appkonten wieder aktivieren.
5. Vor produktiver Wiederaufnahme alte Sitzungen/Tokens gezielt widerrufen und
   E-Mail-/Google-Anmeldung mit isolierten Konten tatsächlich prüfen. Ein geprüfter
   Datenbankrestore allein beweist keine funktionierende Anmeldung. Produktionsrestore
   benötigt einen eigenen Auftrag und eine abgestimmte Schreibpause.

Bei Schlüsselrotation alte Schlüssel mindestens so lange erhalten wie die damit
verschlüsselten Backups. Klartextdump und temporären Schlüssel nach der Prüfung
aus dem privaten Arbeitsverzeichnis entfernen.

Quellen: [Supabase-Backups](https://supabase.com/docs/guides/platform/backups),
[Datenbankverbindungen](https://supabase.com/docs/guides/database/connecting-to-postgres),
[GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
