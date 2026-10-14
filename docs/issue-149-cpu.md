# Issue #149: private Seiten, Sitzungen und RSC

## Verbindliches Abnahmeziel

Der Auftraggeber hat am 12. Oktober 2026 das Abschlussziel präzisiert:
„Aktuelle Produktion optimieren; Free-Grenzen offen dokumentieren“.
Die Optimierung wird daher gegen die aktuelle Produktion abgenommen.
Das ursprünglich geforderte zuverlässige Einhalten von 10 ms auf Workers Free
wird durch diese Aufgabe nicht zugesichert. Kalte Überschreitungen bleiben
unten ausdrücklich dokumentiert; Tarif und bestehendes 500-ms-Limit bleiben
unverändert. Geprüfter PR, Squash-Merge, Main-Release, tatsächliche Live-CPU-
und Cron-Prüfung bleiben Teil des Auftrags.

## Vergleichsbasis am 12. Oktober 2026

Die ursprünglichen Issue-Messungen stammen aus v1.20.2. Vor der Umsetzung war
bereits v1.21.4 produktiv: Commit `70d9be959166eef7c08f729ef8de7b407c70cbb1`,
Worker-Version `c4cd2de2-7f12-4465-9de1-5a3ba8f87a4f`, aktiviert um
13:34:08 UTC. Der Release-Workflow war erfolgreich. Diese aktuelle Version
ist deshalb die Vorher-Basis.

