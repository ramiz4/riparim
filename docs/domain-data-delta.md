# Finaler Datenabgleich für den Domainwechsel

Die Werkzeuge bereiten den letzten Abgleich für #19 vor. Sie schalten keine
Wartungssperre ein und ändern keine Domain, Laufzeitkonfiguration oder
Veröffentlichung. Die öffentliche Quell-Site bleibt während der Vorbereitung
verfügbar. Die kurze Pause wird erst nach erfolgreicher Prüfung und vor ihrer
Aktivierung wie in [domain-cutover.md](domain-cutover.md) angekündigt.

## Bewiesener Ausgangsstand

Der Abschluss von #18 enthält das geschützte Quellbackup, das Zielbackup vor dem
Import und den privaten Transferbericht. `loadTransferredBaseline()` prüft ihre
Identitäten, Abschlussnachweise und Prüfsummen. Es rekonstruiert die bestätigten
Einfügungen ausschließlich im Arbeitsspeicher. Menge der Einfügungen,
beibehaltene Cachemetadaten und der vollständige Ziel-Fingerprint müssen exakt
zum Transferbericht passen. Ein aktuelles, zufällig ähnliches Ziel wird dadurch
nicht zum Ausgangsstand erklärt.

`planDataDelta()` vergleicht diesen Ausgangsstand mit der frischen, angehaltenen
Quelle und dem frischen Ziel. Unveränderte Quellzeilen bewahren die ursprünglichen
Zielwerte einschließlich der bereits validierten Cachemetadaten. Neue,
geänderte oder gelöschte Quellzeilen erzeugen nur die entsprechenden Einfügungen,
Änderungen oder Löschungen. Andere Zieländerungen stoppen den Plan. Bereits exakt
übernommene Änderungen werden bei einem erneuten Abgleich übersprungen.
Sitzungswiderrufe, Kontosperren, entfernte Rollen und gelöschte Einreichungen
werden damit nicht aus einem älteren Backup wiederhergestellt. Ein Wechsel des
Supabase-Projekts ist außerhalb dieses Domainabgleichs und führt zu No-Go.

Die Entscheidung über Cachemetadaten verwendet die vorhandene gemeinsame
Identitätsfunktion. Bei geänderter Telefonnummer, Adresse oder Kartenquelle
bleibt kein alter Zielhash als aktuelle Bestätigung stehen. Quoten, Rollen und
Geschäftsdaten fallen nicht unter diese Ausnahme. Alle ursprünglichen Backups
bleiben unverändert.

## Gesonderter Nachweis abgelaufener Auth-Zähler

Standardmäßig wird auch jede Zielabweichung in `auth_attempts` abgewiesen. Die
optionale Ablaufprojektion benötigt einen geschützten QA-Nachweis und ein
vollständiges geschütztes Zielbackup als Zeitzeugen. Dessen `exportedAt` ist der
feste Stichtag; er darf weder nach der vertrauenswürdigen Ausführungszeit noch
nach den frischen Source-/Target-Backups liegen.

Die Prüfung bestätigt zuerst den unveränderten #18-Fingerprint. Anschließend
werden ausschließlich Zähler ausgeblendet, deren SHA-/Zehn-Minuten-Fenster,
positive Versuchsanzahl und Zwanzig-Minuten-Ablauf zur tatsächlichen
Limiter-Implementierung passen und die bereits **vor diesem Stichtag** abgelaufen
waren. Nach dieser Projektion muss der gesamte bewiesene Ausgangsstand dem
Zeitzeugen entsprechen. Aktive oder fehlerhafte Zähler sowie Änderungen anderer
Tabellen bleiben Konflikte. Eine konkrete IP-Zuordnung wird durch zeitliche
Korrelation nicht als bewiesen ausgegeben.

Diese Projektion erzeugt weder eine Bereinigung noch eine Wiederherstellung
abgelaufener Zähler. Bereits abgelaufene Zielzeilen bleiben physisch unverändert;
abgelaufene Quellzeilen werden nicht erneut kopiert. Aktive Quellzähler werden
normal abgeglichen. Der endgültige **rohe** Ziel-Fingerprint berücksichtigt auch
diese erhaltenen Zielzeilen, damit ein erfolgreicher No-op keinen nur
ungeprüften Projektionszustand behauptet.

