# CI-Leistung messen

Die Verifikation hat drei unabhängige Runner: `quality`, `node` und `workers`.
Der Node-Zweig baut einmal und prüft dieselben validierten Ausgaben in beiden
Integrationssuites. Das bisherige Gate `Tests, types, lint and build` wartet auf
alle Pflichtzweige. Die Release-Serialisierung umfasst weiterhin Verifikation,
Veröffentlichung und Deployment.

## Kontrollierter Vergleich

`Benchmark: CI performance` führt ausschließlich lokale Prüfungen, Builds und
Paketierung mit isolierten Testdaten aus. Der Workflow besitzt nur
`contents: read`, verwendet keine Produktionssecrets und startet keine
Veröffentlichung, Bereitstellung oder Live-Migration. Er hat einen eigenen
Concurrency-Schlüssel pro Run und bricht weder andere Samples noch normale CI ab.

Ein Sample prüft entweder die alte serielle Verifikation (`baseline`) auf einem
Runner oder die neue Verifikation (`candidate`) auf drei unabhängigen Runnern.
Ein Parallelvergleich innerhalb eines einzigen Runners wäre kein Vergleich der
tatsächlichen Jobarchitektur. Die Befehle stehen in
`scripts/ci-benchmark-lane.mjs`; die zentral registrierten Gruppen `core` und
`node` bleiben die Quelle der Suitelisten. Der Baselinelauf verwendet die
unveränderten Befehle seiner Quellrevision einschließlich der drei Node-Builds.
Der Harness startet den identischen `tests/run.mjs`-Entrypoint direkt mit Node:
npm-Test-Lifecycle-PATH würde die Cachehülle durch `node_modules/.bin/npm`
verdecken. Tests, Gruppen, Argumente und Suite-Parallelität bleiben identisch.
Die Instrumentierung zählt echte Next-CLI-Starts mit `build --webpack` über
einen ausschließlich im Benchmark eingesetzten Node-`--import`-Hook vor dem
Mainprogramm: Baseline drei, Kandidat eine. Next überschreibt `process.title`
vor dem Build und entfernt damit seine ursprüngliche Linux-Cmdline; periodisches
`/proc`-Sampling allein wäre für diese Zählung unzuverlässig.
Der tatsächliche Entrypoint `process.argv[1]` wird über `realpath` an das
installierte Next-Modul des gemessenen Checkouts gebunden. Symlinks der
Release-Source-Fixture bleiben derselbe Modulpfad; fremde oder verschachtelte
Fake-Builds werden nicht mitgezählt. Launchlogs gehören jeweils einer
Profilerphase. Mehrfach geladene Hooks aus Source und Harness werden über PID
und `performance.timeOrigin` dedupliziert; Workerthreads zählen nicht erneut.
Bestehende `NODE_OPTIONS` bleiben erhalten. Der Hook wird nur in die Childumgebung
des Benchmarkprofilers ergänzt; normale CI und Produktion erhalten ihn nicht.
Die bereinigte Zielinstallation und ihre eingeschränkten Runtimeprüfungen
übernehmen keine Benchmark-`NODE_OPTIONS`.
Dadurch werden auch Builds erfasst, deren ältere Tests ihre stdout-Ausgabe
verwerfen; Bannerzählungen im Log bleiben eine getrennte Diagnosegröße.

Beide Varianten verwenden `ubuntu-24.04`, Node **24.21.0** und Go **1.27.1**.
Go wird nur für Baseline und `quality` eingerichtet; dort laufen die echten
Email-Templateprüfungen. Alle Installationen nutzen den gelockten Installer mit
`HUSKY=0`. Der Hookvertrag selbst bleibt Teil der allgemeinen Tests.

