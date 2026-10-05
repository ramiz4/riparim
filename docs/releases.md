# Releases und Veröffentlichung

Änderungen gehen über einen Pull Request nach `main`. Produktion darf erst nach dem Squash-Merge, erfolgreicher Prüfung und einem zugehörigen GitHub Release aktualisiert werden. Feature-Branches und offene PRs dürfen nicht über Sites veröffentlicht werden.

## Conventional Commits und Squash-Merge

Der PR-Titel wird als Squash-Commit übernommen und mit Commitlint geprüft. Beispiele:

- `fix: correct workshop search` erzeugt eine Patch-Version.
- `feat: add appearance settings` erzeugt eine Minor-Version.
- `feat!: replace the profile API` erzeugt eine Major-Version. Alternativ steht ein `BREAKING CHANGE:`-Footer am Ende der PR-Beschreibung.
- `docs:`, `test:`, `ci:`, `build:`, `refactor:` und `chore:` erzeugen allein normalerweise keinen Release.

Neue lokale Commits verwenden ebenfalls dieses Format. Prüfen: `printf '%s\n' 'feat: add settings' | npm run commitlint`. Historische Commit-Nachrichten werden nicht umgeschrieben.

GitHub erlaubt ausschließlich Squash-Merges. `main` erfordert einen PR, einen aktuellen erfolgreichen CI-Lauf und den Check **Conventional PR title**; die Regeln gelten auch für Administratoren. Die versionierte Konfiguration steht in `.github/repository-policy.json`. Ein Repository-Administrator kann sie mit `npm run repo:configure` anwenden und mit `npm run repo:check` prüfen. Diese Befehle benötigen eine passende `gh`-Anmeldung, keine Site-Zugangsdaten.

## GitHub Actions

Der Workflow **Release** startet nur bei `push` auf `main` im Repository `ramiz4/riparim`. Er verwendet Node.js 24 und arbeitet mit dem exakten Merge-Commit:

1. Wiederverwendbare CI führt Katalogprüfung, Tests, TypeScript, Lint und den Worker-Build aus.
2. Der geprüfte Build wird als unveränderliches Actions-Artefakt an den Release-Job übergeben. Repository, Commit und SHA-256 müssen übereinstimmen.
3. `semantic-release` analysiert die Conventional Commits seit dem letzten `v*`-Tag und erstellt Tag, Release Notes sowie einen GitHub Release mit Worker-Archiv und Provenienzdatei.
4. Der Deploy-Job lädt beide Dateien aus diesem veröffentlichten GitHub Release. Er prüft Tag, Commit, Prüfsumme und Zielbindings, wendet ausstehende D1-Migrationen an und veröffentlicht genau die geprüften Artefaktbytes auf Cloudflare. Ein erneuter Deploy verwendet denselben Release, keinen neuen Build.

Der automatisch bereitgestellte `GITHUB_TOKEN` erhält ausschließlich im Release-Job `contents: write`. Es werden keine npm-Pakete veröffentlicht, keine Release-Commits nach `main` geschrieben und keine zusätzlichen PATs benötigt. Der erste Release beginnt ohne vorhandenes Versions-Tag bei `1.0.0`; danach gelten SemVer-Bumps. Tags und GitHub Releases sind die Versionsquelle, die private `package.json` wird nicht bei jeder Veröffentlichung geändert.

Release-Läufe werden serialisiert und nicht während einer Veröffentlichung abgebrochen. Ein vor der Release-Erstellung überholter Commit erzeugt keinen Release; der neuere `main`-Lauf übernimmt die Änderungen. Ein bereits veröffentlichter Release wird auch dann deployt, wenn inzwischen ein reiner Dokumentations- oder Wartungscommit auf `main` liegt. Erst ein neuerer vollständig veröffentlichter Release verhindert das Deployment einer älteren Version, auch bei einer Wiederholung nur des Deploy-Jobs. Ein erneuter Lauf desselben Commits verwendet einen bereits vollständig veröffentlichten Release wieder.

Wenn eine GitHub-Veröffentlichung nach dem Anlegen des Tags scheitert, bleibt der Workflow ausdrücklich fehlerhaft. Vor dem erneuten Lauf den vorhandenen Release samt allen vier Assets (Cloudflare- und Sites-Archiv mit jeweils eigener Provenienz) vervollständigen; kein zusätzliches Versions-Tag erzeugen. Ein fehlender, als Entwurf gespeicherter oder unvollständiger Release wird nicht als Erfolg ausgegeben.

## Produktionsmigrationen, Wiederholung und Rollback

Der Deploy-Job wendet D1-Migrationen **vor** dem Worker-Upload an. Währenddessen
bedienen der bisherige Worker und sein Scheduled-Handler weiterhin Anfragen;
Schema und Code werden nicht gemeinsam atomar umgeschaltet. Neue Migrationen
müssen deshalb mit der noch aktiven Version und dem vorgesehenen Code-Rückweg
verträglich sein. Angewendete SQL-Dateien bleiben unverändert; jede Änderung
bekommt eine neue Drizzle-Migration.

