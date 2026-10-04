# Mitarbeit an Riparim

## Git: Haupt-Checkout und Aufgaben-Worktrees

Der primäre Git-Worktree bleibt auf `main` und enthält keine Aufgabenänderungen.
Jede neue Agent-Aufgabe erhält einen separaten Worktree und einen neuen
`codex/<aufgabe>`-Branch. Fortsetzungen verwenden die bestehende Aufgabenisolation.

Vor der Erstellung muss der Agent folgende Bedingungen herstellen:

1. Mit `git worktree list --porcelain` den primären Checkout identifizieren;
   nicht den aktuellen Pfad als Haupt-Checkout voraussetzen. Laufende Bearbeitung
   durch andere Agents zuerst koordinieren; Synchronisierung nicht parallel ausführen.
2. Dort `git status` prüfen. Arbeitsbaum und Index müssen sauber sein, einschließlich
   unversionierter Dateien; es darf kein Merge, Rebase oder Cherry-Pick laufen.
3. `git fetch origin --prune --tags` erfolgreich ausführen. Bei einem sauberen,
   derzeit unbenutzten Haupt-Checkout auf einem anderen Branch mit `git switch main`
   zurückkehren. Fehlt `main`, darf er von `origin/main` angelegt werden, sofern
   `main` in keinem anderen Worktree ausgecheckt ist.
4. `main` mit `git merge --ff-only origin/main` aktualisieren und dessen Upstream
   auf `origin/main` setzen. Danach muss `HEAD` exakt `origin/main` entsprechen.
   Lokale Zusatzcommits und Divergenz sind ein Stop-Kriterium, auch wenn ein Merge
   mit `--ff-only` bei einem vorausliegenden Branch erfolgreich zurückkehrt.
5. Einen noch unbenutzten Worktree-Pfad außerhalb des Haupt-Checkouts und einen
   neuen Branch wählen. Beide von diesem geprüften `main` erstellen. Im neuen
   Worktree Branch und Basis-Commit prüfen, bevor die eigentliche Arbeit beginnt.

Wenn eine Bedingung scheitert, den Start abbrechen und den konkreten Zustand
melden. Fremde Arbeit bleibt erhalten; automatisches Stashing, Reset, Clean oder
erzwungenes Auschecken löst diesen Konflikt nicht. Ein von der Umgebung bereits
bereitgestellter Aufgaben-Worktree muss dieselben Bedingungen erfüllen.

Nach der Zustandsprüfung kann die folgende Vorlage verwendet werden. Die drei
Variablen durch ermittelte absolute Pfade und einen eindeutigen Branchnamen ersetzen.
Die Vorlage setzt einen vorhandenen `main` und einen Haupt-Checkout ohne laufende
Git-Operation voraus; bei jedem Fehler endet sie vor weiteren Schritten.

```sh
(
  set -eu
  primary_checkout='/absoluter/pfad/zum/haupt-checkout'
  task_worktree='/absoluter/pfad/zum/neuen/aufgaben-worktree'
  task_branch='codex/kurze-aufgabe'

  test -z "$(git -C "$primary_checkout" status --porcelain --untracked-files=all)"
  git -C "$primary_checkout" fetch origin --prune --tags
  git -C "$primary_checkout" switch main
  git -C "$primary_checkout" merge --ff-only origin/main
  git -C "$primary_checkout" branch --set-upstream-to=origin/main main
  test "$(git -C "$primary_checkout" branch --show-current)" = main
  task_base=$(git -C "$primary_checkout" rev-parse main)
  test "$task_base" = "$(git -C "$primary_checkout" rev-parse origin/main)"
  test "$task_base" = "$(git -C "$primary_checkout" rev-parse HEAD)"
  test -z "$(git -C "$primary_checkout" status --porcelain --untracked-files=all)"
  test ! -e "$task_worktree"
  git -C "$primary_checkout" worktree add -b "$task_branch" "$task_worktree" main
  test "$(git -C "$task_worktree" branch --show-current)" = "$task_branch"
  test "$(git -C "$task_worktree" rev-parse HEAD)" = "$task_base"
)
```

