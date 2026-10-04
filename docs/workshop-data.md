# Zentrale Werkstattdaten

`data/workshops.json` ist die versionierte Quelle für Werkstattimporte. Sie enthält den exportierten aktuellen Bestand: **78 veröffentlichte Pkw-Werkstätten und 85 Entwürfe**. Der Status jedes Datensatzes ist ausdrücklich gespeichert. Die Schätzung von ungefähr 1.700 Werkstätten stammt vom Nutzer; sie ist kein recherchierter Gesamtbestand und keine Vollständigkeitsbehauptung.

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

Bestehende Kennungen bleiben stabil. Eine übereinstimmende Place ID bzw. exakt passender Name, internationale Telefonnummer, Ort und Adresse verhindern einen zweiten Datensatz. Gemeinsame Telefonnummern allein führen zu keiner Zusammenführung: Die Eurogoma-Filialen in Gjakova und Mitrovica bleiben getrennt. Ältere Revisionen und ältere Google-Momentaufnahmen ersetzen keine neueren Angaben. Unklare Betriebe bleiben ausdrücklich als `draft` gespeichert. `data/workshop-scope.json` dokumentiert die sechs wegen Nutzfahrzeug-/Tachograf-Fokus oder fehlendem konkreten Pkw-Servicebeleg ausgeblendeten Einträge; Auto Electronics bleibt wegen ungeklärter Google-Identität ebenfalls als Entwurf erhalten. Diese Datensätze und vorhandene Riparim-Bewertungen werden nicht gelöscht; Leistungen und Marken werden nicht aus Google-Sternen oder aus einem Namen erfunden.

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