## Geschützte Ausführung

`scripts/apply-delta-d1.mjs` nimmt Optionen und die kurzlebigen Zugangsdaten nur
über geschütztes JSON auf stdin entgegen. Tokens gehören weder in Argumente,
Konfigurationsdateien, Git noch in Berichte. Der verantwortliche Ausführungsprozess
holt sie aus dem geschützten Dienst und erzeugt die Eingabe im Arbeitsspeicher.
Ohne `execute: true` wird ausschließlich ein Plan mit Mengen und Fingerprints
ausgegeben. Die Modul-Schnittstelle `applyDeltaPlan()` erlaubt injizierte
Providerzugriffe für isolierte Tests.

| Option | Nachweis |
| --- | --- |
| `baselineSourceDirectory` | Vollständiges abgeschlossenes Quellbackup aus #18 |
| `preTransferTargetDirectory` | Privates Zielbackup vor den bestätigten #18-Einfügungen |
| `transferReportFile` | Privater bestätigter Transferbericht mit vollständigem Ergebnis-Fingerprint |
| `sourceDirectory`, `expectedSourceCommit` | Frisches vollständiges Quellbackup und unabhängig verifizierter Source-Release |
| `destinationDirectory`, `expectedCommit` | Frisches geschütztes Zielbackup und tatsächlicher Target-Release |
| `expiryProjection` | Optional: `witnessDirectory`, `expectedWitnessCommit`, `receiptFile` |
| `sourceOrigin`, `sourceToken`, `sourceProbeParent` | Geschützter authentifizierter Quellzugriff für vollständige erneute Pause-/Bestandsnachweise |
| `token` | Separater geschützter Cloudflare-Zugang zum fest eingebauten Zielaccount und zur Ziel-D1 |
| `execute` | Nur der boolesche Wert `true` aktiviert Datenmutationen |

Vor jedem Abschnitt werden die unveränderte, authentifizierte Quellpause und der
explizite Target-Wartungsmarker samt unveränderlichem Release-Commit geprüft.
Der Target-Bestand wird vollständig neu gelesen. SQL und Bindings entstehen
allein aus dem neuen Dreifachabgleich; es gibt keine Eingabe beliebiger SQL-Texte.
Änderungen und Löschungen vergleichen alle alten Spalten einschließlich Nullwerten.
Jedes Statement darf genau eine erwartete Zeile ändern; je Abschnitt gibt es
höchstens 50 Statements und höchstens 95 Bindings pro Statement.

Eine verlorene Bestätigung wird nie automatisch wiederholt. Quelle und Ziel
bleiben angehalten, ein neues geschütztes Zielbackup wird erstellt und der
Dreifachabgleich neu berechnet. Er erkennt vollständig oder teilweise übernommene
Änderungen. Am Ende müssen sowohl der vollständige rohe Zielzustand als auch ein
erneuter, leerer Änderungsplan stimmen. Source-Identität und originale Source-
Fingerprints werden nochmals geprüft.

## Private Dateien und Go/No-Go

Ein gegenüber #18 verändertes privates Quellinventar ist derzeit vor jeglicher
D1-Mutation ein ausdrückliches No-Go: Zuerst muss ein gesonderter vollständiger
R2-Delta für Inhalt, Metadaten, Referenzen und Löschungen geprüft werden. Ein
Datenbankabgleich allein übernimmt keine Datei. Auch das aktuelle Zielinventar,
seine Privatheit und Referenzen müssen vor dem Aufruf separat nach
[data-transfer.md](data-transfer.md) bestätigt werden. Die Werkzeuge behaupten
keine bereits ausgeführte Dateiübernahme oder Domainumstellung.

Erst nach konfliktfreiem Abschluss folgen Routing, ausschließliche Freigabe des
Ziel-Writers, die fachliche Domain-/Auth-Abnahme und der vereinbarte
Beobachtungszeitraum. Backups, Quell-Site und private Berichte bleiben bis zur
sicheren Übergabe erhalten.