Für Issue #189 ist die Baseline
`1648f6b8bc780fce820fd1d937774cf3231248e1`. Der Kandidat wird auf eine genaue
Commit-SHA eingefroren. `sample.json` protokolliert Quell- und Harnessrevision,
Node/npm/Go-Versionen, Runnerimage samt Imageversion, Architektur, Cache-Key und
Cachehit. Die Harnessdateien und Messausgaben liegen in einem zweiten Checkout;
sie verändern weder den gemessenen Quellbaum noch dessen Buildreceipt.
Die Childcommands erhalten ausschließlich für ihre SHA-Bindung
`GITHUB_SHA=sourceRevision`. Die echte Harness-SHA bleibt separat in den
Metadaten erhalten; Event und Ref werden nicht verändert. Dadurch behalten die
Paketierer ihren vollständigen Clean-Source-/Commitvertrag und prüfen die
tatsächlich ausgecheckte Messrevision statt des PR-Merge-/Harnesscommits.
CPU-Modell, logische CPUs, `availableParallelism()` und Gesamtspeicher werden
ebenfalls erfasst. Jede Lane und jeder Sample muss dieselben positiven,
ganzzahligen CPU-/Parallelitätskapazitäten besitzen. Speicherkapazität wird als
nächste ganze GiB-Klasse verglichen; die tatsächlich gemeldeten Bytes müssen
positiv und endlich sein und dürfen höchstens **0,1 %** vom Referenzrunner
abweichen. Bei der 16-GiB-Klasse sind das ungefähr 16 MiB. So bleiben wenige
kernelreservierte Seiten, etwa ein beobachteter Unterschied von 4096 Bytes,
zulässig; 4→2 CPUs, 16→8 GiB oder wesentliche Änderungen innerhalb einer Klasse
werden abgewiesen. Die Prüfung gilt für alle drei Kandidatenlanes und für die
gesamte Serie, einschließlich der erneuten Offlineauswertung.
Tatsächliche Bytes, CPU-Modelle und Imageversionen bleiben im Rohinventar
erhalten. Standard-Hosted-Runner können unterschiedliche CPU-Modelle verwenden;
deren Identität wird nicht versprochen. Imageklasse und Node-/npm-/Go-Versionen
müssen weiter übereinstimmen. Diese Toleranz ist eine Validierungsregel der
Offlineauswertung und verändert weder Messbefehle noch gemeldete Rohwerte.

`inputInventory` erfasst alle getrackten Dateien mit SHA-256. Ein separates
Anwendungsinventar umfasst Anwendung, Komponenten, Bibliotheken, Assets,
Katalogdaten, Datenbank, Migrationen, Typen, Vendor-Quellen und die eingecheckten
Laufzeit-/Buildkonfigurationen sowie den Lockfile. Bei `package.json` werden nur
die npm-Skripte aus diesem Inventar entfernt. Katalog- und Migrationsdigests
werden zusätzlich einzeln verglichen. Änderungen in `scripts/`, `tests/`,
`.github/` und Dokumentation sind im vollständigen Inventar sichtbar und müssen
als Build-/Test-/Orchestrierungsänderungen im Vergleich erklärt werden;
insbesondere sind runtime-relevante Skriptänderungen vor dem Vergleich separat
zu prüfen. Das vollständige `sourceDigest` verwendet denselben Vertrag wie das
Node-Receipt und darf zwischen verschiedenen Workflowrevisionen abweichen.
Ein Receipt muss immer zu seiner eigenen Quellrevision passen.

## Kalter und warmer Paketcache

Jeder frisch bereitgestellte Hosted Runner verwendet das dedizierte Verzeichnis
`${runner.temp}/ci-performance-npm`. Sein ausgewerteter Pfad bleibt über Prime-,
Cold- und Warm-Runs identisch: `actions/cache` bindet die Cacheversion auch an
den Pfad und die Kompression. Isolation entsteht durch getrennte Runner und den
Experiment-Key. Vor jedem Restore/Install wird nachgewiesen, dass das Verzeichnis
leer ist; vorhandene Inhalte werden nicht gelöscht oder stillschweigend benutzt.
`setup-node` aktiviert kein npm-Caching.
Der Pfad wird im Initialisierungsschritt mit dessen `runner.temp`-Kontext
aufgelöst und über `GITHUB_ENV` an Restore, Messung und Save weitergegeben.

- `cold`: kein Restore und kein Save; kein Fallback auf einen vorhandenen Cache.
- `prime`: einmal die vollständige Baseline ausführen und danach den isolierten
  Cache unter dem Experiment-Key speichern. Dieser Lauf zählt nicht zur Messung.
- `warm`: ausschließlich diesen exakten Key wiederherstellen;
  `fail-on-cache-miss: true` und `cache-hit == true` sind Pflicht. Ein Cachemiss
  wird als ungültiger Lauf beendet und nicht als Warmlauf ausgewertet.

