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

`/bewertungen`, `/sq/bewertungen` und `/en/bewertungen` verwenden die reguläre Seitenstruktur mit gemeinsamer Seitenbreite, Überschrift und einer Wiederholungsaktion bei Ladefehlern. Die eigene Historie hat keinen Modalrahmen; Bearbeitung und Löschbestätigung behalten ihre vorhandenen Dialoge. Alte Landing-Links leiten serverseitig auf diese Seite weiter. Gültige `einreichung`-Ziele und die Sprache bleiben durch die bestehende Anmeldung erhalten; ungültige oder mehrdeutige Einreichungsziele werden verworfen.

Die beobachtbaren Testgrenzen sind die gerenderte React-Seite und Navigation sowie HTTP-, Authentifizierungs- und Metadatenverträge. `tests/my-reviews-page.test.mjs` prüft Direktaufruf, sicheren Anmelderückweg, Legacy-Weiterleitung, DE/SQ/EN-Metadaten und den Ladehinweis vor Hydration. `tests/notification-link-ui.test.mjs` prüft gezielte Einreichungen, die Rückkehr zur vollständigen Historie und erneut zum gezielten Ziel sowie abgewiesene fremde Einreichungen. `tests/my-reviews-ui.test.mjs` deckt Lade-, Leer- und Fehlerzustände, abgelaufene Sitzungen, private Downloads, Bearbeiten/Ergänzen/Vervollständigen, Pagination, Nachladen nach Dialogschluss und Fehlerwiederholung, Löschbestätigung einschließlich Fokus/Escape und Wiederholung sowie Kontoänderung mit verspäteter Antwort ab. Die vorhandenen API-Fixtures für Besitzrechte und Nachweise bleiben unverändert maßgeblich.

Die Red-Schritte wurden mit `node tests/notification-link-ui.test.mjs`, `node tests/customer-localization-ui.test.mjs`, `node tests/my-reviews-page.test.mjs`, `node tests/notifications.test.mjs` und `node tests/my-reviews-ui.test.mjs` tatsächlich ausgeführt: Modalrahmen, alter Menü-/Mailrückweg, fehlende Weiterleitung, fehlender initialer Ladehinweis beziehungsweise fehlender Anmelderückweg nach Sitzungsablauf. Dieselben Befehle bestehen nach der Umsetzung. Alle Fixtures verwenden fiktive Konten und Inhalte; sie senden keine echten E-Mails und ändern keine Produktionsdaten. `tests/i18n-worker.test.mjs` prüft zusätzlich die privaten Dokumente und Legacy-Weiterleitungen in beiden tatsächlich gebauten Worker-Artefakten.

Die native Prüfung am 06.10.2026 verwendete das vorgegebene Chrome-Profil, die tatsächlichen Komponenten und Projekt-CSS mit fiktiven Antworten für die eigene Historie. Bei 390 Pixeln dunkel mit gefüllter Liste, 1280 Pixeln hell mit Leerzustand sowie 390/1280 Pixeln mit Systemtheme und Fehler-/Ladezustand entsprachen Dokument- und Scrollbreite jeweils dem Viewport; das Systemtheme war auf diesem Rechner hell. Die Übersicht hatte keinen Dialog-Overlay. Der Ladehinweis war sichtbar und Aktualisieren gesperrt; Leer- und Fehlerhinweise sowie der Privatheitshinweis blieben erreichbar. Die gezielte Einreichung zeigte einen Datensatz, die vollständige Historie vier. Browser-Zurück und -Vorwärts stellten diese Ziele wieder her. Ergänzen öffnete die vorhandenen Formularwerte und den bisherigen fiktiven Beleg; Tab erreichte den privaten Downloadlink.