Für inkompatible Änderungen mehrere Releases verwenden: zuerst das Schema
additiv erweitern, dann Daten mit geprüftem, wiederholbarem Backfill übernehmen
und Leser/Schreiber umstellen. Alte Spalten oder Tabellen erst in einer späteren,
gesondert geprüften Migration entfernen, wenn kein aktiver oder für Rollback
vorgesehener Code sie benötigt. Vor produktiven Datenänderungen eine geschützte,
geprüft wiederherstellbare Sicherung erstellen; eine nötige Schreibpause vorher
mit Zeitraum und Wiederaufnahme ankündigen.

Bei einem Fehler Schema und `d1_migrations` frisch prüfen. Bereits erfolgreiche
Migrationen bleiben angewandt, auch wenn der anschließende Code-Upload scheitert.
Die Historie nicht löschen und SQL nicht ungeprüft erneut ausführen. Bei
unbekanntem Ausgang oder abweichendem Schema den Lauf stoppen und den Bestand
klären. Nach behobenem Fehler denselben veröffentlichten Release-Lauf erneut
starten: er prüft Provenienz und Reihenfolge erneut, überspringt angewandte
Migrationen und verwendet unveränderte Archivbytes. Vorher tatsächlich aktive
Worker-Version, Secrets, Bindings und Wartungszustand prüfen. Ein neuerer
vollständig veröffentlichter Release hat weiterhin Vorrang.

