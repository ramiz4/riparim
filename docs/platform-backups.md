# Authkonfiguration, D1 und R2 sichern

Der tägliche Workflow `Platform Backup` ergänzt die bestehende
[Authdaten-Sicherung](auth-backups.md). Er läuft um 03:43 UTC (04:43 Schweizer
Winterzeit, 05:43 Sommerzeit) ausschließlich auf `main`, mit 14 Tagen Aufbewahrung.
Der Entschlüsselungsschlüssel ist derselbe verifizierte RSA-Schlüssel im
1Password-Projekteintrag `mkp7xa42clfbreiv2q3b3nrq5y`, Feld
`SUPABASE_AUTH_BACKUP_PRIVATE_KEY`. Alte Authbackups bleiben entschlüsselbar;
es wird kein Schlüssel ersetzt.

## Bestand und Abgrenzung

Die Prüfung am 12.10.2026 ergab keine geplante unabhängige D1-/R2-Sicherung
und keine automatische Authkonfigurationssicherung. D1 besitzt bereits
Cloudflare Time Travel (sieben Tage auf Workers Free). Dieser Wiederherstellungsweg
ersetzt keine unabhängige Kopie und sichert keine R2-Objekte.
D1 hatte etwa 553 KB, R2 zwei Objekte mit insgesamt 26.528 Bytes.

Das neue Archiv enthält:

- Die vollständige Antwort von Supabase `GET /v1/projects/<ref>/config/auth`:
  Site URL, Redirects, aktivierte Provider, SMTP-Einstellungen, Mailvorlagen,
  Registrierungs-, Sitzungs-, Sicherheits- und Rate-Limit-Einstellungen.
  Alle zurückgegebenen Werte bleiben im verschlüsselten Archiv. Die live
  gelesenen OAuth-/SMTP-Geheimnisfelder waren keine direkt mit den originalen
  Vault-Schlüsseln übereinstimmenden Werte. Solche API-Repräsentationen dürfen
  nicht als Passwort wieder eingespielt werden. Was die API maskiert oder
  nicht exportiert, wird dadurch nicht rekonstruiert; OAuth-/SMTP-Secrets im
  bestehenden 1Password-Eintrag und neu anzulegende Signing-/API-Keys bleiben
  Teil des Wiederherstellungsplans. Keine automatischen PATCHs gegen Produktion.
  `supabase-auth-recovery.json` benennt den Vault-Eintrag und die zugehörigen
  Felder, ohne deren Werte in Metadaten oder Logs auszugeben.
- Einen konsistenten SQL-Lesesnapshot des D1-Anwendungsschemas einschließlich
  Anwendungs- und Migrationsdaten. Cloudflare- und SQLite-interne Tabellen
  sind ausdrücklich ausgenommen.
- Alle R2-Objekte, auch ohne aktuellen Besuchsverweis: Bytes, Schlüssel,
  Größe, ETag, Änderungszeit, HTTP-/Custom-Metadaten und SHA-256. Objektpfade
  werden nicht als lokale Dateinamen verwendet.

## Konsistenz und Prüfung

R2 wird vor dem D1-Snapshot inventarisiert. Downloads müssen Größe und ETag
erhalten; eine zweite vollständige Inventarisierung muss exakt übereinstimmen.
Bei Änderungen, fehlenden Seiten oder Dateien bricht der Run ab und veröffentlicht
kein fertiges Backup. Bei aktivem Upload oder einer Löschung später erneut starten.
Alle D1-Zeilen, Zeilenzahlen und das Schema werden in einer einzigen SQL-Leseanweisung
erfasst. Spalten werden vorher ermittelt, das Schema muss im Snapshot unverändert
sein. Scalar-Subqueries umgehen die kleine D1-Grenze für Compound-SELECTs.
Text inklusive Nullbytes und BLOBs wird verlustfrei über Hexwerte gesichert.
Der native, weitergehende Rechte benötigende Export wird nicht verwendet;
es gibt keine App-Schreibpause und keine automatische Datenänderung.

Vor Verschlüsselung wird D1 in einer isolierten SQLite-Datenbank im Speicher
wiederhergestellt und auf Integrität, Fremdschlüssel und Vollständigkeit der
privaten Dateiverweise geprüft. Externes Öffnen von Dateien und Extensions sind
bei dieser Prüfung gesperrt. D1 und Supabase haben unabhängige Snapshotzeiten;
ein anbieterübergreifend atomarer Snapshot wird nicht behauptet.