Das unabhängige Review und eine DOM-Probe reproduzierten nach Dialogschluss Fokus auf `BODY`. Der zusätzliche Red-Schritt scheiterte an der erwarteten Rückkehr zur auslösenden Ergänzungsaktion. Die korrigierte UI-Suite besteht mit 33 Prüfungen: Schließen/Escape/Abbrechen von Ergänzung, Bearbeitung, Vervollständigung und Löschbestätigung, verzögerte Listenaktualisierung, Aktualisieren als Fokusziel nach entfernten Zeilen sowie erhaltene spätere Navigation oder Fokusbewegung. Die native Nachprüfung bestätigte nach Escape Fokus auf Ergänzen beziehungsweise Löschen. Die Rückkehr berücksichtigt den [APG-Dialogablauf](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Am tatsächlichen lokalen App-Server lieferte der alte englische Einreichungslink HTTP 307 zur neuen lokalisierten URL. Direktaufruf und Browser-Neuladen lieferten HTTP 200 mit „My reviews“ und demselben validierten Ziel; die Anmeldeschaltfläche enthielt den vollständigen lokalisierten Rückweg. Die serverseitige Ausgabe war `noindex,nofollow`. Im nativen Profil meldete React zusätzlich eine Hydrationswarnung für `cz-shortcut-listen` am Body; dieses Attribut fehlte im erneut gelesenen Server-HTML und weist auf eine Browser-Injektion hin. Die Prüfungen verwenden keine echten Konten oder Nachweise, ändern keine Providerkonfiguration und bestätigen keine neue Live-Provideraktivierung.

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
verhindert einen Slice-Fehler im unveränderten Body. Die Betreffquellen müssen
bereits vor dem Rendering in das 255-Zeichen-Feld des Supabase-Dashboards passen.
Sie verwenden kompakte zentrale Betreffcopy und einen vollständigen Prefixvergleich
mit Go-`printf`-Stringpräzision statt `slice`. Die kanonisch validierte Origin ist
ASCII (internationale Hosts stehen in Punycode); daher entspricht die Runenpräzision
hier der Prefix-Bytelänge. Kurze oder fehlende Redirects bleiben sicher deutsch.
Die HTML-Titel behalten ihre ausführliche Copy; sie müssen nicht dem kürzeren
Betreff entsprechen. `tests/auth-email-export.test.mjs` prüft die tatsächlichen
exportierten Betreffquellen gegen die 255-Zeichen-Grenze.
`tests/auth-email-templates.test.mjs` führt
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
eigene SMTP-Einrichtung vor der Vorlagenübernahme: Bei neuen Free-Projekten seit 3. Juni 2026 ist [Vorlagenbearbeitung erst mit eigenem SMTP möglich](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).
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

## Kompakte Betriebsverwaltung (Issue #60)

„Mein Betrieb“ führt beim ersten Besuch direkt zum Antrag auf ein vorhandenes
Werkstattprofil. Ohne bestätigtes Profil oder laufenden Antrag gilt das auch nach
älteren Entscheidungen. Leere Profil-, Antrags- und Änderungskästen entfallen.
Bestätigte Profile bieten „Profil bearbeiten“; Anträge und Änderungen erklären
je nach aktuellem Prüfstand den nächsten Schritt. Historische Ablehnungen
zeigen ihr Ergebnis und den Prüfvermerk, ohne eine inzwischen gesperrte
Einreichung zu empfehlen. Eingereichte Änderungsdetails und der
Antrag auf ein weiteres Profil lassen sich mit nativen `details`/`summary`
Elementen öffnen. Inhabernachweise und Beleglinks bleiben privat; manuelle
Inhaberprüfung und gesonderte Veröffentlichungsfreigabe bleiben erhalten.

„Aktualisieren“ bleibt am Seitentitel erreichbar, weil Entscheidungen der
Verwaltung außerhalb der geöffneten Seite erfolgen. Der Abruf zeigt einen
Ladezustand und sperrt konkurrierende Einreichungen. Scheitert nur das Nachladen
nach einer erfolgreichen Einreichung, bestätigt die Seite die Speicherung und
fordert zum Aktualisieren statt zum erneuten Einreichen auf.

`tests/business-ui.test.mjs` prüft an den tatsächlichen React-Komponenten den
direkten Einstieg, private und erhaltene Eingaben, Prüfstände und nächste Schritte,
kompakte Details, gesperrte Aktionen, initiales Laden, Aktualisierung sowie die
Wiederholung eines fehlgeschlagenen Listenabrufs nach erfolgreicher Einreichung.
`tests/business.test.mjs` prüft zusätzlich die autoritative Liste laufender
Anträge und Änderungssperren eigener Profile unter mehr als 100 neueren
historischen Entscheidungen sowie die Trennung fremder Konten. Die UI-Fixtures
prüfen diese aktuellen Hinweise ohne vorheriges Blättern, Historie ohne laufenden
Antrag, alte Ablehnungen mit laufendem Ersatzentwurf und automatisch abgelehnte
konkurrierende Anträge. Beim Nachladen einer Folgeseite werden aktuelle Zuordnung
und Sperren gemeinsam übernommen; die beiden Historien bleiben unabhängig.
Aktuelle Änderungsanträge besitzen zusätzlich eigene IDs. Beim Nachladen beider
Listen verschwinden veraltete Prüfungskarten auch nach externer Freigabe,
Ablehnung oder einem Ersatzentwurf für dasselbe Profil. Der Client errät keine
Entscheidung; der vollständige Abruf zeigt den neuen Prüfstand und gegebenenfalls
den aktuellen Ersatzentwurf.
Die bestehenden Moderationsprüfungen schützen Dialogfokus, Escape, begründete
Entscheidungen und getrennte Folgeseiten. `tests/management-localization-ui.test.mjs`
prüft weiterhin DE/SQ/EN mit ursprünglichen Beschreibungen und kanonischen
Leistungswerten. Die gesamte Testsuite nutzt isolierte Konten und abgefangene
Provideranfragen; sie sendet keine echten Nachrichten und ändert keine
Produktionsdaten.

Die ergänzende native Prüfung im vorgegebenen Chrome-Profil verwendete ein
eigenes QA-Fenster mit geprüftem Profil und kontrolliertem Fokus sowie die
aktuellen Komponenten, ThemeProvider, Header, Footer, CSS und Assets. Bei
1280 × 844 Pixeln im hellen deutschen Desktop-Layout waren der direkte Antrag,
„Aktualisieren“ am Titel und die Hinweise zum laufenden Antrag verständlich;
Tab und Leertaste öffneten den weiteren Antrag mit sichtbarem Fokusring. Bei
390 × 844 Pixeln zeigte Albanisch im dunklen Theme die Änderungssperre und den
Wartehinweis; Tab und Enter öffneten die eingereichten Originalangaben ohne
horizontale Beschneidung. Englisch im hellen Mobil-Layout erlaubte den
Editoraufruf per Tastatur, den Zugriff auf das beschriftete Telefonfeld und eine
isolierte Einreichung: Erfolgsmeldung, unveränderter öffentlicher Stand,
geschlossener Editor und gesperrte weitere Bearbeitung waren sichtbar. Deutsch
im mobilen Systemtheme folgte dem System und löste dunkel auf; Antrag,
Beschriftungen und Layout blieben lesbar. Alle API-Schreibversuche wurden mit
synthetischen Daten abgefangen; Produktion und echte Konten blieben unverändert.
Lade-, Fehler- und fehlgeschlagene Nachladezustände sind zusätzlich automatisiert
geprüft und werden hier nicht als nativ abgenommen behauptet.

## Bewertungseinstieg am Werkstattprofil (Issue #62)

Variante A verwendet ausschließlich das jeweilige öffentliche Werkstattprofil
für neue Bewertungen. Dort ist die Werkstatt bereits ausgewählt und das
vollständige Formular für Bewertung und privaten Nachweis vorhanden. Der
allgemeine Dialog und „Bewerten“ im Benutzermenü entfallen. Eigene Einreichungen
können weiterhin gezielt bearbeitet oder ergänzt werden.

`tests/review-entry.test.mjs` prüft alte `nachweis`-Links in DE/SQ/EN: bekannte
öffentliche Werkstätten führen zu ihrem Profil mit `#bewerten`; allgemeine,
unbekannte, ungültige oder mehrdeutige Ziele führen zum Werkstattfinder mit
einem lokalisierten Hinweis. Ein Katalogfehler nutzt dessen vorhandenen
Wiederholungsablauf. Der tatsächliche Worker-Test prüft zusätzlich die
Weiterleitungen und schützt nicht veröffentlichte Profile. Der Finderhinweis
bleibt beim Neuladen und Sprachwechsel erhalten.

Die React-Prüfungen bestätigen den fehlenden allgemeinen Menüeintrag, den
sichtbaren Werkstattnamen am Formular, Profil-Anmelderücksprünge, das gemeinsame
POST von Bewertung und privatem Nachweis, Sterne-/Einwilligungsvalidierung,
lokalisierte Fehler und die Freigabeerklärung im Erfolgszustand. Bearbeitungen
verwenden weiterhin PUT mit Revision und erhaltenem privaten Beleg; ihr
Anmeldeziel ist die eigene gezielte Einreichung. Die bestehenden isolierten
API-/SQLite-/R2-Prüfungen schützen Upload, Besitzrechte und Moderation.

Diese Prüfungen verwenden fiktive Daten und abgefangene Providergrenzen.
Die native Prüfung erfolgte in Chrome mit dem bestätigten Projektprofil
`ramizloki82@googlemail.com`, echten Komponenten, Projekt-CSS und synthetischen,
abgefangenen Requests. Bei 390 Pixeln waren System-Theme (hier hell), Light und
Dark ohne horizontale Überbreite; bei 1280 Pixeln wurde das geöffnete Formular
im dunklen Theme mit Werkstattname neben den Feldern geprüft. Viewport und
Dokumentbreite betrugen jeweils 390 beziehungsweise 1280 Pixel.

Das Benutzermenü enthält keinen allgemeinen Bewertungslink; Escape stellt den
Fokus am Auslöser wieder her. Leertaste bedient den Inline-Toggle, Tab erreicht
das beschriftete Datum und die Pfeiltaste wählt den nächsten Stern samt Fokus.
Die ausgeloggte SQ-Profilprüfung bestätigt den Namen und den lokalisierten
Anmeldelink mit Rückkehr zu `#bewerten`. Der EN-Finderhinweis und Profilzugang
waren bei 390 Pixeln und tatsächlich auf 200 Prozent gestelltem Chrome-Zoom
sichtbar, weiterhin ohne horizontale Überbreite; anschließend wurde der Zoom
auf 100 Prozent zurückgesetzt.

Diese native Prüfung bestätigt keine vollständige Anmeldung, Einreichung oder
Dateiübertragung; diese Verträge decken die oben genannten isolierten Tests ab.
Es gibt keine neue Migration oder Providerkonfiguration.

Nach Integration von Issue #61 führt „Meine Bewertungen“ überall zur regulären
privaten Seite `/bewertungen` mit optionaler validierter `einreichung`. Der
gezielte Bearbeitungsdialog verwendet denselben lokalisierten Anmelderücksprung
und Abschlusslink; seine Fokuswiederherstellung bleibt erhalten. Alte
`besuche`-/`einreichung`-Links behalten den privaten Seiteneinstieg, auch bei
gleichzeitigem `nachweis`-Parameter. Der ungenutzte allgemeine Dialog-Hook ist
entfernt. Die ergänzenden Integrationstests prüfen beide Linkverträge und die
bestehenden eigenen Seitenaktionen mit fiktiven Daten.

## Profilgebundener Übernahme-Antrag mit Dokument

Der Antrag übernimmt ausschließlich die über `werkstatt` verlinkte öffentliche
Werkstatt und zeigt Name und Standort an. Eine Auswahl anderer Profile und der
permanente Button „Aktualisieren“ entfallen. Ohne gültiges, eindeutiges Ziel
führt ein Hinweis zum Werkstattfinder. Der Antrag enthält einen privaten
Nachweistext und einen optionalen Upload für PDF, JPG oder PNG bis 5 MB.
Nach erfolgreicher Einreichung lädt die Seite automatisch nach; nur ein
Ladefehler bietet „Erneut versuchen“. Bestehende Beleglinks bleiben in der
Verwaltungsprüfung erhalten. Dokumente lassen sich über eine geschützte Route
nur vom Antragsteller und der Verwaltung herunterladen.

Migration `0014` erweitert `workshop_claims` additiv um nullable Dateimetadaten.
Bestehende Anträge brauchen keine Übernahme. Der Releaseprozess wendet die
Migration vor dem neuen Worker an. Dokumente verwenden den bestehenden privaten
R2-Bucket und das Upload-Inventar. Kontolöschung entfernt auch Dokumente und
verwaiste Uploads; bedingte R2-Schreibvorgänge verhindern verspätete Inhalte
nach dem Entfernen ihrer Reservierung.

`tests/business-ui.test.mjs` prüft den festen Namen statt Profilauswahl, genau ein
Textfeld und den beschrifteten Upload, erhaltene Eingaben nach Fehlern, den
fehlenden Aktualisieren-Button, automatische Statusübernahme und Wiederholung
bei Ladefehlern sowie ungültige und mehrdeutige Ziele. Die API-/SQLite-/R2-Fixtures
in `tests/business.test.mjs` prüfen private Downloads, MIME-/Signaturprüfung,
Größenlimits ohne Content-Length, Fehlerbereinigung, historische Beleglinks und
Kontolöschung während eines Uploads. Alle Daten sind fiktiv.

Die native Prüfung am 11.10.2026 nutzte Chrome mit zuvor bestätigtem Profil
`ramizloki82@googlemail.com`, die tatsächliche BusinessPanel-Komponente,
ThemeProvider und gebautes Projekt-CSS. Die lokale Vorschau verwendete
synthetische Antworten statt Livekonten. Bei 1282 Pixeln hell und 390 Pixeln
dunkel (SQ) war das Formular lesbar; Viewport- und Dokumentbreite waren gleich.
Tab erreichte vom Nachweistext den Upload und anschließend den Einreichen-Button
mit sichtbarem Fokus. Englisch im mobilen Systemtheme löste dunkel auf und
zeigte den Ladefehler mit „Try again“ ohne Aktualisieren-Button. Diese native
Prüfung bestätigt keine echte Dateiübertragung oder Produktionsübernahme;
die Uploadverträge decken die isolierten Tests ab.

## Kontoname für Bewertungen

Die E-Mail-Registrierung verlangt einen Namen mit 2–80 Zeichen und speichert
ihn getrimmt als `full_name`. `tests/google-auth.test.mjs` prüft fehlende, leere,
zu kurze, zu lange und nicht textuelle Namen vor dem Provideraufruf sowie
Google- und ältere E-Mail-Konten ohne Namen. Verifizierte Sitzungen verwenden
bei ungültigem Profilnamen „Anonym“ statt einer E-Mail-Adresse.

`tests/combined-reviews.test.mjs` prüft tatsächliche POST-/PUT-Routen mit
SQLite: Mitgesendete Bewertungsnamen werden ignoriert, neue und bearbeitete
Bewertungen übernehmen den aktuellen Kontonamen. Anonyme und 80 Zeichen lange
Namen können weiterhin moderiert und veröffentlicht werden. Die bestehende
Besitz-, Nachweis- und Freigabeprüfung bleibt erhalten. Änderungen nur am
Kontonamen schreiben bestehende Bewertungen nicht um; die nächste Bearbeitung
übernimmt den Namen mit erneuter Moderation. Keine Migration oder
Providerkonfigurationsänderung ist erforderlich.

Die tatsächlichen React-Komponenten prüfen in DE/SQ/EN das verpflichtende,
beschriftete Registrierungsfeld mit zugeordneter Hilfe, die Namensübertragung
und den angezeigten Kontonamen ohne editierbares Bewertungsfeld. Neue und
bearbeitete Bewertungen senden kein Namensfeld. Fehler, erhaltene Eingaben,
Sternbedienung und Einwilligung bleiben durch die Kunden-UI-Suite geprüft.

Die native Prüfung im bestätigten Chrome-Profil
`ramizloki82@googlemail.com` verwendete echte Komponenten und Projekt-CSS in
einem lokalen Harness mit fiktiven Daten und abgefangenen API-Anfragen. Die
Registrierung war im hellen Desktop-Layout und bei 390 × 844 Pixeln lesbar;
Tab wechselte vom Anzeigenamen zur E-Mail. Das albanische Bewertungsformular
zeigte bei 390 Pixeln im dunklen Theme den Kontonamen ohne Eingabefeld; die
Pfeiltaste änderte Sternwert und Fokus. Englisch zeigte im Systemtheme den
Fallback „Anonym“; ein 80 Zeichen langer Name ohne Leerzeichen brach innerhalb
der mobilen Namensanzeige um. Diese Prüfung bestätigt keine Live-Registrierung
oder echte Dateiübertragung. Es wurden keine Produktionsdaten geändert und
keine E-Mails versendet.

## Getrennte Betriebsübersicht und Beanspruchung

`/betrieb` ist die private Übersicht für eigene Profile, Anträge und Änderungen.
Sie enthält kein Antragsformular und keinen permanenten Aktualisieren-Button.
Bei leerer Übersicht erklärt ein Hinweis den Einstieg über das öffentliche
Werkstattprofil; ein Link öffnet den Werkstattfinder. Der Inhaberlink im Profil
führt direkt zur eigenständigen Seite `/betrieb/beanspruchen?werkstatt=…`.
Diese hat „Werkstattprofil beanspruchen“ als Seitentitel, die feste Werkstatt und
ausschließlich Nachweistext plus optionalen privaten Upload. Nach erfolgreicher
Einreichung ersetzt eine Bestätigung das Formular und verlinkt „Mein Betrieb“.
Es gibt keine automatische Rückleitung und keinen eingebetteten Übersichtsteil.

Anmeldung und Sprachwechsel behalten die Antragsseite mit eindeutigem
Werkstattziel bei. Mehrdeutige, fehlende oder nicht veröffentlichte Werkstätten
zeigen kein Formular für ein anderes Profil. Ein Katalogfehler bietet einen
gezielten Wiederholungslink. Beide Seiten bleiben `noindex,nofollow`; das
Benutzermenü führt weiterhin zur Übersicht. APIs, private Dokumente, Besitzrechte
und manuelle Freigaben verwenden die bestehenden Verträge; es gibt keine neue
Migration oder Providerkonfiguration.

`tests/business-pages.test.mjs` prüft die tatsächlichen Seitendokumente
in DE/SQ/EN, die getrennten Titel, Gast-Anmelderücksprünge,
ungültige/mehrdeutige/unveröffentlichte Ziele und den Katalogfehler.
`tests/business-claim-ui.test.mjs` prüft den beschrifteten Upload, Multipartdaten,
erhaltene private Eingaben, gesperrte konkurrierende Einreichungen sowie die
Bestätigung ohne Formular und ohne zusätzliche Übersichtsanfrage.
`tests/business-ui.test.mjs` schützt die leere Übersicht, laufende Anträge,
Profilbearbeitung und Moderation ohne eingebetteten neuen Antrag. Sprachwechsel,
Header und beide tatsächlich gebauten Worker werden zusätzlich geprüft.
Alle Fixtures verwenden fiktive Konten und abgefangene Netzwerkanfragen.

Die ergänzende native Prüfung im bestätigten Chrome-Profil
`ramizloki82@googlemail.com` nutzte ein eigenes QA-Fenster, die tatsächlichen
Komponenten, ThemeProvider, Header, Footer, Assets und gebautes Projekt-CSS.
Bei 1282 Pixeln hell wurden Antrag, synthetische Einreichung per Tastatur,
Bestätigung ohne Formular und der Dokumentlink zur leeren Übersicht geprüft.
Bei 390 Pixeln zeigte Englisch im dunklen Theme nur die Antragsseite;
Albanisch im Systemtheme (hier dunkel) zeigte nur die Übersicht. Die gemessene
Antragsbreite entsprach dem Viewport (390 beziehungsweise 1282 Pixel).
Die Vorschau fing Schreibanfragen mit fiktiven Antworten ab. Diese Abnahme
bestätigt keine echte Authentifizierung oder Dateispeicherung in Produktion.

## Vereinfachtes Bewertungsformular (11. Oktober 2026)

Sterne sind für eine Bewertung ausreichend; der Text ist optional und hat keine
Mindestlänge. Bewertungstext und optionale Belegnotiz beginnen eingeklappt.
Vorhandene Texte bleiben beim Bearbeiten sichtbar. Wiederholte Einleitungen,
Namens- und Speichererklärungen entfallen; der private Nachweis, Besuchsangaben,
Einwilligung und manuelle Freigabe bleiben erforderlich. Die Texte sind in
DE/SQ/EN angepasst. Es ist keine Migration oder Datenübernahme nötig.

`tests/combined-reviews.test.mjs` prüft leere, fehlende, kurze und lange Texte,
ungültige Sterne, nicht textuelle Eingaben, Freigabe und öffentliche Aggregate
sowie das Entfernen eines Texts mit erneuter Freigabe. Die tatsächlichen
Kunden- und Verwaltungsoberflächen behandeln Sternebewertungen als vollständig.
Die CSS-Prüfung schützt die schrumpfenden Formulargruppen und Grid-Spalten sowie
die maximale Breite nativer Datumsfelder in Quell- und Produktions-CSS.

Die native Prüfung im bestätigten Chrome-Profil `ramizloki82@googlemail.com`
verwendete die tatsächliche React-Komponente und kompiliertes Projekt-CSS mit
fiktiven Daten. Bei 320/390 Pixeln mobil und 1280 Pixeln Desktop entsprachen
Dokument- und Viewportbreite einander. Das Datumsfeld blieb innerhalb seines
Labels (262/332/600 Pixel). Helles und dunkles Theme sowie Sterneauswahl mit
Pfeiltasten/End und das Aufklappen des optionalen Texts per Tab/Enter wurden
geprüft. Ein echtes iPhone mit Safari wurde nicht geprüft; die automatisierten
CSS-Grenzen ersetzen keine Abnahme auf diesem Gerät. Die Vorschau fängt
Schreibanfragen ab und verändert keine Produktionsdaten.

## Flache Antragsseite

Die Beanspruchung verwendet auf Desktop und Mobil keine äußere Formular-Card.
„Profil beanspruchen“, der kompakte Werkstattkontext und ein kurzer Einstieg
führen direkt zu Nachweistext und optionalem Dokument. Die Dateiauswahl besitzt
in DE/SQ/EN eigene sichtbare Beschriftungen; native Browsertexte werden visuell
ersetzt, während der echte Dateiinput für Tastatur und Dateidialog erhalten
bleibt. Dateiname, Ersetzen und Entfernen sind sichtbar. Entfernen bewahrt den
Text und setzt den Fokus auf die Auswahl zurück. Während der Einreichung sind
die Felder gesperrt und der Button zeigt den Sendezustand. Die Bestätigung
erhält Fokus und verlinkt die separate Betriebsübersicht.

Die bestehenden Multipart-, Größen-, Besitz- und Freigabeverträge bleiben
unverändert; neue Migrationen oder Providerkonfigurationen sind nicht nötig.
Die tatsächlichen React-Prüfungen decken zusätzlich Auswahlzustand, Entfernen,
Fokus, erhaltene Fehlerentwürfe, Sendezustand und Bestätigungsfokus in allen drei
Sprachen ab. Die native Vorschau im bestätigten Chrome-Profil
`ramizloki82@googlemail.com` zeigte bei 1282 Pixeln hell und 390 Pixeln dunkel
keine äußere Card und keine horizontalen Überbreiten. Auf 390 × 844 Pixeln war
„Antrag einreichen“ vollständig im sichtbaren Formularbereich. Englisch mit
Systemtheme löste dunkel auf; Tab erreichte den sichtbaren Upload-Fokusring,
anschließend den Sende-Button. Eine lokale Einreichung per Enter führte zum
Bestätigungstitel mit Fokus. Die Vorschau verwendet fiktive Antworten und bestätigt keine reale Dokumentübertragung.

## Verpflichtende Dokumente und Mehrfachauswahl

Neue Inhaberansprüche brauchen mindestens ein Dokument; der Hinweis „Optional“
entfällt. Die Auswahl erlaubt bis zu fünf PDF-, JPG- oder PNG-Dateien, jeweils
bis 5 MiB und zusammen bis 10 MiB. Zusätzliche Auswahlen ergänzen die Liste;
jedes Dokument kann einzeln entfernt werden. Ein abgebrochener Dateidialog
bewahrt die Auswahl. Alte Anträge ohne Datei bleiben lesbar. Migration und
Rollout-Verträglichkeit stehen in [releases.md](releases.md).

Die Routen-Fixtures prüfen Pflichtprüfung inklusive JSON-Umgehungsversuch,
Anzahl-/Größen-/Signaturgrenzen, private Downloads aller Dokumente, alte
Einzeldateien, Kompensation bei späterem Uploadfehler und Kontolöschung während
des zweiten Uploads. Die UI-Fixtures prüfen Mehrfachauswahl, Ergänzen, Entfernen,
Fehler mit erhaltenem Entwurf, Downloads in Übersicht und Verwaltung sowie
Bestätigung mit Fokuswechsel in DE/SQ/EN. Die vollständige Testsuite besteht.

Native Prüfung im bestätigten Profil `ramizloki82@googlemail.com`: Desktop
(1282 px, Light Mode) und schmal (390 px, Dark Mode) zeigen beide Dateien
ohne horizontalen Überlauf. Der native Dateidialog wählt zwei isolierte
Testdateien gleichzeitig; Tastaturfokus erreicht die Auswahl. Nach dem
lokal abgefangenen Einreichen erhält die Bestätigungsüberschrift den Fokus.
Die Vorschau verwendet fiktive Konten und lokale Testdateien. Es wurden keine
Produktionsanträge oder Nachweise erzeugt.

## CPU-Schnellpfade und manueller Einzelversand (12. Oktober 2026)

Startseite und Datenschutz werden wie Katalog/Profile aus dem geprüften Release ausgeliefert; persönliche Kontodaten kommen ausschließlich aus der geschützten Session-API. Landing-Dokumente enthalten keinen vollständigen Werkstattkatalog mehr. Legacy-Einreichungs-/Nachweislinks, DE/SQ/EN, RSC, Live-Entöffentlichung und administrative Katalogleserechte bleiben durch echte Worker-Tests geschützt. Öffentliche Katalog-GETs verwenden denselben Datenvertrag ohne das React-Seitenframework; administrative Abfragen und alle Schreibzugriffe bleiben im autorisierten Requestpfad.

Die Moderation wartet den ersten Mailversuch ab. Die native D1-Fixture bestätigt die tatsächliche sofortige Übergabe ohne Scheduled-Handler. Fehler erlauben maximal fünf manuelle Wiederholungen, nach Wartezeiten von 1/5/15/30/60 Minuten. Tests prüfen frühe Anfragen, erschöpfte Budgets, parallele Claims, unveränderte Payloadbytes, Empfänger-/Credentialänderungen, Resend-Fristen, SMTP-Unklarheit und den fehlenden Sammelversand. Die aufklappbare Versandübersicht lädt erst auf Anforderung und pollt nicht. React-Prüfungen schützen Beschriftungen, deaktivierte Aktionen, Status-/Fehlermeldungen und die erhaltenen Moderationsabläufe in DE/SQ/EN.

Der lokale CPU-Profiler verwendet ausschließlich einen isolierten workerd, Canonical-Fixtures und blockierte Providerzugriffe. Er misst Stichproben der aktiven CPU, keine Cloudflare-Abrechnung oder verbindliche Produktionsobergrenze. Die Messung nach einem geprüften Main-Release bleibt für seltene/private Aufrufpfade nötig. Die native Browserprüfung war in dieser Sitzung wegen wiederholter Meldungen „The user changed Google Chrome“ nicht zuverlässig ausführbar; es wird keine erfolgreiche native Layout-/Theme-Abnahme behauptet.

## Auth-Anbieterprüfung (Issue #139, 12. Oktober 2026)

Die tatsächliche Setupkomponente und sämtliche bestehenden Layoutstyles wurden
im bestätigten Chrome-Profil geprüft: DE Light auf 1280 Pixeln, SQ Dark und EN
System auf 390 Pixeln sowie Lade-, Busy- und Fehlerzustände. Tastaturauswahl,
Tabfokus, Anbieterwechsel im Entwurf, gesperrte Felder/Sprachnavigation und
anbieterspezifische Hilfe funktionierten ohne horizontalen Dokumentüberlauf.
PocketBase zeigt kein Public-Keyfeld; die Speicherfehlermeldung nennt neutral
Adresse und Konfiguration des Anmeldedienstes. Requests hatten ausschließlich
synthetische Antworten und lösten keine echten Providerwrites oder E-Mails aus.

Automatisiert sprechen die tatsächlichen Adapter und App-Routen unabhängige
Supabase-/PocketBase-Protokollserver. Der echte Node-HTTP-Test prüft zusätzlich
PocketBase über eine lokale TLS-Instanz, Runtimebindings, bestehende private
Besitzpfade, Profil-/Reauthablauf, Rollen, kontrollierten Wechsel, Datenschutz
und Logout. Eine separate lokale PocketBase-0.40.5-Probe bestätigt dessen
aktuelle REST-/ExternalAuth-Verträge mit synthetischen Konten. Ein echter
Googleclient, produktiver SMTP-Versand und eine Live-Hash-/Kontoübernahme waren
nicht Gegenstand dieser Probe; Voraussetzungen stehen in [auth-provider.md](auth-provider.md).

## Bewertungsdialog und mehrere durchgeführte Arbeiten

„Bewertung schreiben“ öffnet den Dialog auf dem Werkstattprofil mit `?bewerten=1`.
Direktaufruf, Neuladen und Browser-Zurück/Vorwärts stellen dessen Zustand wieder
her; bestehende `#bewerten`-Links bleiben gültig. Sprache und der geprüfte
Suchrücksprung bleiben auch im Anmelderückweg erhalten. Geschlossene Entwürfe,
einschließlich einer ausgewählten Datei, bleiben nur im Speicher der aktuellen
Seite und sind an Konto und Werkstatt gebunden. Erfolgreiches Einreichen startet
beim nächsten Öffnen einen leeren Entwurf, auch bei Browser-Vorwärts nach dem
Schließen der Erfolgsansicht; der Submit-Button ist dann wieder vorhanden.
Der Anzeigename kommt weiterhin
serverseitig aus dem bestätigten Konto; das Formular enthält keine Namenseingabe.

Migration `0025_dark_pretty_boy.sql` ergänzt die nullable JSON-Spalte
`visits.services` und übernimmt bestehende `service`-Werte als Einzelelementlisten.
Die Migration muss vor dem neuen Anwendungscode angewendet werden. Das skalare
`service`-Feld bleibt als primäre Leistung für ältere Clients bestehen. Neue
Formulare senden `services` als JSON-Liste mit ein bis sechs bekannten Kategorien;
der Server prüft jede Kategorie und entfernt Duplikate. Explizite Listen ersetzen
die bisherige Auswahl. Ältere Bearbeitungsanfragen bewahren zusätzliche Kategorien,
wenn die primäre Leistung unverändert bleibt. Eigene Einreichungen, Moderation und
öffentliche Bewertungen zeigen sämtliche Leistungen in der gewählten Sprache.
Berechtigungen, Besuchsnachweise und Freigabeanforderungen bleiben unverändert.
Schreibt ein vorheriger Worker während Deployment oder Rollback nur `service`,
hat ein geänderter skalarer Wert Vorrang vor der veralteten JSON-Liste. Nullable
Legacy-Einfügungen bleiben lesbar. Diese Übergänge prüft
`tests/review-services.test.mjs` nach Anwendung der echten Migrationen.

`tests/profile-review-dialog.test.mjs` prüft URL-Zustand, Browsernavigation,
Entwurf/File-Erhalt, Konto-/Werkstattgrenzen und den Anmelderückweg.
`tests/combined-reviews.test.mjs` prüft Speichern, Lesen, Bearbeiten, Legacy-Clients,
Moderation und abgewiesene Service-Listen mit isolierten SQLite-/R2-Fixtures.

## Gemeinsamer Seitenrahmen und normale Auswahlfelder (13. Oktober 2026)

Header, Inhaltsrahmen und Footer verwenden dieselbe `.wrap`-Breite: maximal
1440 Pixel, mit 56 Pixeln Seitenrand auf Desktop, 32 bis 1000 Pixeln und 16
bis 720 Pixeln Viewportbreite. Bewertungen, Einstellungen und Betriebsübersicht
teilen Titel- und Abstandsvariablen. Die Einstellungen haben flache äußere
Bereiche; die drei Theme-Karten bleiben erhalten. Der normale Bewertungskopf
hat weder Zurück-Link noch Aktualisieren-Button. Ladefehler erlauben gezieltes
Nachladen. Entfernt eine Löschung die auslösende Zeile, erhält die Überschrift
Fokus; spätere Navigation und andere Fokusbewegungen werden weiterhin bewahrt.

Formular-Picker verwenden `Field`/`FieldLabel` mit getrennten, zugeordneten Labels
und umrandeten Controls. Die alten gefärbten `.field`-Container entfallen;
das integrierte Suchlayout der Landingpage bleibt erhalten. Nur der Dialoginhalt
scrollt. `overflow: clip` verhindert, dass Tastaturfokus den äußeren Dialograhmen
verschiebt oder die Positionierung eines Select-Dropdowns in eine Größenschleife
bringt.

Die native lokale Abnahme prüfte Einstellungen, Bewertungen, Betrieb und Katalog
bei 1491, 1030, 1000 und 390 Pixeln: Header, Inhalt und Footer hatten jeweils
dieselben Kanten, ohne horizontales Überlaufen. Die Theme-Auswahl wurde mit Maus
und Tastatur in Hell und System geprüft. Ort und Sichtbarkeit im Werkstatteditor
hatten transparente Label-Container, verknüpfte Labels und umrandete Controls;
die Sichtbarkeitsauswahl blieb mit Enter, Pfeiltasten und Escape stabil, mit
unverschobenem Dialograhmen und ohne ResizeObserver-Meldung. Es wurden keine
Werkstattänderungen gespeichert.

## Client-Navigation ohne Dokument-Reload (13. Oktober 2026)

Interne Seitenlinks in Logo, Benutzer-/Verwaltungsmenü und Kundenabläufen
verwenden den Client-Router. Technische Endpunkte, Downloads, externe Ziele und
ausdrückliche Fehlerwiederholungen behalten Dokumentnavigation. Der gemeinsame
Release-RSC-Header enthält die von Vinext eingebettete Build-Kennung; ohne sie
verwirft der Browser vorgebaute Antworten auch aus demselben Release und lädt
das Zieldokument neu. Echte Buildwechsel behalten den sicheren Reload.

Die Navigationstests verwenden den tatsächlichen Vinext-Link und prüfen
DE/SQ/EN, Tastaturaktivierung, Menüschließen, native Linkausnahmen und
abgebrochene Klicks. Der RSC-Regressionstest verwendet den tatsächlichen
Routerplaner. Die gebaute Worker-Prüfung vergleicht öffentliche und private
RSC-Antworten mit der unabhängig gelesenen Kennung des Frameworkrenderers.

Im bestätigten Chrome-Profil `ramizloki82@googlemail.com` wurde der lokal
gebaute Cloudflare-Worker mit isolierter Datenbank und blockierten
Providerzugriffen geprüft. Vor der Headerkorrektur lösten Anmeldung und Logo
zusätzliche Dokumentanfragen aus. Danach blieben Anmeldung, Logo per Tab/Enter
und Einstellungen beim selben Dokumentzähler; nur RSC-Anfragen kamen hinzu.
Die Prüfung hat keine echten Konten, E-Mails oder Produktionsdaten verändert.

## Stabiler Anmeldestatus im Header (13. Oktober 2026)

Die Live-Abnahme von v1.31.2 im bestätigten Chrome-Profil zeigte bei Startseite
→ Einstellungen → Datenschutz dieselbe `performance.timeOrigin`: Die
Navigation lud kein neues Dokument. Gleichzeitig stieg die Anzahl der
`/api/session`-Anfragen von eins auf zwei auf drei; während jeder neuen
Prüfung erschien kurz der Gastheader. Das neue Seitenexemplar begann mit
`account:null`, obwohl die vorherige Seite das Konto bereits bestätigt hatte.

Der Header behält nun die zuletzt bestätigte Identität ausschließlich als
Anzeigevorschau im Arbeitsspeicher des aktuellen Browserdokuments. Der
Serverrenderer liest diese Vorschau nie; Cookies und Browserstorage werden
nicht ergänzt. Normale Seitenwechsel teilen die bestätigte Sitzung für
höchstens 30 Sekunden. Der nächste Zugriff nach Ablauf, Tab-/Fensterrückkehr,
BFCache-Wiederherstellung, Kontoänderungen und ein ausdrücklicher Retry prüfen
sie erneut; gleichzeitige Verbraucher teilen dieselbe laufende Anfrage.
Private Daten-APIs prüfen unabhängig davon jeden Zugriff serverseitig. Eine
abgelaufene Anzeigevorschau reicht nicht zum Laden der privaten Seite. Beim ersten Laden zeigt der Header einen beschrifteten, nicht
fokussierbaren Ladezustand statt unbestätigter Anmeldebuttons. Ein Fehler bleibt
neutral; eine bestätigte Gastantwort oder lokale Kontolöschung entfernt das
Kontomenü. Antworten von vor einer Invalidierung dürfen die Vorschau nicht
wiederherstellen.

`tests/session-header-navigation.test.mjs` prüft den echten Header und die
private Bewertungswrapper-Komponente bei verzögerten/fehlgeschlagenen
Sitzungsantworten, Client-Neumount, serverseitigem Rendering, Gastantwort,
Invalidierung, Cacheablauf, Fokusrückkehr und verspäteter alter Antwort. Die bestehende Deferred-UI-Suite
prüft weiterhin DE/SQ/EN, Rollenentzug, Umbenennung, Kontolöschung und
konkurrierende Sitzungsabfragen. Alle Fixtures verwenden fiktive Konten.

## Header beim kalten Profilübergang (14. Oktober 2026)

Der eingeloggte Live-Test wechselte vom Werkstattprofil über das Benutzermenü
zu eigenen Bewertungen, Betrieb und Verwaltung sowie über Browser-Zurück
wieder zum Profil. Die privaten Übergänge zeigten weder Gastbuttons noch
Dokument-Reloads. Beim ersten Profilaufruf im frischen Browserdokument fehlte
jedoch kurz der gesamte Header: Der tatsächliche Suspense-Fallback zeigte
ausschließlich „Werkstattprofil wird geladen …“. Der Zustand wurde erneut
mit einem zweiten Profil reproduziert und als Screenshot festgehalten.

Der Profil-Fallback enthält jetzt denselben `SiteHeader` mit `publicSnapshot`
wie die datenfreie Profilshell. Er übernimmt die bereits bestätigte Identität
aus dem gemeinsamen Browser-Sitzungszustand; eine unbekannte Sitzung bleibt
neutral. Die bestehende Anfrage-Deduplizierung gilt auch während des Übergangs
zur geladenen Profilshell. Es gibt keine neue Autorisierung, Datenabfrage,
Migration oder zusätzliche Browser-Speicherung.

`tests/profile-loading-header.test.mjs` rendert den tatsächlichen
Route-Fallback in DE/SQ/EN und prüft Header, Statusbeschriftung, serverseitige
Identitätsisolation und Tastaturzugang. Der Client-Test wechselt von einem
verifizierten Header in den Fallback und schützt den Kontomenü-Erhalt ohne
zusätzliche Sitzungsabfrage. Fixtures verwenden ausschließlich fiktive Konten.

## Fünf Minuten Sitzungscache und Tab-Synchronisierung (14. Oktober 2026)

Der browserinterne UI-Sitzungscache bleibt fünf Minuten frisch. Eine neue
Clientroute nutzt innerhalb dieser Frist dieselbe verifizierte Antwort. Nach
Ablauf oder Rückkehr zum Fenster wird erneut geprüft; der bekannte Header bleibt
währenddessen erhalten. Server und geschützte APIs prüfen ihre Berechtigungen
weiter unabhängig.

Erfolgreicher Passwort-Login, Logout, Passwortreset und Kontolöschung invalidieren
den Cache sofort. BroadcastChannel überträgt ausschließlich `signed-in`,
`signed-out` oder `refresh`; keine Identität, Rolle oder Tokens. Ohne
BroadcastChannel verwendet die App kurzlebige Storage-Ereignisse mit Signal und
Nonce; blockierter Storage verhindert die lokale Invalidierung nicht.
Empfangene Nachrichten werden nicht zurückgesendet.

Der erste erfolgreiche `/api/session`-Aufruf eines Dokuments stößt in anderen
Tabs eine erneute Prüfung an. Dadurch synchronisieren auch Google-/E-Mail- und
native Anmelderücksprünge ihre serverseitig gesetzten Cookies. Diese Prüfung
ändert keine serverseitigen Auth-Regeln und speichert keine Kontodaten im Browser.

`session-header-navigation.test.mjs` prüft den echten Header nach 30 Sekunden,
unmittelbar vor fünf Minuten und nach Ablauf. `session-cache-tabs.test.mjs`
prüft unabhängige Modulzustände zweier Tabs, Login/Logout ohne Fokuswechsel,
OAuth-Dokumentrückkehr, verspätete Antworten vor Logout, Nachrichten ohne
Kontodaten, Echovermeidung, Storage-Fallback und gesperrten Storage.

## Google-Anmeldung im Worker (14. Oktober 2026, Issue #183)

Der Live-Rücksprung reproduzierte `/anmelden?fehler=google&weiter=%2F%3Fbesuche%3D1`.
Der Auth-Provider bestätigte den erfolgreichen PKCE-Codeaustausch und die
Benutzerprüfung; der Worker meldete anschließend einen `TypeError`. Die
unabhängige Google-Identitätsprüfung verwendete `fetch` mit `redirect:"error"`.
Die konfigurierte Workers-Laufzeit unterstützt nur `follow` und `manual` und
verwarf diesen Aufruf bereits vor der Netzwerkanfrage.

Die Prüfung verwendet jetzt `manual`. Die bestehende Erfolgsstatusprüfung
verwirft Weiterleitungen und andere Fehler, sodass der Google-Bearertoken
weiterhin ausschließlich an den festen Userinfo-Endpunkt geht. Identitäts-,
Sitzungs- und Berechtigungsprüfungen bleiben erhalten.

`node tests/google-auth-worker.test.mjs` reproduzierte vor der Änderung den
identischen Fehler-Rücksprung mit `TypeError` und besteht danach. Der Test
führt die echten Start-/Callbackrouten, das Supabase-SSR-SDK, PKCE, eine
asymmetrisch signierte ES256-Sitzung und D1 in der nativen Workers-Laufzeit aus.
Er prüft die reguläre Sitzung, DE/SQ/EN, sichere Rücksprungziele, Abbruch,
ungültigen Flow, fehlgeschlagenen Codeaustausch, Google-Fehler und
Identitätsabweichungen sowie das Verwerfen von Redirects ohne Tokenweitergabe.
Alle Konten, Signaturschlüssel und Providerantworten sind isolierte Fixtures;
der Test ist im regulären Runner registriert. Eine erfolgreiche Anmeldung
auf Produktion muss nach Übernahme des geprüften Main-Releases separat
verifiziert werden.
