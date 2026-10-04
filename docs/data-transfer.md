# Datenübernahme von Sites zum eigenen Worker

Die Quell-Site bleibt während Vorbereitung und Prüfung erhalten. Eine leere,
bereits migrierte Zieldatenbank ist keine abgeschlossene Übernahme. #18 bleibt
offen, bis Backup, Wiederherstellung, Abgleich und Zugriffstests tatsächlich
ausgeführt und dokumentiert sind; Domainwechsel #19 und Stilllegung #20 folgen.

## Ressourcen und Veröffentlichungsstand

- Quelle: Sites-Projekt `appgprj_6abfd028b7e48191822a15d44cbbda8d`,
  `https://riparim.com`, logische Bindings `DB` und `BUCKET`.
- Zielaccount: `ec181b3a61c7c3da13910600953fc3ea`, Worker `riparim`.
- Ziel-D1: `riparim-production`, `b395ea3a-5316-4b0b-bdee-533bdb68d6a0`.
- Ziel-R2: `riparim-evidence-production`, privat.

Der Quellzugriff erfolgt über die vorhandenen Worker-Bindings. Der Sites-
Connector bietet keinen vollständigen Datenbank-/Dateiexport. Ein Cloudflare-
Token des Zielaccounts erhält dadurch keinen Zugriff auf die Plattformressourcen
der Quelle. Für die Übernahme wird deshalb der geprüfte Sites-Build desselben
Main-Releases genutzt. Die beiden Anbieterarchive dürfen nicht vertauscht werden:
der eigene Worker entfernt native Identitätsheader, der Sites-Adapter bewahrt
deren bestehendes Verhalten hinter dem Plattformzugang.

Nur ein vollständig veröffentlichter GitHub Release mit passendem Quellcommit,
Projekt und SHA-256 darf auf die Quell-Site übernommen werden. Der konfigurierte
Sites-Quellbranch muss den exakten Release-Commit per Fast-forward erhalten;
bei Divergenz stoppen. Reine zusätzliche Veröffentlichungscommits dürfen nicht
als vermeintlich gleicher Archivcommit ausgegeben werden. Nach zusätzlicher
Sicherung der gesamten Quellhistorie auf einem eigenen Branch und mit lokalem
Git-Bundle samt Wiederherstellungsprüfung kann eine ausdrücklich vom Nutzer
beauftragte Ausrichtung erfolgen. Sie verwendet ausschließlich
`--force-with-lease=refs/heads/main:<zuvor bestätigter vollständiger SHA>` zum
geprüften Release-Commit und bricht bei jeder zwischenzeitlichen Änderung ab.
Ohne diese ausdrückliche Beauftragung bleibt die Veröffentlichung gestoppt.
Das heruntergeladene geprüfte Sites-Archiv wird unverändert
mit den nativen Sites-Werkzeugen gespeichert und veröffentlicht.

## Geschützter Export und Schreibpause

Die Quelle erhält folgende geschützte Laufzeitkonfiguration; sie gehört weder
in Git noch in PR-Text, Logs oder Befehlsargumente:

- `MIGRATION_READ_ONLY=true`: sperrt den gesamten App-Handler, einschließlich
  GETs mit automatischen Datenbankänderungen und Scheduled-Benachrichtigungen.
- `MIGRATION_EXPORT_TOKEN_SHA256`: SHA-256 eines kryptografisch erzeugten
  256-Bit-Tokens. Der Klartext wird ausschließlich geschützt im Exportprozess
  gehalten und per Authorization-Header übertragen.
- `MIGRATION_EXPORT_EXPIRES_AT`: höchstens 24 Stunden gültiger ISO-Zeitpunkt.
- `MIGRATION_SOURCE_COMMIT`: exakter, unabhängig geprüfter Release-Commit.

Der Exportpfad `/__migration/export` antwortet ohne diese Konfiguration und ohne
gültige Berechtigung mit 404. Er akzeptiert keine Client-SQL-Abfragen, keine
Client-Zielressourcen und keine Cookie-/UI-Admin-Abkürzung. Tabellen werden gegen
das tatsächliche SQLite-Schema geprüft; kleine Folgeseiten erhalten BLOB-Werte.
R2 wird vollständig über dessen Cursor inventarisiert, einschließlich privater
Objekte ohne aktuellen Besuchsverweis. Dateischlüssel stehen im geschützten
POST-Body; Inhalte werden gestreamt und nur mit unverändertem ETag gelesen.

Die Exportberechtigung läuft ab; die Schreibpause endet **nicht** automatisch.
Nach dem Wechsel darf die alte Site keine zweite Schreibquelle werden. Die
Wiederaufnahme benötigt einen ausdrücklichen Betriebsentscheid und erneuten
Abgleich. Zum Rückfall vor Domainwechsel die Exportwerte entfernen und die
Schreibpause gezielt aufheben; keine Datenbank oder Dateien löschen.

