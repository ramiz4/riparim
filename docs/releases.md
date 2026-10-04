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

Release-Läufe werden serialisiert und nicht während einer Veröffentlichung abgebrochen. Ein inzwischen überholter Commit erzeugt keinen Release; der neuere `main`-Lauf übernimmt die Änderungen. Ein erneuter Lauf desselben Commits verwendet einen bereits vollständig veröffentlichten Release wieder.

Wenn eine GitHub-Veröffentlichung nach dem Anlegen des Tags scheitert, bleibt der Workflow ausdrücklich fehlerhaft. Vor dem erneuten Lauf den vorhandenen Release samt beiden Assets vervollständigen; kein zusätzliches Versions-Tag erzeugen. Ein fehlender, als Entwurf gespeicherter oder unvollständiger Release wird nicht als Erfolg ausgegeben.

## Cloudflare-Produktion

`wrangler.jsonc` enthält den eigenen Zielaccount, den Worker `riparim`, die verifizierte D1-Datenbank `riparim-production` und den privaten R2-Bucket `riparim-evidence-production`. Vite übernimmt diese Konfiguration für Produktionsbuilds. Lokale Vorschauen verwenden isolierte Bindings; Produktionsressourcen bleiben mit `remote: false` vom lokalen Entwicklungsserver getrennt. Die generierte `dist/server/wrangler.json` wird unverändert aus dem Release-Archiv deployt.

Das GitHub-Environment `production` erlaubt ausschließlich den Branch `main`. Darin werden zwei Secrets eingerichtet:

- `CLOUDFLARE_API_TOKEN`: separater Account-Token für automatisierte Deployments und D1-Migrationen. Für die erste Worker-Erstellung sind Workers Product Admin sowie D1 Write nötig; nach dem Bootstrap kann der Workers-Zugriff auf Editor für diesen Worker reduziert werden. Keine DNS-, Billing-, R2-Objekt- oder Token-Management-Rechte sind für diesen Workflow nötig.
- `CLOUDFLARE_WORKER_SECRETS`: JSON mit mindestens `REVIEW_MODERATOR_EMAIL` sowie den benötigten Google-Schlüsseln, `SUPABASE_SECRET_KEY` für die Benutzerverwaltung oder einmaligen Aktivierungswerten. Der Moderatorwert muss dem bestehenden Riparim-Admin entsprechen. Deployment-Tokens gehören nicht in dieses Laufzeit-JSON.

Die Secrets dürfen nicht als Repository-Secrets gespeichert werden: PR-Workflows erhalten keinen Zugriff auf das geschützte Produktions-Environment. Die Codex-MCP-Anmeldung bleibt davon getrennt. Anwendungsgeheimnisse werden mit `--secrets-file` gemeinsam mit dem Worker hochgeladen, kurzfristig in einer Datei mit Modus `0600` gehalten und anschließend entfernt. Eine spätere Veröffentlichung ohne neue Werte bewahrt bestehende Worker-Secrets.

`SITE_ORIGIN` liegt als normale Variable in der Wrangler-Konfiguration. Das erste Ziel ist die Workers-Adresse; Custom Domains und Routes werden durch diesen PR nicht umgestellt. Fehlende CI-Zugangsdaten lassen den Deploy-Job ausdrücklich scheitern. Lokale `wrangler deploy --dry-run`-Prüfungen validieren Paket und Bindings, aber keine Remote-Berechtigungen.

## Einmaliger Wechsel von Sites

Die bisherige Site bleibt bis zur abgeschlossenen Umstellung auf OpenAI Sites in Betrieb. Nach dem ersten geprüften Release muss die Datenübernahme separat abgeschlossen werden: D1-Daten einschließlich `auth_settings`, Sessions und Owner-Verknüpfungen sowie private R2-Belege übertragen, Migrationshistorie abgleichen, Laufzeitwerte übernehmen und Supabase-Redirects für das neue Ziel freigeben. Eine leere neue Datenbank mit angewendeter Schema-Migration ist keine Übernahme bestehender Nutzerdaten.

Vor dem Domainwechsel die Anmeldung, Moderation, privaten Belege und Werkstattsuche auf dem eigenen Worker prüfen. Erst anschließend `riparim.com` an den Worker anbinden und `SITE_ORIGIN` im nächsten geprüften Main-Release aktualisieren. Native ChatGPT-Konten müssen vor der Umstellung mit einem bestätigten Supabase-Zugang verknüpft sein; gleiche E-Mail-Adressen allein erlauben keine Zuordnung privater Belege. Die bisherige Site bleibt als Rückfalloption erhalten, bis eine gezielte Stilllegung beauftragt ist. Schema-/Datenänderungen werden durch einen Code-Rollback nicht automatisch zurückgesetzt.

Der eigene Worker entfernt eingehende `oai-authenticated-user-*`-Header. Diese können auf OpenAI Sites eine native Plattform-Identität darstellen, auf dem eigenen öffentlich erreichbaren Worker stammen sie vom Client und dürfen keine Anmeldung oder Adminrechte begründen. Supabase-Anmeldung und Session-Prüfung bleiben bestehen.

Referenzen: [semantic-release](https://semantic-release.org/recipes/ci-configurations/github-actions/), [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), [GitHub Squash-Merges](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests), [Cloudflare CI](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Workers-Berechtigungen](https://developers.cloudflare.com/workers/authorization/workers/).