Anschließend im Aufgaben-Worktree arbeiten. Installationen, Build-Ausgaben,
lokale Datenbanken und Testzustände bleiben dort isoliert; gemeinsam verwendete
Git-Refs und Remotes erfordern weiterhin Koordination. Für spätere Aktualisierungen
des Aufgabenbranches `origin/main` frisch holen und nur im Aufgaben-Worktree
integrieren. Eine gemeinsam verwendete Branch-Historie bleibt erhalten.

## Conventional Commits

Alle neuen Aufgabencommits und PR-Titel folgen
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
Verwende englische, kurze Beschreibungen und kleingeschriebene Typen:

```text
<type>(<optionaler scope>): <beschreibung>
```

Typen: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`,
`style`, `revert`. Ein Commit behandelt eine zusammenhängende Änderung.

```text
feat(catalogue): add service filters
fix(auth): validate callback redirect targets
docs(agents): define isolated task workflow
```

Inkompatible Änderungen werden mit `!` markiert und erhalten einen
`BREAKING CHANGE:`-Footer mit Auswirkungen und Migrationsweg, zum Beispiel:

```text
feat(api)!: require verified workshop ownership

BREAKING CHANGE: Workshop updates require verified ownership. Existing owners
must complete verification before submitting further updates.
```

Bei Squash-Merges muss die tatsächlich nach `main` übernommene Commit-Nachricht
dieser Konvention folgen und sämtliche Breaking-Change-Hinweise enthalten.
Bei mehreren unabhängigen Änderungen separate PRs bevorzugen.

## Semantic Release

Semantic Release ist der verbindliche Zielprozess für Versionen, Release Notes
und Release-Tags. Die technische Quelle der Wahrheit sind die eingecheckte
Release-Konfiguration und der CI-Workflow. Diese Richtlinie allein aktiviert
keine Release-Automatisierung.

- Releases laufen ausschließlich in CI auf `main` nach erfolgreichen
  Qualitätsprüfungen; PRs und Aufgabenbranches veröffentlichen keine Releases.
- Commit-Analyzer und Release-Notes-Generator müssen beide das Preset
  `conventionalcommits` verwenden und Breaking Changes konsistent erkennen.
- `fix` führt zu Patch, `feat` zu Minor, Breaking Changes zu Major;
  `perf` soll Patch auslösen. Weitere Typen lösen ohne Breaking Change keine
  Veröffentlichung aus. Abweichungen müssen in der Release-Konfiguration begründet sein.
- Versionen, Release-Tags und generierte Release Notes werden vom Release-Prozess
  verwaltet. Aufgaben ändern sie nicht manuell und führen keine lokalen Live-Releases aus.
- Die Anwendung bleibt ein privates Projekt; eine Veröffentlichung als npm-Paket
  gehört nicht zum Release-Prozess. CI-Zugangsdaten bleiben in geschützten Secrets;
  Release-Jobs erhalten nur die benötigten Berechtigungen und laufen serialisiert.
- Der Workflow `Release` veröffentlicht das geprüfte GitHub-Release-Artefakt auf
  dem eigenen Cloudflare-Worker. Deployment, Produktionsmigrationen und die
  gesonderte Daten-/Domainumstellung richten sich nach
  [docs/releases.md](docs/releases.md). Offene PRs werden nicht veröffentlicht.

Referenz: [Semantic Release](https://semantic-release.org/intro/) und
[Konfiguration](https://semantic-release.org/usage/configuration/).

## Qualität und Übergabe

Für AI Agents gelten die Entwurfsprinzipien, Datenschutzregeln und
Abschlussbedingungen in [AGENTS.md](AGENTS.md). Installation und lokale Prüfungen
stehen in [README.md](README.md); die verpflichtenden Codeprüfungen definiert
[der CI-Workflow](.github/workflows/ci.yml). Beschreibe im PR das resultierende
Verhalten, durchgeführte Prüfungen und nötige Migrationen.