Der Key enthält Experiment, OS/Architektur, genaue Node-/Go-Version und
`package-lock.json`-Hash. Beide Quellen müssen denselben Lockfile verwenden.
Es werden ausschließlich npm-Paketdaten geteilt, keine `node_modules`,
Next-/Vite-Ausgaben oder Go-Buildcaches. Andere Projektcaches werden nicht gelöscht.

Die echte Node-Zielinstallation behält absichtlich nur `PATH`, `HOME` und
`TMPDIR`. Eine Benchmark-PATH-Hülle für denselben npm-CLI pinnt deshalb `--cache`
am Prozessstart und protokolliert den Cachepfad auch bei diesen bereinigten
Umgebungen. Die Anwendung und der Installer selbst werden dafür nicht verändert.
`HOME` bleibt unverändert. `/proc` überprüft die Cacheargumente beziehungsweise
Cacheumgebung der beobachteten npm-/npx-Prozesse. Ein abweichender Cachepfad
beendet den Sample. Baseline und Node-Kandidat müssen mindestens eine echte
Zielinstallation mit bereinigter Umgebung nachweisen.
Rootinstallationen verwenden den globalen npm-CLI des gepinnten Node-Runtimes.
Zielinstallationen mit bereinigter Umgebung verwenden ausdrücklich den
gelockten `source/node_modules/npm/bin/npm-cli.js`, den auch der normale
npm-Test-Lifecycle bereitstellt. CLI-Pfade und beide tatsächlichen npm-Versionen
werden protokolliert und über die Varianten verglichen.

## Vor dem Merge starten

GitHub verlangt für `workflow_dispatch` einen Workflow auf dem Defaultbranch.
Deshalb unterstützt dieser Workflow zusätzlich ausdrücklich ausgelöste
`pull_request: labeled`-Events auf PRs desselben Repositories. Andere Labels
starten keine Benchmarkjobs. Die fünf Benchmarklabels sind:

- `ci-performance-prime`
- `ci-performance-baseline-cold`
- `ci-performance-candidate-cold`
- `ci-performance-baseline-warm`
- `ci-performance-candidate-warm`

Das Hinzufügen eines Labels erzeugt einen unabhängigen Run. Nach dessen Start
das Label entfernen, damit es erneut hinzugefügt werden kann. Der Experiment-Key
enthält PR-Nummer und eingefrorene PR-Head-SHA. Eine neue Kandidatenrevision hat
dadurch einen eigenen Cache und eine eigene Messserie.

Zuerst einmal `prime` erfolgreich ausführen. Anschließend fünf Cold-Paare und
zehn Warm-Paare starten; pro Paar zuerst Baseline/Kandidat, im nächsten Paar
Kandidat/Baseline. Die Startreihenfolge und Run-IDs festhalten. Beide Quellen
während der Serie unverändert lassen; andere CI-Last und Runnerimagewechsel
ebenfalls protokollieren. Der Workflow startet maximal drei Runner gleichzeitig
pro Sample. Die Auslösung mehrerer Samples muss zusätzlich begrenzt werden;
serielle Paare vermeiden selbst erzeugte Queuewartezeiten.

Nach dem Merge kann derselbe Ablauf per `workflow_dispatch` mit den Inputs
`variant`, `source-ref`, `cache-state` und `experiment` gestartet werden.
`source-ref` muss eine genaue 40-stellige Commit-SHA sein. Die Primevariante ist
immer `baseline`. Nicht die produktive `Release: Publish and deploy`-Pipeline für Messungen auslösen.

## Read-only-Auswertung

Mit authentifiziertem `gh` und Leserechten auf Actions:

```sh
node scripts/ci-performance.mjs collect ramiz4/riparim .agents/ci-performance-results RUN_ID_1 RUN_ID_2
node scripts/ci-performance.mjs report .agents/ci-performance-results/samples.json .agents/ci-performance-results/report.json
```

