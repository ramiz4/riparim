# Kundenablauf: Prüfung vom 4. Oktober 2026

## Live geprüft

- Die Testregistrierung wurde über die veröffentlichte Site durchgeführt. Der Versanddienst bestätigte die Zustellung, und der Nutzer bestätigte seine E-Mail-Adresse.
- Die Bestätigungs- und Wiederherstellungsvorlagen im bestehenden Supabase-Projekt verwenden jetzt den serverseitigen Token-Hash-Callback. Der `weiter`-Parameter bleibt erhalten; eine Anmeldung nach Bestätigung führt dadurch zur ursprünglichen Werkstatt und Bewertungsstelle zurück.
- Eine echte Wiederherstellungs-E-Mail mit der neuen Vorlage wurde zugestellt. Der Nutzer bestätigte die erfolgreiche Passwortänderung und die Rückkehr zur Anmeldung.
- Anschließend wurde die geprüfte E-Mail-Zustellung in der geschützten Site-Verwaltung freigegeben. Der reguläre Site-Endpunkt `/api/auth/recovery` lieferte HTTP 200; auch diese E-Mail wurde zugestellt. Die Freigabe liegt in der Laufzeitdatenbank, nicht in Git.

Testadressen, Passwörter, Bestätigungstokens und Sitzungen werden nicht in dieser Dokumentation gespeichert. Das bestehende SMTP-Projekt wurde beibehalten. Die Vorlagen entsprechen dem dokumentierten [Supabase-Token-Hash-Verfahren](https://supabase.com/docs/guides/auth/auth-email-templates); der Versand verwendet [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Bewertungsablauf im lokalen Browser

Der portable Entwicklungsserver verwendete ausschließlich die lokale Testidentität und projektlokale SQLite-/R2-Speicher. Eine ausdrücklich als Test gekennzeichnete Bewertung wurde mit einer PNG-Testdatei eingereicht. Sie erschien zunächst nur unter den eigenen Einreichungen und in der Prüfverwaltung. Ein nicht angemeldeter Abruf des privaten Nachweises wurde mit HTTP 401 zurückgewiesen.

Nach lokaler Admin-Freigabe erschienen Text und vier Sterne im Werkstattprofil. Eine Bearbeitung verwendete den vorhandenen Beleg weiter und setzte die Einreichung erneut auf „In Prüfung“; die öffentliche Bewertung verschwand. Anschließend wurde die gesamte lokale Einreichung gelöscht. Die eigenen und öffentlichen Listen waren leer, der Nachweis lieferte HTTP 404, und die lokalen R2-Objekt-, Multipart- und Part-Tabellen enthielten jeweils null Datensätze. Es wurden keine fiktiven Kundenbewertungen in Produktion veröffentlicht.

## Automatisierte Prüfung

`npm test` prüft die Routen mit isolierten Provider-, SQLite- und R2-Fixtures. Neu abgedeckt sind der gesamte E-Mail-Ablauf mit erhaltenem Rücksprungziel, ungültige Tokens, Providerfehler, Passwortänderung mit kontoübergreifender Sitzungswiderrufung und Abmeldung. Die Speicherprüfungen umfassen jetzt auch fehlgeschlagene Löschung mit Wiederholung, drei Seiten alter Belege und eine Löschung während eines verspäteten Ersatz-Uploads. Diese Tests senden keine echten E-Mails und verändern keine Produktionsdaten.

Die übrigen Freigabeprüfungen sind `npm run catalog:check`, `npx tsc --noEmit`, `npm run lint` und der Sites-Worker-Build. Der Katalogtest schützt die neun neuen Freigaben, 13 bestätigten Koordinaten und zwei zurückgestellten Standortkonflikte. Der Entfernungstest berücksichtigt den ergänzten GeoNames-Suchursprung für Skenderaj.

## Eigenständige eigene Bewertungen (Issue #61)

`/bewertungen`, `/sq/bewertungen` und `/en/bewertungen` verwenden die reguläre Seitenstruktur mit Navigation, Überschrift und Aktualisieren. Die eigene Historie hat keinen Modalrahmen; Bearbeitung und Löschbestätigung behalten ihre vorhandenen Dialoge. Alte Landing-Links leiten serverseitig auf diese Seite weiter. Gültige `einreichung`-Ziele und die Sprache bleiben durch die bestehende Anmeldung erhalten; ungültige oder mehrdeutige Einreichungsziele werden verworfen.

Die beobachtbaren Testgrenzen sind die gerenderte React-Seite und Navigation sowie HTTP-, Authentifizierungs- und Metadatenverträge. `tests/my-reviews-page.test.mjs` prüft Direktaufruf, sicheren Anmelderückweg, Legacy-Weiterleitung, DE/SQ/EN-Metadaten und den Ladehinweis vor Hydration. `tests/notification-link-ui.test.mjs` prüft gezielte Einreichungen, die Rückkehr zur vollständigen Historie und erneut zum gezielten Ziel sowie abgewiesene fremde Einreichungen. `tests/my-reviews-ui.test.mjs` deckt Lade-, Leer- und Fehlerzustände, abgelaufene Sitzungen, private Downloads, Bearbeiten/Ergänzen/Vervollständigen, Pagination, Aktualisieren, Löschbestätigung einschließlich Fokus/Escape und Wiederholung sowie Kontoänderung mit verspäteter Antwort ab. Die vorhandenen API-Fixtures für Besitzrechte und Nachweise bleiben unverändert maßgeblich.

Die Red-Schritte wurden mit `node tests/notification-link-ui.test.mjs`, `node tests/customer-localization-ui.test.mjs`, `node tests/my-reviews-page.test.mjs`, `node tests/notifications.test.mjs` und `node tests/my-reviews-ui.test.mjs` tatsächlich ausgeführt: Modalrahmen, alter Menü-/Mailrückweg, fehlende Weiterleitung, fehlender initialer Ladehinweis beziehungsweise fehlender Anmelderückweg nach Sitzungsablauf. Dieselben Befehle bestehen nach der Umsetzung. Alle Fixtures verwenden fiktive Konten und Inhalte; sie senden keine echten E-Mails und ändern keine Produktionsdaten. `tests/i18n-worker.test.mjs` prüft zusätzlich die privaten Dokumente und Legacy-Weiterleitungen in beiden tatsächlich gebauten Worker-Artefakten. Browsergeometrie, Tastaturbedienung und Themes werden vor der PR-Freigabe gesondert geprüft; diese automatisierten Fixtures ersetzen keine Browserprüfung.

## Google-Anmeldung

Die Google-OAuth-App und der Web-Client wurden im bestehenden Cloud-Projekt angelegt. JavaScript-Ursprung ist `https://riparim.com`; Weiterleitung ist die vom bestehenden Supabase-Projekt bereitgestellte OAuth-Callback-Adresse. Der geheime Clientschlüssel gehört ausschließlich in die Google-Provider-Einstellung von Supabase. Die Anmeldung benötigt nur `openid`, Profil und E-Mail, wie in der [offiziellen Einrichtung](https://supabase.com/docs/guides/auth/social-login/auth-google) beschrieben.

Der Nutzer hat den Clientschlüssel direkt in Supabase hinterlegt, den Provider aktiviert und die erfolgreiche echte Google-Anmeldung bestätigt. Das Google-Branding ist noch nicht verifiziert; deshalb erscheint im Kontoauswahlfenster derzeit die technische Supabase-Domain. Fixture-Ergebnisse allein bestätigen keine produktive Google-Anmeldung.

Beim Abgleich mit dem parallel veröffentlichten Theme wurde die Google-Abmeldung korrigiert: Der Header verwendet für Google und E-Mail den App-Abmelde-Endpunkt, der die aktuelle Sitzung widerruft und die Provider-Cookies entfernt. Der native ChatGPT-Abmeldeweg bleibt für ChatGPT-Konten vorgesehen. Die Header-Regressionsprüfung reproduzierte den bisherigen Fehler und besteht nach der Korrektur; die Auth-Routenprüfung bestätigt zusätzlich den Widerruf einer zuvor verifizierten Google-Sitzung.

## Eigene Kontoverwaltung

Die Kontoeinstellungen wurden mit fiktiven Konten geprüft: validierter Anzeigename ohne Änderung bestehender Bewertungsnamen, erneute Passwortprüfung und Google-OAuth-Bestätigung, getrennte Löschbestätigung, fremde Kontoziele, abgelaufene Berechtigungen sowie geschützte Verwaltungszugänge. Die UI-Prüfung umfasst Tastaturfokus, Escape, Abbrechen, deaktivierte Aktionen während laufender Anfragen und die Wiederholung einer unterbrochenen Löschung. Die Oberfläche wurde zusätzlich im Browser mit fiktiven Daten in hellem Desktop- und dunklem Mobil-Layout geprüft.

Die Speicher-Regressionsprüfungen pausieren einen Nachweisupload vor dem R2-Schreiben und beginnen währenddessen die Kontolöschung. Die Löschung entfernt die leere R2-Reservierung, sodass die atomare ETag-Bedingung den verspäteten Dateischreibvorgang abweist. Auch bei fehlgeschlagener Kompensation dürfen keine privaten Dateiinhalte nachträglich gespeichert werden. Das Inventar macht nötige Bereinigungen sichtbar. Zusätzliche Prüfungen decken abgebrochene Reservierungen mit und ohne vorhandenes R2-Objekt ab. Ein weiterer Test löscht das Providerkonto erfolgreich und lässt danach die lokale Abschlussbereinigung scheitern: Das Konto erscheint weiterhin als unvollständige Löschung in der Verwaltung und die administrative Wiederholung funktioniert auch bei Provider-HTTP-404.

Die Prüfungen verändern keine echten Konten und ersetzen keine produktive Prüfung des neuen Kontobereichs. Vor Veröffentlichung sind D1-Migrationen `0009` und `0010` erforderlich; es sind keine neuen Supabase-E-Mailvorlagen nötig.

## Betriebszugang

Der neue Betriebsablauf wird mit isolierten Konten und einer privaten SQLite-Datenbank geprüft: Antrag mit privater Begründung und Beleglinks, begründete manuelle Entscheidung, ausschließlich zugeordnete Profile, Entwürfe vor Veröffentlichung, Konkurrenz- und Dublettenfälle, verlorene Moderationsrechte, verknüpfte Altbesitzer und Bereinigung bei Kontolöschung. Google-Fixtures prüfen erfolgreiche und fehlerhafte Kontaktvalidierung ohne Änderung der öffentlichen Zuordnung; konkurrierende Entscheidungen dürfen keine fremden Metadaten übernehmen. Die UI-Prüfungen decken beschriftete Formulare, Fehler- und Leerzustände, erhaltene Eingaben, Statusanzeigen, Bestätigungsdialog, Tastaturfokus, Escape sowie gesperrte Aktionen bei laufenden Anfragen ab. Es werden keine echten Betriebsanträge oder Google-Abfragen erzeugt. Moderationsliste und eigene Historie besitzen getrennte Folgeseiten; eine 101-Anträge-Fixture bestätigt, dass ältere offene Anträge bei identischen Zeitstempeln vollständig erreichbar bleiben. Ungültige Telefonnummern und WhatsApp-Kontakte liefern korrigierbare Eingabefehler. Der Betriebsbereich und die Freigabeliste wurden zusätzlich im Browser mit fiktiven Daten bei 1280 Pixeln im hellen Theme und 390 Pixeln im dunklen Theme auf Beschriftungen und Überlauf geprüft. Vor Veröffentlichung ist Migration `0011` erforderlich.

## Moderationsbenachrichtigungen

Isolierte Versand-Fixtures prüfen atomare Moderation/Ereignisspeicherung, verifizierte Empfänger und bestätigte Altverknüpfungen, private Inhalte, sichere gezielte Anmeldelinks, gleichzeitige Entscheidungen und Versandversuche, dauerhafte Backoffs einschließlich der Begrenzung fehlgeschlagener Empfängerabfragen, fehlende Konfiguration/Kontakte sowie Netzwerk- und Datenbankfehler nach einer bereits angenommenen Nachricht. Wiederholungen verwenden exakt denselben Inhalt und Idempotenzschlüssel; abgelaufene Schlüssel und geänderte Empfänger oder Zugangsdaten führen zu blockierten Versandereignissen. Die geschützte Versand-API unterscheidet Vormerkung, Übergabe und unklare Ergebnisse und erlaubt keine blinde Wiederholung nach Ablauf. „Bewertungen prüfen“ enthält keinen Versandbereich; Moderationsentscheidungen lösen weiterhin den automatischen Versand aus. Die React-Prüfung bewahrt Suche, Tastaturfilter, private Nachweislinks, Prüfentscheidungen, Folgeseiten und Ergebniszähler. Ein gezieltes erneutes Laden am Fehlerzustand wiederholt ausschließlich den Listenabruf, auch nach einer bereits erfolgreichen Moderation.

Ein zusätzlicher Miniflare-Test führt den tatsächlichen Worker-Scheduled-Handler mit nativer D1-Datenbank aus. Sämtliche Provideranfragen werden innerhalb dieses isolierten Workers abgefangen; es werden keine echten E-Mails verschickt. Der Scheduler übergibt ein Ereignis einmalig und überspringt es beim nächsten Lauf. Vor Veröffentlichung ist Migration `0012` erforderlich, außerdem die serverseitige Resend-Konfiguration und der im Artefakt deklarierte Fünf-Minuten-Cron. Die bestehende Auth-Domain wurde beim Dienst als bestätigt und für Versand aktiviert gelesen; eine echte Zustellung der neuen Vorlagen wurde nicht geprüft.

## Kundenabläufe in drei Sprachen (Issue #50)

Die isolierte DE/SQ/EN-Matrix prüft Signup → Bestätigung → separate Anmeldung
mit ursprünglichem Werkstattziel, Recovery → Reset → Anmeldung, Google-Erfolg
und Abbruch, eigene Google-Löschreauth sowie Abmeldung. APIs erhalten explizit
`locale`; fehlende Werte bleiben deutsch kompatibel, ungültige Werte liefern
400 vor Provider-/Konfigurationszugriff. Der physische Callback und seine
Cookiepfade bleiben `/auth/bestaetigen`. Sein gemeinsamer Mailvertrag beginnt
mit `?locale=…&weiter=…`; alte `type=signup`-Callbacks bleiben gültig.

`tests/google-auth.test.mjs` verwendet echte Routen und eine private SQLite-
Fixture mit abgefangenen Provideraufrufen. `tests/account-settings.test.mjs`
prüft die eigenständige Sprachpräferenz am bestätigten eigenen Konto,
Metadatenerhalt, fremde Ziele, Mischpayloads, Rollenfelder und Providerfehler.
Der Sprachwähler wartet höchstens drei Sekunden auf das Speichern; bei Fehler
oder Timeout navigiert er trotzdem und zeigt nach Reload die sichere lokale
Notice. Native ChatGPT-Konten überspringen den Schreibversuch.
`tests/i18n-switcher.test.mjs` deckt diesen Vertrag ab; die lokale native
Simulation behält Loopback-/Header-/Prefetchgrenzen in
`tests/i18n-native-auth.test.mjs`.

Die tatsächlichen React-/Radix-Komponenten werden durch
`tests/customer-localization-ui.test.mjs` und
`tests/account-settings-ui.test.mjs` mit aktiven Katalogen geprüft: lokale
Beschriftungen und Fehler, Passwortanzeige, Sternbedienung per Tastatur,
Dialogfokus/Escape, erhaltene Originalinhalte und bestehende kanonische
Leistungs-/Nachweiswerte. Kontolöschung verlangt exakt `KONTO LÖSCHEN`,
`DELETE ACCOUNT` beziehungsweise `FSHI LLOGARINË`; erst danach sendet der
Client den bestehenden deutschen Sentinel. Die serverseitigen eigenen
Deletion-Grants und Schutzregeln bleiben maßgeblich.

`tests/combined-reviews.test.mjs` vergleicht erfolgreiche Downloadbytes und
Header und prüft lokale Plaintextfehler mit identischen 401/404-Statuscodes und
`X-Riparim-Error-Code`. Kunden- und Administrationslinks verwenden denselben
Downloadhelfer. Auth-/Kontometadaten und private Landing-Querymodi sind
`noindex,nofollow` ohne öffentliche Alternates; die normale Landing bleibt
indexierbar. Metadatenfixtures und beide tatsächlichen Worker-Builds prüfen
diese Grenze. Keine dieser Fixtures nutzt persönliche Konten, echte Belege,
Live-E-Mails oder Produktionsänderungen. Browsergeometrie/Themes/Zoom werden
vor der PR-Freigabe gesondert koordiniert.

## Betrieb und Verwaltung in drei Sprachen (Issue #51)

Die isolierten React-/Radix-Prüfungen verwenden die tatsächlich aktiven
DE/SQ/EN-Kataloge: Verwaltungsnavigation, Betreiberentwurf, Werkstatteditor,
Benutzer-/Rollenbestätigung, Bewertungsmoderation und Auth-Konfiguration.
Originaltexte, bestehende Leistungen/Beratungssprachen, Rollen, Status,
Einreichungsrevisionen und technische Projektwerte bleiben in den Requests
unverändert. Lokale Fehler behalten Entwürfe und zeigen keine rohen Providertexte.
Bestehende Prüfungen bewahren Tastaturfokus, Escape, gesperrte Aktionen bei
laufenden Mutationen, Rollen-/Sitzungswiderruf und geschützte Konten.

Die tatsächlichen Business-, Workshop-, Benutzer-, Konfigurations- und
Versandrouten werden mit isolierter SQLite-Datenbank und abgefangenen
Providergrenzen geprüft. Stabile Fehlercodes und ursprüngliche HTTP-/Textverträge
gelten auch für SQ-/EN-Anfragen. Ein verzögerter administrativer Anzeigenamenpatch
darf keine inzwischen geänderte Sprachpräferenz oder andere Metadaten zurücksetzen.
Dieser Test prüft den API-Keymerge-Vertrag, keine produktive Providerkonkurrenz.

Versanddiagnosen übersetzen Zustände und Ursachen und lokalisieren Versuchszähler
sowie Kosovo-Zeit einschließlich Sommerzeit. „An Versanddienst übergeben“
bestätigt weiterhin keine Zustellung. Metadatenfixtures und beide tatsächlichen
Worker-Builds prüfen alle sechs geschützten Routen auf `noindex,nofollow` ohne
private Sprachalternativen. Browsergeometrie, Themes und Zoom werden vor der
PR-Freigabe getrennt mit einem temporären Harness der echten Komponenten und
fiktiven Daten geprüft. Keine persönlichen Konten, echten Nachweise oder
Live-E-Mails dienen als Fixtures; Providerkonfiguration und Mailaktivierung
bleiben dem Folgeissue und dem geprüften Main-Release vorbehalten.

Nach Integration von Issue #52 prüfen die tatsächlichen AuthSetup-Komponenten
in allen drei Locales vier getrennte Betreff-/HTML-Felder und deren
Clipboardaufrufe bytegenau gegen die zentralen Go-Exporte. Technischer Quellcode
wird angezeigt, nicht als HTML ausgeführt oder übersetzt. Abgewiesene
Clipboardaufrufe zeigen nur lokale manuelle Kopierhinweise. Der angezeigte
Übernahmevertrag umfasst tatsächliche kanonische Originwerte, erhaltene
Callbackfreigaben, Release-Export und Go-Vorschauen, alle vier Providerdateien,
erneutes Lesen sowie Empfangstest/Rückweg; keine reine Bodyübernahme.
## Lokalisierte Mailvorlagen und Provideraktivierung (Issue #52)

Die zentralen Bestätigungs- und Recoveryvorlagen enthalten DE/SQ/EN-Betreff
und HTML-Body. Nur der exakte locale-first Redirectprefix wählt SQ/EN;
leere, kurze, alte oder abweichende URLs bleiben deutsch. Der Längenguard
verhindert einen Slice-Fehler. `tests/auth-email-templates.test.mjs` führt
beide zentralen Felder mit Go `html/template` ohne `FuncMap` aus und prüft
Sonderzeichen, Token-URLescaping, Sprache, direkte Bodycontainer, Titel und CTA.
Der [geprüfte Supabase-Mailer](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/mailer/templatemailer/template.go)
parst beide Felder mit `html/template` und ruft erst `subject.Execute`, dann
`body.Execute` auf. Die lokale Go-Prüfung beweist diesen Quellvertrag; die
gehostete Betreffauswertung wird erst durch den Empfangstest bestätigt.

Die Providerübernahme erfolgt separat aus einem geprüften Main-Release:

1. Im bestehenden Supabase-Projekt die tatsächliche Site URL, Redirect-Allowlist
   und die bisherigen vier Betreff-/Bodyfelder als privaten Rückweg sichern.
   SMTP-Zugangsdaten bleiben unverändert und außerhalb des Exports.
2. Worker-`SITE_ORIGIN` und tatsächlich gelesene Supabase Site URL müssen exakt
   dieselbe kanonische Origin ohne abschließenden Slash enthalten. Vom
   Release-Checkout mit dem tatsächlich gelesenen Providerwert exportieren:

   ```sh
   npm run auth:email-templates -- \
     --site-origin https://riparim.com \
     --provider-site-url https://riparim.com \
     --output-dir /tmp/riparim-auth-mail-release
   ```

   Das Zielverzeichnis muss neu sein. Slash-/Pfad-/Originabweichungen führen
   vor der Ausgabe zu `AUTH_EMAIL_ORIGIN_NOT_CANONICAL` oder
   `AUTH_EMAIL_ORIGIN_MISMATCH`. Ein deutscher Fallback ist kein erfolgreicher
   SQ-/EN-Test. Der Export enthält vier Providerquellen, sechs synthetische
   tatsächliche Go-Vorschauen mit erwarteter/gerenderter Locale und Prüfsummen.
   Er ändert keinen Provider und enthält keine realen Tokens oder Empfänger.
3. Nur den physischen Callback erlauben: Produktion
   `https://riparim.com/auth/bestaetigen\?**`, bei Bedarf getrennt die tatsächlich
   verwendete lokale Callback-Origin. Keine Host-/Seitenwildcards und keine
   `/sq/auth/…`- oder `/en/auth/…`-Callbacks. Bestehende alte Callbacklinks und
   notwendige Freigaben erhalten; die Site URL bleibt eine reine Origin.
4. Unter Authentication → Email Templates gemeinsam `confirmation.subject.txt`
   und `confirmation.body.html` bei „Confirm sign up“ sowie
   `recovery.subject.txt` und `recovery.body.html` bei „Reset password“ übernehmen.
   Alternativ die [Management-API-Felder](https://supabase.com/docs/guides/auth/auth-email-templates)
   `mailer_subjects_confirmation`, `mailer_templates_confirmation_content`,
   `mailer_subjects_recovery`, `mailer_templates_recovery_content` verwenden.
   Anschließend beide Felder erneut lesen und bytegenau mit dem Export vergleichen.
5. Providerpreview und isolierte, ausdrücklich freigegebene Testkonten je Locale
   verwenden: tatsächlichen Betreff/Body empfangen, Bestätigung → separate
   Anmeldung zum ursprünglichen Profil sowie Recovery → Reset → Anmeldung und
   alte DE-Links prüfen. Keine echten Kunden anschreiben; Adressen, Passwörter
   und Tokens bleiben privat. Recovery schreibt keine fremden Metadaten.
   Scheitert die Prüfung, die vier gesicherten bisherigen Felder zurückspielen
   und Mailfreigabe nicht als bestätigt kennzeichnen.

Reviewmails verwenden beim ersten Versuch ausschließlich die allowlisted
`user_metadata.preferred_locale` des geprüften bestätigten Empfängers.
Moderator-/Cron-/Browserlocale ist ohne Einfluss. Beide Entscheidungen haben
lokalisierte Login-/Einreichungsziele. Die Route-, React- und nativen
D1/Scheduled-Fixtures prüfen DE/SQ/EN und fremde/private Zielgrenzen.
`tests/notifications.test.mjs` vergleicht das tatsächliche `fetch init.body`
und den Idempotenzschlüssel nach verlorener lokaler Bestätigung, Sprach- und
Konfigurationswechsel. Historische deutsche Payloads behalten sogar
JSON-Reihenfolge und Leerraum. Empfänger-/Credentialwechsel, 23-Stunden-Grenze,
Backoff und kontrollierte Wiederholungen bleiben geschützt.

Neue Reviewmails liefern auf ausdrücklichen Projektwunsch ausschließlich Betreff
und HTML an Resend; der tatsächliche Requestbody enthält `text: ""` als
expliziten Opt-out. Bei fehlendem Feld erzeugt Resend automatisch Klartext,
wie die [Send-Email-API](https://resend.com/docs/api-reference/emails/send-email)
und der [Changelog](https://resend.com/changelog/automatic-plain-text-emails)
beschreiben.
Die Tests prüfen dies für beide Entscheidungen und alle drei Locales sowie
bytegleiche HTML-only-Retries. Bereits eingefrorene historische Payloads mit
`text` sowie alte Payloads ohne `text` bleiben unverändert, damit ihr
Idempotenzvertrag erhalten bleibt. Beim
[geprüften Supabase-SMTP-Client](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/mailer/mailmeclient/mailmeclient.go)
setzt `SetBody("text/html", body)` ausschließlich HTML; die Providerfelder
können keinen zusätzlichen MIME-Klartextteil konfigurieren. Auth-HTML ist
vollständig textbasiert und zugänglich. Die `.preview.txt`-Dateien des Exports
sind nur Lesbarkeitsvorschauen, keine behauptete SMTP-Alternative. Content-Type
und tatsächliches Verhalten des gehosteten Mailers beim Empfangstest prüfen.
Diese Providergrenze wird nicht durch Headertricks, Hooks oder eine neue
Mailplattform umgangen.

Automatisierte Fixtures und Vorschauen senden keine realen Nachrichten und
ändern keine Produktion. Native Prüfung bei 390/1280 Pixeln, 200 Prozent Zoom
und heller/dunkler Darstellung sowie tatsächlicher Empfang und Providerübernahme
werden vor der Gesamtfreigabe separat protokolliert. Ohne diesen Nachweis ist
die neue Providerkonfiguration noch nicht als live abgenommen zu bezeichnen.

## Kompakte Anmeldeeinrichtung (Issue #59)

Die Verwaltung zeigt vier kurze Prüfschritte und öffnet URL-Werte, SMTP-Hilfe,
Google-Einstellungen sowie die langen Mailquellen bei Bedarf mit nativen
`details`/`summary`-Elementen. Ein bereits konfiguriertes Projekt und erfolgreich
getestete Einstellungen werden weiterverwendet. Dadurch bleibt die Verbindung
rechts direkt erreichbar; eine neue Projekterstellung oder Wiederholung
bereits abgenommener Einrichtung wird nicht verlangt.

Site URL und der physische Callback `https://riparim.com/auth/bestaetigen\?**`
bleiben erforderlich. Die [Redirect-Dokumentation](https://supabase.com/docs/guides/auth/redirect-urls)
empfiehlt einen festgelegten Produktionspfad. Der einzelne Backslash maskiert
das Fragezeichen als Querytrenner; ein unmaskiertes `?` wäre ein
Einzeichen-Wildcard. `**` erhält die bestehenden Sprach-/Rücksprungparameter.
Die Allowlist ersetzt keine App-Zielvalidierung: Supabase akzeptiert bereits
Redirects zur Site-Origin, während die serverseitige Zielvalidierung der
Anwendung unverändert maßgeblich bleibt. Die [SMTP-Dokumentation](https://supabase.com/docs/guides/auth/auth-smtp)
beschränkt den Standardversand auf nichtproduktive Zwecke. Deshalb steht die
eigene SMTP-Einrichtung vor der Vorlagenübernahme: Bei neuen Free-Projekten seit
3. Juni 2026 ist [Vorlagenbearbeitung erst mit eigenem SMTP möglich](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).
Bestätigungs- und Recoveryvorlagen bleiben direkt aus
`lib/auth/email-templates.ts` bezogen und enthalten jeweils Betreff und HTML-Body.
Google benötigt weiterhin Website-Origin, den Callback des Supabase-Projekts
und die Providerkonfiguration gemäß der [offiziellen Anleitung](https://supabase.com/docs/guides/auth/social-login/auth-google).

`tests/auth-setup-ui.test.mjs` prüft die tatsächlichen React-/Radix-Komponenten:
kompakte anfängliche Anleitung in DE/SQ/EN, erreichbare native Details, vier
zentrale kopierbare Betreff-/HTML-Felder, Wiederverwendung gespeicherter
Verbindung sowie unveränderte Entwurfs-/Aktivierungs-/SMTP-Verträge,
Vorschauziele und Lade-/Fehlerzustände. Die API-Fixtures haben keine externen
Effekte. Bei der Integration der Verwaltungslokalisierung aus Issue #51 blieben
Formular, Fehlercodes und Sperren während laufender Speicherung erhalten.
Originabgleich, Releaseexport, Backup, Readback und Rollback-Hilfe sind in
allen drei Sprachen in der geschlossenen Mailhilfe erreichbar; die
Management-UI-Suite prüft weiterhin Quellenkopie und lokale Copy-Fehler.

Die ergänzende native Prüfung im vorgegebenen Chrome-Profil verwendete die
tatsächliche Komponente und Projekt-CSS mit ausschließlich abgefangenem
`GET /api/auth-settings`: 390 Pixel mit Systemtheme (auf diesem Rechner dunkel),
1280 Pixel hell und 390 Pixel dunkel mit geöffneter URL-/SMTP-/Mailhilfe.
Dokumentbreite und Scrollbreite waren jeweils identisch (390/1280 Pixel);
alle vier Quellen blieben bei 390 Pixeln innerhalb ihrer 287 Pixel breiten
Scrollbereiche. Leere Konfiguration, Ladezustand mit gesperrtem Speicherbutton
und Fehler waren lesbar; die Anleitung blieb erreichbar. Leertaste schloss
die Hilfe, Enter öffnete sie. Tab erreichte SMTP-Link, verschachtelte
Bestätigungshilfe sowie Betreff und HTML-Body; End scrollte die Quelle bis zum
abschließenden `{{ end }}` mit sichtbarem Fokusring. Die Prüfung änderte keine
Providerkonfiguration und löste keine Live-E-Mails aus. Der korrigierte
Dashboardwert wurde anschließend nativ mit genau einem Backslash bestätigt;
auch bei 1336 Pixeln blieb die Dokumentbreite gleich der Scrollbreite.
