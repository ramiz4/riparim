# Kontrollierte Stilllegung der bisherigen Sites-Veröffentlichung

Diese Anleitung setzt [#20](https://github.com/ramiz4/riparim/issues/20) nach der
[technischen Produktionsabnahme](domain-cutover-2026-10-05.md) um. Stand vom
5. Oktober 2026: Inventar, geschütztes Gesamtarchiv und Stilllegung sind geprüft.
Der Nutzer beendete die gesonderte Rückfallphase ausdrücklich mit
„Ja, jetzt stilllegen.“; die Betreiberentscheidung wurde um 09:51:01
Europe/Belgrade (07:51:01 UTC) festgehalten. Die Ausführung und Nachprüfung stehen
im Abschlussnachweis unten. Der frühere Terminvorschlag 6. Oktober, 05:00 Uhr
wurde dadurch ersetzt; er löst keine weitere automatische Änderung aus.

## Bestand und Unabhängigkeit des neuen Betriebs

| Alter Bestand | Inventar vor der Ausführung |
| --- | --- |
| Hostingprojekt | `appgprj_6abfd028b7e48191822a15d44cbbda8d`, aktiv, Betreiber ist Owner |
| Generierte URL | `https://mjeshter-kosovo.r-loki.chatgpt.site`, HTTP 503 mit tatsächlichem Wartungstext und `no-store` |
| Gespeicherte Veröffentlichung | Version 42, `bf0af1913102710925efcadbfa9d3fff7631b694`, geprüfter Sites-Release v1.2.0 |
| Provider-Worker | `site---6abfd028b7e48191822a15d44cbbda8d` |
| Alte Domainzuordnungen | Apex `appgdom_6ac0ffb23eb481919cf1ad20c799ecae`; www `appgdom_6ac0ffd2de708191ab09da6e4a896478` |
| D1 | logisches Binding `DB`; 17 Anwendungstabellen plus zwei archivierte Systemtabellen, insgesamt 386 Zeilen |
| Privates R2 | logisches Binding `BUCKET`; vollständig inventarisiert, null Objekte und Nachweisreferenzen |
| Laufzeitkonfiguration | Revision 17, 13 Variablen; `MIGRATION_READ_ONLY=true` bleibt erhalten |
| Hintergrundarbeit | keine verknüpften Sites-Automationen in der nativen Abfrage; gespeicherter Fünf-Minuten-Cron überspringt durch Read-only sämtliche Benachrichtigungsarbeit |
| Historischer Quellcode | ursprünglicher e3-Stand samt vollständiger Git-Historie und BF0-Release-Tag separat gesichert |

Der produktive Worker `riparim` läuft im eigenen Account
`ec181b3a61c7c3da13910600953fc3ea` auf `https://riparim.com`. Er verwendet allein
`riparim-production` / `b395ea3a-5316-4b0b-bdee-533bdb68d6a0` und den privaten
Bucket `riparim-evidence-production`. Die aktivierten eigenen Custom Domains
liegen in Zone `cb2470c7a7d49b8a3e6aa3e697c3355e`. Alte Sites-Domainzuordnungen
sind eigenständige Providerobjekte und keine eigenen Worker-Routes.

Aktiver Release ist v1.2.9 / `53ae6ce7a896e779b75e5f249d25b7993c8c12d4`.
Weitere Main-Commits mit ausschließlich Dokumentation oder Tests haben keinen
neuen Release erzwungen. Der nach einem fehlerhaften Reihenfolgetest reparierte
[Main-Lauf](https://github.com/ramiz4/riparim/actions/runs/37269913883) ist vollständig
grün. Native Sites-Tokens und Plattform-Identitätsheader sind keine Abhängigkeit
des eigenen Workers; der Eingang entfernt gefälschte Plattformheader.
Supabase, Google und Resend bleiben gemeinsam genutzte Dienste.

## Geschütztes, wiederherstellbares Gesamtarchiv

Archivkennung: `aa0d0eaf-05fe-4c62-a19b-b3a6e60849a9`.
Die AES-256-GCM-Datei liegt außerhalb verwalteter Aufgaben-Worktrees in einem
privaten Verzeichnis und zusätzlich als verschlüsseltes Dokument im bestehenden
Projekt-Vault. Der zufällige 256-Bit-Schlüssel ist in einem separaten geschützten
Vault-Eintrag gespeichert. Pfade und Vault-Referenzen enthält der private
Archivbeleg; keine Schlüssel oder Datensätze werden in Git gespeichert.

Ciphertext-SHA-256:
`5af82e3e8caf6ad481e8c66b7b417f2bf4225e47893ca0fb2e4307747f2941be`.

Das Archiv umfasst:

- Den frischen, authentifizierten eingefrorenen Source-Export, Snapshot,
  vollständigen privaten R2-Manifest und Abschlussbeleg. Alle 19 Tabellen und
  386 Zeilen einschließlich Besitzrechten, Freigabestatus und Migrationshistorie
  bleiben enthalten; der leere R2-Bestand wird ausdrücklich nachgewiesen.
- Die 13 Laufzeitvariablen samt Wiederherstellungsprovenienz. Die native API
  maskiert Geheimniswerte; die erforderlichen aktuellen Werte stammen deshalb
  aus dem bestehenden geschützten Projekt-Vault. Der aktive Export-Hash wurde
  durch den authentifizierten Export belegt. Die vorhandene Resend-Variable
  verweist dort auf das Feld `api key`. Gemeinsame Zugangsdaten werden vor
  Wiederverwendung erneut auf Gültigkeit geprüft; abgelaufener Exportzugang wird
  nicht erneut aktiviert.
- Native Projekt-/Zugriffs-/Domain-/Versionsmetadaten, DNS-Rückfallbestand und
  den vollständigen finalen Abgleich aus #19.
- Das unveränderte GitHub-Sites-Archiv v1.2.0 mit Provenienz: SHA-256
  `26ba05a8ef7190479d07cd5e4ff3258f0cd234e2c749f750873b8e8ddbdf9cf8`.
- Den exakt rekonstruierten nativen Version-42-TAR: SHA-256
  `e83f183cd41920a31d4178548cbd73c8c68a5b8974c7743cb08087e7d9072459`,
  6.154.240 Bytes, 254 Dateien. Er wurde aus den vertrauenswürdigen Release-Dateien
  rekonstruiert; er ist kein Download aus dem Provider. Alle Pfade und Inhalts-
  Hashes sind identisch. Abweichungen zum gzip-Container betreffen ausschließlich
  die kanonische TAR-Darstellung: sortierte reguläre Dateien, keine Verzeichnis-
  Einträge, UID/GID/mtime null, leere Besitzernamen, Modus `0644`.
- Zwei vollständige Git-Bundles: ursprünglicher Stand
  `e3d92c79da31bdf392a64c14d319eefb4aeca92b` am ausdrücklich gewählten Branch
  `codex/sites-source-backup-e3d92c7`, sowie Release-Tag v1.2.0 / BF0.

**Tatsächlich geprüft:** Schlüssel aus dem Vault zurückgelesen, lokale
Ciphertextdatei entschlüsselt, sämtliche 15 manifestierten Nutzdateien gehasht,
Snapshot erneut validiert und Source-Datenbank im Speicher wiederhergestellt.
Alle 13 Migrationen, Integritätsprüfung und Fremdschlüsselprüfung bestanden.
Die hochgeladene verschlüsselte Dokumentdatei wurde separat heruntergeladen;
ihr Hash stimmt exakt überein. Temporäre Klartextverzeichnisse und Schlüsseldateien
wurden nach erfolgreicher Prüfung entfernt. Die bisherigen geschützten
Aufgaben-Backups werden bis zur sicheren Übergabe weiterhin erhalten.

Verantwortlicher ist der Riparim-Betreiber unter dem bestehenden Projektzugang.
Technische Mindestaufbewahrung: **30 Tage, mindestens bis 4. November 2026** für
Archiv, Wiederherstellungsschlüssel und alte Plattformressourcen. Das Datum löst
keine automatische Löschung aus. Eine endgültige Löschung benötigt danach eine
gesonderte ausdrückliche Beauftragung. Verlängerte Aufbewahrung bleibt möglich.

## Geprüfter Ausführungsplan

Die verfügbaren nativen Werkzeuge bieten kein Unpublish, Suspend oder Löschen
des gesamten Projekts. Der ausführbare Plan sperrt deshalb die alte öffentliche
Veröffentlichung reversibel und bewahrt Projekt, Versionen, D1 und R2.

1. Unmittelbar vorher Produktions-Release, HTTPS und beide eigenen Worker-Domains
   prüfen. Archiv/Vault-Readback und aktuelles Sources-Inventar müssen stimmen.
   Quelle bleibt Read-only; eine wieder aktivierte oder veränderte Quelle ist
   ein Stop-Kriterium. Zeitpunkt und Entscheidung zum Ende der Rückfallphase
   werden im Ausführungsbeleg festgehalten.
2. `sites_get_site` muss Owner-Zugang sowie verfügbaren Modus `custom` bestätigen.
   Der aktuelle Bestand enthält nur den Owner und keine zusätzlichen Editor- oder
   Gruppenzugänge. `sites_update_site_access` setzt `access_mode: custom` mit
   leeren Besucher-/Gruppenlisten. Der Owner bleibt nach nativer Zugriffspolitik
   berechtigt; anschließend Policy erneut lesen und anonymen Zugriff prüfen.
3. Alte Source-Domain-IDs aus einer frischen `sites_list_custom_domains`-Antwort
   übernehmen und ausschließlich diese beiden Zuordnungen mit
   `sites_remove_custom_domain` entfernen. Danach Source-Liste leer und eigene
   Worker-Domains/TLS unverändert nachweisen. Die eigenen DNS-Records, Nameserver,
   Mail- und Verifikationseinträge werden dabei nicht bearbeitet.
4. Ausschließlich die alten Exportvariablen entfernen:
   `MIGRATION_EXPORT_TOKEN_SHA256`, `MIGRATION_EXPORT_EXPIRES_AT`,
   `MIGRATION_SOURCE_COMMIT`. `MIGRATION_READ_ONLY=true` und alle gemeinsam
   genutzten Anwendungswerte bleiben erhalten. Eine neue Environmentrevision
   gilt erst nach Deployment; deshalb die bereits gespeicherte geprüfte
   Version 42 nach bestätigtem Owner-only-Zugriff mit
   `sites_deploy_private_site_version` erneut übernehmen. Kein Feature-Branch
   und kein neu gebautes Archiv werden veröffentlicht.
5. Erfolgreiches Deployment mit neuer aktiver Revision nachweisen. Exportzugang
   abgewiesen, alte öffentliche URL nicht mehr öffentlich erreichbar, Source
   weiterhin schreibgesperrt, Owner-Zugang und Versionen/D1/R2 erhalten. Der
   physische Cron bleibt Bestandteil des archivierten Codes; seine Geschäfts-
   arbeit ist dauerhaft durch Read-only deaktiviert. Native Projekt-Automationen
   werden frisch erneut gelesen; unerwartete aktive Aufgaben stoppen den Plan.
6. Abschließende Produktionstests: Apex/www/HTTPS und Release-Marker, E-Mail und
   Google-Anmeldung/Abmeldung, Verwaltung, erlaubter eigener/Admin-Zugriff auf
   privaten Testbeleg sowie verweigerter fremder/anonymer Zugriff. Nur markierte
   synthetische Daten verwenden und vollständige Bereinigung nachweisen.
7. Tatsächliche Schritte, Zeiten, Policyrevision, Deployment, verbleibende
   Ressourcen und Einschränkungen ergänzen. Erst danach #20 abschließen und den
   übergeordneten Abschluss in #17 prüfen.

Es werden keine gemeinsam genutzten Supabase-/Google-/Resend-Werte, der eigene
Cloudflare-Deployment-Token oder die allgemeine Sites-Verbindung widerrufen.
Kurzlebige alte Git-/Exportzugänge werden anhand ihres belegten Ablauf-/Bindungs-
zustands behandelt; fehlende Token-Inventarfunktionen werden nicht als erfolgter
Widerruf ausgegeben. Projektgebundene native Owner-Zugänge bleiben für die
Aufbewahrung und Wiederherstellung erhalten.

## Wiederherstellung und sichere Unterbrechung

Das verschlüsselte Dokument und der zugehörige Recovery-Eintrag werden unter dem
bestehenden Vault-Zugang gelesen. Zuerst Ciphertext-Hash prüfen, dann AES-GCM mit
dem dokumentierten Format `RIPARIM-SITES-AES256GCM-V1` entschlüsseln und alle
manifestierten Dateihashes prüfen. Source-Snapshot, Manifest und Migrationen
werden mit den vorhandenen `loadVerifiedSourceBackup`-/`restoreSnapshot`-Prüfungen
zunächst ausschließlich lokal validiert. Beim ursprünglichen Git-Bundle den
Backupbranch ausdrücklich auswählen; ein unbelegtes Bare-Repository-HEAD ist
kein verlorener Quellcode. Der BF0-Code wird über den Release-Tag gewählt.

Ein Freigabefehler auf dem eigenen Worker wird bevorzugt durch einen geprüften
Forward-Fix auf Main behoben. Ein Code-Rollback setzt keine D1-/R2-Daten zurück.
Die eingefrorene Quelle darf erst nach angekündigter Schreibpause beider Seiten,
frischen Sicherungen, vollständiger geprüfter Rückübernahme aller neuen Daten,
Änderungen, Löschungen und Dateien sowie erneuter Auth-/Berechtigungsprüfung als
Writer zurückkehren. Eine bloße Wiederöffnung der alten Audience oder ein
Zurückrouten auf ihren veralteten Bestand ist nicht freigegeben.

Bei einer fehlenden Bestätigung oder einer unbekannten API-/Vault-Antwort den
abhängigen Schritt anhalten, vorhandene Journale/Objekte frisch prüfen und keine
blinde Wiederholung ausführen. Eigene Worker-Ressourcen und neue Nutzerdaten
bleiben erhalten.

## Abschlussnachweis vom 5. Oktober 2026

Die freigegebene Rückfallphase ist beendet. Die alte **öffentliche** Veröffentlichung
ist kontrolliert stillgelegt; das aktive Hostingprojekt und seine physischen
Ressourcen bleiben zur Aufbewahrung erhalten. Dies ist keine Projektlöschung.

| Tatsächlich ausgeführt | Ergebnis |
| --- | --- |
| Source-Zugriff | `custom`, Policyrevision 3; genau ein Owner, null Nicht-Owner und Gruppen; aktueller Betreiber bleibt Owner |
| Alte Domainzuordnungen | ausschließlich beide inventarisierten Source-IDs entfernt; frische Source-Liste leer |
| Eigene Domainkonfiguration | beide ursprünglichen eigenen Worker-Domain-IDs, Zone, aktivierter Zustand und ausgeschaltete Previews unverändert |
| Alte Exportwerte | ausschließlich `MIGRATION_EXPORT_TOKEN_SHA256`, `MIGRATION_EXPORT_EXPIRES_AT`, `MIGRATION_SOURCE_COMMIT` entfernt |
| Aktive Source-Laufzeit | Environmentrevision 18; `MIGRATION_READ_ONLY=true`; übrige Einträge unverändert |
| Private Übernahme | gespeicherte geprüfte Version 42 / BF0; Deployment `appgdep_6ac358569efc8191b9841848bccea8b5` erfolgreich mit Revision 18 |
| Alte öffentliche Zugänge | generierte Root-URL und Exportpfad antworten anonym mit HTTP 401 |
| Erhaltene Source-Ressourcen | Projekt aktiv und Owner-zugänglich, Versionen unverändert, logisches D1-Binding mit allen 17 Anwendungstabellen vorhanden; private Dateien vollständig archiviert, keine Ressourcen gelöscht |
| Hintergrundarbeit | null verknüpfte Sites-Automationen; physischer Source-Cron bleibt archiviert, sämtliche Geschäftsarbeit durch Read-only gesperrt |

Die neue Produktion lieferte nach jedem Routing-Schritt weiterhin HTTP 200
am Apex und HTTP 308 mit erhaltener Query auf www, jeweils mit dem unveränderten
Release-Commit von v1.2.9. Es gab keine weitere öffentliche Wartungspause.

**Nachprüfung tatsächlich bestanden:** fünf Produktions-Preflights und 15
Auth-/Berechtigungsprüfungen um 10:02:59 Europe/Belgrade. E-Mail-/Passwort-Anmeldung,
Sitzungswiderruf bei Sperre und Abmeldung, erneute Anmeldung nach Entsperrung,
Verwaltungsrechte, private PNG-Datei für Owner/Admin sowie verweigerter fremder/
anonymer Zugriff und Ausschluss des Pending-Besuchs aus öffentlichen Bewertungen
funktionieren auf dem eigenen Worker. Es wurden keine echten E-Mails versandt.

Drei markierte synthetische Konten, ihre Daten und die private Datei sind
vollständig entfernt: null verbleibende Konten, null Bereinigungsfehler,
R2-Inventar danach null Objekte. Gemeinsame IP-Limits blieben erhalten.
Privates Prüfjournal: `1ed4fac9-7739-42da-ae97-709d36d7b6f8`.

Zusätzlich wurde die echte Google-Anmeldung auf riparim.com wiederholt:
Rücksprung zu `/werkstaetten?ort=prishtina`, vorhandener Admin-Menüeintrag,
erreichbare Verwaltungsseite und anschließende Abmeldung zur Gast-Anmeldeseite.
Browserlog: null Fehler, kein Navigationsfehler aus #33. Es wurden keine echten
Benutzer- oder Moderationsdaten verändert.

Gemeinsame Supabase-, Google-, Resend- und eigene CI-Zugänge wurden nicht
widerrufen oder umkonfiguriert. Ausschließlich der alte Source-Exportzugang ist
aus der aktiven Laufzeit entfernt. Die allgemeine Sites-Verbindung und native
Owner-Identität bleiben für andere Sites und die Wiederherstellung erhalten.
Kurzlebige frühere Git-Schreibzugänge werden nicht als dauerhaft widerrufen
behauptet; es wurde für die Stilllegung kein neuer Source-Schreibzugang erzeugt.
Der produktive Betrieb benötigt diese alte Git-Verbindung nicht.

Die Archiv- und Ressourcenaufbewahrung bis mindestens 4. November bleibt gültig.
Es wurde keine endgültige Löschung beauftragt oder ausgeführt. Nach sicherer
Übergabe können eigene Aufgaben-Worktrees archiviert werden; benötigte ignorierte
Backups bleiben vorher gesondert gesichert. Die tatsächliche Archivierung und
die verbleibenden Ressourcen sind damit die dokumentierte Übergabe für #20.
