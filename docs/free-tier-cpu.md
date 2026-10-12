# Cloudflare Free: CPU und manueller Mailversand

## Nachgewiesener Engpass

Die Logs vom 11.–12. Oktober 2026 zeigten drei `exceededCpu`-Abbrüche einer älteren Worker-Version auf `/`. Langsame Startseitenaufrufe oberhalb 10 ms lagen im Mittel bei rund 175 ms. Weitere betroffene Pfade waren öffentliche APIs, Datenschutz und private Kontoseiten. Diese gefilterten Werte sind kein Mittelwert aller Besucheranfragen.

Der lokale echte workerd reproduzierte rund 25 ms aktive CPU-Stichproben pro warmem Startseitenaufruf. Die bisherige Startseite renderte React und serialisierte den gesamten Katalog bei jeder Anfrage. Auch der Framework-Handler wurde bereits vor dem öffentlichen Assetpfad geladen. Die Katalogübersicht las und dekodierte für die Revisionsprüfung sämtliche veröffentlichten Zeilen.

## Änderung und Messung

- Startseite und Datenschutz werden in DE/SQ/EN als datenfreie Release-Dokumente gerendert. Der Header fragt persönliche Sitzungsdaten separat ab; keine Konten oder Besuchsnachweise gelangen in die Artefakte. Der Landing-Katalog wird erst für eine ausdrücklich ausgeführte WebMCP-Suche abgefragt.
- Der öffentliche Assetpfad lädt das React-/Vinext-Framework nicht mehr. Ein begrenzter Buildadapter korrigiert den relativen Pfad von Vinext beta.5s generiertem Asset-Sidecar im ausgelagerten Handler; tatsächliche Worker-Builds prüfen dessen Import und RSC-Verhalten.
- Öffentliche Katalog-GETs verwenden dieselbe maßgebliche Antwortfunktion direkt. Administrative Abfragen und sämtliche Schreibmethoden bleiben im autorisierten Frameworkpfad. Eine Gast-Session ohne Cookie benötigt auf dem eigenen Worker keinen Auth-/React-Aufruf; native Identity-Header können dort keine Anmeldung erzeugen.
- Die Katalogrevision wird als ein SQL-Aggregat verglichen. Geänderte oder ausgeblendete Profile behalten die unmittelbare D1-Statusprüfung und datenfreie Fallback-Shells. Unbekannte Seitenpfade werden vor Framework-Laden abgewiesen. Authentifizierte Seiten und RSC bleiben dynamisch.

Vergleichsmessung mit denselben isolierten Canonicaldaten, ohne Produktions-/Providerzugriff:

| Pfad | Vorher, aktive CPU-Stichprobe/Aufruf | Nachher |
| --- | ---: | ---: |
| `/` | 24,8 ms | 2,0 ms |
| `/werkstaetten` | 5,4 ms | 1,8 ms |
| `/api/workshops` | 7,7 ms | 3,6 ms |

`BUILD_TARGET=cloudflare npm run build` und anschließend `node scripts/profile-worker-cpu.mjs` erzeugen lokale Inspector-Profile unter `work/cpu-profiles/`. Die CPU-Stichproben sind vergleichende Profilerdaten, keine Cloudflare-Abrechnung. Netzwerk-/D1-Wartezeit zählt nicht zur CPU. Messschwankungen und kalte/private Pfade erlauben keine Garantie, dass jede Produktionsanfrage unter 10 ms bleibt. Nach dem geprüften Main-Release dieselben Pfade und `exceededCpu` über die realen Logs erneut bewerten; den Tarif nicht vorsorglich ändern.

## Mailversand ohne periodischen Job

Der gespeicherten Moderationsentscheidung folgt ein abgewarteter Erstversand. Fehler ändern die Freigabe nicht. Es gibt keine Cronverarbeitung, Sammelaktion oder UI-Polling. Die explizit leere Cronliste entfernt den bisherigen Zeitplan beim Release-Deployment.

Eine private, aufklappbare Verwaltungsübersicht bietet einzelne Wiederholungen: höchstens fünf zusätzlich zum Erstversand, nach Wartezeiten von 1, 5, 15, 30 und 60 Minuten. Versuchslimit, Wartezeit und Lease werden beim Datenbank-Claim atomar geprüft. Konfiguration-/Empfängerfehler zählen ebenfalls zum Budget. Ein neuer Erstversand kann nicht als periodischer Retry missbraucht werden.

Bestehende Ereignisse, Versuche und Payloadbytes bleiben erhalten; keine neue Migration. Resend behält die ursprünglichen Idempotenzbytes innerhalb von 23 Stunden. Unklare SMTP-Übergaben bleiben gesperrt. Betreiber von Node-Releases müssen vorhandene Mailtimer deaktivieren; ein Einzelretry verlangt die Ereignis-ID. Ein Code-Rollback darf ausgeschöpfte Versuche nicht zurücksetzen und muss den gewollten manuellen Versandmodus berücksichtigen.

Quellen: [Workers CPU-Grenzen](https://developers.cloudflare.com/workers/platform/limits/#cpu-time), [Workers-Preise](https://developers.cloudflare.com/workers/platform/pricing/), [Projekt-Versandvertrag](mail-transports.md).
