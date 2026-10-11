# Portabler Node-Betrieb

Riparim kann neben dem bestehenden Vinext-/Cloudflare-Build denselben
App-Router-Code mit dem bereits installierten Next.js auf einem gewöhnlichen
Node-Server ausführen. Es gibt keine neue Framework- oder Storage-Abhängigkeit.
Cloudflare-Produktion, D1, R2 und deren Releaseweg bleiben unverändert.

## Build, Migrationen und Start

Node.js 24 ab 24.10 wird empfohlen; die unterstützten Versionen stehen in
`package.json`. Der zweite Betriebsweg verwendet das eingebaute `node:sqlite`.
In Node 22/24 gilt dessen API noch als experimentell. Installation und Build
benötigen die gelockten Entwicklungsabhängigkeiten.

```sh
npm run install:ci
npm run build:node
cp .env.example .env
export RIPARIM_DATA_DIR="$PWD/.riparim"
export SITE_ORIGIN=http://127.0.0.1:5174
npm run db:migrate:node
npm run start:node -- --port 5174
```

Der Build erzeugt `.next/` und `.node-runtime/command.mjs`. Nexts Webpack-Build
ersetzt ausschließlich `lib/runtime/env` durch den Node-Adapter. Seiten und
APIs verwenden dieselben Geschäftsregeln und SQL-Abfragen wie der Worker.
Die Option `skipProxyUrlNormalize` erhält die ursprüngliche Request-Origin:
sonst können interne Sprach-Rewrites von `127.0.0.1` auf `localhost` als
externe Selbstanfragen ausgeführt werden. Der kanonische `/de`-Redirect bleibt.
Next kann bei bereits begonnenen HTML-Streams eine Nicht-gefunden-Seite mit
HTTP 200 ausliefern; private Entwürfe werden auch dabei nicht ausgegeben.

Für den Betrieb hinter einem HTTPS-Reverse-Proxy muss `SITE_ORIGIN` die
öffentliche HTTPS-Origin sein. Der Server bindet standardmäßig nur Loopback;
Port und Host lassen sich als Next-CLI-Argumente übergeben. Next lädt `.env`
beim Start; die beiden Kommandos laden sie mit Nodes `--env-file-if-exists`.
Secrets bleiben serverseitig und gehören nicht in Git oder Build-Artefakte.

## Daten und private Dateien

`RIPARIM_DATA_DIR` bezeichnet ein eigenes, beschreibbares Datenverzeichnis
außerhalb von `public/`. Ohne Konfiguration wird `.riparim/` verwendet.
Darin liegen zwei persistente Dateien mit Dateimodus `0600`:

- `app.sqlite`: Anwendungstabellen aus den unveränderten Drizzle-SQL-Dateien.
- `files.sqlite`: private Dokumentinhalte als Blobs mit Schlüssel, ETag,
  Uploadzeit und HTTP-/Custom-Metadaten. Diese separate Datei ist der lokale
  Dateispeicher, kein öffentliches Downloadverzeichnis.

Neue Verzeichnisse werden mit Modus `0700` angelegt. Der Dienstbenutzer braucht
exklusiven administrativen Zugriff auf das Verzeichnis. Downloads laufen
weiterhin ausschließlich durch die bestehenden APIs mit Besitz-/Adminprüfung
und `Cache-Control: private, no-store`. Sites-Identitätsheader begründen im
Node-Betrieb weder Kunden- noch Adminrechte, auch bei fehlender Auth-Konfiguration.
Die echte Anmeldung verwendet vorerst weiterhin das konfigurierte Supabase-Projekt.

`db:migrate:node` führt die SQL-Dateien in aufsteigender Reihenfolge aus.
`riparim_node_migrations` speichert Dateiname, SHA-256 und Zeitpunkt. Jede
Migration und ihr Beleg bilden eine Transaktion. Wiederholungen überspringen
identische angewendete Dateien; geänderte angewendete Dateien führen zum Abbruch.
Es gibt keine neue Drizzle-Migration und keine automatische Datenübernahme aus D1.
Die initiale Katalogübernahme verwendet weiterhin den vorhandenen Import.

