# Zentrale Werkstattdaten

`data/workshops.json` ist die versionierte Quelle für Werkstattimporte. Sie enthält den aktuellen Bestand: **172 veröffentlichte Kfz-Servicebetriebe einschließlich Fahrzeugaufbereitung und keine Entwürfe**. Der Status jedes Datensatzes ist ausdrücklich gespeichert. Die Schätzung von ungefähr 1.700 Werkstätten stammt vom Nutzer; sie ist kein recherchierter Gesamtbestand und keine Vollständigkeitsbehauptung.

Die bisherigen getrennten Dateien für Profile und Google-Momentaufnahmen wurden in diese Quelle übernommen und entfernt. Namen, Kontakte, Quellen, Prüfzeitpunkte und stabile Riparim-Kennungen bleiben erhalten. Es werden keine Platzhalter für fehlende Werkstätten erzeugt.

## Bewertungsquellen

- Riparim-Bewertungen bleiben im eigenen Besuchs-/Bewertungssystem. `rating` und `count` der Riparim-Aggregate gehören nicht in diese Profilquelle.
- `google.placeId` und `google.matchedAt` speichern die tatsächliche Zuordnung zu Google. Zuordnungen werden über offizielle Karten-/Betriebsnachweise oder passende unabhängige Telefon-, Namens- und Standortbelege verifiziert. `google.verification` bewahrt die eigenen Recherchemetadaten der zuletzt einzeln bestätigten Zuordnungen. Eine veröffentlichte Werkstatt braucht eine Place ID, unabhängig von Google-Rezensionen.
- `google.snapshot` enthält ausschließlich die bereits unabhängig belegten Momentaufnahmen einschließlich Originalquelle und Prüfzeitpunkt. Nur fünf Sternebewertungen sind numerisch belegt. Unbekannte Sterne oder Anzahlen bleiben `null`.
- Aktuelle API-Sterne und Rezensionen werden live geladen und weder in dieser Datei noch in Git, D1 oder R2 abgelegt.

Die Standardbedingungen von Google erlauben keine dauerhafte Git-Datenbank mit kopierten Places-Geschäftsangaben und Bewertungen. Place IDs sind von den Speicherbeschränkungen ausgenommen. Ein Bulkimport von Google-Inhalten benötigt eine passende abweichende Freigabe/Lizenz; ein API-Schlüssel allein ersetzt diese nicht. Ohne sie werden weitere Betriebsangaben unabhängig recherchiert bzw. aus einer ausdrücklich dafür lizenzierten Datenquelle übernommen.

## Prüfen, zusammenführen und importieren

```sh
npm run catalog:check
npm run catalog:merge -- /absoluter/pfad/zum/import.json
npm run catalog:merge -- /absoluter/pfad/zum/import.json --write
```

Eine Importdatei enthält ein `workshops`-Array mit vollständigen Datensätzen im selben Format. Der erste merge-Aufruf zeigt nur den geplanten Abgleich. `--write` aktualisiert die zentrale Datei atomar. Ungültige Quellen, doppelte IDs/Place IDs, Angaben aus der Zukunft oder unvollständige Datensätze werden zurückgewiesen.

Bestehende Kennungen bleiben stabil. Eine übereinstimmende Place ID bzw. exakt passender Name, internationale Telefonnummer, Ort und Adresse verhindern einen zweiten Datensatz. Gemeinsame Telefonnummern allein führen zu keiner Zusammenführung: Die Eurogoma-Filialen in Gjakova und Mitrovica bleiben getrennt. Ältere Revisionen und ältere Google-Momentaufnahmen ersetzen keine neueren Angaben. Unklare Betriebe bleiben ausdrücklich als `draft` gespeichert. `data/workshop-scope.json` dokumentiert sechs fachlich ausgeschlossene Einträge sowie den unabhängig als geschlossen belegten Opel-Rakovica-Betrieb. Die 27 verworfenen Profile einschließlich Auto Electronics sind aus dem aktuellen Katalog entfernt. Die acht übrigen Entwürfe wurden nach der abschließenden Prüfung auf Nutzerauftrag entfernt; der belegte Reno-Nordstandort erhält eine neue Kennung. Vorhandene Riparim-Bewertungen bleiben erhalten; Leistungen und Marken werden nicht aus Google-Sternen oder aus einem Namen erfunden.

Nach Prüfung und Commit wird die Site wie üblich veröffentlicht. Der Runtime-Import verwendet den Inhalts-Hash der zentralen Datei als Abschlusskennung. Er ergänzt neue IDs und übernimmt nur jüngere Profilrevisionen; spätere Admin-Änderungen, Entwürfe, Besuche und Riparim-Bewertungen bleiben geschützt. Der Import arbeitet mit höchstens 95 SQL-Bindings pro Statement und 50 Statements pro Batch, kann nach einem Teilfehler wiederholt werden und löscht keine Profile.

Änderungen aus der Admin-Oberfläche müssen vor der nächsten Katalogänderung wieder exportiert und in diese Datei übernommen werden. Die vorhandene Admin-Oberfläche schreibt weiterhin in die laufende Datenbank; sie kann keinen Git-Commit erzeugen. Bei einem Konflikt bleibt die jüngere Datenbankrevision erhalten, bis der Export die zentrale Datei aktualisiert.

## Öffentlich belegte Kontaktdaten

`data/workshop-contacts.json` ergänzt vorhandene Profile um die auf eigenen
Betriebswebsites recherchierten E-Mail-Adressen und Websites. Die zehn am
13. Oktober 2026 abgeglichenen Betriebe behalten ihre bisherigen Kennungen,
Telefonnummern, Orte und Freigabestatus. Die separate Tabelle
`workshop_contact_details` verknüpft jeden Kontakt per Fremdschlüssel mit dem
Profil und speichert Quellen-URLs, Prüfdatum sowie den abgeglichenen Namen,
Telefonkontakt und Ort. Bei JavaScript-Websites bleibt auch die konkrete
öffentlich ausgelieferte Quelldatei im Nachweis erhalten.

`email_verification = publicly_listed` bedeutet ausschließlich, dass der Betrieb
die Adresse öffentlich aufführt. Es bestätigt weder Zustellung noch Einwilligung
oder Betriebsbesitz. Ansprache, Antworten und Follow-up-Termine bleiben im
bestehenden Google Sheet; dieser Datenimport löst keinen E-Mail-Versand aus.
Die ursprüngliche Einzeladressenspalte und Websiteangaben bleiben für ältere
Releases erhalten. Mehrfachadressen ergänzen sie über den folgenden Vertrag.