## Zugänge, Schutz und kostenlose Grenzen

Das GitHub-Environment `platform-backup` erlaubt nur `main`. Erforderlich sind
`CLOUDFLARE_BACKUP_TOKEN` (D1 Read und Workers R2 Storage Read im Riparim-Account) und
`SUPABASE_AUTH_CONFIG_TOKEN` (nur Auth Config Read, nur das bestehende Projekt).
Beide Zugangsschlüssel werden zusätzlich im selben 1Password-Projekteintrag
aufbewahrt. Sie werden nicht in Git oder öffentlichen Logs gespeichert.

Transport verwendet geprüftes HTTPS; Redirects werden abgewiesen. Die API-Zugänge
haben ausschließlich die bestätigten Leserechte und werden nicht für andere Ziele verwendet.
Klartext existiert nur im privaten temporären Runnerverzeichnis. Das gesamte
Archiv wird vor Upload mit RSA-3072/AES-256-GCM (CMS) verschlüsselt.
GitHub erhält nur `platform.tar.gz.cms` und den öffentlichen SHA-256-Beleg.

Es werden keine Paid-Pläne, Buckets oder weiteren Cloudservices eingerichtet.
Standardrunner sind im öffentlichen Repository kostenlos; Artifact-Speicher,
D1-Lesezugriffe und R2-Operationen teilen bestehende Freimengen. Sicherheitsgrenzen:
höchstens 1.000 Objekte, 4 MiB R2-Inhalt und 8 MiB komprimiertes Archiv. Wachstum
führt zum Abbruch statt zu einer automatischen Kontingenterhöhung. Bei der geprüften
kleinen Datenmenge ist reichlich Reserve vorhanden. Andere Kontoverbräuche trotzdem
berücksichtigen. GitHub-Zeitpläne können verzögert oder nach 60 Tagen ohne
Repositoryaktivität deaktiviert werden; Backupalter und Runstatus kontrollieren.

## Wiederherstellung

1. Erfolgreiches Artifact in ein privates Verzeichnis herunterladen und den
   Ciphertext-SHA-256 prüfen. Mit dem in 1Password gespeicherten Schlüssel
   gemäß [Authbackup-Anleitung](auth-backups.md) entschlüsseln (`openssl cms`,
   `-binary -inform DER`). Bei GCM-Fehlern sämtlichen Output verwerfen.
2. Tar-Inhalt zuerst inventarisieren; nur reguläre Dateien im Verzeichnis
   `snapshot/` zulassen, keine absoluten Pfade, Traversalsegmente oder Links.
   Konto, Projekt, Datenbank, Bucket und alle Inhaltsprüfsummen gegen die
   verschlüsselten Manifeste prüfen.
3. D1 zunächst in einer isolierten SQLite-/D1-Umgebung wiederherstellen.
   Tabellenverträge und Drizzle-Migrationen, Besitzrechte, Moderationsstatus,
   Identitäten, Lösch-Tombstones und Outboxzustände gegen den aktuellen Code
   prüfen. Nicht blind über einen neueren produktiven Bestand schreiben.
4. R2-Dateien und Metadaten in einem privaten Testbucket oder im geprüften
   Node-Restore rekonstruieren. Originale ETags stehen im Manifest; R2 vergibt
   beim Wiederanlegen systemeigene ETags. Reservierungen und bedingte Uploads
   müssen nach dem bestehenden Datenübernahmevertrag abgeglichen werden.
   Das Archiv allein ist keine Freigabe für einen Produktionsrestore.
5. Authkonfiguration in einer kompatiblen isolierten Instanz abgleichen.
   SMTP/Google-Secrets, Redirects, neue Signing/API-Keys und separate Authdaten
   einrichten; tatsächliche Anmeldung, private Downloads und Kontolöschung prüfen.
   Alte Sitzungen widerrufen. Quelle und Ziel brauchen einen abgestimmten
   Wiederherstellungsauftrag und eine Schreibpause gemäß [Providerexit](provider-exit.md).

Quellen: [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/),
[D1 SQL](https://developers.cloudflare.com/d1/sql-api/sql-statements/),
[Supabase Auth Config](https://supabase.com/docs/reference/api/v1-get-auth-service-config).
