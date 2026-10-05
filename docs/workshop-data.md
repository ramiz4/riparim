# Zentrale Werkstattdaten

`data/workshops.json` ist die versionierte Quelle für Werkstattimporte. Sie enthält den exportierten aktuellen Bestand: **128 veröffentlichte Pkw-Werkstätten und 8 Entwürfe**. Der Status jedes Datensatzes ist ausdrücklich gespeichert. Die Schätzung von ungefähr 1.700 Werkstätten stammt vom Nutzer; sie ist kein recherchierter Gesamtbestand und keine Vollständigkeitsbehauptung.

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

Bestehende Kennungen bleiben stabil. Eine übereinstimmende Place ID bzw. exakt passender Name, internationale Telefonnummer, Ort und Adresse verhindern einen zweiten Datensatz. Gemeinsame Telefonnummern allein führen zu keiner Zusammenführung: Die Eurogoma-Filialen in Gjakova und Mitrovica bleiben getrennt. Ältere Revisionen und ältere Google-Momentaufnahmen ersetzen keine neueren Angaben. Unklare Betriebe bleiben ausdrücklich als `draft` gespeichert. `data/workshop-scope.json` dokumentiert sechs fachlich ausgeschlossene Einträge sowie den unabhängig als geschlossen belegten Opel-Rakovica-Betrieb; Die 27 verworfenen Profile einschließlich Auto Electronics sind aus dem aktuellen Katalog entfernt. Diese Datensätze und vorhandene Riparim-Bewertungen werden nicht gelöscht; Leistungen und Marken werden nicht aus Google-Sternen oder aus einem Namen erfunden.

Nach Prüfung und Commit wird die Site wie üblich veröffentlicht. Der Runtime-Import verwendet den Inhalts-Hash der zentralen Datei als Abschlusskennung. Er ergänzt neue IDs und übernimmt nur jüngere Profilrevisionen; spätere Admin-Änderungen, Entwürfe, Besuche und Riparim-Bewertungen bleiben geschützt. Der Import arbeitet mit höchstens 95 SQL-Bindings pro Statement und 50 Statements pro Batch, kann nach einem Teilfehler wiederholt werden und löscht keine Profile.

Änderungen aus der Admin-Oberfläche müssen vor der nächsten Katalogänderung wieder exportiert und in diese Datei übernommen werden. Die vorhandene Admin-Oberfläche schreibt weiterhin in die laufende Datenbank; sie kann keinen Git-Commit erzeugen. Bei einem Konflikt bleibt die jüngere Datenbankrevision erhalten, bis der Export die zentrale Datei aktualisiert.

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
