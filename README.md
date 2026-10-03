# Riparim

Werkstätten in Kosovo finden, Leistungen und Standort vergleichen und direkt kontaktieren. Kundinnen und Kunden reichen Bewertung und privaten Besuchsnachweis zusammen ein. Erst nach Prüfung durch einen Administrator wird die Bewertung veröffentlicht.

Website: [riparim.com](https://riparim.com)

## Technik

- React, TypeScript und Vinext mit App Router
- Cloudflare Worker, D1-Datenbank und privater R2-Dateispeicher über OpenAI Sites
- Supabase Auth für E-Mail/Passwort und Google OAuth
- Drizzle für Schema und SQL-Migrationen

Öffentlich sichtbar sind ausschließlich freigegebene Werkstätten und Bewertungen. Nachweise und Kontodaten werden nicht im Repository gespeichert. Werkstattdaten enthalten Quellen; Einträge aus Verzeichnissen bleiben bis zur Freigabe Entwürfe.

## Lokal starten

Voraussetzungen: Node.js ab 22.13 und npm.

```sh
npm run install:ci
cp .env.example .env
npm run dev -- --host 127.0.0.1 --port 5174
```

Die lokale Oberfläche ist unter `http://127.0.0.1:5174` erreichbar. Supabase-Projekt und Anmeldeoptionen werden in der geschützten Verwaltung konfiguriert. SMTP und Google OAuth müssen beim Anbieter eingerichtet und getestet werden; der Quellcode allein aktiviert sie nicht.

`REVIEW_MODERATOR_EMAIL` bestimmt das Administratorkonto und gehört in die Laufzeitkonfiguration. `.env`, lokale Datenbanken, Uploads und Build-Ausgaben sind von Git ausgeschlossen. Die `.env.example` enthält ausschließlich Platzhalter.

Der portable Entwicklungsserver bietet eine lokale ChatGPT-Testidentität unter `/signin-with-chatgpt?return_to=/`. Diese Simulation gilt nur auf Loopback und wird nicht in den Produktionsbuild übernommen. Verwende sie nicht als Ersatz für Tests der echten Anmeldung.

## Datenbank und Prüfung

Migrationen liegen in `drizzle/`. Nach Änderungen am Schema:

```sh
npm run db:generate
```

Für eine neue lokale Datenbank zuerst bauen und die SQL-Migrationen in aufsteigender Reihenfolge anwenden. Bereits angewendete Migrationen nicht erneut ausführen:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_handy_black_queen.sql
```

Den letzten Befehl für die jeweils noch ausstehenden Dateien wiederholen.

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
```

`npm test` prüft den Bewertungsablauf, Besitzrechte, Katalogfilter sowie Google-Sitzungen und OAuth-Callbacks mit isolierten SQLite-/R2-/Provider-Fixtures. Dabei werden keine echten E-Mails gesendet und keine Produktionsdaten verändert.

## Veröffentlichung

Das Projekt wird über OpenAI Sites veröffentlicht. `.openai/hosting.json` enthält die bestehende Projektzuordnung und die logischen D1-/R2-Bindungen. Laufzeitwerte und Geheimnisse werden außerhalb von Git verwaltet. Ein GitHub-Push löst keine automatische Veröffentlichung aus.

Sites-Veröffentlichungen verwenden den passenden Sites-Workflow: geprüften Quellstand speichern, Worker-Artefakt bauen und die gespeicherte Version deployen. Produktionsmigrationen werden dabei über Sites angewendet. Ein lokaler Worker kann mit `npm start -- --port 5175` geprüft werden.