`npm run catalog:check` prüft Kontaktformat, Quellen, Prüfdatum, eindeutige IDs
und die Übereinstimmung mit dem veröffentlichten Katalog. Der Runtime-Import
bezieht die Kontaktquelle in seine Abschlusskennung ein und prüft Name, Telefon,
Ort und Veröffentlichung erneut im tatsächlichen SQL-Schreibvorgang. Abweichende
Liveprofile werden übersprungen, neuere Kontaktprüfungen bleiben erhalten.
Kontaktdaten ändern keine Profilrevisionen, Bewertungen oder Besitzrechte. Die
additive Drizzle-Migration wird über den normalen geprüften Main-Release
angewendet; der anschließende Katalogimport ergänzt die zehn Kontaktdatensätze.

## Mehrere E-Mail-Adressen

`data/workshop-emails.json` verwendet Version 2 des Kontaktvertrags und enthält
eine Recherchezeile für jede der 172 bestehenden Werkstattkennungen. Der am
13. Oktober 2026 im internen Browser geprüfte Bestand umfasst 83 Adressen bei
74 Werkstätten, davon acht mit mehreren Adressen. 98 Listen bleiben leer,
einschließlich drei ungeklärter Zuordnungen. Jede Adresse besitzt eigene
Quellen-URLs und ein Prüfdatum; erfolglose Prüfungen und ausgeschlossene
Fremdtreffer sind dokumentiert. Die zehn vorhandenen Adressen und ihre
Nachweise bleiben erhalten. Es werden keine Adressen aus Domains abgeleitet.

Migrationen `0023` und `0024` ergänzen `workshop_email_addresses`, die nullable
Spalte `workshops.editorial_emails` und den Revisionsnachweis
`workshop_email_imports`. Die erste Migration übernimmt die zehn bestehenden
Kontaktzeilen samt Nachweisen. Alte Spalten werden weder entfernt noch
umgeschrieben. Eine Datenbankgrenze erlaubt höchstens zehn Rechercheadressen
je Werkstatt. Der Katalogimport prüft die tatsächliche Betriebszuordnung und
ergänzt nur neue oder jüngere Nachweise; die Deploymentplanung bleibt frei
von Laufzeitdecodern und deren Validatorabhängigkeiten.

`editorial_emails = null` verwendet die Rechercheadressen. Eine gespeicherte
Liste hat dauerhaft Vorrang, auch eine leere Liste. Ihre Einträge besitzen
`address`, `active` und `verified`. Deaktivierte Einträge bleiben ausschließlich
für den berechtigten Inhaber und die Verwaltung sichtbar. Entfernte Einträge
werden auch durch spätere Rechercheimporte nicht öffentlich wiederhergestellt.
Recherchierte Adressen sind immer unbestätigt. Verifizierung ist die manuelle
Bestätigung durch die berechtigte Verwaltung oder eine freigegebene
Inhaberänderung; sie bestätigt keine technische Zustellung. Mehrere Adressen
können gleichzeitig verifiziert sein.

Inhaberänderungen verwenden die vorhandenen Entwürfe und Moderation;
Adminänderungen verwenden die bestehende Berechtigung und Profilrevision.
Der Schreibvertrag verwendet `emailEntries` mit Statuswerten; die öffentliche
Stringliste `emails` wird bei Profilupdates nicht als Schreibauftrag interpretiert.
Beide Formulare beginnen mit der aktuell wirksamen Liste und erhalten auch
deaktivierte redaktionelle Einträge. Unveränderte Listen werden ausgelassen.
Ändert die UI eine Adresse, setzt sie deren vorherige Verifizierung zurück.
An den Systemgrenzen gelten zehn unterschiedliche Adressen, maximal
254 Zeichen, entfernte äußere Leerzeichen und Dublettenprüfung ohne Beachtung
der Groß-/Kleinschreibung. Reihenfolge und explizite Verifizierungs-/Aktivwerte
bleiben erhalten.

Die öffentliche API liefert `emails: string[]` und die zugehörigen aktiven
`emailContacts: {address,verified}[]`. Sie zeigt keine Quellen, inaktiven
Einträge oder Importmetadaten. „Kontakt & Standort“ enthält einzelne codierte
`mailto:`-Links und den jeweiligen Verifizierungsstatus. Ohne aktive Adressen
entfällt der E-Mail-Bereich. Der skalare Adressaggregate verändert weder
Bewertungsanzahl noch Sterne; Konto-E-Mails und Öffnungszeiten werden nicht
bearbeitet. Es erfolgt kein Mailversand.

```sh
npm run emails:import
npm run emails:import -- --output /geschützter/pfad/query.json
npm run emails:import -- --local-db /isolierte/kopie.sqlite --write
# Nur mit dem veröffentlichten Main-Release ausgecheckt:
npm run emails:import -- --release vX.Y.Z --write --revision <vorschau-hash>
```

Die Revision ist der SHA-256 des validierten vollständigen Manifests. Eine
abweichende angegebene Revision wird abgewiesen. Vor jedem tatsächlichen
Schreibvorgang prüft der Import alle Werkstattzuordnungen, einschließlich
leerer Listen, und schreibt Revision und Adressen atomar. Gleiche Revisionen
ändern keine bestehenden Daten; jüngere Nachweise und sämtliche redaktionellen
Listen bleiben geschützt. Vor Produktionsmigrationen/-importen ist eine
geschützte SQL-Sicherung mit erfolgreicher isolierter Wiederherstellung nötig.
Veröffentlichung erfolgt ausschließlich über geprüften PR, Squash-Merge und
den normalen Main-Release.

## Kuratierte SQ-/EN-Anzeigen

`data/workshop-translations.json` enthält ausschließlich redaktionelle SQ-/EN-
Anzeigen nach stabiler Werkstattkennung: `specialty`, `description`, geordnete
`serviceDetails`, `phoneNote` und geordnete `sourceTitles`. Alle 129 beim Start
veröffentlichten versionierten Profile sind abgedeckt. Namen, Adressen, Kontakte,
Marken, Beratungssprachen, Source-URLs, Google-Inhalte und Nutzerdaten bleiben
Originale. Die Datei beeinflusst weder D1-Import/Seedkennung noch Identityhash,
Freigabestatus oder Migrationen.

Der zentrale Vertrag `workshopTranslationSourceHash` in
`lib/workshop-translations.ts` bildet SHA-256 über UTF-8-`JSON.stringify` des
Objekts in dieser festen Reihenfolge: `specialty`, `description`, `serviceDetails`,
`phoneNote`, `sources`. Jede Quelle ist in Originalreihenfolge ausschließlich
`{url,title}`; Arrayreihenfolge, Leerraum und Satzzeichen bleiben Bestandteil
der Revision. Kontakte, Zeitstempel, Quellenart und andere Metadaten fließen
nicht ein. Hashlogik in Pflegeskripten nicht kopieren.

