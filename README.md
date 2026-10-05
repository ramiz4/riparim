# Riparim

Werkstätten in Kosovo finden, Leistungen und Standort vergleichen und direkt kontaktieren. Kundinnen und Kunden reichen Bewertung und privaten Besuchsnachweis zusammen ein. Erst nach Prüfung durch einen Administrator wird die Bewertung veröffentlicht.

Website: [riparim.com](https://riparim.com)

Für Mitarbeit gelten [CONTRIBUTING.md](CONTRIBUTING.md) und für AI Agents
[AGENTS.md](AGENTS.md): isolierte Aufgaben-Worktrees, Conventional Commits und
Semantic Release als Release-Prozess.

## Technik

- React, TypeScript und Vinext mit App Router
- Cloudflare Worker, D1-Datenbank und privater R2-Dateispeicher; die neue Release-Pipeline verwendet den eigenen Cloudflare-Account
- Supabase Auth für E-Mail/Passwort und Google OAuth
- Drizzle für Schema und SQL-Migrationen

Öffentlich sichtbar sind ausschließlich freigegebene Werkstätten und Bewertungen. Nachweise und Kontodaten werden nicht im Repository gespeichert. Werkstattdaten enthalten Quellen; Einträge aus Verzeichnissen bleiben bis zur Freigabe Entwürfe.

## Lokal starten

Voraussetzungen: Node.js 22 ab 22.14 oder ab 24.10 und npm. CI verwendet Node.js 24.
Für `npm test` und den Auth-Mailvorlagenexport ist zusätzlich Go 1.27.1 nötig;
CI richtet diese Version fest ein. Die Templates werden mit echtem Go
`html/template` geprüft, ohne Module oder weitere Go-Abhängigkeiten. Ist Go
nicht auf dem `PATH`, kann `RIPARIM_GO_BINARY` auf die ausführbare Datei zeigen.

```sh
npm run install:ci
cp .env.example .env
npm run dev -- --host 127.0.0.1 --port 5174
```

Die lokale Oberfläche ist unter `http://127.0.0.1:5174` erreichbar. Supabase-Projekt und Anmeldeoptionen werden in der geschützten Verwaltung konfiguriert. SMTP und Google OAuth müssen beim Anbieter eingerichtet und getestet werden; der Quellcode allein aktiviert sie nicht.

Ein neuer Worktree braucht vor dem ersten Seitenaufruf die lokale Datenbank aus dem Abschnitt „Datenbank und Prüfung“. Der Entwicklungsserver verwendet dieselben logischen D1-/R2-Bindings wie der Sites-Build; die vorhandenen Migrationen müssen auf diese lokale Datenbank angewendet werden.

`REVIEW_MODERATOR_EMAIL` bestimmt das Administratorkonto und gehört in die Laufzeitkonfiguration. `.env`, lokale Datenbanken, Uploads und Build-Ausgaben sind von Git ausgeschlossen. Die `.env.example` enthält ausschließlich Platzhalter.

Unter `/verwaltung/benutzer` verwaltet die Administration die E-Mail- und Google-Konten des konfigurierten Supabase-Projekts: ansehen, anlegen, bearbeiten, aktivieren, deaktivieren und löschen. Dafür muss `SUPABASE_SECRET_KEY` als serverseitiges Geheimnis auf einen Secret- oder Service-Role-Key desselben Projekts gesetzt werden. Der Schlüssel wird weder in der Oberfläche abgefragt noch an den Browser übertragen.

Administrativ angelegte Konten haben bestätigte E-Mail-Adressen und reguläre Kundenrechte; es wird keine E-Mail versendet. Deaktivierung sperrt neue und bestehende Sitzungen sofort. Nach Reaktivierung ist eine neue Anmeldung erforderlich. Änderungen an E-Mail oder Passwort widerrufen bestehende App-Sitzungen. Löschen entfernt auch zugehörige Besuche, Bewertungen und private Nachweise, einschließlich verknüpfter Altbestände. Bei einem Fehler bleibt das Konto gesperrt und die Löschung kann wiederholt werden. Der Verwaltungszugang ist gegen Sperren, Löschen und Änderung seiner E-Mail-Adresse geschützt.

In der Benutzerverwaltung können Admins weiteren Konten Adminrechte erteilen und diese wieder entziehen. Diese Rolle erlaubt die Verwaltung von Werkstätten, Bewertungen und privaten Nachweisen, Benutzerkonten sowie der Anmeldekonfiguration. Die Zuweisung liegt ausschließlich in der privaten D1-Tabelle `auth_account_roles`, ist an die unveränderliche Konto-ID des Auth-Projekts gebunden und kann nicht über Supabase-Profilmetadaten gesetzt werden. Rollenwechsel widerrufen bestehende App-Sitzungen atomar mit der Rollenänderung; die betroffene Person muss sich erneut mit E-Mail/Passwort oder Google anmelden. Deaktivierte oder unbestätigte Konten erhalten weiterhin keinen Zugriff. Der ursprüngliche Verwaltungszugang behält seine bisherigen Anmeldebedingungen und bleibt als geschützter Admin erhalten. Admins können ihre eigene Rolle nicht entziehen; gleichzeitige Rollenänderungen prüfen die Berechtigung auch unmittelbar beim Schreiben.

Unter `/einstellungen` können angemeldete E-Mail- und Google-Konten ihren Anzeigenamen bearbeiten. Bereits eingereichte Bewertungsnamen bleiben unverändert. Eigene Kontolöschung verlangt eine neue Passwortprüfung beziehungsweise einen serverseitig geprüften Google-OAuth-Ablauf und die Eingabe `KONTO LÖSCHEN`. Kontoziele kommen ausschließlich aus der verifizierten Sitzung. Delegierte Admins, der ursprüngliche Verwaltungszugang und bestätigte administrative Altverknüpfungen sind gegen eigene Löschung geschützt.

Migration `0009` ergänzt die private D1-Tabelle `auth_account_deletions`, Migration `0010` die Upload-Inventartabelle `evidence_uploads`; bestehende Daten benötigen keine Übernahme. Vor Veröffentlichung sind beide Migrationen anzuwenden. Ein gehashter Löschschlüssel ist zunächst zehn Minuten gültig und wird beim Start der Löschung zur sieben Tage gültigen Fortsetzungsberechtigung. Er ermöglicht keine normale Anmeldung. Teilfehler behalten Sperre und Eigentumsverknüpfung für die Wiederholung; die Bereinigung entfernt auch verwaiste und ältere Nachweisdateien. Nach Ablauf hilft die administrative Löschfunktion; unvollständige lokale Bereinigungen erscheinen auch dann in der Benutzerverwaltung, wenn der Anmeldedienst das Konto bereits entfernt hat. Laufende Nachweisuploads werden vor dem Schreiben registriert. Private Dateiinhalte ersetzen ihre leere R2-Reservierung ausschließlich mit einer atomaren ETag-Bedingung. Entfernt die Löschung die Reservierung, kann ein verspäteter Upload keine privaten Dateiinhalte mehr speichern. Verwaiste Reservierungen und fehlgeschlagene Kompensationslöschungen bleiben bereinigbar, ohne die Kontolöschung dauerhaft zu blockieren. Es werden keine neuen Supabase-Tabellen oder Mailvorlagen benötigt.

Unter `/betrieb` können angemeldete Konten bestehende öffentliche Werkstattprofile mit einem privaten, nachvollziehbaren Inhabernachweis und optionalen HTTPS-Beleglinks beanspruchen. Die Verwaltung bestätigt oder lehnt den Antrag unter `/verwaltung/betriebe` mit Begründung ab. Pro Profil besteht höchstens eine bestätigte Zuordnung; konkurrierende Anträge können keine zusätzlichen Rechte erteilen. Ein bestätigter Betriebszugang verleiht keine Adminrolle und erlaubt ausschließlich Änderungsentwürfe für eigene Profile. Kontakt, Leistungen und Beschreibung werden erst nach erneuter Freigabe öffentlich übernommen. Name, Standort, Quellen, Prüfdatum und Freigabestatus bleiben geschützt. Geänderte Telefonnummern benötigen die bestehende strikte Google-Prüfung; deren Vorbereitung überschreibt die öffentliche Zuordnung nicht. Ein zwischenzeitlich geändertes Profil verhindert die Übernahme eines alten Entwurfs.

D1-Migration `0011` ergänzt `workshop_claims`, `workshop_owners` und `workshop_changes`. Sie erfordert keine Übernahme bestehender Daten und muss vor Veröffentlichung angewendet werden. Nachweise sind Text und Beleglinks, keine öffentlichen Anhänge; die Verwaltung muss sie unabhängig prüfen. Kontolöschung entfernt private Anträge, Entwürfe und Betriebszuordnungen einschließlich bestätigter Altverknüpfungen, lässt aber die unabhängig gepflegten Katalogprofile bestehen. Freigegebene Betriebsänderungen müssen vor dem nächsten Katalogimport wie Adminänderungen exportiert werden.

Bei Bewertungsfreigabe und angeforderter Nachweisergänzung speichert die Moderation zusammen mit der Statusänderung ein dauerhaftes Ereignis in `review_notifications`. Die Nachricht enthält ausschließlich den Status und einen Link über die Anmeldung zur eigenen Einreichung; Namen, Bewertungstext, Fahrzeugdaten, private Nachweise und Prüfvermerke werden nicht versendet. Empfänger kommen aus dem serverseitig geprüften Supabase-Konto; bestätigte Altverknüpfungen werden berücksichtigt. Fehlende bestätigte Adressen und gesperrte Konten bleiben ausdrücklich in der Versandübersicht erkennbar.

Der Versand verwendet den bestehenden Resend-Dienst und die bestätigte Domain `auth.riparim.com`. `RESEND_API_KEY` ist ein serverseitiges Geheimnis aus dem vorhandenen geschützten Projektzugang, `TRANSACTIONAL_EMAIL_FROM` der Absender, beispielsweise `Riparim <no-reply@auth.riparim.com>`. `SUPABASE_SECRET_KEY` wird zur Prüfung bestätigter Kontoadressen benötigt. Gemeinsame DE/SQ/EN-Mailcopy liegt in `lib/email-content.ts`; `lib/notifications/email.ts` rendert die Reviewmails mit Betreff und ausschließlich HTML mit Sprache, Titel und beschriftetem Link. Der erste Versuch verwendet ausschließlich die validierte Präferenz des bestätigten Empfängers; fehlende oder ungültige Werte bleiben deutsch. Gespeicherte Retries behalten ihre ursprüngliche Sprache und sämtliche Versandbytes auch nach einer Präferenz- oder Releaseänderung. Das gilt auch für historische Payloads, die noch einen Klartextteil enthalten.

Bestätigungs-/Recoverybetreff und HTML-Vorlage liegen in
`lib/auth/email-templates.ts`. Die Anwendung erzeugt weiterhin den stabilen
Callback mit `?locale=…&weiter=…`. Die gesonderte Providerübernahme nach einem
geprüften Main-Release steht in [der Mailaktivierung](docs/customer-flow-qa.md#lokalisierte-mailvorlagen-und-provideraktivierung-issue-52).
Es gibt keine neue Mailplattform, Migration oder Auth-Hook-Infrastruktur.

Migration `0012` ergänzt die private Versandtabelle und muss vor Veröffentlichung angewendet werden; historische Moderationsentscheidungen werden nicht nachträglich benachrichtigt. Der erste Versand wird an den Worker-Kontext gebunden. Ein deklarierter Worker-Cron prüft fällige Ereignisse alle fünf Minuten; im lokalen Betrieb wird der Scheduled-Handler ausschließlich über die lokale Testfunktion ausgelöst. Die Verwaltung kann Ereignisse unter „Bewertungen prüfen“ kontrolliert erneut prüfen. Providerfehler widerrufen die erfolgreiche Moderation nicht. Die konfigurierte Produktion muss den Scheduled-Handler und den Cron aus dem Worker-Artefakt übernehmen.

Jede Entscheidung besitzt einen eindeutigen Idempotenzschlüssel je Einreichung und Revision. Nach dem ersten Versuch bleiben Empfänger und Nachrichteninhalt unverändert. Wiederholungen enden konservativ nach 23 Stunden, da [Resend die Schlüssel 24 Stunden speichert](https://resend.com/docs/dashboard/emails/idempotency-keys); unklare ältere Ereignisse benötigen eine Prüfung beim Versanddienst. Ein geänderter Empfänger oder eine geänderte Versandschlüssel-Konfiguration verhindert eine unsichere Wiederholung. Nach erfolgreicher Übergabe wird der eingefrorene Adress-/Nachrichteninhalt aus der lokalen Tabelle entfernt. „An Versanddienst übergeben“ bestätigt keine endgültige Zustellung. Das Löschen der Einreichung oder des Kontos entfernt zugehörige lokale Versandereignisse.

Der portable Entwicklungsserver bietet eine lokale ChatGPT-Testidentität unter `/signin-with-chatgpt?return_to=/`. Diese Simulation gilt nur auf Loopback und wird nicht in den Produktionsbuild übernommen. Verwende sie nicht als Ersatz für Tests der echten Anmeldung.

## Datenbank und Prüfung

Migrationen liegen in `drizzle/`. Nach Änderungen am Schema:

```sh
npm run db:generate
```

Für eine neue lokale Entwicklungsdatenbank zuerst den Sites-Worker bauen und die SQL-Migrationen in aufsteigender Reihenfolge anwenden. Bereits angewendete Migrationen nicht erneut ausführen:

```sh
BUILD_TARGET=sites npm run build
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

`npm run build` prüft zusätzlich den erzeugten Browser-Code: Der echte gebündelte Link muss die Navigation auslösen und auch nach einem fehlgeschlagenen Prefetch funktionieren. Die Prüfung läuft für Cloudflare- und Sites-Builds mit isolierten Browser-/Netzwerk-Fixtures. Nach einem vorhandenen Build lässt sie sich mit `npm run test:client-build` einzeln wiederholen.

Die ergänzende Live- und Browserprüfung steht in [docs/customer-flow-qa.md](docs/customer-flow-qa.md). Die dokumentierte Bestandsprüfung in `data/catalogue-review-2026-10-04.json` führt die unabhängigen Quellen und zurückgestellten Standortkonflikte auf.

GitHub Actions prüft Katalog, Tests, TypeScript, Lint und Worker-Build bei Pull Requests. Nach einem Squash-Merge nach `main` erstellt `semantic-release` bei relevanten Conventional Commits einen versionierten GitHub Release und veröffentlicht dessen geprüftes Worker-Artefakt auf Cloudflare. Details und nötige Produktions-Secrets stehen in [docs/releases.md](docs/releases.md).

## Veröffentlichung

Die Veröffentlichung auf `https://riparim.com` erfolgt ausschließlich über den Workflow **Release** aus dem gemergten `main`. `wrangler.jsonc` ist die Quelle für Zielaccount, Ressourcen, die beiden eigenen Custom Domains und Laufzeitvariablen. Das GitHub-Environment `production` erlaubt nur `main` und verwahrt die Deployment-/Anwendungs-Secrets. Offene PRs werden nicht veröffentlicht.

Die Datenübernahme und Produktionsumstellung sind [geprüft und abgenommen](docs/domain-cutover-2026-10-05.md). Der [Gesamtabschluss](docs/release-handover-2026-10-05.md) ordnet die Nachweise den Abnahmekriterien zu. Die bisherige OpenAI Site ist [öffentlich stillgelegt](docs/sites-retirement.md); Owner-Zugang, Daten und Versionen bleiben zur gesicherten Aufbewahrung erhalten. `.openai/hosting.json` identifiziert dieses historische Projekt für das geprüfte Sites-Archiv und lokale Bindings; es ist kein produktives Deploymentziel der regulären Pipeline. Native Sites-Tokens werden nicht für CI verwendet. Der eigene Cloudflare-Worker entfernt native Sites-Identitätsheader am Eingang. Ein lokaler Worker kann mit `npm start -- --port 5175` geprüft werden.
