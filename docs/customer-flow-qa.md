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

Isolierte Versand-Fixtures prüfen atomare Moderation/Ereignisspeicherung, verifizierte Empfänger und bestätigte Altverknüpfungen, private Inhalte, sichere gezielte Anmeldelinks, gleichzeitige Entscheidungen und Versandversuche, dauerhafte Backoffs einschließlich der Begrenzung fehlgeschlagener Empfängerabfragen, fehlende Konfiguration/Kontakte sowie Netzwerk- und Datenbankfehler nach einer bereits angenommenen Nachricht. Wiederholungen verwenden exakt denselben Inhalt und Idempotenzschlüssel; abgelaufene Schlüssel und geänderte Empfänger oder Zugangsdaten führen zu einer sichtbaren Blockade. Die Admin-UI unterscheidet Vormerkung, Übergabe und unklare Ergebnisse und erlaubt keine blinde Wiederholung nach Ablauf.

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