Bei Katalogpflege zuerst aktuelle freigegebene Admin-/Betriebsänderungen in die
Canonicalquelle übernehmen. Dann die fünf Displayfelder für SQ und EN fachlich
prüfen und ihre Arrays in derselben Originalreihenfolge aktualisieren. Besonders
Verzeichnisherkunft, unbestätigte Erreichbarkeit und unbekannte Leistungen/Marken
müssen erhalten bleiben. Den Hash mit dem zentralen Vertrag berechnen, nicht
bloß die Revision austauschen, um alte Übersetzungen weiterzuverwenden.
`npm run catalog:check` verweigert unbekannte/doppelte IDs, zusätzliche Felder oder
Sprachen, veraltete Hashes, falsche Arraylängen, leere Übersetzungen nicht leerer
Originale und fehlende SQ-/EN-Abdeckung veröffentlichter versionierter Profile.
Entwürfe erzeugen keine Abdeckungspflicht. Die Zuordnung jedes Arraytexts zum
Originalindex wird außerdem redaktionell geprüft; die Hashprüfung kann keine
semantisch vertauschten Übersetzungen erkennen.

Der reine Serveradapter prüft den Hash nochmals gegen die tatsächlich gelesenen
Livefelder und liefert `displayById` getrennt von Canonical-`workshops`. Ein
geändertes oder neues Liveprofil zeigt sein aktuelles Original mit einem lokalen
sichtbaren Hinweis bis zum nächsten geprüften Katalog-/Releaseupdate. Nur ein
Original mit bekanntem, exakt passendem deutschen Kataloghash bekommt `lang=de`;
neue Betreiber-/Livefreitexte werden nicht pauschal als Deutsch gekennzeichnet.
Fehlende APIlocale bewahrt die deutsche Legacyantwort; explizite `de|sq|en`
liefert die zusätzliche öffentliche Displaymap. Die autorisierte Verwaltungs-
antwort behält Canonicaldaten ohne Overlay. Deutsche Originaldetails bestimmen
weiterhin Leistungsgruppen und Suchhervorhebung; ihre ursprünglichen Indizes
bleiben vor Normalisierung/Deduplizierung erhalten. Es gibt keine automatische
Übersetzung von Betreibertexten, Reviews, Belegen oder privaten Nutzerdaten.

## Google-Zuordnungen für den vorhandenen Bestand

```sh
npm run catalog:google-match
# Nach Einrichtung des Server-Schlüssels in der sicheren Laufzeitumgebung:
npm run catalog:google-match -- --fetch --write --links --limit 100
```

Ohne `--fetch` werden keinerlei API-Anfragen ausgeführt. Mit `--fetch` wird nach Name und Ort nur für bestehende veröffentlichte Werkstätten gesucht; höchstens 100 Such- und Detailabfragen je Lauf. Der Schlüssel wird ausschließlich aus `GOOGLE_PLACES_SERVER_API_KEY` gelesen und nie ausgegeben oder gespeichert. Ein Treffer braucht passende Telefonnummer, Name, Kosovo und Standort. Mehrdeutige Treffer werden nicht zugeordnet. Bei Authentifizierungs-, Quoten- oder Place-ID-Konflikten wird der Fehler mit Werkstattkennung protokolliert; API-Inhalte und Schlüssel erscheinen nicht im Bericht. Nur erfolgreich zugeordnete Place IDs und eigene Zuordnungszeitpunkte werden mit `--write` übernommen.

Die Live-Darstellung benötigt zusätzlich `GOOGLE_MAPS_BROWSER_API_KEY`; Einrichtung und Schlüsselbeschränkungen stehen in `docs/google-places.md`.

## Weiterprüfung der 51 Entwürfe am 5. Oktober 2026

Die verbleibenden 51 Profile wurden erneut anhand aktueller Betriebsseiten, Betriebsbeiträge, unabhängiger Verzeichnisse und ihrer konkreten Standorte geprüft. **13 weitere bestehende Profile erhalten eine eindeutige bestätigte Google-Identität:** Vedati, Auto-Diagnostika, Ford Jashanica, BEDA, Cufa, INOVATOR, Maloku, Mentori (bisher Fiat), Nero, BMW Prishtina, Kimi, Xhelali und Gazi. Kennungen und frühere Riparim-Bewertungen bleiben erhalten. Der Katalog nach diesem Prüfschritt umfasste **125 veröffentlichte Profile und 38 Entwürfe**.

Aktuelle Betriebsquellen verbinden bei geänderten Kontakten oder Namen ausdrücklich den bisherigen und heutigen Auftritt. INOVATORs Unternehmensgeschichte belegt die Fortführung als INOVATOR Automotive; Malokus eigene Website nennt alten und aktuellen Kontakt; Xhelalis unabhängiger Betriebsbeleg verknüpft den früheren Kontakt mit Auto Folje Xhelali. Bei Kimi und Gazi fehlen Google-Telefonkontakte: Hier belegen charakteristischer Name, Werkstattfoto und der tatsächliche profilspezifische Standortmarker im unabhängigen Gjirafa-Verzeichnis denselben Geschäftspunkt innerhalb von 300 Metern. Kartenmittelpunkte und andere nahe Werkstätten wurden nicht als Identitätsbeleg verwendet. Die zusätzlichen genauen Profilkoordinaten für Cufa und Xhelali stammen ausschließlich aus deren selbst veröffentlichten Directions-Zielpunkten.

Jede neue Place ID wurde direkt bei Google Maps mit einer absichtlich unpassenden Ersatzsuche geprüft. Nur wenn Google die ID selbst auflöste und genau die vorher geprüfte Geschäftspaarung auswählte, galt der ID-Rücktest als bestanden. Das verhindert eine versehentliche Bestätigung durch eine bloße Namenssuche. Eine CID allein reicht weiterhin nicht. Die Anwendung erhält keine zusätzliche Logik zur Ableitung von IDs. Es wurden **keine weiteren serverseitigen Places-Abfragen** ausgeführt; das gemeinsame Tageslimit bleibt unverändert. Google-Bewertungen und Geschäftsdaten wurden nicht dauerhaft kopiert.

