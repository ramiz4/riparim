# Riparim

Werkstätten in Kosovo finden, Leistungen und Standort vergleichen und direkt kontaktieren. Kundinnen und Kunden reichen Bewertung und privaten Besuchsnachweis zusammen ein. Erst nach Prüfung durch einen Administrator wird die Bewertung veröffentlicht.

Website: [riparim.com](https://riparim.com)

Für Mitarbeit gelten [CONTRIBUTING.md](CONTRIBUTING.md) und für AI Agents
[AGENTS.md](AGENTS.md): isolierte Aufgaben-Worktrees, Conventional Commits und
Semantic Release als Release-Prozess.

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

Unter `/verwaltung/benutzer` verwaltet die Administration die E-Mail- und Google-Konten des konfigurierten Supabase-Projekts: ansehen, anlegen, bearbeiten, aktivieren, deaktivieren und löschen. Dafür muss `SUPABASE_SECRET_KEY` als serverseitiges Geheimnis auf einen Secret- oder Service-Role-Key desselben Projekts gesetzt werden. Der Schlüssel wird weder in der Oberfläche abgefragt noch an den Browser übertragen.

Administrativ angelegte Konten haben bestätigte E-Mail-Adressen und reguläre Kundenrechte; es wird keine E-Mail versendet. Deaktivierung sperrt neue und bestehende Sitzungen sofort. Nach Reaktivierung ist eine neue Anmeldung erforderlich. Änderungen an E-Mail oder Passwort widerrufen bestehende App-Sitzungen. Löschen entfernt auch zugehörige Besuche, Bewertungen und private Nachweise, einschließlich verknüpfter Altbestände. Bei einem Fehler bleibt das Konto gesperrt und die Löschung kann wiederholt werden. Der Verwaltungszugang ist gegen Sperren, Löschen und Änderung seiner E-Mail-Adresse geschützt.

In der Benutzerverwaltung können Admins weiteren Konten Adminrechte erteilen und diese wieder entziehen. Diese Rolle erlaubt die Verwaltung von Werkstätten, Bewertungen und privaten Nachweisen, Benutzerkonten sowie der Anmeldekonfiguration. Die Zuweisung liegt ausschließlich in der privaten D1-Tabelle `auth_account_roles`, ist an die unveränderliche Konto-ID des Auth-Projekts gebunden und kann nicht über Supabase-Profilmetadaten gesetzt werden. Rollenwechsel widerrufen bestehende App-Sitzungen atomar mit der Rollenänderung; die betroffene Person muss sich erneut mit E-Mail/Passwort oder Google anmelden. Deaktivierte oder unbestätigte Konten erhalten weiterhin keinen Zugriff. Der ursprüngliche Verwaltungszugang behält seine bisherigen Anmeldebedingungen und bleibt als geschützter Admin erhalten. Admins können ihre eigene Rolle nicht entziehen; gleichzeitige Rollenänderungen prüfen die Berechtigung auch unmittelbar beim Schreiben.

Unter `/einstellungen` können angemeldete E-Mail- und Google-Konten ihren Anzeigenamen bearbeiten. Bereits eingereichte Bewertungsnamen bleiben unverändert. Eigene Kontolöschung verlangt eine neue Passwortprüfung beziehungsweise einen serverseitig geprüften Google-OAuth-Ablauf und die Eingabe `KONTO LÖSCHEN`. Kontoziele kommen ausschließlich aus der verifizierten Sitzung. Delegierte Admins, der ursprüngliche Verwaltungszugang und bestätigte administrative Altverknüpfungen sind gegen eigene Löschung geschützt.

Migration `0009` ergänzt die private D1-Tabelle `auth_account_deletions`; bestehende Daten benötigen keine Übernahme. Vor Veröffentlichung ist die Migration anzuwenden. Ein gehashter Löschschlüssel ist zunächst zehn Minuten gültig und wird beim Start der Löschung zur sieben Tage gültigen Fortsetzungsberechtigung. Er ermöglicht keine normale Anmeldung. Teilfehler behalten Sperre und Eigentumsverknüpfung für die Wiederholung; die Bereinigung entfernt auch verwaiste und ältere Nachweisdateien. Nach Ablauf hilft die bestehende administrative Löschfunktion. Es werden keine neuen Supabase-Tabellen oder Mailvorlagen benötigt.

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

`npm test` prüft den Bewertungsablauf, Besitzrechte, Benutzerverwaltung, Katalogfilter sowie Google-Sitzungen und OAuth-Callbacks mit isolierten SQLite-/R2-/Provider-Fixtures. Dabei werden keine echten E-Mails gesendet und keine Produktionsdaten verändert.

Die ergänzende Live- und Browserprüfung steht in [docs/customer-flow-qa.md](docs/customer-flow-qa.md). Die dokumentierte Bestandsprüfung in `data/catalogue-review-2026-10-04.json` führt die unabhängigen Quellen und zurückgestellten Standortkonflikte auf.

GitHub Actions führt Katalogprüfung, Tests, TypeScript, Lint und Worker-Build bei Pull Requests und nach Änderungen an `main` mit dem bestehenden Lockfile aus. Die Prüfung benötigt keine Produktionsgeheimnisse und veröffentlicht die Site nicht automatisch.

## Veröffentlichung

Das Projekt wird über OpenAI Sites veröffentlicht. `.openai/hosting.json` enthält die bestehende Projektzuordnung und die logischen D1-/R2-Bindungen. Laufzeitwerte und Geheimnisse werden außerhalb von Git verwaltet. Ein GitHub-Push löst keine automatische Veröffentlichung aus.

Sites-Veröffentlichungen verwenden den passenden Sites-Workflow: geprüften Quellstand speichern, Worker-Artefakt bauen und die gespeicherte Version deployen. Produktionsmigrationen werden dabei über Sites angewendet. Ein lokaler Worker kann mit `npm start -- --port 5175` geprüft werden.