`collect` liest Workflow-/Jobmetadaten, lädt ausschließlich Messartefakte herunter
und bewahrt die REST-Rohdaten neben den unveränderten Logs und Manifesten.
Es veröffentlicht nichts und verändert keine Labels oder Runs. Die Auswertung
verlangt identische Anwendung/Katalog/Migrationen, Runtimeversionen, Runnerklasse,
Experiment und Cache-Key sowie eine einheitliche Quellrevision pro Variante.
Duplizierte Run-IDs werden abgewiesen. Artefakte werden ausschließlich über
`ci-performance-RUN_ID-RUN_ATTEMPT-*` aus dem ausgewerteten Versuch geladen.
Jede Erhebung erhält ein eigenes Versuchverzeichnis; ältere Artefakte werden
nicht mit dem aktuellen Versuch vermischt. Setup-/Cachefehler, unvollständige
oder gemischte Metadaten, abgebrochene Jobs und Retries stehen mit Gründen und
Rohdatenpfad in `invalid-samples.json` sowie im Bericht. Sie stoppen die Erhebung
der übrigen Runs nicht und fließen nicht in Erfolgsquantile ein. Teilwiederholungen
mit fehlenden aktuellen Lane-Artefakten sind ungültige Benchmark-Retries;
frühere Producer werden für diese Messung nicht als neue Samples ausgegeben.

Erfolgsquantile zählen ausschließlich erfolgreiche Erstversuche. Fehler und
Wiederholungen werden getrennt ausgewiesen. Mindestens fünf erfolgreiche Cold-
und zehn erfolgreiche Warm-Samples pro Variante sind erforderlich; weniger
Samples liefern einen ausdrücklich unvollständigen Bericht. Median = mittlerer
Wert beziehungsweise Mittel der beiden mittleren Werte; P95 = Nearest Rank.

Die Zeitgrößen beziehen sich auf die tatsächlich ausgeführten `Benchmark`-Jobs:

| Größe                   | Definition                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Anfängliche Wartezeit   | Run-Erstellung bis zum ersten Verifikationsjobstart; enthält auch den kurzen Harness-Planjob.       |
| Aktiver kritischer Pfad | Maximum der aktiven Producer-Laufzeiten plus aktive Laufzeit des nachfolgenden Kandidaten-Gates.    |
| Ausführungsspanne       | Erster Jobstart bis zum letzten aktiven Jobabschluss; umfasst versetzte Runnerstarts.               |
| Schedulerverzögerung    | Ausführungsspanne minus aktiver kritischer Pfad.                                                    |
| Inter-job-Idle          | Summe der Intervalle ohne irgendeinen aktiven Verifikationsjob.                                     |
| End-to-end              | Run-Erstellung bis zum letzten aktiven Verifikationsjobabschluss; nicht `updated_at`.               |
| Runnersekunden          | Summe aller aktiven Verifikationsjoblaufzeiten einschließlich Setup, Cache und Messartefakt-Upload. |

Der Kandidat besitzt denselben zusätzlichen Checkout-/Gate-Runner wie die
normale CI; seine aktive Zeit, Runnersekunden und Zwischenwartezeit zählen mit.
Das Matrix-Gesamtergebnis ist nur dann erfolgreich, wenn jede Lane erfolgreich
war; der Gatejob prüft dies mit dem normalen `verify-ci-gate.mjs`.
Plan- und Auswertungsarbeit ist Harnessaufwand. Die Messartefakt-Uploads sind in
den Jobzeiten enthalten. Einzelne Commands und Suites stehen in
`phases.jsonl`; `subphases` übernimmt `[ci-phase]`-JSON aus dem Renderer und den
Node-Integrationssuites. Baselinequellen ohne Subphaseninstrumentierung haben
weiterhin ihre vollständigen Command-/Suitelaufzeiten. Netzwerk, Installation,
HTTP, Rendering und Shutdown dürfen nur anhand vorhandener Phasen verändert
werden. Überlappende Phasen/Suites nicht zur kritischen Pfadzeit addieren.

Speicher wird auf Linux über `/proc` alle 100 ms als **Summe des RSS des
Command-Prozessbaums** gemessen, einschließlich beobachteter detached/reparented
Kinder mit PID-/Startzeitidentität. Dieser beobachtete Peak kann kurze Spitzen
verpassen und gemeinsam verwendete Seiten mehrfach zählen. Er ist kein
Einzelprozess-MaxRSS aus GNU time und keine exakte Containergrenze. Fehler der
Ressourcenmessung machen einen Sample ungültig. Auf macOS meldet der Profiler
ausdrücklich, dass diese Messung nicht verfügbar ist.

