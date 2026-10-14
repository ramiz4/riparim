# Riparim

Werkstätten in Kosovo finden, Leistungen und Standort vergleichen und direkt kontaktieren. Kundinnen und Kunden reichen Bewertung und privaten Besuchsnachweis zusammen ein. Erst nach Prüfung durch einen Administrator wird die Bewertung veröffentlicht.

Website: [riparim.com](https://riparim.com)

Für Mitarbeit gelten [CONTRIBUTING.md](CONTRIBUTING.md) und für AI Agents
[AGENTS.md](AGENTS.md): isolierte Aufgaben-Worktrees, Conventional Commits und
Semantic Release als Release-Prozess.

## Technik

- React, TypeScript und Vinext mit App Router
- Cloudflare Worker, D1-Datenbank und privater R2-Dateispeicher; die neue Release-Pipeline verwendet den eigenen Cloudflare-Account
- Eigener Auth-Vertrag mit Supabase als Default und konkret austauschbarem PocketBase-Adapter für E-Mail/Passwort und Google OAuth
- Tägliche verschlüsselte Supabase-Auth-Sicherung: [Betrieb und Wiederherstellung](docs/auth-backups.md)
- Ergänzende Sicherung von Authkonfiguration und D1/R2: [Plattformbackups](docs/platform-backups.md)
- Vorbereitete, deaktivierte und portable E-Mail-Überwachung beider Jobs auf Cloudflare oder Node: [Backup-Monitor](docs/backup-monitoring.md)
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

Die lokale Oberfläche ist unter `http://127.0.0.1:5174` erreichbar. Auth-Anbieter und Anmeldeoptionen werden in der geschützten Verwaltung konfiguriert. SMTP und Google OAuth müssen beim Anbieter eingerichtet und getestet werden; der Quellcode allein aktiviert sie nicht.

### Code formatieren

`npm run install:ci` aktiviert über `prepare` automatisch den lokalen Husky-Hook.
Vor jedem Commit formatiert lint-staged ausschließlich gestagte Dateien mit der
festgelegten lokalen Prettier-Version und übernimmt die Formatierung in den Index.
Nicht gestagte Änderungen bleiben erhalten, auch bei teilweise gestagten Dateien.
Ein Syntaxfehler verhindert den Commit und stellt den ursprünglichen Index und
Arbeitsstand wieder her. Der Hook führt keine vollständigen Tests oder Builds aus.

```sh
npm run format
npm run format:check
```

Beide Befehle verwenden denselben Umfang und die Konfiguration in
`.prettierrc.json`. Sie nutzt Prettier-Standardwerte; JSONC-Dateien erhalten keine
abschließenden Kommas, da die vorhandenen Wrangler-Verträge sie mit `JSON.parse`
lesen. `format:check` verändert keine Dateien und prüft die Formatierung
früh in CI. ESLint prüft weiterhin Codequalität; die vorhandenen Regeln enthalten
keine widersprüchlichen Formatierungsregeln. `.prettierignore` bewahrt generierte
Lockfiles und Bindings, angewandte Drizzle-Migrationen sowie unveränderte
Vendor-Quellen einschließlich shadcn und des Sites-Vite-Plugins.

Für Formatierung beim Speichern den Prettier-Editoradapter installieren und die
lokale Projektversion verwenden; die eingecheckte Konfiguration wird automatisch
erkannt. Editorformatierung ist optional. Git-Hooks sind lokal umgehbar; die
Formatierungsprüfung in CI bleibt verbindlich.

Jeder Aufgaben-Worktree benötigt seine eigene Installation. Die Einrichtung
schreibt den Hook-Pfad in dessen Git-Worktree-Konfiguration und bewahrt die Hooks
anderer Worktrees. Bei Bedarf aktiviert sie `extensions.worktreeConfig`; ein
ungewöhnlicher gemeinsamer `core.worktree` muss zuvor in die Konfiguration des
primären Worktrees verschoben werden. CI verwendet `HUSKY=0`; `prepare` überspringt
außerdem Produktionsinstallationen, fehlende Git-Metadaten und Installationen ohne
Husky, etwa die isolierten Tool-Jobs. Nach einer lokalen Installation mit
`--ignore-scripts` aktiviert `npm run prepare` den Hook.

`npm run dev` übernimmt in der lokalen Vorschau zusätzlich den geprüften Katalog und die vorhandene Öffnungszeiten-Importquelle als Standarddaten. Bestehende importierte oder vom Betrieb bestätigte Zeiten, unterdrückte Importe und geänderte Profilidentitäten werden bewahrt.

Ein neuer Worktree braucht vor dem ersten Seitenaufruf die lokale Datenbank aus dem Abschnitt „Datenbank und Prüfung“. Der Entwicklungsserver verwendet dieselben logischen D1-/R2-Bindings wie der Sites-Build; die vorhandenen Migrationen müssen auf diese lokale Datenbank angewendet werden.

Im lokalen Dev-Modus zeigt `/anmelden` den Button „Als Seedy anmelden“. Alternativ führt `/dev/anmelden` ohne Passwort direkt zu den Einstellungen; `?weiter=…` bewahrt ein geprüftes internes Ziel. Der Einstieg und die lesbaren Seed-Kontodaten sind auf die lokale Loopback-Vorschau beschränkt. Mit `REVIEW_MODERATOR_EMAIL=seedy@sites.test` in der ignorierten `.dev.vars` erhält Seedy den lokalen Verwaltungszugang.

`REVIEW_MODERATOR_EMAIL` bestimmt das Administratorkonto und gehört in die Laufzeitkonfiguration. `.env`, lokale Datenbanken, Uploads und Build-Ausgaben sind von Git ausgeschlossen. Die `.env.example` enthält ausschließlich Platzhalter.

Unter `/verwaltung/benutzer` verwaltet die Administration die E-Mail- und Google-Konten des konfigurierten Auth-Anbieters: ansehen, anlegen, bearbeiten, aktivieren, deaktivieren und löschen. Supabase bleibt der Standard; PocketBase verwendet ein unabhängiges REST-Protokoll hinter demselben kleinen App-Vertrag. Für administrative Vorgänge werden ausschließlich serverseitige, separat an Provider und Ziel-Origin gebundene Credentials verwendet. Die Migration `0018_auth_providers.sql` bewahrt bestehende Supabase-Einstellungen/Cookies und ergänzt die Providerbindung privater Löschgrants. Einrichtung, Betriebsgrenzen, Hash-/Resetvoraussetzungen und sichere Kontoübernahme stehen in [docs/auth-provider.md](docs/auth-provider.md).

Administrativ angelegte Konten haben bestätigte E-Mail-Adressen und reguläre Kundenrechte; es wird keine E-Mail versendet. Deaktivierung sperrt neue und bestehende Sitzungen sofort. Nach Reaktivierung ist eine neue Anmeldung erforderlich. Änderungen an E-Mail oder Passwort widerrufen bestehende App-Sitzungen. Löschen entfernt auch zugehörige Besuche, Bewertungen und private Nachweise, einschließlich verknüpfter Altbestände. Bei einem Fehler bleibt das Konto gesperrt und die Löschung kann wiederholt werden. Der Verwaltungszugang ist gegen Sperren, Löschen und Änderung seiner E-Mail-Adresse geschützt.

In der Benutzerverwaltung können Admins weiteren Konten Adminrechte erteilen und diese wieder entziehen. Diese Rolle erlaubt die Verwaltung von Werkstätten, Bewertungen und privaten Nachweisen, Benutzerkonten sowie der Anmeldekonfiguration. Die Zuweisung liegt ausschließlich in der privaten D1-Tabelle `auth_account_roles`, ist an die stabile interne Konto-ID gebunden und kann nicht über Provider-Profilmetadaten gesetzt werden. Rollenwechsel widerrufen bestehende App-Sitzungen atomar mit der Rollenänderung; die betroffene Person muss sich erneut mit E-Mail/Passwort oder Google anmelden. Deaktivierte oder unbestätigte Konten erhalten weiterhin keinen Zugriff. Der ursprüngliche Verwaltungszugang behält seine bisherigen Anmeldebedingungen und bleibt als geschützter Admin erhalten. Admins können ihre eigene Rolle nicht entziehen; gleichzeitige Rollenänderungen prüfen die Berechtigung auch unmittelbar beim Schreiben.

Unter `/einstellungen` können angemeldete E-Mail- und Google-Konten ihren Anzeigenamen bearbeiten. Die Kontodaten zeigen E-Mail-Adresse, Anmeldemethode und bestätigten Status. Ein eigener Passwortbereich startet den bestehenden Ablauf über einen E-Mail-Link; Google-Konten verweisen zur Passwortverwaltung bei Google. Die Kontolöschung steht in einem getrennten Bereich mit den bisherigen Identitäts- und Administrationsschutzprüfungen. Die lokale Loopback-Vorschau bietet Seed-Admin, E-Mail-Konto (`?vorschau=email`) und Google-Konto (`?vorschau=google`) mit fiktiven Daten. Namensänderung, Passwort-Link, Passwortformular und Kontolöschung werden ausschließlich im Seitenzustand simuliert; Konto-, E-Mail- und Sitzungs-APIs bleiben dabei unberührt. Nach einer simulierten Löschung lässt sich die Vorschau zurücksetzen. Die E-Mail-Registrierung verlangt einen Anzeigenamen mit 2–80 Zeichen. Neue und bearbeitete Bewertungen übernehmen ausschließlich den serverseitig geprüften Kontonamen; ein eigener Bewertungsname kann nicht eingegeben werden. Bei fehlenden oder ungültigen Namen älterer oder Google-Konten erscheint „Anonym“, niemals die E-Mail-Adresse als Ersatz. Bereits eingereichte Bewertungsnamen bleiben bei einer reinen Kontonamensänderung unverändert und werden erst bei der nächsten Bewertungsbearbeitung übernommen. Eigene Kontolöschung verlangt eine neue Passwortprüfung beziehungsweise einen serverseitig geprüften Google-OAuth-Ablauf und die Eingabe `KONTO LÖSCHEN`. Kontoziele kommen ausschließlich aus der verifizierten Sitzung. Delegierte Admins, der ursprüngliche Verwaltungszugang und bestätigte administrative Altverknüpfungen sind gegen eigene Löschung geschützt.

Unter `/bewertungen` sehen angemeldete Konten ihre eigenen Einreichungen als eigenständige Seite mit Prüfstatus, privaten Nachweisen und den bisherigen Bearbeitungs-, Ergänzungs- und Löschaktionen. Das Kontomenü, Abschlusslinks und neue Moderationsbenachrichtigungen verwenden diese Seite. Alte Links mit `/?besuche=1` oder `einreichung` führen mit erhaltener Sprache und gültigem Einreichungsziel dorthin. Direktaufruf, Neuladen und Browsernavigation benötigen keinen geöffneten Landing-Dialog. Gäste und abgelaufene Sitzungen erhalten den bestehenden Anmeldeweg mit sicherem Rücksprungziel. Die Seite ist in DE/SQ/EN `noindex,nofollow` ohne private Sprachalternativen; Berechtigungen und Nachweisspeicherung bleiben auf den bestehenden APIs.

Migration `0009` ergänzt die private D1-Tabelle `auth_account_deletions`, Migration `0010` die Upload-Inventartabelle `evidence_uploads`; bestehende Daten benötigen keine Übernahme. Vor Veröffentlichung sind beide Migrationen anzuwenden. Ein gehashter Löschschlüssel ist zunächst zehn Minuten gültig und wird beim Start der Löschung zur sieben Tage gültigen Fortsetzungsberechtigung. Er ermöglicht keine normale Anmeldung. Teilfehler behalten Sperre und Eigentumsverknüpfung für die Wiederholung; die Bereinigung entfernt auch verwaiste und ältere Nachweisdateien. Nach Ablauf hilft die administrative Löschfunktion; unvollständige lokale Bereinigungen erscheinen auch dann in der Benutzerverwaltung, wenn der Anmeldedienst das Konto bereits entfernt hat. Laufende Nachweisuploads werden vor dem Schreiben registriert. Private Dateiinhalte ersetzen ihre leere R2-Reservierung ausschließlich mit einer atomaren ETag-Bedingung. Entfernt die Löschung die Reservierung, kann ein verspäteter Upload keine privaten Dateiinhalte mehr speichern. Verwaiste Reservierungen und fehlgeschlagene Kompensationslöschungen bleiben bereinigbar, ohne die Kontolöschung dauerhaft zu blockieren. Es werden keine neuen Supabase-Tabellen oder Mailvorlagen benötigt.

Unter `/betriebe` sehen angemeldete Konten ihre zugeordneten Werkstattprofile; mehrere Betriebe pro Konto sind möglich. „Profil bearbeiten“ öffnet einen Dialog mit festem Kopf, scrollbarem Formular und festen Aktionen. Die eigenständige Seite `/antraege` zeigt offene und entschiedene Übernahme-Anträge sowie Profiländerungen. Beide Seiten stehen gleichrangig im Kontomenü. Alte Links auf `/betrieb` und `/betrieb/beanspruchen` werden mit erhaltenen Parametern auf die neuen Adressen weitergeleitet.

„Werkstattprofil beanspruchen“ ist eine eigene Seite unter `/betriebe/beanspruchen?werkstatt=…`, erreichbar über das öffentliche Werkstattprofil. Antragstellende wählen ihre Verbindung zum Betrieb: Inhaber, Geschäftsführer, bevollmächtigte Person oder eine andere Verbindung mit eigener Erklärung. Der gewählte Bezug wird als private Erklärung gespeichert; bei einer anderen Verbindung sind mindestens 40 Zeichen nötig. Jeder neue Antrag benötigt 1–5 Dokumente als PDF, JPG oder PNG, jeweils bis 5 MiB und zusammen bis 10 MiB. Nur Antragsteller und Verwaltung können sie herunterladen. Direktaufrufe ohne gültiges Profil zeigen einen Link zum Werkstattfinder. Nach erfolgreicher Einreichung führt die Bestätigung zu „Meine Betriebsanträge“.

Die Verwaltung bestätigt oder lehnt Betriebsanträge unter `/verwaltung/betriebe` mit einer passenden Begründungsauswahl ab. Auch Prüfvermerke für Bewertungen bieten Standardgründe und eine eigene Erklärung bei „Anderer Grund“. Diese Vermerke bleiben privat. Pro Profil besteht höchstens eine bestätigte Zuordnung; konkurrierende Anträge können keine zusätzlichen Rechte erteilen. Ein bestätigter Betriebszugang verleiht keine Adminrolle und erlaubt ausschließlich Änderungsentwürfe für eigene Profile. Kontakt, Leistungen und Beschreibung werden erst nach erneuter Freigabe öffentlich übernommen. Name, Standort, Quellen, Prüfdatum und Freigabestatus bleiben geschützt. Geänderte Telefonnummern benötigen die bestehende strikte Google-Prüfung; deren Vorbereitung überschreibt die öffentliche Zuordnung nicht. Ein zwischenzeitlich geändertes Profil verhindert die Übernahme eines alten Entwurfs. Die Übersicht lädt nach Änderungen automatisch nach; eine Wiederholung wird nur bei Ladefehlern angeboten.

D1-Migration `0011` ergänzt `workshop_claims`, `workshop_owners` und `workshop_changes`. Sie erfordert keine Übernahme bestehender Daten und muss vor Veröffentlichung angewendet werden. Migration `0014` ergänzt nullable Dateimetadaten für private Inhabernachweise. Bestehende Textnachweise und Beleglinks bleiben erhalten; es ist keine Datenübernahme nötig. Die Verwaltung muss Nachweise unabhängig prüfen. Uploads nutzen den bestehenden privaten R2-Speicher und das Upload-Inventar; Kontolöschung bereinigt auch diese Dokumente. Kontolöschung entfernt private Anträge, Entwürfe und Betriebszuordnungen einschließlich bestätigter Altverknüpfungen, lässt aber die unabhängig gepflegten Katalogprofile bestehen. Freigegebene Betriebsänderungen müssen vor dem nächsten Katalogimport wie Adminänderungen exportiert werden.

Bei Bewertungsfreigabe und angeforderter Nachweisergänzung speichert die Moderation zusammen mit der Statusänderung ein dauerhaftes Ereignis in `review_notifications`. Die Nachricht enthält ausschließlich den Status und einen Link über die Anmeldung zur eigenen Einreichung; Namen, Bewertungstext, Fahrzeugdaten, private Nachweise und Prüfvermerke werden nicht versendet. Empfänger kommen aus dem serverseitig geprüften Konto des gewählten Auth-Anbieters; bestätigte Altverknüpfungen werden berücksichtigt. Fehlende bestätigte Adressen und gesperrte Konten bleiben in den privaten Versandereignissen nachvollziehbar.

Der Standardversand verwendet weiterhin den bestehenden Resend-Dienst und die bestätigte Domain `auth.riparim.com`. `RESEND_API_KEY` ist ein serverseitiges Geheimnis aus dem vorhandenen geschützten Projektzugang, `TRANSACTIONAL_EMAIL_FROM` der Absender, beispielsweise `Riparim <no-reply@auth.riparim.com>`. Der passend gebundene Auth-Adminschlüssel wird zur Prüfung bestätigter Kontoadressen benötigt; Supabase behält den kompatiblen `SUPABASE_SECRET_KEY`-Weg. Gemeinsame DE/SQ/EN-Mailcopy liegt in `lib/email-content.ts`; `lib/notifications/email.ts` rendert die Reviewmails mit Betreff und ausschließlich HTML mit Sprache, Titel und beschriftetem Link. `text: ""` deaktiviert die automatische Klartexterzeugung von Resend. Der erste Versuch verwendet ausschließlich die validierte Präferenz des bestätigten Empfängers; fehlende oder ungültige Werte bleiben deutsch. Gespeicherte Retries behalten ihre ursprüngliche Sprache und sämtliche Versandbytes auch nach einer Präferenz- oder Releaseänderung. Das gilt auch für historische Payloads, die noch einen Klartextteil enthalten.

Bestätigungs-/Recoverybetreff und HTML-Vorlage liegen in
`lib/auth/email-templates.ts`. Die Anwendung erzeugt weiterhin den stabilen
Callback mit `?locale=…&weiter=…`. Die gesonderte Providerübernahme nach einem
geprüften Main-Release steht in [der Mailaktivierung](docs/customer-flow-qa.md#lokalisierte-mailvorlagen-und-provideraktivierung-issue-52).
Es gibt keine neue Mailplattform, Migration oder Auth-Hook-Infrastruktur.

Der reproduzierbare Anbieterwechsel mit geschütztem App-/Dateibackup, frischem Node-Restore und Daten erhaltendem Rückweg steht in [provider-exit.md](docs/provider-exit.md).

Der portable Node-Betrieb unterstützt zusätzlich SMTP über `EMAIL_TRANSPORT=smtp`, `SMTP_URL` und `SMTP_SECRET_ORIGIN`. Migration `0017_mail_transports.sql` ergänzt Transportbindung, eingefrorene MIME-Bytes und eine dauerhafte SMTP-Startmarkierung. Unklare SMTP-Übergaben werden auch bei administrativem Retry nicht erneut gesendet. Konfiguration, TLS-Prüfung und der kontrollierte Wechselweg stehen in [mail-transports.md](docs/mail-transports.md). Der Worker behält den HTTP-Versand über Resend.

Migration `0012` ergänzt die private Versandtabelle; historische Moderationsentscheidungen werden nicht nachträglich benachrichtigt. Der Erstversand wird direkt nach der gespeicherten Moderationsentscheidung abgewartet. Es gibt keinen periodischen Mailjob. Bei Fehlern erlaubt die geschützte Verwaltung höchstens fünf manuelle Wiederholungen nach 1, 5, 15, 30 und 60 Minuten Wartezeit. Limit und Wartezeit werden atomar serverseitig geprüft. Die Übersicht aktualisiert sich nach einer Aktion oder auf ausdrücklichen Abruf; sie pollt nicht. Providerfehler widerrufen die erfolgreiche Moderation nicht. Unklare SMTP-Übergaben und abgelaufene Resend-Idempotenzfenster bleiben gegen unkontrollierten Neuversand gesperrt. Bereits gespeicherte Ereignisse und Payloadbytes bleiben erhalten. Der Release entfernt den bisherigen Cron mit einer explizit leeren Cronliste; keine neue Migration ist erforderlich.

Jede Entscheidung besitzt einen eindeutigen Idempotenzschlüssel je Einreichung und Revision. Nach dem ersten Versuch bleiben Empfänger und Nachrichteninhalt unverändert. Wiederholungen enden konservativ nach 23 Stunden, da [Resend die Schlüssel 24 Stunden speichert](https://resend.com/docs/dashboard/emails/idempotency-keys); unklare ältere Ereignisse benötigen eine Prüfung beim Versanddienst. Ein geänderter Empfänger oder eine geänderte Versandschlüssel-Konfiguration verhindert eine unsichere Wiederholung. Nach erfolgreicher Übergabe wird der eingefrorene Adress-/Nachrichteninhalt aus der lokalen Tabelle entfernt. „An Versanddienst übergeben“ bestätigt keine endgültige Zustellung. Das Löschen der Einreichung oder des Kontos entfernt zugehörige lokale Versandereignisse.

Der portable Entwicklungsserver bietet eine lokale ChatGPT-Testidentität unter `/signin-with-chatgpt?return_to=/`. Diese Simulation gilt nur auf Loopback und wird nicht in den Produktionsbuild übernommen. Verwende sie nicht als Ersatz für Tests der echten Anmeldung.

## Portabler Node-Server

Zusätzlich zum Cloudflare-Worker kann derselbe App-Code mit Next.js auf Node
laufen. `npm run build:node`, `npm run db:migrate:node` und
`npm run start:node -- --port 5174` verwenden SQLite und einen privaten lokalen
Blob-Dateispeicher. Konfiguration, Sicherung, manueller Versand und Grenzen
stehen in [docs/node-runtime.md](docs/node-runtime.md). Der bestehende
Cloudflare-Default bleibt bestehen. Geprüfte vorgebaute Nodepakete und der hostlokale Installations-/Deploymentweg stehen in [docs/node-deployment.md](docs/node-deployment.md).

Interne Konto-IDs werden über eine private, additive Identitätszuordnung von
externen Anmeldekonten getrennt. Bestehende Besitzschlüssel und Dateipfade
bleiben erhalten. Rollout, geprüfte Anbieterzuordnung, Sperrerhalt und Rückweg
stehen in [docs/account-identities.md](docs/account-identities.md).

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

Auf Linux, macOS und WSL laufen unabhängige Test-Suites in vier getrennten
Node-Prozessen gleichzeitig. `TEST_CONCURRENCY=1 npm test` erhält die serielle
Diagnose; Werte von 1 bis 4 sind erlaubt. Für Windows verwende WSL: Native
Windows-Ausführung wird vor dem Start von Suites abgelehnt, da dort die sichere
Bereinigung über POSIX-Prozessgruppen fehlt.
Logs tragen den Namen ihrer Suite. Die i18n-Prüfung läuft zuerst; Fehler oder
Abbruch stoppen laufende Suites, bevor das gemeinsame Testverzeichnis entfernt
wird. Ressourcenprüfung und Laufzeitmessung stehen in
[der Test-Runner-Dokumentation](docs/test-suite-concurrency.md).

`npm run build` prüft zusätzlich den erzeugten Browser-Code: Der echte gebündelte Link muss die Navigation auslösen und auch nach einem fehlgeschlagenen Prefetch funktionieren. Die Prüfung läuft für Cloudflare- und Sites-Builds mit isolierten Browser-/Netzwerk-Fixtures. Nach einem vorhandenen Build lässt sie sich mit `npm run test:client-build` einzeln wiederholen.

Die ergänzende Live- und Browserprüfung steht in [docs/customer-flow-qa.md](docs/customer-flow-qa.md). Die dokumentierte Bestandsprüfung in `data/catalogue-review-2026-10-04.json` führt die unabhängigen Quellen und zurückgestellten Standortkonflikte auf.

GitHub Actions prüft Katalog, Tests, TypeScript, Lint und Worker-Build bei Pull Requests. Nach einem Squash-Merge nach `main` erstellt `semantic-release` bei relevanten Conventional Commits einen versionierten GitHub Release und veröffentlicht dessen geprüftes Worker-Artefakt auf Cloudflare. Details und nötige Produktions-Secrets stehen in [docs/releases.md](docs/releases.md).

## Veröffentlichung

Die Veröffentlichung auf `https://riparim.com` erfolgt ausschließlich über den Workflow **Release** aus dem gemergten `main`. `wrangler.jsonc` ist die Quelle für Zielaccount, Ressourcen, die beiden eigenen Custom Domains und Laufzeitvariablen. Das GitHub-Environment `production` erlaubt nur `main` und verwahrt die Deployment-/Anwendungs-Secrets. Offene PRs werden nicht veröffentlicht.

Die Datenübernahme und Produktionsumstellung sind [geprüft und abgenommen](docs/domain-cutover-2026-10-05.md). Der [Gesamtabschluss](docs/release-handover-2026-10-05.md) ordnet die Nachweise den Abnahmekriterien zu. Die bisherige OpenAI Site ist [öffentlich stillgelegt](docs/sites-retirement.md); Owner-Zugang, Daten und Versionen bleiben zur gesicherten Aufbewahrung erhalten. `.openai/hosting.json` identifiziert dieses historische Projekt für das geprüfte Sites-Archiv und lokale Bindings; es ist kein produktives Deploymentziel der regulären Pipeline. Native Sites-Tokens werden nicht für CI verwendet. Der eigene Cloudflare-Worker entfernt native Sites-Identitätsheader am Eingang. Ein lokaler Worker kann mit `npm start -- --port 5175` geprüft werden.