`limits.cpu_ms: 500` stammt aus dem bereits gemergten PR #151. Diese Aufgabe
ändert weder diese Konfiguration noch den Tarif. Die Bewertung gegen das
[Free-Budget von 10 ms je HTTP-Aufruf](https://developers.cloudflare.com/workers/platform/limits/#cpu-time)
ist davon unabhängig; erfolgreiche Antworten unter einem höheren Limit
belegen keine Eignung für Free.

Die kontrollierten GETs liefen zwischen 15:35 und 15:37 UTC mit eindeutigen,
datenfreien `cpu_probe`-Markern. Pro Fall wurde ein erster beobachteter Aufruf
und anschließend 30 warme Aufrufe gesendet. Alle unten ausgewerteten Antworten
waren HTTP 200 und enthielten den obigen Release-Commit. Ein erster
beobachteter Live-Aufruf ist kein nachgewiesen frischer Isolate; ein echter
Kaltstart wird separat lokal geprüft. Netzwerkzeit ist nicht CPU-Zeit.

Die CPU-Werte kommen aus Cloudflares `cpu_time_ms`-Tracefeld, gruppiert nach
Route und Marker. Cloudflare gewichtet Stichproben adaptiv: der aggregierte
`count` wich teilweise von der tatsächlich gesendeten Anzahl ab. Die Tabelle
zeigt deshalb die gesendeten 30 Aufrufe und die beobachteten, gewichteten
CPU-Statistiken. Sie behauptet keine lückenlose Messung jedes Aufrufs.

| Route und Zustand                                   | Format | Warme Aufrufe gesendet | Median CPU | p95 CPU | Maximum CPU | Erster beobachteter Aufruf |
| --------------------------------------------------- | ------ | ---------------------: | ---------: | ------: | ----------: | -------------------------: |
| `/`, Gast                                           | HTML   |                     30 |       0 ms |    1 ms |        1 ms |                       4 ms |
| `/anmelden`, Gast                                   | HTML   |                     30 |      23 ms |   43 ms |       62 ms |                     174 ms |
| `/betrieb`, Gast                                    | HTML   |                     30 |      34 ms |   50 ms |       73 ms |                      49 ms |
| `/bewertungen`, Gast                                | HTML   |                     30 |      23 ms |   33 ms |       35 ms |                      29 ms |
| `/einstellungen`, Gast                              | HTML   |                     30 |      17 ms |   26 ms |       27 ms |                      71 ms |
| `/werkstaetten`, Gast                               | RSC    |                     30 |     140 ms |  176 ms |      179 ms |                     128 ms |
| `/betrieb`, Gast                                    | RSC    |                     30 |      15 ms |   22 ms |       45 ms |                      21 ms |
| `/api/session`, Gast mit bedeutungslosem Testcookie | JSON   |                     30 |       6 ms |    9 ms |       28 ms |                      13 ms |
| `/api/workshops`, Gast                              | JSON   |                     30 |       6 ms |   10 ms |       18 ms |                      12 ms |

RSC wurde mit `RSC: 1`, `Accept: text/x-component` und dem kanonischen leeren
`?_rsc`-Parameter separat angefordert. Nichtleere Probe-IDs erzeugten zunächst
HTTP 307; diese Redirects sind ausdrücklich nicht Teil der RSC-Tabelle. Der
Katalog-RSC-Body betrug rund 342 KB, die JSON-Katalogantwort rund 225 KB.

Eine vom Benutzer bereitgestellte bestehende Sitzung wurde anschließend ohne
Mailversand oder fachliche Live-Schreibvorgänge geprüft. Der erste beobachtete
authentifizierte Betriebsaufruf benötigte 154 ms CPU. Zehn anschließend mit
`networkidle` vollständig abgeschlossene Aufrufe mit individuellen Probe-IDs
wurden im Echtzeit-Tail vollständig erfasst: Median 33,5 ms, p95/Maximum 63 ms.
Die Sitzungsprüfung eines authentifizierten direkten GETs benötigte 44 ms
(n = 1; keine belastbare warme Stichprobe). Private Antworten verwendeten
`private, no-store`.

## Nachgewiesene Ursachen und Prüfvertrag

Der isolierte echte workerd reproduzierte Katalog-RSC mit 342–348 KB und rund
62–66 ms warmer aktiver CPU-Stichprobe. Der Profiler zeigte vor allem
RSC-Serialisierung. Private Bewertungsseiten übertrugen zusätzlich den ganzen
Bearbeitungskatalog. Eine authentifizierte Sitzungsprüfung rief den Provider
dreimal auf: Proxy, Routenauthentifizierung und die symmetrische
Tokenprüfung des SDKs.

Der Vergleichsprofiler verwendet ausschließlich isoliertes D1/R2, synthetische
Sitzungen und abgefangene Providerantworten. CPU-Sampling aus dem lokalen
Inspector ist vergleichende Diagnose, keine Cloudflare-Abrechnung. Eine
Freigabe für Free benötigt zusätzlich reale CPU-Werte des veröffentlichten
Main-Releases, einschließlich Sitzungszustand, HTML/RSC, realer Navigation und
Locale-Wechsel. Fehlende `exceededCpu`-Abbrüche allein genügen nicht.

## Umsetzung und lokale Nachher-Messung

Private HTML-/RSC-Antworten enthalten nur Release-Oberflächen und lokalisierte
Ladehinweise. Sitzungen, Besitzrechte und private Daten werden anschließend
über frische, autorisierte APIs geladen. Die internen Artefaktpfade sind am
Worker gesperrt. Auch diese datenfreien privaten Antworten bleiben
`private, no-store` und `noindex,nofollow`.

```text
HTML / RSC → datenfreie Release-Oberfläche
JSON GET   → ein Providerclient je Anfrage → aktuelle D1-Zugriffsprüfung
Schreiben  → bestehende autorisierte App-Routen
```

Sitzungs-, Auth-Options-, Betriebs-, Bewertungs- und Kontolesezugriffe umgehen
das React-Framework auf dem eigenen Worker. App Router und Worker verwenden
dieselben maßgeblichen GET-Antwortfunktionen. Das erhält Besitzrechte,
bestätigte Altverknüpfungen, Cursor, Moderation und den bereits begonnenen
Kontolöschungsablauf. Frische HTTP-Anfragen prüfen weiterhin Provider,
Sitzungswiderruf, Kontosperre und Rollenentzug. Node/Sites und sämtliche
Schreibmethoden behalten ihre bisherigen Adapter.

Der Supabase-Adapter teilt die verifizierte Providerantwort nur innerhalb
einer HTTP-Anfrage. Eine native, streng geprüfte Cookie-Lesedarstellung
vermeidet langsame JavaScript-Base64-Dekodierung; originale Chunknamen und
Cookiebytes sowie SDK-Validierung, Tokenauffrischung, Schreibformate und
Löschung bleiben erhalten. Nichtkanonische oder ungültige Eingaben gehen
unverändert durch den bisherigen SDK-Pfad. Es gibt keine neue Abhängigkeit,
Auth-Protokollumstellung oder Aufgabenmigration.

Der öffentliche RSC-Pfad verwendet Release-Artefakte mit denselben aktuellen
Status-/Revisions- und Providerprüfungen wie HTML. Katalog-RSC liefert eine
kompakte Oberfläche und lädt veröffentlichte Datensätze über die bestehende
Live-API. Private Queryziele werden nach Hydration aus der tatsächlichen URL
gelesen; der RSC-Antwortheader trägt den aktuellen Pfad samt Query außerhalb
des unveränderlichen Artefakts.

Der Aufgabenbranch integrierte während der Umsetzung `main` bis
`c0bf92b851beb3d5db7f288dd05bcb27d65b314a` (v1.23.0). Die neue Landingpage,
Premium-Funktionen und deren bereits veröffentlichte Migration `0019` bleiben
erhalten. Die später integrierte Backup-Monitoring-Änderung betrifft keine
Anwendungslaufzeit und aktiviert durch diese Aufgabe keinen Monitor.

Der letzte gemessene Cloudflare-Build enthält die integrierte Basis
`c0bf92b` plus Aufgabenänderungen einschließlich aller drei Review-Korrekturen.
SHA-256 des Modulbestands nach dem Hashverfahren des Profilers:
`bce84bb7b9ae20b8650c91ecd19cbf0842ddefe0664b1b6a214b27661338b946`.
Die endgültigen JWT-Fixtures verwenden außerdem eine authentifizierte Audience
und eine UUID-Sitzungs-ID; frühere Messungen nutzten eine einfachere Fixture.
Je Fall wurden drei frische workerd-Isolates und 30 warme Aufrufe gemessen.
Die befüllte Fixture enthält eigene, bestätigte alte und fremde Datensätze
sowie einen getrennten 51-Datensätze-Paginationstest. Die profilierten
Antworten enthalten rund 3 KB Betriebsdaten, 2,9 KB Bewertungen und 151 Bytes
Kontozustand; größere reale Datenbestände sind damit nicht abschließend geprüft.

| Angemeldeter GET | Kalter Median / Maximum | Warmer Median / p95 / Maximum |
| ---------------- | ----------------------- | ----------------------------- |
| `/api/session`   | 13,27 / 17,31 ms        | 2,65 / 4,02 / 4,78 ms         |
| `/api/business`  | 13,89 / 18,88 ms        | 4,20 / 5,86 / 6,62 ms         |
| `/api/visits`    | 9,60 / 10,05 ms         | 3,01 / 5,08 / 5,44 ms         |
| `/api/account`   | 10,72 / 14,58 ms        | 2,89 / 5,08 / 5,21 ms         |

Eine aufgefrischte abgelaufene Sitzung benötigte kalt median/maximal 15,17 ms. Eine erstmals zugeordnete Altidentität lag bei
10,27 / 13,40 ms, ein Providerausfall bei 9,96 / 10,45 ms.
Die Gastfälle der direkten privaten APIs lagen kalt maximal bei 6,45 ms,
warm maximal bei 2,09 ms. Ein Gast mit bedeutungslosem Cookie lag
kalt median/maximal bei 5,36/5,65 ms und warm bei 1,12/2,05 ms. Authentifizierte direkte Lesezugriffe benötigen
einen Provideraufruf; Auffrischung benötigt zwei.

Vor der GET-Extraktion lagen bei einer befüllten Fixture die kalten
Mediane für Betrieb/Bewertungen/Konto bei 27,89/23,04/23,92 ms. Diese frühere
Aufgabenmessung basiert allerdings noch auf `70d9be9`; der Vergleich umfasst
auch die Integration des neueren Main; die JWT-Fixture wurde danach angeglichen. Der separate Originalvergleich aus
dem unveränderten Git-Archiv `70d9be9` zeigt für angemeldete Bewertungen
87,92 ms kalten und 47,16 ms warmen Median; mit der korrigierten Oberfläche
sind es 3,98 ms kalt und 0 ms warmer Median (p95 1,29 ms, Maximum 1,80 ms).
Der Katalog-RSC-Body beträgt jetzt 19.620 Bytes; sein Gastfall benötigte
kalt median/maximal 4,06/5,65 ms und warm median/p95/maximal 0/1,13/1,40 ms.
Nullsamples bedeuten fehlende aktive Inspector-Stichproben, keine garantierte
CPU-Freiheit. Das sind Dokumentwerte, keine Summen aller nachgeladenen
API-Aufrufe.

**Die lokale Messung erfüllt die kalte Free-Reserve noch nicht.** Insbesondere
private authentifizierte APIs und Tokenauffrischung überschreiten weiterhin
10 ms. Die verbesserten warmen Werte erlauben keine allgemeine Free-Garantie.
Echte Cloudflare-CPU-Werte und größere/private Abläufe müssen nach dem
geprüften Main-Release erneut gemessen werden. Der Tarif und das bestehende
konfigurierte 500-ms-Limit bleiben unverändert.

Reproduktion nach einem Cloudflare-Build:

```sh
CPU_PROFILE_POPULATED=1 CPU_PROFILE_COLD=3 CPU_PROFILE_SAMPLES=30 \
  CPU_PROFILE_CASES=/api/session,/api/business,/api/visits,/api/account \
  node scripts/profile-worker-cpu.mjs
```

Der Profiler dokumentiert Commit, tatsächlichen Artefakthash, Fixturezustand,
kalte/warme Rohsamples, Provideraufrufe, Antwortgröße und zusammengefasste
CPU-Stichproben. Modulinitialisierung vor dem Inspector ist ausdrücklich
ausgeschlossen; es werden keine Live-Provider oder Produktionsdaten verwendet.

## Browser- und Vertragsprüfung

Die Browserprüfung verwendete den vom Benutzer bereitgestellten integrierten
Browser mit zuvor verifiziertem Riparim-Konto. Die lokale tatsächliche
Cloudflare-Anwendung lief mit isoliertem D1/R2 und synthetischen
Providerantworten. DE/SQ/EN, 390/1280 Pixel, Hell/Dunkel/System, Tastatur,
Lade-/Leer-/Fehlerzustände und verweigerter Verwaltungszugang wurden geprüft;
das Systemtheme löste hier dunkel auf. Es gab keinen horizontalen Überlauf.

Die native Prüfung reproduzierte zuerst verlorene Queryziele in statischen
RSC-Oberflächen und verlorenen Fokus nach einem erneuten Sitzungsfehler.
Die korrigierte tatsächliche Navigation bewahrt die gezielte Bewertung und
Werkstatt durch Anmeldung, Direktaufruf und Browser-Zurück. Sitzungs-Retry erhält bei erneutem Fehler den Tastaturfokus. Öffentliche Suche mit Ort/Leistung, Locale-Wechsel und
Neuladen behielten ihre Filter. Die bestehenden öffentlichen Feldgrenzen
beim Sprachwechsel bleiben unverändert.

Das erste unabhängige Architect-Review fand außerdem drei Fehler bei
beibehaltenen Clientkomponenten. Der Werkstatt-Retry löst nun ausdrücklich
einen neuen Ladeversuch aus. Ergebnisse gehören zum aktuellen Konto und
Queryziel; beim Wechsel verschwinden alte Formulare sofort und verspätete
Antworten werden verworfen. Erfolgreiche Namensänderung oder Kontolöschung
invalidieren die gemeinsame Sitzungsanfrage und aktualisieren öffentliche
sowie private Anzeigen auch ohne Remount. Alte laufende Sitzungsantworten
können diesen Zustand nicht überschreiben. Diese Verträge wurden zuerst
mit fehlschlagenden Tests reproduziert und danach erfolgreich geprüft.
Der Formularbereich bleibt bei Kontoänderungen erhalten; nach erfolgreichem
Werkstatt-Retry erhält der Hauptbereich den Tastaturfokus.

Die gebauten Worker-Vertragstests ergänzen befüllte Besitz-/Altverknüpfungs- und
fremde Fälle, Pagination, private Nachweise, Moderation, Rollen-/Sitzungsentzug,
begonnene gesperrte Kontolöschung, Cookieauffrischung, definitive Ablehnung,
Provider-/Datenbankfehler und gefälschte native Header. Die bisherigen
Mutations-, SMTP-, manuellen Retry- und Node/Sites-Verträge bleiben Teil der
regulären CI-Prüfungen. Live-Messungen versenden keine echten Mails und ändern
keine fachlichen Produktionsdaten.

## Cron-Verlauf über alle Versionen

Die Schedules-API lieferte bei der aktuellen Bestandsprüfung eine leere Liste.
Die Logs wurden zusätzlich ohne Worker-Versionsfilter nach Service `riparim`
und `$metadata.origin = scheduled` ausgewertet. Zwischen 09:30 und 11:10 UTC
wurden 20 Invocation-Ereignisse des bisherigen `*/5 * * * *`-Timers beobachtet;
das letzte lag im Intervall 11:05–11:10 UTC. Die zugehörigen Fehler meldeten
den fehlenden Scheduled-Handler. Von 11:10 UTC bis zum Aufgabenstart und den
Vorher-Messungen wurden keine weiteren Scheduled-Ereignisse gefunden.

Der Stopp war damit bereits vor dieser Implementierung eingetreten und
überdauerte die Veröffentlichungen v1.21.0 bis v1.21.4. Das ist ein
versionsübergreifender Beobachtungsnachweis und keine durch diese Aufgabe
verursachte Reparatur. Die Logs belegen, dass ein alter Timer trotz leerer
Control-Plane-Liste weiter feuerte. Ein verzögerter Abgleich ist eine
naheliegende Erklärung; der genaue providerinterne Ablauf lässt sich mit den
verfügbaren Logs nicht bestimmen.
Das letzte Ereignis liegt jenseits der dokumentierten
[Propagationszeit von bis zu 15 Minuten](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
Die zusätzliche Bestandsprüfung um 16:59 UTC zeigte weiterhin eine leere
Schedules-Liste und null Scheduled-Ereignisse oder passende Handlerfehler seit
11:10 UTC, ohne Versionsfilter. Die verfügbaren Trigger-/Handlerwerte in
diesem Fenster waren ausschließlich `http`/`fetch`; das schließt eine bloß
geänderte Darstellung der Timer im neuen Traceformat als Erklärung aus.
Das aktive Release war inzwischen v1.23.0 mit Worker-Version
`fefcc17c-cf8d-4b63-b108-c7b5904ef652`, aktiviert um 16:58:22 UTC.
Die Abwesenheit muss nach dem Aufgabenrelease erneut über mehrere
Fünf-Minuten-Intervalle geprüft werden. Es wird kein wirkungsloser
Scheduled-Handler eingeführt.

Der Mailvertrag bleibt ein abgewarteter Erstversand und höchstens fünf
manuelle Einzelwiederholungen nach 1/5/15/30/60 Minuten. Versuchszähler,
atomarer Claim, Lease, Idempotenz und Sperren bei unklarer SMTP-Übergabe
bleiben maßgeblich. Die Messungen senden keine echten Nachrichten.
