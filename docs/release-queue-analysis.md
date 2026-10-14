# Release-Wartezeiten nach Issues 90–92

Messstand: 11.10.2026, Basis `85c33b0a4449646517b4c643501f482ba68f62b2`.
Alle Zeiten stammen aus GitHub-Actions-Run-/Job-Zeitstempeln; Datum und Logs
sind UTC. Joblaufzeiten enthalten Setup und Cleanup. Wartezeit bis zum
Jobstart enthält mögliche Runner- und Concurrency-Wartezeit; GitHub liefert
hier keine belastbare Aufteilung nach diesen Ursachen.

## Historische Läufe und Wiederholung

| Lauf / Versuch                                                                                          | Wartezeit vor Prüfjob | Aktiver Prüfjob | Folgeschritte                               |
| ------------------------------------------------------------------------------------------------------- | --------------------: | --------------: | ------------------------------------------- |
| [Release 37365785961, Versuch 1](https://github.com/ramiz4/riparim/actions/runs/37365785961/attempts/1) |                 320 s |           147 s | Release 37 s; Deploy nach 902 s abgebrochen |
| [derselbe Release, Versuch 2](https://github.com/ramiz4/riparim/actions/runs/37365785961/attempts/2)    |                 241 s |           285 s | Release 32 s; Deploy übersprungen           |
| [PR-CI 37364195930](https://github.com/ramiz4/riparim/actions/runs/37364195930)                         |                 308 s |           304 s | kein Produktionsjob                         |
| [Titelprüfung 37365493954](https://github.com/ramiz4/riparim/actions/runs/37365493954)                  |                 329 s |            31 s | kein Produktionsjob                         |

Versuch 1 wurde am 05.10. um 19:48:37 erstellt. Versuch 2 begann erst um
21:57:23; sein Prüfjob lief 22:01:24–22:06:09. Die Differenz zwischen ursprünglicher
Erstellung und Abschluss enthält die Pause vor dem Retry und ist keine
Buildzeit. Vergleichbare Wartezeiten bei PR-CI und Titelprüfung, die nicht
zur Produktions-Concurrency gehören, verhindern eine Zuordnung der gesamten
Verzögerung zur Release-Serialisierung. Runner-Verfügbarkeit ist eine mögliche,
mit diesen Daten jedoch nicht abschließend bestätigte Ursache.

Der erste Semantic-Job veröffentlichte `v1.7.0` für Commit
`45a8a358dc97f50f1cd0489cbeb5e44a081cf778` um 19:57:35. Versuch 2 meldete
`A newer main commit exists; its queued workflow will create the release.`
Dieser Retry war bereits getaggt. Seine 285 s Verifikation sind daher kein
Nachweis für sicher vermeidbare Arbeit eines unveröffentlichten alten Commits.

## Aktuelle Main-Läufe

| Main-Lauf                                                                                      | Erstellung bis Prüfjobstart | Aktiver Prüfjob | Prüfende bis Release-Start | Release-Ende bis Deploy-Start |
| ---------------------------------------------------------------------------------------------- | --------------------------: | --------------: | -------------------------: | ----------------------------: |
| [352be3a, vor Issue 90](https://github.com/ramiz4/riparim/actions/runs/38094220885)            |                         2 s |           444 s |                        2 s |     Deploy übersprungen: Docs |
| [b88b2df, nach Issue 90](https://github.com/ramiz4/riparim/actions/runs/38094733816)           |                         3 s |           242 s |                        2 s |                           4 s |
| [2b857d0, weitere Katalogänderung](https://github.com/ramiz4/riparim/actions/runs/38095275181) |                         2 s |           242 s |                        2 s |                           3 s |
| [93a6937, nach Issue 91](https://github.com/ramiz4/riparim/actions/runs/38096765160)           |                         2 s |           203 s |                        2 s |                           4 s |
| [85c33b0, nach Issue 92](https://github.com/ramiz4/riparim/actions/runs/38097639289)           |                         2 s |           188 s |                        3 s |                           3 s |

Diese unterschiedlichen Commits zeigen die tatsächlichen Laufzeiten des
Gesamtprozesses; sie ersetzen keinen kontrollierten Vergleich einzelner
Änderungen. Die kontrollierten Testmessungen stehen in
[test-suite-concurrency.md](test-suite-concurrency.md), die Tool-Installationen
in [ci-tool-installs.md](ci-tool-installs.md).

## Entscheidung und kleinste Korrektur

Der verbleibende Minutenengpass in der Queue ist mit den aktuellen Läufen
nicht reproduzierbar. Es gibt keine belegte Einsparung durch parallele
Release-Verifikation oder einen frühen Skip-Job; deshalb erfolgt kein solcher
Umbau. `production-release` bleibt über Prüfung, Veröffentlichung und Deployment
serialisiert mit `cancel-in-progress: false`. PR-Pflichtchecks und beide Builds
laufen vollständig. Es werden keine bezahlten Runner oder neuen Ressourcen verwendet.

Die Untersuchung bestätigt dagegen einen Wiederholungsfehler: Der Release-CLI
prüfte bisher neueren Main vor dem bereits veröffentlichten Tag und unterdrückte
dadurch dessen Deployment bei einem vollständigen Retry. Die kleinste Korrektur
validiert und verwendet den veröffentlichten Tag des exakten geprüften Commits
zuerst wieder. Erst bei einem ungetaggten Commit wird Remote-Main unmittelbar
vor einer neuen Semantic-Veröffentlichung geprüft. Fehler, leere Antworten und
ungültige SHA-/Ref-Antworten brechen diesen Pfad ab.

Es gibt keine behauptete zusätzliche Zeitersparnis für Issue 93. Die Korrektur
stellt die dokumentierte Wiederholbarkeit her. Bestehende Provenienzprüfung
beider Archive vor der Entscheidung und die Deploy-Sperre gegen einen neueren
vollständig veröffentlichten Release bleiben erhalten. Unvollständige
Veröffentlichungen bleiben Fehler und erhalten keinen neuen Tag.

`release-retry.test.mjs` führt den echten Release-CLI mit einem temporären
lokalen Git-Remote und isolierten Archive-/Provenienzfixtures aus; SDK und
GitHub-Antworten sind ohne Veröffentlichung ersetzt. Es prüft Docs-/Chore-Retries,
nahe Main-Änderungen, überholte ungetaggte Commits, beschädigte Provenienz,
mehrere Tags, unvollständige Veröffentlichungen und fehlgeschlagene/ungültige
Remote-Abfragen. Die bestehenden Deploytests prüfen zusätzlich unveränderte
Archivbytes, neueren Docs-Main und neuere vollständige Releases vor
Produktionsoperationen. Eine echte Produktionswiederholung wird für diese
Analyse nicht ausgelöst.
