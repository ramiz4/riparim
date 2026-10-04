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

Der automatisch bereitgestellte `GITHUB_TOKEN` erhält ausschließlich im Release-Job `contents: write`. Es werden keine npm-Pakete veröffentlicht, keine Release-Commits nach `main` geschrieben und keine zusätzlichen PATs benötigt. Der erste Release beginnt ohne vorhandenes Versions-Tag bei `1.0.0`; danach gelten SemVer-Bumps. Tags und GitHub Releases sind die Versionsquelle, die private `package.json` wird nicht bei jeder Veröffentlichung geändert.

Release-Läufe werden serialisiert und nicht während einer Veröffentlichung abgebrochen. Ein inzwischen überholter Commit erzeugt keinen Release; der neuere `main`-Lauf übernimmt die Änderungen. Ein erneuter Lauf desselben Commits verwendet einen bereits vollständig veröffentlichten Release wieder.

Wenn eine GitHub-Veröffentlichung nach dem Anlegen des Tags scheitert, bleibt der Workflow ausdrücklich fehlerhaft. Vor dem erneuten Lauf den vorhandenen Release samt beiden Assets vervollständigen; kein zusätzliches Versions-Tag erzeugen. Ein fehlender, als Entwurf gespeicherter oder unvollständiger Release wird nicht als Erfolg ausgegeben.

## Hosting-Grenze

Die bestehende öffentliche Site bleibt auf OpenAI Sites. Die hier verfügbare Sites-Anbindung bietet keinen dokumentierten Deploy-Zugang für GitHub Actions. Temporäre Sites-Git-Tokens dürfen nicht als GitHub Secrets gespeichert werden. Ein GitHub Release oder das Hochladen des Worker-Archivs aktualisiert deshalb die öffentliche Site noch nicht.

Für eine manuelle Veröffentlichung darf nur der vollständig veröffentlichte Release verwendet werden: Tag auf den Merge-Commit auflösen, Provenienz und Archiv-SHA-256 prüfen, diesen Quellstand über den Sites-Workflow veröffentlichen und den erfolgreichen Deployment-Status abwarten. Keine PR-Änderungen vorziehen.

Automatische Veröffentlichung benötigt einen separat geklärten, CI-fähigen Hosting-Zugang. Ein Umzug in einen eigenen Cloudflare-Account erfordert die bestehenden D1-/R2-Daten, Laufzeitkonfiguration und Domain-Zuordnung; diese Änderung ist nicht stillschweigend Teil einer Release-Konfiguration.

Referenzen: [semantic-release](https://semantic-release.org/recipes/ci-configurations/github-actions/), [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), [GitHub Squash-Merges](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests), [Sites-Leitfaden](https://learn.chatgpt.com/docs/sites).
