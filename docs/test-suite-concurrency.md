# Begrenzte Test-Parallelität (Issue 91)

`npm test` prüft zuerst den i18n-Vertrag, baut Node einmal unter derselben
Prozessgruppenverwaltung und führt anschließend jede registrierte Suite in
einem eigenen Node-Prozess aus. Beide Node-Integrationssuites verwenden
validierte Kopien dieses Builds in getrennten Fixtures.

`npm test -- --group core` führt alle übrigen Suites ohne Node-Build aus;
`npm test -- --group node` prüft die zwei Node-Integrationssuites. Ein explizites
`RIPARIM_NODE_PREBUILT` muss zu den aktuellen Source-/Outputdigests passen.
Die zentrale Registrierung erzwingt vollständige, disjunkte Gruppen; der
Standard ohne Gruppe bleibt die vollständige Prüfung. Ablauf und kontrollierte
Messung stehen in [ci-performance.md](ci-performance.md). Auf Linux/macOS/WSL ist die
Standardparallelität vier. `TEST_CONCURRENCY=1 npm test` führt dieselben Suites
seriell aus; `2`, `3` oder `4` erlauben entsprechend viele gleichzeitige Suites.
Native Windows-Ausführung wird vor jeder Suite und jeder Änderung am
Testverzeichnis mit einer WSL-Empfehlung abgelehnt. POSIX-Prozessgruppen sichern
die Bereinigung auch dann, wenn ein beendeter Node-Prozess Nachfahren mit offenen
Ausgabekanälen hinterlässt. `taskkill` kann diesen Fall nach Ende des Elternprozesses
nicht zuverlässig abdecken; deshalb gibt es keinen nativen Windows-Testpfad.

## Geprüfte Ressourcen

- Jede Suite schreibt ausschließlich in eigene Unterverzeichnisse oder eindeutig
  benannte Dateien unter `.test-runtime`; der Runner allein entfernt dessen Wurzel.
  `repository-policy.test.mjs` entfernt nur sein eigenes Unterverzeichnis.
- SQLite-Fixtures verwenden `:memory:`. Import-, Datenübernahme-, Release-,
  Mail-Export- und Lock-Fixtures verwenden eigene `mkdtemp`-Verzeichnisse.
  Statische Katalogdaten, Migrationen und Quellen werden lediglich gelesen.
- Miniflare-Fixtures wählen freie lokale Ports und isolierte Laufzeitdaten.
  Es gibt keine gemeinsame Testdatenbank und keinen festen Suite-Port.
- Globales DOM, Provider-Mocks und React-Zustand sind pro Node-Prozess isoliert.
  Echte Go-Mailrenderings teilen lediglich Gos sperrgeschützten Buildcache.
  Keine Suite benötigt das Ergebnis einer vorherigen Suite.

## Fehler, Signale und Diagnose

Jede Ausgabezeile und Start-/Endmeldung trägt den Dateinamen der Suite. Eine
fehlgeschlagene Suite stoppt die Warteschlange und laufende Geschwister. SIGINT
und SIGTERM liefern 130 beziehungsweise 143. Linux/macOS-Suites besitzen eigene
Prozessgruppen: SIGTERM erreicht auch Node-, Go-, esbuild- und workerd-Nachfahren;
noch laufende Gruppen erhalten nach 500 ms SIGKILL. Der Erfolgspfad wartet nicht
500 ms, wenn die Gruppe bereits verschwunden ist. Auch verbliebene Nachfahren
eines erfolgreich beendeten Node-Prozesses werden bereinigt. `.test-runtime`
wird erst nach Prozessende und geschlossenen Ausgabekanälen entfernt.

Die Runner-Regression prüft Parallelitätsgrenze, den seriellen Modus, alle
Suite-Starts, die i18n-Sperre, zugeordnete Logs, Fehler, beide Signale und auch
Nachfahren, die SIGTERM ignorieren. Sie verwendet eigene temporäre Verzeichnisse
und einen Handshake statt Zeitannahmen zur Prüfung gleichzeitiger Starts.
Ein isolierter Kindprozess simuliert zusätzlich `process.platform = 'win32'`
und prüft den sofortigen Fehler, fehlende Suite-Starts und das unveränderte
Testverzeichnis. Diese Plattform-Vertragsprüfung ist kein nativer Windows-Test.

## Messung

[Actions-Lauf 38096027955, Job 114341991218](https://github.com/ramiz4/riparim/actions/runs/38096027955/job/114341991218)
verglich am 11. Oktober 2026 alle 75 Suites einschließlich i18n-Sperre im selben
Checkout und auf demselben Ubuntu-Runner: Node.js 24.21.0, vier CPUs,
16.766.414.848 Bytes RAM. Gemessener Merge-Commit:
`4e7be6ccf67d07fc09938ca0d33ae52b862a46e8`, PR-HEAD `dd046d0`.

| Parallelität | Reihenfolge  | Testlaufzeit | GNU-time-RSS (KiB) |
| ------------ | ------------ | -----------: | -----------------: |
| 1            | erster Lauf  |      77,67 s |            602.380 |
| 2            | zweiter Lauf |      45,17 s |            602.084 |
| 4            | dritter Lauf |      36,93 s |            605.520 |
| 1            | Wiederholung |      70,88 s |            604.356 |
| 2            | Wiederholung |      45,09 s |            608.324 |

Alle fünf vollständigen Läufe bestanden: 380 erfolgreiche Prozess-Endmeldungen
(75 Suites plus i18n-Sperre je Lauf), keine Fehler oder beobachteten OOM-Abbrüche.
Vier Prozesse sparen gegenüber dem wiederholten seriellen Lauf **47,9 %**,
gegenüber dem ersten seriellen Lauf **52,5 %** und gegenüber der wiederholten
Zweierausführung **18,1 %** Testlaufzeit. Deshalb ist vier der Standard.

Die Laufzeit umfasst i18n-Prüfung und Bereinigung, ohne Actions-Queue und Setup.
GNU time `%M` ist die maximale einzelne RSS aus Prozess-/Kind-Rusage, **kein
summierter Spitzenwert des gleichzeitig laufenden Prozessbaums**. Die Zahlen
belegen keine entsprechende Gesamtspeichergrenze.

Nach der Messung wurde der unsichere native Windows-Pfad entfernt und die
Fail-fast-Vertragsprüfung ergänzt. Der POSIX-Scheduler und sämtliche bisherigen
Suite-Registrierungen bleiben erhalten; der finale Linux-Stand wird mit der
Standardparallelität vier und der vollständigen CI geprüft. Der nur zur Messung
verwendete zusätzliche Workflow ist entfernt. Die letzte Runner-Logzeile nennt
auch lokal Parallelitätsgrad, Exitcode und gesamte Testlaufzeit.