Die Abnahme verlangt mindestens 35 % kürzeren Median des aktiven Pfads,
ebenfalls verbesserten P95 und höchstens 125 % mediane Runnersekunden.
Warmcache-Betriebsbudget: P50 ≤240 s, P95 ≤300 s. Der reale Releasepfad mit
Cloudflare-Deployment besitzt zusätzlich ein Ziel von P50 ≤360 s ohne
anfängliche Queue-/Approvalwartezeit; dieses Read-only-Benchmark deployt nicht
und kann dieses Ziel nur durch spätere tatsächliche Releasebeobachtungen prüfen.
Zielabweichungen und Folgemaßnahmen vor Issue-Abschluss ausdrücklich festhalten.
Auch 30 kontrollierte Erfolgsruns belegen keine allgemeine Flake-Garantie.

## Workflow- und Laufnamen

Workflow-Anzeigenamen folgen `Kategorie: Zweck`: eine kurze, eindeutige
englische Bezeichnung mit ASCII-Zeichen. Der Kategorienpräfix macht verwandte
Aufgabenbereiche in der Actions-Liste erkennbar; der Zweck benennt ihre Aufgabe. Dateinamen bleiben
stabile technische Identitäten für API-Aufrufe, Monitoring und wiederverwendbare
Workflows.

| Datei                          | Anzeigename                   |
| ------------------------------ | ----------------------------- |
| `ci.yml`                       | `CI: Verify and build`        |
| `conventional-pr.yml`          | `CI: Check PR title`          |
| `release.yml`                  | `Release: Publish and deploy` |
| `auth-backup.yml`              | `Backup: Supabase Auth`       |
| `platform-backup.yml`          | `Backup: Platform`            |
| `ci-performance-benchmark.yml` | `Benchmark: CI performance`   |

`run-name` ergänzt den Kontext des einzelnen Laufs: CI und Titelprüfung zeigen
PR-Nummer und Titel; Backups zeigen Branch sowie `scheduled` oder `manual`;
Benchmarks zeigen Variante/Cachezustand beziehungsweise das auslösende Label und
PR-Nummer oder Experiment. Release behält GitHubs Ereignisstandard, den
Commitbetreff, damit die zugrunde liegende Änderung in der Laufliste sichtbar ist.

Jobnamen mit externen Verträgen bleiben exakt erhalten:
`Tests, types, lint and build`, `Conventional PR title` und der Main-Aufrufer
`Verify merged main`. Damit bleibt auch der vom Nodeinstaller geprüfte Name
`Verify merged main / Tests, types, lint and build` erhalten. Die gespeicherten
Monitorbezeichnungen `Supabase Auth Backup` und `Platform Backup` bleiben stabile
logische Identitäten; die Backup-Workflows werden über ihre Dateipfade gelesen.
Eine Änderung des Anzeigenamens benötigt keine Migration des Monitorzustands.

