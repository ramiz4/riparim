# Portabler Node-Betrieb

Riparim kann neben dem bestehenden Vinext-/Cloudflare-Build denselben
App-Router-Code mit dem bereits installierten Next.js auf einem gewöhnlichen
Node-Server ausführen. Es gibt keine neue Framework- oder Storage-Abhängigkeit.
Cloudflare bleibt das Deployment-Default. Der [Node-Release-/Deploymentweg](node-deployment.md) installiert vorgebaute geprüfte Main-Releases auf einem einzelnen Host ohne App-Neubuild.

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

Der Build erzeugt `.next/` und `.node-runtime/command.mjs`. Ein kleiner `node:http`-Starter übergibt Requests an das vorhandene Next.js.
Nexts Webpack-Build ersetzt `lib/runtime/env` durch den Node-Adapter und den Worker-SMTP-Stub durch den kleinen Node-Versandadapter. Seiten und
APIs verwenden dieselben Geschäftsregeln und SQL-Abfragen wie der Worker.
Die Option `skipProxyUrlNormalize` erhält die ursprüngliche Request-Origin:
sonst können interne Sprach-Rewrites von `127.0.0.1` auf `localhost` als
externe Selbstanfragen ausgeführt werden. Der kanonische `/de`-Redirect bleibt.
Die gemeinsame Verfügbarkeitsprüfung entscheidet vor dem Streaming:
fehlende, ungültige und unveröffentlichte Werkstattprofile erhalten HTTP 404
für HTML, RSC-Navigation und HEAD. Private Entwürfe bleiben verborgen.

Für den Betrieb hinter einem HTTPS-Reverse-Proxy muss `SITE_ORIGIN` die
öffentliche HTTPS-Origin sein. Der Starter validiert HTTP/HTTPS ohne Zugangsdaten,
Pfad, Query oder Fragment und erzeugt daraus Nexts öffentliche Request-Metadaten.
Socket-Bindhost und Port bleiben davon getrennt. Eingehende Host- und
Forwarded-Host/-Proto/-Port-Header überschreiben diese Konfiguration nicht.
Der Reverse-Proxy übernimmt TLS und öffentliche Hostweiterleitungen.
Der Server bindet standardmäßig nur Loopback; `--hostname` und `--port` können
über `npm run start:node -- ...` übergeben werden. Starter und Kommandos laden
`.env` mit Nodes `--env-file-if-exists`. Secrets bleiben serverseitig und gehören
nicht in Git oder Build-Artefakte.

Für IP-Limits verwendet der Node-Adapter die verifizierte Socketadresse aus
einem `AsyncLocalStorage`-Kontext. Starter und Next-Bundle teilen ausschließlich
den Kontextcontainer; gleichzeitig bearbeitete Requests behalten getrennte
Adressen. Frei übergebene `cf-connecting-ip`, `X-Forwarded-For` oder interne
Fakeheader begründen keinen neuen Rate-Limit-Scope. Der Cloudflare-Adapter
verwendet weiterhin den vom eigenen Edge bereitgestellten Header.

Wenn ein Reverse-Proxy vorgeschaltet ist, enthält `RIPARIM_TRUSTED_PROXIES`
ausschließlich seine expliziten IP-Adressen, kommagetrennt. Nur ein Socketpeer
aus dieser Liste darf ein gültiges einzelnes `X-Real-IP` liefern. Der Proxy muss
diesen Header mit der tatsächlich verbundenen Clientadresse **überschreiben**;
ungeprüftes Weiterreichen eines Browserheaders erfüllt diese Grenze nicht.
IPv4-mapped IPv6 und äquivalente IP-Schreibweisen werden normalisiert. Fehlende,
mehrdeutige oder ungültige weitergeleitete Clientadressen fallen auf den Socketpeer
zurück. Ungültige Einträge in der Proxy-Allowlist brechen den Start ab.
Ohne Allowlist werden sämtliche Forwarding-IP-Header ignoriert. Starte über
`start:node`; direktes `next start` stellt keinen Socketkontext bereit und
verwendet konservativ den gemeinsamen `unknown`-Scope.

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
Die echte Anmeldung verwendet den konfigurierten Auth-Host: standardmäßig Supabase, alternativ eine ausdrücklich freigegebene Supabase-kompatible Instanz oder das konkrete PocketBase-Profil gemäß [auth-provider.md](auth-provider.md). `AUTH_TRUSTED_ORIGIN`/`AUTH_TRUSTED_PROVIDER`, die `AUTH_ADMIN_KEY`-Credentialbindings sowie die kompatiblen `SUPABASE_SECRET_KEY`-Werte werden auch im Node-Weg ausschließlich aus der geschützten Laufzeitumgebung gelesen.

`db:migrate:node` führt die SQL-Dateien in aufsteigender Reihenfolge aus.
`riparim_node_migrations` speichert Dateiname, SHA-256 und Zeitpunkt. Jede
Migration und ihr Beleg bilden eine Transaktion. Wiederholungen überspringen
identische angewendete Dateien; geänderte angewendete Dateien führen zum Abbruch.
Es gibt keine neue Drizzle-Migration und keine automatische Datenübernahme aus D1.
Die initiale Katalogübernahme verwendet weiterhin den vorhandenen Import.
Der geprüfte vollständige D1/R2-Export kann mit dem kleinen Offline-Restore in
ein neues Node-Verzeichnis übernommen werden. Ablauf, sichere Retrygrenze und
frischer Rücktransfer stehen in [provider-exit.md](provider-exit.md).

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
  APIs, private Zugriffsverweigerung, gefälschte Sites-Adminheader, echte Socket-IP-
  Limits, parallele vertrauenswürdige Proxyclients und konfigurierte HTTPS-Origins sowie beide
  ausführbaren Migration-/Outbox-Kommandos.

Diese Prüfungen ändern keine Live-Provider und senden keine echten E-Mails.
Der Test baut Node selbst; `npm run test:node` wiederholt die HTTP-Abnahme einzeln.
Die bisherigen Cloudflare-/Sites-Builds und Releasepakete bleiben Pflichtchecks.

API-Grundlagen: [Node SQLite](https://nodejs.org/api/sqlite.html),
[Next-Server](https://nextjs.org/docs/app/guides/custom-server),
[AsyncLocalStorage](https://nodejs.org/api/async_context.html) und
[Proxy-URL-Normalisierung](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#advanced-proxy-flags).