Ein Code-Rollback ist nur mit dem aktuellen Schema und den vorhandenen Daten
zulässig; er setzt D1 und R2 nicht zurück. Der übliche Korrekturweg ist ein
geprüfter Forward-Fix über Main. Eine Rückkehr zu Sites folgt dem
[gesonderten Abgleichplan](domain-cutover.md#wiederherstellung-nach-dem-routingwechsel)
und der [Archiv-Wiederherstellung](sites-retirement.md#wiederherstellung-und-sichere-unterbrechung).
Ein Backup-Restore, der neue Schreibvorgänge verlieren würde, ist kein sicherer
Rollback. [D1-Migrationen](https://developers.cloudflare.com/d1/reference/migrations/),
[Worker-Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## Cloudflare-Produktion

`wrangler.jsonc` enthält den eigenen Zielaccount, den Worker `riparim`, die verifizierte D1-Datenbank `riparim-production` und den privaten R2-Bucket `riparim-evidence-production`. Vite übernimmt diese Konfiguration für Produktionsbuilds. Lokale Vorschauen verwenden isolierte Bindings; Produktionsressourcen bleiben mit `remote: false` vom lokalen Entwicklungsserver getrennt. Die generierte `dist/server/wrangler.json` wird unverändert aus dem Release-Archiv deployt.

D1 und R2 werden vor dem ersten Deployment angelegt und ihre exakten Bindings geprüft. Der Deploy-Aufruf deaktiviert Wranglers automatische Provisionierung mit `--experimental-provision=false`. Dadurch entfällt insbesondere die zusätzliche R2-Metadatenabfrage beim ersten Worker-Upload; der Deployment-Token benötigt keine R2-Lese- oder Objektrechte.

Das GitHub-Environment `production` erlaubt ausschließlich den Branch `main`. Darin werden zwei Secrets eingerichtet:

- `CLOUDFLARE_API_TOKEN`: separater Account-Token für automatisierte Deployments und D1-Migrationen. Für die erste Worker-Erstellung sind Workers Product Admin sowie D1 Write nötig; nach dem Bootstrap kann der Workers-Zugriff auf Editor für diesen Worker reduziert werden. Die aktiven Custom Domains benötigen zusätzlich `Workers Routes Write`, ausschließlich für die eigene Zone von `riparim.com`. Allgemeine DNS-, Billing-, R2-Objekt- und Token-Management-Rechte gehören nicht zum App-Deployment.
- `CLOUDFLARE_WORKER_SECRETS`: JSON mit mindestens `REVIEW_MODERATOR_EMAIL` sowie den benötigten Google-Schlüsseln, `SUPABASE_SECRET_KEY` für Benutzerverwaltung und bestätigte Benachrichtigungsempfänger, `RESEND_API_KEY` und `TRANSACTIONAL_EMAIL_FROM` für transaktionale Bewertungsnachrichten oder einmaligen Aktivierungswerten. Der Moderatorwert muss dem bestehenden Riparim-Admin entsprechen. Deployment-Tokens gehören nicht in dieses Laufzeit-JSON.

Die Secrets dürfen nicht als Repository-Secrets gespeichert werden: PR-Workflows erhalten keinen Zugriff auf das geschützte Produktions-Environment. Die Codex-MCP-Anmeldung bleibt davon getrennt. Anwendungsgeheimnisse werden mit `--secrets-file` gemeinsam mit dem Worker hochgeladen, kurzfristig in einer Datei mit Modus `0600` gehalten und anschließend entfernt. Eine spätere Veröffentlichung ohne neue Werte bewahrt bestehende Worker-Secrets.

Die Anwendung verarbeitet fällige Bewertungsnachrichten alle fünf Minuten über den Scheduled-Handler und den Cron aus `wrangler.jsonc`. Die Deployment-Prüfung stellt sicher, dass dieser Zeitplan im veröffentlichten Artefakt erhalten bleibt.

`SITE_ORIGIN=https://riparim.com` liegt als normale Variable in der Wrangler-Konfiguration. Ausschließlich Apex und www sind als aktivierte Custom Domains der eigenen Zone eingetragen; Preview-URLs bleiben deaktiviert. Der technische Workers-Host verwendet denselben Datenbestand. Die Deploy-Prüfung erzwingt diese Routinggrenzen und die unveränderte Konfiguration im Release-Archiv. Fehlende CI-Zugangsdaten lassen den Deploy-Job ausdrücklich scheitern. Lokale `wrangler deploy --dry-run`-Prüfungen validieren Paket und Bindings, aber keine Remote-Berechtigungen.

## Einmaliger Wechsel von Sites

Die [Datenübernahme](data-transfer-2026-10-04.md), [Produktionsumstellung](domain-cutover-2026-10-05.md) und [kontrollierte öffentliche Sites-Stilllegung](sites-retirement.md) sind abgeschlossen. D1-Daten einschließlich Auth-Konfiguration, Identitäten, Rollen, Sessions, Besitzrechten und Freigabestatus wurden abgeglichen; privates R2 und Migrationshistorie sind geprüft. Der eigene Worker ist der alleinige Writer. Die alte Site ist Owner-only und bleibt schreibgesperrt; ihre Daten, Versionen und gesicherten Archive werden gemäß dokumentierter Aufbewahrung erhalten. Eine leere neue Datenbank mit angewendeter Schema-Migration ist keine Übernahme bestehender Nutzerdaten.

Der erste Worker-Release erlaubt zunächst die Prüfung des Deployments. Anmeldung und Verwaltung benötigen die übernommene aktive `auth_settings`-Zeile und die zum bestehenden Supabase-Projekt gehörenden Werte. `REVIEW_MODERATOR_EMAIL` und `SUPABASE_SECRET_KEY` allein legen diese Konfiguration nicht an; eine ungeschützte Bootstrap-Route wird nicht bereitgestellt.

Die technische Abnahme umfasst tatsächliche E-Mail-/Google-Anmeldung, Verwaltung, private Belege und Werkstattsuche über die Produktionsdomain. Native ChatGPT-Konten benötigen für private Altbestände eine bestätigte Supabase-Verknüpfung; gleiche E-Mail-Adressen allein erlauben keine Zuordnung. Schema-/Datenänderungen werden durch einen Code-Rollback nicht automatisch zurückgesetzt. Für einen Fehler nach dem Wechsel bleibt der aktuelle eigene D1-/R2-Bestand maßgeblich; Rückübernahme und Wiederöffnung der alten Site verlangen den dokumentierten sicheren Abgleich.

Der eigene Worker entfernt eingehende `oai-authenticated-user-*`-Header. Diese können auf OpenAI Sites eine native Plattform-Identität darstellen, auf dem eigenen öffentlich erreichbaren Worker stammen sie vom Client und dürfen keine Anmeldung oder Adminrechte begründen. Supabase-Anmeldung und Session-Prüfung bleiben bestehen.

Der Gesamtabschluss der Produktionsumstellung steht im [Abschlussbericht](release-handover-2026-10-05.md). Die zugehörigen Arbeiten sind in [Issue #17](https://github.com/ramiz4/riparim/issues/17) verfolgt: [Datenübernahme #18](https://github.com/ramiz4/riparim/issues/18), anschließend [Domain-/Auth-Umstellung #19](https://github.com/ramiz4/riparim/issues/19) und nach abgenommener Umstellung sowie beendeter Rückfallphase [Sites-Stilllegung #20](https://github.com/ramiz4/riparim/issues/20).

Referenzen: [semantic-release](https://semantic-release.org/recipes/ci-configurations/github-actions/), [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), [GitHub Squash-Merges](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests), [Cloudflare CI](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Workers-Berechtigungen](https://developers.cloudflare.com/workers/authorization/workers/).

## Geprüftes Sites-Archiv für die Datenübernahme

CI baut beide Anbieterziele aus demselben geprüften Commit. Der GitHub Release
enthält neben dem regulären Cloudflare-Artefakt ein Sites-Archiv und eine eigene
Provenienzdatei mit Projekt-ID und SHA-256. Sites verwendet weiterhin den
Plattformadapter und logische DB-/BUCKET-Bindings; das eigene Cloudflare-Archiv
ist dafür ungeeignet. Die reguläre Veröffentlichung auf den eigenen Worker bleibt
automatisiert. Die einmalige Quellenveröffentlichung übernimmt ausschließlich
das unveränderte, geprüfte Sites-Release-Archiv. Die erforderliche Schreibpause,
geschützte Sicherung und Go/No-Go-Prüfung stehen in [data-transfer.md](data-transfer.md).