Vor der Bestandsaufnahme müssen alte Aufrufe und Hintergrundarbeiten abgeflossen
sein. Zwei identische vollständige Bestandsaufnahmen sind eine zusätzliche
Kontrolle, kein Ersatz für diese Betriebsbedingung. Bei aktiven Uploads,
Löschungen, unklarer Quieszenz oder abweichendem Abschlussabgleich bleibt der
Zustand No-Go. Ein bestehender Lösch- oder Uploadzustand wird erhalten und nicht
automatisch bereinigt oder als erledigt markiert.

## Backup und Wiederherstellung

Backups werden außerhalb von Git in einem Verzeichnis mit Modus 0700 gespeichert;
Dateien erhalten 0600. Das Inventar enthält alle tatsächlichen Tabellen,
Schemaobjekte und erreichbaren Migrationsmetadaten. Reservierte `_cf_*`-Tabellen
sind vom Anbieter für SQL-Lesezugriffe gesperrt; ihre Namen werden ausdrücklich
als ausgeschlossene Plattformtabellen dokumentiert. Dieser logische Export
behauptet keine Sicherung dieser internen Providerdaten. Private SQL-Bindings und
Sitzungsdaten werden nicht in Diagnosen ausgegeben. Dateiinhalt, Größe,
SHA-256, ursprünglicher Objektschlüssel, HTTP-/Custom-Metadaten sowie Quell-ETag
werden festgehalten. Ein abgebrochener Export gilt nicht als abgeschlossen.

`scripts/data-transfer.mjs` stellt die Anwendungsdaten isoliert mit ausschließlich
eingechecktem SQL wieder her. Fremdes Export-SQL wird nie ausgeführt. Das gesamte
Schema samt Spalten muss genau einen bekannten Migrationsstand beweisen; eine
vorhandene D1-/Drizzle-Historie muss dazu passen. Fehlende Historie wird als solche
ausgewiesen und niemals durch erfundene angewendete Zeilen ersetzt. Plattform-
und Quell-Migrationsdaten bleiben unverändert im Quellarchiv erhalten. Das
Upgrade ergänzt ausschließlich den bewiesenen fehlenden Migrationssuffix.

Die gleiche Wiederherstellungsprüfung gilt für das Zielbackup. Dessen bereits
angewendete Historie bleibt erhalten. Ein Datentransfer ersetzt keine Migration
und spielt keine alten CREATE/DROP-Anweisungen über die Produktionsdatenbank.

## Import und Abnahme

Der Zielnachweis verlangt neben HTTP503/no-store den ausdrücklichen Wartungsmarker
des Workers und dessen unveränderlich eingebauten Release-Commit. Ein gewöhnlicher
App-Ausfall gilt nicht als aktive Schreibpause. Quellidentität und Bestandsfingerprints
werden vor und nach jedem Importabschnitt authentifiziert geprüft.

Vor Import beide Seiten sichern, Wiederherstellung prüfen, Dateien vollständig
verifizieren und einen privaten Plan erzeugen. Gleiche Datensätze sind No-ops;
fehlende Primärschlüssel können ergänzt werden. Abweichende Zeilen und Unique-
Kollisionen stoppen den Plan. Auch zusätzliche Zieldatensätze bleiben erhalten
und sichtbar. Es gibt kein pauschales Replace, Upsert oder Löschen fremder Daten.
Ein bewusst notwendiger Katalogabgleich benötigt einen gesondert geprüften Plan.

Private Objekte werden unter gleichen Schlüsseln übernommen. Bereits vorhandene
Zielobjekte müssen Inhalt und Metadaten nachweislich erfüllen, andernfalls
stoppen. Originale Provider-ETags/Uploadzeiten bleiben im Backup; neu erzeugte
R2-Providerwerte dürfen nicht mit unveränderten Datei-Prüfsummen verwechselt
werden. Referenzen aus `visits` und `evidence_uploads` werden vollständig geprüft;
ein fehlender privater Beleg blockiert die Übernahme.

Für Wiederholungen bestätigte Einfügungen erneut gegen Quelle und Ziel prüfen.
Ein verlorener Commit-Acknowledgement ist kein Grund für blinden erneuten Import.
Die Ausgabe enthält nur Mengen und Prüfergebnisse. Abschließend einen neuen
vollständigen Quell-/Zielabgleich ausführen und die Schreibpause bestätigen.

Go/No-Go benötigt außerdem: unveränderte Supabase-Projektidentität, serverseitig
bestätigte Legacy-Verknüpfungen, erhaltene Adminrollen und Kontosperren,
Anmeldung/Abmeldung, Moderation und erlaubte sowie fremde/anonyme Nachweisabrufe.
Gleiche E-Mail-Adressen erzeugen keine Besitzrechte. Mit echten Konten benötigte
Anmeldeschritte werden getrennt von isolierten Tests dokumentiert. Ohne diese
Abnahme keine Domainumstellung und keine Schließung von #18.