Alle 51 Prüfausgänge stehen in `data/catalogue-followup-2026-10-05.json`. **30 benötigten danach weiterhin eine eindeutig belegte Google-Identität**, bei Reno Center MUÇIQI bleibt die **Filialkontinuität** ungeklärt, **Opel Rakovica ist unabhängig als geschlossen belegt**, und **sechs fachliche Ausschlüsse** bleiben erhalten. Die heutige Reno-Nordfiliale in Shkabaj/Obiliq wird ohne belegte Kontinuität nicht auf das frühere Südprofil in Graçanicë/Preoc übertragen. Bei Axha, Firi und G & B gehört der nahe Google-Eintrag bereits zum öffentlichen BMW-balia-Profil; bloße Nähe darf weder eine neue Zuordnung noch eine Überschreibung bewirken. Historische bzw. nicht zugewiesene IDs für den geschlossenen Betrieb und die andere Reno-Filiale stehen nur im Prüfbericht.

Die erste Prüfung mit 34 Freigaben bleibt als historischer Bericht unverändert erhalten. Es sind keine Schemaänderung und keine neue Drizzle-Migration erforderlich. [Issue #53](https://github.com/ramiz4/riparim/issues/53) verfolgt die noch offenen Fälle.

## Vertiefte Identitätsprüfung der 30 verbleibenden Fälle

Die 30 noch ungeklärten Identitäten wurden erneut über eigene Anzeigen und Betriebsbeiträge, Zusatzkontakte auf Werkstattschildern, primäre OSM-Daten und profilspezifische Standortmarker untersucht. **Drei weitere vorhandene Profile sind bestätigt:** Sfishta Auto Home (bisher Prishtina Auto Home), Auto Elektro Servis Niki und Auto Pjesë & Servis Fatosi. Der Katalog umfasst danach **128 veröffentlichte Profile und 35 Entwürfe**; alle 163 Kennungen bleiben erhalten.

Sfishta Auto Homes eigene Serviceanzeige führt den bisherigen Kontakt weiter. Amtliche Auftragsbelege nennen Auto Home und N.T.SH. Sfishta gemeinsam in Bardhosh und bestätigen den zusätzlichen Geschäftskontakt des Google-Eintrags. Das belegt die operative Kontinuität, ohne eine rechtliche Verschmelzung zu behaupten. Nikis eigene Anzeigen und aktuelle Betriebsbeiträge verbinden den unveränderten Kontakt, Pkw-Elektrik/Diagnose und Avdullah Presheva Nr. 82 mit dem kombinierten Enesi-Moto-Geschäftspunkt. Der Pkw-Werkstattname bleibt erhalten; Transportwerbung allein gilt nicht als Reparaturnachweis. Fatosis eigene Anzeigen verbinden den bisherigen Kontakt mit dem Google-Kontakt des Waschbetriebs. Eine eigene Stellenanzeige und der genaue unabhängige Werkstattmarker bestätigen denselben kombinierten Standort; Verzeichnisbeschreibung und Reparaturfotos belegen den Pkw-Service.

Die Google-Prüfung erfolgte im vom Nutzer vorgegebenen Browserprofil. Jede Place ID wurde mit einer absichtlich unpassenden Ersatzsuche auf genau denselben Eintrag zurückgeprüft. Es gab keine zusätzlichen serverseitigen Places-Abfragen, keine Übernahme von Google-Bewertungen und keine Lockerung der Veröffentlichungssperre. Neue öffentliche Profilangaben stammen aus unabhängigen Betriebsquellen; Google-Koordinaten wurden nicht gespeichert.

`data/catalogue-identity-2026-10-05.json` dokumentiert alle 30 Ergebnisse und die zusätzlichen Recherchewege. **27 Identitäten bleiben ungeklärt.** Die acht übrigen Entwürfe dieser Stufe bleiben unverändert: ein Reno-Filialkonflikt, der geschlossen belegte Opel-Betrieb und sechs fachliche Ausschlüsse. Die früheren Berichte mit 34 und 13 Freigaben bleiben unverändert; Tests gleichen alle drei aufeinanderfolgenden Prüfungen ab.

## Vom Nutzer verworfene 27 Entwürfe

Auf ausdrücklichen Nutzerauftrag werden genau die 27 zuletzt ungeklärten Identitäten entfernt. `data/workshop-removals.json` hält ausschließlich die entfernten Kennungen, den Auftrag und die Bestandsänderung fest: **163 → 136 Profile**, weiterhin **128 öffentlich**, **35 → 8 Entwürfe**. Die historischen Prüfberichte bleiben unverändert; ihre früheren Bestandszahlen sind keine aktuellen Katalogzahlen. Der ungemergte Quellenprüfungs-PR #72 wurde verworfen.

Vor der produktiven Entfernung werden die Katalogtabellen geschützt gesichert und ihre Wiederherstellung geprüft. Die atomare Löschoperation verlangt alle 27 unveränderten, nicht veröffentlichten und nicht Google-zugeordneten Profile ohne verknüpfte Besuche, Besitzrechte, Übernahmeanträge oder Änderungsentwürfe. Ein Konflikt unterdrückt die gesamte Entfernung. Kundentabellen und private Nachweise werden nicht beschrieben oder gelöscht.

Entfernungsmarker in `catalog_state` bleiben erhalten. Neue Migration `0013_prevent_retired_workshop_reimport.sql` verhindert, dass ältere Seeder die Profile oder ihre Google-Metadaten wieder einfügen. Frische Installationen erhalten dieselben Marker; Importvalidator und Verwaltung weisen entfernte Kennungen zurück. Die Löschung wird nach dem geprüften Release separat und kontrolliert ausgeführt. Eine spätere Wiederherstellung braucht einen ausdrücklichen Auftrag und muss Manifest sowie Marker berücksichtigen; ein Code-Rollback stellt die Daten nicht wieder her.

## Bestandsprüfung vom 5. Oktober 2026

Alle 85 offenen Entwürfe wurden gegen den aktuellen Produktionsbestand abgeglichen. Bei 77 fehlte eine gespeicherte Place ID; die acht bereits zugeordneten Entwürfe waren sechs fachlich ausgeschlossene Einträge und zwei zurückgestellte Standortkonflikte. Doppelte Place IDs wurden nicht gefunden. Die 422-Freigabesperre ist bei fehlender eindeutiger Identität beabsichtigt; sie wurde nicht abgeschwächt.

32 Entwürfe erhielten eine neue, eindeutig gegen unabhängig belegtes Telefon, charakteristischen Namen und Ort bestätigte Google-Zuordnung. Lesbare unabhängige Verzeichnisse, Betriebsanzeigen und gegebenenfalls OpenStreetMap belegen den Pkw-Service. Zwei weitere Entwürfe konnten nach Auflösung veralteter Verzeichnisadressen veröffentlicht werden: Autodiagnozas eigene Kontaktseite nennt Zona Industriale Nr. 98 und den Plus Code M42G+74; ein Betriebsbeitrag belegt ACC-/ADAS-Kalibrierung an einem Pkw. BMW Service Ferizajs eigenes Betriebsprofil nennt Brahim Ademi und einen ausdrücklich veröffentlichten Directions-Zielpunkt. Beide aktuellen Standorte liegen höchstens 300 Meter vom jeweils unverändert erhaltenen Google-Eintrag entfernt. Die Koordinaten stammen aus den unabhängigen Betriebsquellen; Kartenansichts-Mittelpunkte wurden nicht übernommen.

Die **34 Freigaben sind live veröffentlicht**. Der öffentliche Bestand umfasste danach **112 Profile und 51 Entwürfe**, davon 21 öffentliche Profile mit genauen Koordinaten. Alle 112 veröffentlichten Profile besitzen eine eindeutige Place ID. Kennungen, Besitzrechte, private Nachweise und Riparim-Bewertungen wurden bewahrt. Vor den Datenänderungen wurde eine geschützte Sicherung der betroffenen Katalogtabellen erstellt und ihre Wiederherstellbarkeit in einer isolierten SQLite-Datenbank geprüft. Die Live-Übernahme prüfte Profilrevision und Place-ID-Konflikte; der öffentliche API-Bestand wurde anschließend mit der zentralen Quelle verglichen.

**Danach benötigten 45 Entwürfe eine bestätigte Place ID, sechs blieben fachlich ausgeschlossen.** Bei Vedati wurden aktuelles Telefon, Adresse und belegter Google-CID-Link vorbereitet. Auto-Diagnostikas Adresse und Leistungsumfang wurden anhand der Betriebsanzeige auf reine Fehlerdiagnose korrigiert; dort sind keine Reparaturen belegt. Beide blieben in diesem ersten Prüfschritt bis zur Place-ID-Auflösung als Entwurf erhalten. Opel Rakovica ist im aktuellen unabhängigen Verzeichnis als geschlossen markiert. Die serverseitigen Google-Abfragen erreichten das gemeinsame Tageslimit von 100; die Grenze wurde nicht erhöht oder umgangen. Eigene Prüfergebnisse und der Status jedes der 85 ursprünglichen Entwürfe stehen in `data/catalogue-review-2026-10-05.json`; [Issue #53](https://github.com/ramiz4/riparim/issues/53) bleibt für die offenen Zuordnungen bestehen.

Google-Antworten wurden nur vorübergehend für den Identitätsvergleich verarbeitet. Dauerhaft gespeichert werden ausschließlich Place IDs und eigene Prüfmetadaten; neue Google-Sterne, Rezensionen, Öffnungszeiten oder Google-Geschäftskoordinaten wurden weder in Git noch in D1 übernommen. Es sind keine Schemaänderung und keine neue Drizzle-Migration erforderlich.

## Bestandsprüfung vom 4. Oktober 2026

Alle 92 bisherigen Entwürfe wurden für diese Veröffentlichung gesichtet. Neun konnten anhand unabhängiger Kontakt-/Pkw-Servicequellen und einer individuell bestätigten Google-Identität freigegeben werden; 77 benötigen weitere Belege, sechs bleiben fachlich ausgeschlossen. Auto Regllazha TABAKU, Auto Service Bardhi, BMW-Visari, Autoservis Agimi, Auto Rally 90, BLEDI, XONI, Ylli Performance und Ali Mercedesi wurden veröffentlicht. Die bisherige Kennung bleibt jeweils erhalten. BMW-Visaris aktueller Kontakt ist auch unabhängig als zweite Telefonnummer belegt.

Bei 13 bereits veröffentlichten Profilen wurden die erneut belegten Plus-Code-Adressen mit dem offiziellen Open-Location-Code-Algorithmus offline in Koordinaten umgerechnet. Die gespeicherte Google-Identität wurde einzeln gegen den unabhängig belegten Standort bestätigt. Damit besitzen 19 veröffentlichte Profile genaue Koordinaten; diese sind keine Ortsmittelpunkte und stammen nicht aus einem Google-API-Export.

Der bislang fehlende Suchursprung für Skenderaj stammt aus dem GeoNames-Ortsdatensatz [785642](https://sws.geonames.org/785642/about.rdf), nicht aus dem Gemeindedatensatz. Entfernungssortierung und Umkreissuche funktionieren dadurch auch bei Auswahl dieses Ortes. Der Ursprung bleibt ein Ortsmittelpunkt; die Werkstattkoordinaten bleiben getrennt.

Autodiagnoza Kosove und BMW Service Ferizaj zeigen dagegen einen Abstand von mehr als 300 Metern zwischen der unabhängig belegten Adresse und dem aktuellen Standort ihrer gespeicherten Google-Identität. Beide bleiben bis zur unabhängigen Klärung als Entwurf erhalten. Ihre Kennungen, historischen Google-Zuordnungen und Bewertungen werden nicht gelöscht. `data/workshop-scope.json` verhindert eine versehentliche erneute Veröffentlichung.

Die Prüfung ergibt **78 veröffentlichte Profile und 85 Entwürfe**. `data/catalogue-review-2026-10-04.json` dokumentiert jeden geprüften Entwurf, die eigenen Identitätsprüfungen, Quellen und zurückgestellten Konflikte. Es enthält keine kopierten Google-Geschäftsinhalte. Für aktuell angebotene Beratungssprachen lagen keine ausdrücklichen belastbaren Belege vor; die Sprachfelder bleiben leer. Bereits bestätigte Service-WhatsApp-Kontakte wurden erneut geprüft; reine Verkaufskontakte und Kartenansichts-Mittelpunkte wurden nicht übernommen. Global Automotives Kontaktquelle verweist jetzt auf die aktuelle Betriebsseite `/kontakti/`.

## Größere Recherche

Eine einzelne Text-Search-Abfrage liefert derzeit höchstens 60 Ergebnisse über bis zu drei Seiten. Selbst mehrere Abfragen sind keine vollständige Landesliste. Nach geklärtem Zugang und Datenrecht muss die Recherche alle relevanten Gemeinden und Begriffe abdecken, Folgeseiten verarbeiten, ausgeschöpfte Suchgebiete weiter aufteilen und die tatsächliche Abdeckung dokumentieren. `car_repair` und `tire_shop` sind passende Ausgangskategorien; Autohändler und Autowäschen benötigen einen tatsächlichen Werkstattnachweis. Jeder Import erfolgt zunächst in die JSON-Quelle, dann nach Prüfung in die Site.

Offizielle Dokumentation, geprüft am 3. Oktober 2026:

- https://developers.google.com/maps/documentation/places/web-service/policies
- https://cloud.google.com/maps-platform/terms
- https://developers.google.com/maps/documentation/places/web-service/text-search

## Bestätigte Betriebsinhaber

Betriebsinhaber beantragen den Zugang zu einem vorhandenen öffentlichen Profil mit einer privaten Begründung und optionalen HTTPS-Beleglinks. Eine manuelle Bestätigung unter `/verwaltung/betriebe` ordnet genau ein Konto zu; sie veröffentlicht kein Profil und erteilt keine Adminrechte. Kontaktangaben, Leistungen und Beschreibung gelangen über getrennte Änderungsentwürfe zur Freigabe. Die Übernahme bewahrt Kennung, Quellen, Prüfdatum und Freigabestatus. Identitätsfelder wie Name und Standort bleiben der Administration vorbehalten; geänderte Telefonnummern durchlaufen erneut die vorhandene strikte Google-Zuordnung.

Die Identitätsprüfung eines Entwurfs speichert keine vorläufige Place-ID über die öffentliche Zuordnung. Freigabe und neue Zuordnung werden zusammen übernommen, sofern Profilrevision, bestätigter Eigentümer und Moderationsberechtigung noch gültig sind. Eine zwischenzeitliche Adminänderung verhindert die Übernahme alter Entwürfe. Freigegebene Betriebsänderungen bleiben durch ihren neueren Profilzeitpunkt gegen ältere Imports geschützt und müssen beim nächsten Export wie Adminänderungen in die zentrale Quelle übernommen werden. Private Inhabernachweise und Kontokennungen gehören nicht in die JSON-Katalogquelle.

## Abschluss der acht übrigen Entwürfe

Der Nutzer hat die Empfehlung zum Abschluss freigegeben: sechs fachlich ungeeignete oder geschlossen belegte Einträge entfernen, den veralteten Reno-Südstandort durch einen getrennt belegten Nordstandort ersetzen und Isuzu/Burak nur bei konkretem Pkw-Service-Nachweis veröffentlichen. Die abschließende Recherche konnte Buraks allgemeinen englischen Pkw-Textbausteinen keinen ausreichend konkreten Pkw-Werkstattumfang am zugeordneten Prizren-Geschäftspunkt gegenüberstellen. Die aktuelle Unternehmensbeschreibung und der konkrete Serviceauftritt belegen Lkw-/Bus-Teilehandel und Motorradservice. Deshalb werden auch dieser Entwurf und das alte Reno-Südprofil entfernt: **acht Entwürfe entfernt, ein neues Profil veröffentlicht, 136 → 129 Profile, 128 → 129 öffentlich, 8 → 0 Entwürfe**.

`data/catalogue-final-2026-10-05.json` bewahrt die acht Prüfausgänge und den positiven Nachweis für **Reno Muçiqi & Bllaca in Obiliq/Shkabaj**. Ein amtlicher Wartungsauftrag von April 2026 und eigene Betriebsbeiträge belegen Kontakt, Nordstandort und Pkw-Wartung. Neue Kennung `reno-muciqi-bllaca-obiliq` und einzeln zurückgeprüfte Place ID identifizieren ausschließlich diesen Geschäftspunkt; Kundenverknüpfungen des Südprofils werden nicht übertragen. Die genauen Werkstattkoordinaten stammen aus dem unabhängig veröffentlichten Standortcode M4H8+RCV, offline als 8GJ3M4H8+RCV dekodiert. Obiliq ist als auswählbarer Ort ergänzt; sein Suchursprung stammt aus dem GeoNames-Ortsdatensatz [787534](https://sws.geonames.org/787534/about.rdf), CC BY 4.0, und ist kein Werkstattmarker. Es gab keine weiteren serverseitigen Places-Anfragen und keine Übernahme neuer Google-Bewertungen.

`data/workshop-final-removals.json` ergänzt die vorherigen 27 Entfernungsmarker um genau diese acht Kennungen. Die erste Entfernung und alle historischen Prüfberichte bleiben unverändert. Die vorhandenen generischen Trigger aus Migration 0013 schützen auch diese Kennungen vor alten Seedern; **keine neue Schemaänderung oder Migration** ist nötig. Die gesonderte atomare Live-Löschung nach dem geprüften Release verlangt alle acht unveränderten Entwürfe ohne Besuche, Übernahmeanträge, Besitzrechte oder Änderungsentwürfe. Für die sechs bereits zugeordneten Entwürfe muss die gespeicherte Place ID exakt der einzeln geprüften Zuordnung entsprechen; eine neue, geänderte oder verschwundene Zuordnung unterdrückt die ganze Operation. Private Tabellen werden weder beschrieben noch gelöscht. Eine geschützte Katalogsicherung und ihre Wiederherstellung werden vorher geprüft.

## Erweiterung um 29 Betriebe am 10. Oktober 2026

Auf Nutzerauftrag werden alle in dieser Recherche eindeutig belegten neuen Betriebe über die ursprünglich gewünschten 20 hinaus aufgenommen: 19 Werkstatt-/Autoglas-/Elektronikbetriebe und zehn Betriebe mit Detailing oder Lackaufbereitung. Die 129 öffentlichen Live-Profile wurden vorab mit allen versionierten Profilfeldern abgeglichen; es gab keine Abweichungen. Bestehende Profile, Kennungen, Entfernungsmarker und Kundenverknüpfungen bleiben erhalten. Der geprüfte Merge ergänzt 29 neue Kennungen ohne Dubletten: **129 → 158 öffentlich, weiterhin keine Entwürfe**.

Betriebsangaben stammen aus eigenen Websites, selbst veröffentlichten Betriebsbeiträgen und unabhängigen Verzeichnissen. Jeder neue Betrieb besitzt eine direkt aufgelöste Google-Place-ID mit einzeln geprüftem Telefon-/Namens-/Standortbeleg. Gleichlautende Detailer und abweichende Kontakte wurden nicht automatisch übernommen. Bei Opel Zh-Sh bestätigt der konkrete unabhängige Plus-Code die richtige Filiale trotz gemeinsamem Telefonkontakt; bei Sokoli stimmt trotz Namenszusatz derselbe Kontakt und genaue Plus-Code überein. Luxury Auto Detailings aktuelle eigene Beiträge ersetzen einen abweichenden älteren Verzeichnisstandort.

Alle 29 neuen Profile besitzen kuratierte SQ-/EN-Anzeigen und Google-Zuordnungsmetadaten, aber keine kopierten Google-Geschäftsdaten, Sterne oder Koordinaten. Detailing wird unter der vorhandenen Kategorie Karosserie & Lack mit ausdrücklicher Spezialisierung geführt; mechanische Leistungen werden dafür nicht erfunden. Es ist keine Migration nötig. Das geprüfte Main-Release übernimmt die Einträge über den bestehenden Runtime-Import. `data/import-2026-10-10.json` dokumentiert die 29 Freigaben und die nicht übernommenen Kandidaten.

## Erster täglicher Lauf am 11. Oktober 2026

Auto Enzo Detailing und Shine Detailing Studio ergänzen den versionierten
Katalog um zwei Google-eindeutig zugeordnete Detailing-Betriebe in Prishtina:
**158 → 160 Profile, weiterhin keine Entwürfe**. Eigene Betriebsbeiträge in
einem nachvollziehbaren unabhängigen Spiegel belegen Kontakte, Straßen und
konkrete Leistungen; Shine hat zusätzlich einen unabhängigen Kontaktbeleg.
Beide aktiven Google-Einträge wurden im vorgeschriebenen Gmail-Profil über
den offiziellen Place-ID-Finder und anschließend direkt per ID mit
absichtlich unpassender Ersatzsuche geprüft. Telefon und Straße stimmen
überein. Es werden keine Google-Geschäftsdaten oder neuen Bewertungen
kopiert und keine Inhaberbestätigung behauptet.

17 unabhängig recherchierte Kandidaten und sechs Bestandsdubletten wurden
gesichtet. Nur zwei Kandidaten erfüllen derzeit alle Freigabebedingungen;
fehlende eindeutige IDs, fehlender Google-Telefonkontakt und ein ungeklärter
Standortwechsel führen zur Rückstellung. Der Dry Run ergänzt genau zwei
IDs und aktualisiert kein bestehendes Profil. DE/SQ/EN-Inhalte und zentrale
Übersetzungshashes sind geprüft. Das Manifest
`data/import-2026-10-11-daily.json` unterscheidet den geprüften Quellimport
von noch zu bestätigender Live-Veröffentlichung. Die ursprünglichen 158
Profile sind vor dem Import vollständig ohne Profilfeldabweichung mit D1
abgeglichen und geschützt gesichert worden.

## Täglicher Import am 12. Oktober 2026

Auto Elektro Service AGRONI in Vushtrri und Auto Servis JONI in Sadovinë e
Jerlive/Viti ergänzen den geprüften Quellbestand von 160 auf 162 Profile.
Ihre eigenen Websites belegen Namen, Telefonnummern, Standorte und Leistungen.
Die öffentlichen Maps-Einträge wurden einzeln gegen diese Angaben abgeglichen
und ihre Place-IDs mit absichtlich unpassender Ersatzsuche direkt rückgeprüft.
Es gab keine eigenen Google-API-/SDK-Aufrufe und keine Inhaberbestätigung.

Der Dry Run ergänzt zwei IDs und aktualisiert keine bestehenden Profile.
DE-Originale und SQ-/EN-Overlays verwenden den zentralen Übersetzungshash.
Der vorherige Livebestand mit 160 Profilen und Place-IDs ist ohne Abweichung
abgeglichen; vier Katalogtabellen sind geschützt gesichert und isoliert
wiederhergestellt. BEXHI bleibt ohne Maps-Telefon, BELTI wegen eines
Telefonkonflikts zurückgestellt. Weitere Rechercheergebnisse und der genaue
PR-/Release-/Liveabnahmestatus stehen im
[heutigen Manifest](../data/import-2026-10-12-daily.json). Die tägliche Routine
verwendet gemäß Nutzerentscheidung immer die öffentliche Maps-Oberfläche.

## Premium-Partnerplätze

Migration `0019_rare_molecule_man.sql` ergänzt `workshop_premium` unabhängig
von den importierten Profilfeldern. Bestehende Werkstätten werden nicht zu
Premium-Partnern; es gibt keine Datenübernahme und keine Zahlungsintegration.
Die Verwaltung aktiviert einen Platz nach extern bestätigter Zahlung über
„Premium-Partner“ in der Werkstattliste und entfernt ihn bei Ende der Vereinbarung.
Nur die serverseitig autorisierte Administration darf den Status ändern.
Aktivierung verlangt im Schreibstatement ein veröffentlichtes Profil; öffentliche
Partnerdaten schließen Entwürfe immer aus. Profilimporte überschreiben den
Premium-Status nicht; Profillöschung entfernt ihn per Fremdschlüssel.

Die Startseite mischt die zulässigen Partner bei jedem Laden und zeigt höchstens
drei, ohne Duplikate. Zufällige Auswahlen können sich wiederholen. Sobald
veröffentlichte aktive Partner existieren, besteht die Auswahl ausschließlich
aus diesen und wird als Anzeige gekennzeichnet. Ohne aktive veröffentlichte
Partner werden auf ausdrücklichen Nutzerwunsch drei veröffentlichte Betriebe
als zufällige Auswahl gezeigt; auf Nutzerwunsch ohne „Beispielplatzierung“-Text.
Diese Auswahl aktiviert keinen Premium-Status. Weder die Auswahl noch eine
bezahlte Platzierung ist eine Qualitätsprüfung.

Die drei Kartenhintergründe sind generierte Symbolbilder; sie stammen nicht
aus den angezeigten Betrieben. Die Karten kennzeichnen sie entsprechend.
Ein statischer dunkler Verlauf hält Name, Leistung und Ort in beiden Themes
lesbar. Die Bildmotive werden je Kartenplatz vergeben, nicht als Profilfotos
in den Werkstattdaten gespeichert. Die Prompts stehen unter
`assets/partner-background-prompts.json`.

Beim Deployment des geprüften Main-Releases wird die additive Migration vor
der neuen Anwendung angewendet. Produktionspartner werden nicht automatisch aktiviert. Die Tests verwenden ausschließlich
isolierte Datenbanken und fiktive Administration, ohne Zahlungen oder Livewrites.

## Täglicher Import am 13. Oktober 2026

Auto servis ‘BERATI’ BMW und Auto Servis & Diagnoz "OPEL" in Malishevë
ergänzen den geprüften Quellbestand von 162 auf 164 Profile. Öffentliche
Verzeichnisse belegen Kontakt, Straße und Fahrzeugwartung/-reparatur; die
aktiven Maps-Einträge wurden ausschließlich über die öffentliche Oberfläche
abgeglichen und direkt per Place-ID rückgeprüft. Marken, Beratungssprachen,
WhatsApp und weitergehende Leistungen werden nicht aus Namen abgeleitet.
Der Import ändert keine bisherigen Profile. Quellen, Rückstellungen und
PR-/Release-/Liveabnahmestatus stehen im
[Importmanifest](../data/import-2026-10-13-daily.json).

## Manueller Zusatzlauf am 13. Oktober 2026

Der Nutzer hat für einen manuellen Test der erweiterten Recherche eine Ausnahme
von der Tagessperre beauftragt. Acht zusätzliche Betriebe in Vushtrri ergänzen
den geprüften Quellbestand von 164 auf 172 Profile, ohne bestehende Profile zu
ändern. Name, öffentliches Telefon, unabhängig belegter Standort und aktiver
Maps-Eintrag wurden einzeln geprüft; alle Place-IDs stammen aus sichtbaren
öffentlichen Maps-Links und wurden direkt mit unpassender Ersatzsuche geprüft.

Bei ARDI belegt der öffentlich verlinkte Facebook-Routenpunkt denselben
Geschäftspunkt trotz unterschiedlicher Straßenbezeichnungen. Daja nennt im
eigenen Profil nur Vushtrri mit Postleitzahl; der Katalog übernimmt nur diesen
Ort und weist auf die nicht unabhängig belegte genaue Straße hin. Es werden
keine Google-Straßen, Koordinaten, Bewertungen oder Öffnungszeiten kopiert.

DE-Originale und SQ-/EN-Overlays verwenden den zentralen Übersetzungsvertrag.
Öffentlich belegte Geschäfts-E-Mails werden mit Quelle und Prüfzeit im
Zusatzlauf des Tagesmanifests erfasst. Eine fehlende E-Mail sperrt die
Veröffentlichung nicht; Zustellbarkeit und Werbeeinwilligung werden nicht
behauptet. Nachrichten wurden nicht versendet. PR, Release und Live-Abnahme
werden im [bestehenden Tagesmanifest](../data/import-2026-10-13-daily.json)
beziehungsweise dem lokalen Abschlussreceipt dokumentiert.

## Eigene Öffnungszeiten

Bestätigte Inhaber bearbeiten Öffnungszeiten zusammen mit ihren Profildaten. Der
Wochenplan beginnt mit Montag und enthält sieben Tage: unbekannt, geschlossen,
nach Vereinbarung oder bis zu drei geordnete Zeitfenster. Zeiten verwenden
`HH:MM`; ausschließlich das Ende darf `24:00` sein. Für Öffnung über Mitternacht
werden Zeitfenster auf beiden Tagen eingetragen. Bis zu 60 eindeutige datierte
Ausnahmen ersetzen den jeweiligen Wochenplan vollständig. Überlappende Zeiten,
ungültige Daten und fremde Metadaten werden serverseitig zurückgewiesen.

Freigaben laufen über die bestehende Inhaber-, Konto-, Moderations- und
Revisionsprüfung atomar mit der Profiländerung. Die öffentliche Anzeige nennt
„Öffnungszeiten laut Werkstatt“ und das serverseitige Einreichungsdatum des
freigegebenen Entwurfs. Bei fehlenden Zeiten erscheint ein Kontakt-Hinweis.
„Jetzt geöffnet“ verwendet die Kosovo-Ortszeit (`Europe/Belgrade`, einschließlich
Sommerzeit), Ausnahmen und halboffene Zeitintervalle. Die Anzeige aktualisiert
sich alle 30 Sekunden sowie beim Wechsel der Tabsichtbarkeit.

Migration `0020_married_magus.sql` ergänzt nullable `opening_hours` und
`opening_hours_confirmed_at` in `workshops`. Kein Backfill: bestehende Profile
starten ohne eigene Zeiten. Alte Entwürfe ohne dieses Feld bewahren vorhandene
Zeiten; ein explizites `null` entfernt sie. Katalogimporte und die bestehenden
Adminprofil-Upserts lassen diese getrennt gepflegten Spalten unverändert.
Google-Zeiten werden nicht importiert. Direkte Angaben der Werkstätten können
über deren bestätigte Inhaberfunktion erfasst werden.

## Beauftragter Öffnungszeitenimport vom 13. Oktober 2026

Auf ausdrücklichen Nutzerauftrag ergänzt `data/opening-hours-import.json` einmalig
171 Wochenpläne aus der recherchierten CSV. 146 Pläne sind recherchiert;
25 sind ausdrücklich angenommene Standards (Mo–Fr 08:00–18:00, Sa 08:00–16:00,
Sonntag geschlossen). Die vier widersprüchlichen beziehungsweise veralteten
Quellenpläne erhalten ebenfalls diesen Standard. TITANS bleibt wegen der
gemeldeten dauerhaften Schließung ohne importierten Plan; sein Profilstatus wird
nicht geändert. Der Auftrag schließt die Speicherung der recherchierten
Maps-Zeiten für diese konkrete Liste ein; daraus entsteht kein allgemeiner
Google-Bulkimport oder automatischer Aktualisierungsauftrag.

Migration `0022_daily_dreadnoughts.sql` ergänzt `workshop_opening_hours_imports` separat
von Inhaberzeiten. Herkunft, Recherchehinweise und ersetzte Originalpläne bleiben
intern erhalten. Die öffentliche API liefert nur `importedOpeningHours`, keine
Importmetadaten. Die UI zeigt bestätigte Inhaberzeiten vorrangig und sonst den
importierten Wochenplan ohne Herkunftshinweis oder erfundenes Bestätigungsdatum.
Nur bestätigte Inhaberzeiten erhalten einen aktuellen Öffnungsstatus. Ein
freigegebenes explizites Entfernen sperrt die Importzeiten atomar, auch vor dem
ersten Import. Wiederholungen und neue Importrevisionen heben diese Sperre nicht
auf. Ein Migrationstrigger bewahrt Entfernungen vorhandener Inhaberzeiten auch
während des Übergangs von der vorherigen App-Version.

Vorschau: `npm run hours:import`. Vorbereitung aus einer vollständigen CSV:
`npm run hours:import -- --csv DATEI --prepare data/opening-hours-import.json`.
Der veröffentlichte Manifeststand wird auf einer lokalen SQLite-Datenbank mit
`--local-db DATEI --write` beziehungsweise im Checkout des geprüften Release mit
`--release vX.Y.Z --write` angewendet. Vor produktiven Änderungen werden die
betroffenen Tabellen gesichert und ihre Wiederherstellung isoliert geprüft.
`--output DATEI` exportiert dieselbe parametrisierte Importabfrage für den
authentifizierten Cloudflare-Verbindungsweg. Dessen Ausführung verlangt ebenfalls
den geprüften Main-Release und einen Abgleich mit dessen unverändertem Manifest.

Die einzige atomare Importabfrage prüft alle Werkstatt-IDs, Namen, Orte, Adressen,
Telefone und Freigabestatus unmittelbar beim Schreiben. Ein abweichender oder
fehlender Datensatz bricht die gesamte Abfrage ab. Die Importrevision verhindert
erneutes Schreiben derselben Daten. Andere Profilfelder, Inhaberzeiten,
Bewertungen und private Tabellen werden nicht geschrieben.
