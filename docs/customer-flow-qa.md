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

Die echte Google-Anmeldung wird erst nach dem sicheren Eintragen des Clientschlüssels, Aktivierung des Providers und erfolgreichem Browser-Callback als geprüft geführt. Fixture-Ergebnisse allein bestätigen keine produktive Google-Anmeldung.
