# Zentrale Werkstattdaten

`data/workshops.json` ist die versionierte Quelle für Werkstattimporte. Sie enthält den exportierten aktuellen Bestand: **78 veröffentlichte Werkstätten und 85 vorhandene Entwürfe**. Der Status jedes Datensatzes ist ausdrücklich gespeichert. Die Schätzung von ungefähr 1.700 Werkstätten stammt vom Nutzer; sie ist kein recherchierter Gesamtbestand und keine Vollständigkeitsbehauptung.

Die bisherigen getrennten Dateien für Profile und Google-Momentaufnahmen wurden in diese Quelle übernommen und entfernt. Namen, Kontakte, Quellen, Prüfzeitpunkte und stabile Riparim-Kennungen bleiben erhalten. Es werden keine Platzhalter für fehlende Werkstätten erzeugt.

## Bewertungsquellen

- Riparim-Bewertungen bleiben im eigenen Besuchs-/Bewertungssystem. `rating` und `count` der Riparim-Aggregate gehören nicht in diese Profilquelle.
- `google.placeId` und `google.matchedAt` speichern die tatsächliche Zuordnung zu Google. Zuordnungen werden anhand von Telefonnummer, Name und Standort verifiziert.
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

Bestehende Kennungen bleiben stabil. Eine übereinstimmende Place ID bzw. exakt passender Name, internationale Telefonnummer, Ort und Adresse verhindern einen zweiten Datensatz. Gemeinsame Telefonnummern allein führen zu keiner Zusammenführung: Die Eurogoma-Filialen in Gjakova und Mitrovica bleiben getrennt. Ältere Revisionen und ältere Google-Momentaufnahmen ersetzen keine neueren Angaben. Unklare Betriebe bleiben ausdrücklich als `draft` gespeichert; Leistungen und Marken werden nicht aus Google-Sternen oder aus einem Namen erfunden.

Nach Prüfung und Commit wird die Site wie üblich veröffentlicht. Der Runtime-Import verwendet den Inhalts-Hash der zentralen Datei als Abschlusskennung. Er ergänzt neue IDs und übernimmt nur jüngere Profilrevisionen; spätere Admin-Änderungen, Entwürfe, Besuche und Riparim-Bewertungen bleiben geschützt. Der Import arbeitet mit höchstens 95 SQL-Bindings pro Statement und 50 Statements pro Batch, kann nach einem Teilfehler wiederholt werden und löscht keine Profile.

Änderungen aus der Admin-Oberfläche müssen vor der nächsten Katalogänderung wieder exportiert und in diese Datei übernommen werden. Die vorhandene Admin-Oberfläche schreibt weiterhin in die laufende Datenbank; sie kann keinen Git-Commit erzeugen. Bei einem Konflikt bleibt die jüngere Datenbankrevision erhalten, bis der Export die zentrale Datei aktualisiert.

## Google-Zuordnungen für den vorhandenen Bestand

```sh
npm run catalog:google-match
# Nach Einrichtung des Server-Schlüssels in der sicheren Laufzeitumgebung:
npm run catalog:google-match -- --fetch --write --limit 100
```

Ohne `--fetch` werden keinerlei API-Anfragen ausgeführt. Mit `--fetch` wird nach Name und Ort nur für bestehende veröffentlichte Werkstätten gesucht; höchstens 100 Such- und Detailabfragen je Lauf. Der Schlüssel wird ausschließlich aus `GOOGLE_PLACES_SERVER_API_KEY` gelesen und nie ausgegeben oder gespeichert. Ein Treffer braucht passende Telefonnummer, Name, Kosovo und Standort. Mehrdeutige Treffer werden nicht zugeordnet. Bei Authentifizierungs-, Quoten- oder Place-ID-Konflikten wird der Fehler mit Werkstattkennung protokolliert; API-Inhalte und Schlüssel erscheinen nicht im Bericht. Nur erfolgreich zugeordnete Place IDs und eigene Zuordnungszeitpunkte werden mit `--write` übernommen.

Die Live-Darstellung benötigt zusätzlich `GOOGLE_MAPS_BROWSER_API_KEY`; Einrichtung und Schlüsselbeschränkungen stehen in `docs/google-places.md`.

## Größere Recherche

Eine einzelne Text-Search-Abfrage liefert derzeit höchstens 60 Ergebnisse über bis zu drei Seiten. Selbst mehrere Abfragen sind keine vollständige Landesliste. Nach geklärtem Zugang und Datenrecht muss die Recherche alle relevanten Gemeinden und Begriffe abdecken, Folgeseiten verarbeiten, ausgeschöpfte Suchgebiete weiter aufteilen und die tatsächliche Abdeckung dokumentieren. `car_repair` und `tire_shop` sind passende Ausgangskategorien; Autohändler und Autowäschen benötigen einen tatsächlichen Werkstattnachweis. Jeder Import erfolgt zunächst in die JSON-Quelle, dann nach Prüfung in die Site.

Offizielle Dokumentation, geprüft am 3. Oktober 2026:

- https://developers.google.com/maps/documentation/places/web-service/policies
- https://cloud.google.com/maps-platform/terms
- https://developers.google.com/maps/documentation/places/web-service/text-search