`tests/ci-workflow.test.mjs` prüft alle sechs Namen, deren Eindeutigkeit,
kontextbezogene Laufnamen sowie die bisherigen Trigger und externen Checknamen.
Die Benennungskonvention ist eine Repositoryentscheidung; GitHub stellt die
getrennten Felder [`name` und `run-name`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#name)
bereit und unterstützt in Laufnamen die Kontexte `github` und `inputs`.

## Primärquellen

Der Quality-Zweig validiert alle `.github/workflows/*.yml` semantisch mit dem
offiziellen, über SHA-256 gepinnten actionlint **1.7.12**. Das prüft unter anderem
Ausdruckskontexte und Job-/Stepverträge. `-shellcheck= -pyflakes=` deaktiviert nur
die optionalen zusätzlichen Shell-/Pythonintegrationen; die Workflowprüfung
bleibt vollständig aktiv und benötigt keine weitere App-Abhängigkeit.
Der Kandidatenbenchmark ruft denselben `scripts/check-workflows.sh`-Entrypoint
nach der Installation auf und zählt Download sowie Prüfung als Phase
`workflow-lint` vollständig mit. Die Baselinerevision besitzt diese zusätzliche
Prüfung noch nicht; ihre ursprüngliche Prüfmenge bleibt im Vergleich erhalten.
Der Kandidat erweitert den Prüfvertrag, ohne Anwendungseingaben zu verändern.

- [GitHub: Workflow-Events und Dispatch-Voraussetzungen](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [GitHub: Workflow-Jobmetadaten und Versuch-API](https://docs.github.com/en/rest/actions/workflow-jobs)
- [actions/cache: exaktes Restore und separater Save](https://github.com/actions/cache)
- [actions/cache: Cacheversion und Pfadbindung](https://github.com/actions/cache#cache-version)
- [actions/setup-node: Paketcacheoptionen](https://github.com/actions/setup-node)
- [actionlint: gepinnte Version und semantische Workflowprüfung](https://github.com/rhysd/actionlint/blob/v1.7.12/docs/usage.md)

## Ergebnis vom 14. Oktober 2026

Gemessener Kandidat `a60aaa387fbe058cc537dd884ecb84b34614c821`, Baseline
`1648f6b8bc780fce820fd1d937774cf3231248e1`. Alle 423 Anwendungseingaben,
Katalog, Migrationen und Lockfile stimmen überein. Ubuntu 24.04, vier CPUs,
16-GiB-Klasse, Node 24.21.0, Go 1.27.1, npm 11.19.0 und Target-npm 11.21.0.

| Paketcache | Erfolgreiche Paare | Aktiver Pfad P50 vorher → nachher | P95 vorher → nachher | P50 Runnersekunden vorher → nachher | Verkürzung |
| ---------- | -----------------: | --------------------------------: | -------------------: | ----------------------------------: | ---------: |
| Kalt       |                  5 |                       475 → 212 s |          484 → 226 s |                         475 → 520 s |     55,4 % |
| Warm       |                 10 |                     423,5 → 217 s |          474 → 233 s |                     423,5 → 493,5 s |     48,8 % |

Alle 30 ausgewerteten Erstversuche bestanden; keine Fehler, ungültigen Samples
oder Retries. Prime ist ausgeschlossen. Sämtliche Warm-Lanes trafen den exakten
Cache; Kaltläufe restaurierten keinen Cache. Echte Next-Starts: Baseline drei,
Kandidat einer. Gesamtcheck und alle Runnerkosten sind enthalten. Runnerzeit
steigt um 9,5 % kalt beziehungsweise 16,5 % warm und bleibt unter 25 %.
Warm-P50/P95 bleiben unter 240/300 Sekunden. Damit sind alle Messziele erreicht.

Der Nutzer verlangte während der Messserie ausdrücklich den Abschluss. Es wurden
keine zusätzlichen Versuche gestartet; die bereits beauftragten letzten Läufe
schlossen während der finalen Prüfung ab. Die vollständige ursprüngliche
Stichprobe liegt damit vor. Kleine Stichproben begründen weiterhin keine
allgemeine Flake-Garantie.

Prime und das erste Kaltpaar starteten gleichzeitig; spätere Samples liefen in
begrenzten Gruppen. Zusätzliche Runnerlast und Wartezeiten sind dokumentiert.
Die Images wechselten zwischen `20261004.327.1` und `20261012.334.1`, CPUmodelle
variieren. Das ist ein Vergleich derselben dokumentierten Runnerklasse,
kein Vergleich byteidentischer VM-Images. Rohkapazitäten und Versionen bleiben
im Datensatz erhalten. Die Hooks und RSS-Beobachter laufen bei beiden Varianten;
der Kandidat enthält zusätzlich neue Regressionstests und den Workflowcheck.

Run-Links, Digests, Kapazitäten, vollständige Laufzeiten und der reproduzierbare
Bericht stehen in [ci-performance-results.json](ci-performance-results.json).
Die Actions-Messartefakte enthalten originale Logs und Phasen. Der abgewiesene
Workflow-Definitionslauf [38549303157](https://github.com/ramiz4/riparim/actions/runs/38549303157)
liegt vor der gültigen Messserie und zählt ausdrücklich nicht als Sample.
Die spätere Kapazitäts-/Metadatenkorrektur ist eine Offlinevalidierung und
verändert keine gemessenen Programme oder Zeiten. Der reale Releasepfad wurde
für den Benchmark nicht bereitgestellt; für dessen neue Produktions-P50 liegt
noch keine ausreichende Stichprobe vor.
