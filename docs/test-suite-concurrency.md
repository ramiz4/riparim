# Begrenzte Test-Parallelität (Issue 91)

`npm test` prüft zuerst den i18n-Vertrag und führt anschließend jede registrierte
Suite in einem eigenen Node-Prozess aus. Auf Linux/macOS ist die vorläufige
Standardparallelität zwei. `TEST_CONCURRENCY=1 npm test` führt dieselben Suites
seriell aus; `2`, `3` oder `4` erlauben entsprechend viele gleichzeitige Suites.
Die endgültige Wahl wird auf demselben Commit mit GitHub-Actions-Messungen geprüft.
Windows behält serielle Ausführung und verwendet `taskkill /PID … /T /F` für
noch laufende eigene Prozessbäume. Der Windows-Pfad wurde hier nicht ausgeführt.

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

## Messung

Serielle und parallele Vergleichsläufe verwenden denselben Commit und dieselben
Suites. Die letzte Logzeile nennt Parallelitätsgrad, Exitcode und gesamte
Testlaufzeit einschließlich i18n-Prüfung und Bereinigung. Queue-/Setup-Zeit von
GitHub Actions zählt nicht als Testlaufzeit. Ergebnisse werden vor dem Merge
hier ergänzt; ein schnellerer Lauf muss weiterhin sämtliche Suites bestehen.