SQL-Batches bleiben atomar. Private Dateiinhalte und deren ETag stehen gemeinsam
in einer Blobstore-Zeile: bedingte Uploads aktualisieren sie ausschließlich,
wenn die Reservierung mit diesem ETag noch existiert. Kontolöschung entfernt
Reservierungen; verspätete Uploads können danach keine Inhalte hinterlassen.
SQLite serialisiert diese Operation auch zwischen mehreren lokalen Verbindungen.
Metadatenlisten laden keine Dokumentinhalte. Ungültige Schlüssel mit absoluten
Pfaden, Traversalsegmenten oder Backslashes werden abgewiesen.

Der Weg ist für **einen Host mit lokalem persistentem Datenträger** vorgesehen.
Eine gemeinsame SQLite-Datei auf Netzlaufwerken oder mehrere Hosts sind kein
abgenommener Betriebsweg. Vor Sicherung oder Übernahme alle App-Prozesse und
den Versandjob stoppen, dann das vollständige Datenverzeichnis einschließlich
vorhandener SQLite-WAL-/SHM-Dateien sichern. Beide Datenbanken gehören zu einer
Sicherung; `files.sqlite` allein enthält keine Besitzrechte. Wiederherstellung
in ein privates Verzeichnis erfolgt bei gestoppten Prozessen, danach Migrationen
und die Kundenabläufe prüfen. Für Online-Backups ist eine SQLite-Backupmethode
statt einfacher Kopien aktiver Dateien erforderlich.

## Hintergrundversand

Ohne Worker-Kontext wartet die vorhandene Moderationsroute ihren ersten
Versandversuch ab. Das dauerhafte Outbox-Ereignis bleibt bei Teilfehlern erhalten.
Es gibt keine ungebundenen Fire-and-forget-Promises.

```sh
npm run notifications:node
```

Dieses Kommando verarbeitet und erwartet fällige Ereignisse mit der vorhandenen
Lease-/Idempotenzlogik. Der Betreiber führt es mit demselben Datenverzeichnis,
der gleichen `.env` und aus dem Release-Verzeichnis alle fünf Minuten aus,
beispielsweise über einen systemd-Timer oder Cron. Der Worker-Cron bleibt für
Cloudflare bestehen. Timer-Ausgaben und Fehler müssen im Betrieb erfasst werden;
dieser Umbau richtet keinen externen Scheduler oder Maildienst automatisch ein.

## Abnahme

`npm test` registriert den zweiten Betriebsweg:

- `node-storage`: Persistenz, atomare Batch-Rollbacks, unveränderte Migrationen,
  private Dateien, Metadaten, Pagination und bedingte Schreibvorgänge.
- `node-evidence`: tatsächliche Bewertungs-/Download-/Kontolöschlogik mit
  synthetischen Konten und echtem Node-Storage; fremder Download wird verweigert,
  Kontolöschung während Upload bereinigt Inhalt und Inventar.
- `node-runtime`: tatsächlicher Next-Produktionsbuild und gestarteter HTTP-Server
  mit synthetischen öffentlichen und privaten Profilen; Seiten in DE/SQ/EN,
  APIs, private Zugriffsverweigerung und gefälschte Sites-Adminheader sowie beide
  ausführbaren Migration-/Outbox-Kommandos.

Diese Prüfungen ändern keine Live-Provider und senden keine echten E-Mails.
Der Test baut Node selbst; `npm run test:node` wiederholt die HTTP-Abnahme einzeln.
Die bisherigen Cloudflare-/Sites-Builds und Releasepakete bleiben Pflichtchecks.

API-Grundlagen: [Node SQLite](https://nodejs.org/api/sqlite.html),
[Next CLI](https://nextjs.org/docs/app/api-reference/cli/next) und
[Proxy-URL-Normalisierung](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#advanced-proxy-flags).
