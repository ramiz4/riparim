# Google-Bewertungen für Riparim

Die Google-Schlüssel sind in der gehosteten Laufzeit eingerichtet. Sterne und Anzahl werden ausschließlich aktuell von Google geladen; alte Momentaufnahmen werden nicht mehr angezeigt oder zur Sortierung verwendet. Alle **71 veröffentlichten Pkw-Werkstätten** besitzen eine eindeutig bestätigte Place ID. Die zuletzt offenen Zuordnungen wurden einzeln anhand offizieller Karten, eigener Betriebswebsites oder übereinstimmender unabhängiger Kontakt-/Standortnachweise geprüft; 22 weitere IDs sind hinterlegt. `google.verification` dokumentiert Methode, Beleglinks und eigene Prüfnotiz. Auto Electronics bleibt bis zu einem bestätigten direkten Google-Eintrag als Entwurf erhalten. Die sechs in `data/workshop-scope.json` begründeten Nutzfahrzeug-/Tachograf- und unklaren Pkw-Serviceeinträge sind ausgeblendet. Die tatsächliche Anzeige hängt zusätzlich von der verfügbaren Google-Anbindung im Browser ab.

Die zentrale Importquelle ist `data/workshops.json`; sie enthält Profile, stabile Riparim-IDs, Google-Zuordnungen und belegte Momentaufnahmen getrennt. Datenformat, Bestandsprüfung und Importbefehle stehen in `docs/workshop-data.md`. API-Inhalte werden nicht dauerhaft in Git gespeichert; ein Google-Bulkexport benötigt passende Datenrechte.

## Aktivierung im bestehenden Google-Cloud-Projekt Riparim

1. Maps JavaScript API, Places API (New) und Places UI Kit API aktivieren. Das bestehende Abrechnungskonto verwenden.
2. Einen Browser-Schlüssel auf die HTTP-Referrer `https://riparim.com/*` und den bestätigten generierten Site-Host beschränken. Nur Maps JavaScript API, Places API (New) und Places UI Kit API zulassen. Keine allgemeinen Wildcard-Domains freigeben.
3. Einen separaten Server-Schlüssel erstellen, nur für Places API (New). Dieser Schlüssel bleibt ausschließlich im Server-Runtime-Secret.
4. `GOOGLE_MAPS_BROWSER_API_KEY` und `GOOGLE_PLACES_SERVER_API_KEY` als Sites-Runtime-Werte speichern und eine neue Version veröffentlichen. Keine Schlüssel in Git oder `.openai/hosting.json` aufnehmen.
5. Für browserseitige Places-Aufrufe und das UI Kit im Cloud-Projekt geeignete niedrige Quoten setzen und die Abrechnung beobachten. Ein Abrechnungsbudget allein ist kein harter Ausgabenstopp. Die Anwendung begrenzt serverseitige Identitätssuchen unabhängig davon auf 100/Tag.
6. Mehrere reale Profile prüfen und Zuordnungsabdeckung feststellen. Fehler oder mehrdeutige Treffer bleiben als Maps-Link verfügbar und werden nicht als fehlende Google-Bewertungen ausgegeben.

## Vorhandene Google-Maps-Links als Identität

Die gespeicherten Links werden zuerst ausgewertet. `query_place_id`, `place_id` und `q=place_id:…` identifizieren den Eintrag unmittelbar und benötigen keine erneute Suchanfrage. Ein CID-Link wird anhand der identischen CID im von Google zurückgegebenen Maps-Link bestätigt. Fremde Domains und Suchtext werden niemals als Place ID behandelt.

Für Suchlinks wird deren vorhandene Suchanfrage einschließlich Adresse verwendet. Ein eindeutiger Treffer muss zusätzlich über Telefonnummer oder den passenden Namen und einen präzisen Standort (belegte Koordinaten, Plus Code oder mindestens zwei passende Adresswörter) bestätigt werden. Ein Suchlink allein belegt keine Identität. Bestätigte Links werden mit der Place ID gespeichert; Kontaktlink und eingebetteter Bewertungsbereich verwenden denselben Eintrag. Ein geänderter Link invalidiert den Zuordnungscache.

## Zuordnung und Darstellung

Ein veröffentlichtes Profil benötigt eine bestätigte Google-Identität, auch wenn keine Rezensionen oder Sterne vorhanden sind. Importvalidator und Verwaltungsroute prüfen diese Voraussetzung. Ein unverändertes bestätigtes Profil behält seine Identität; Änderungen an Name, Telefon, Ort, Adresse oder Koordinaten benötigen eine neue Bestätigung. Doppelt verwendete Place IDs werden zurückgewiesen. Kartenlink, Route, Bewertungen, Öffnungszeiten und Fotos verwenden dieselbe ID. Öffnungszeiten und Fotos werden ausschließlich live geladen, nicht in die Importquelle übernommen.

Die öffentliche Zuordnungsroute nimmt ausschließlich eine vorhandene veröffentlichte Werkstattkennung entgegen. Die Suchanfrage stammt aus deren veröffentlichtem Kontakt. Eine Zuordnung braucht dieselbe internationale Telefonnummer, einen charakteristischen Namensbestandteil und passende bekannte Koordinaten bzw. den Ort in Kosovo. Ein ausdrücklich anderes Land wird abgewiesen. Google lässt das Land bei Kosovo-Einträgen teilweise auch in Place Details weg: Dann braucht es entweder höchstens 300 Meter Abstand zu den unabhängig belegten Werkstattkoordinaten oder den passenden Ort im Google-Adressfeld und höchstens 15 Kilometer Abstand zu dessen bekanntem Zentrum. Mehrere geeignete Place IDs werden zurückgewiesen.

Telefonabfragen verwenden ein Leerzeichen nach der Vorwahl und den dazugehörigen Regionscode: `+383`/`XK`, vorhandene `+381`-Nummern unverändert mit `RS`. Bekannte Werkstattkoordinaten setzen einen Suchbias von drei Kilometern; ohne Koordinaten wird das Gebiet Kosovo verwendet. So hängt die Suche nicht von der Ausgangs-IP des Servers ab. Die abschließende Landes- und Standortprüfung bleibt davon unabhängig; bei einer erfolglosen Telefonsuche folgt eine Suche nach Werkstattname und Ort, mit denselben strikten Identitätsprüfungen. Fehlende strukturierte Länderangaben werden für Kandidaten mit passender Telefonnummer über Place Details geprüft. Alle Such- und Detailanfragen zählen zum gemeinsamen Limit von 100/Tag. Zusammengezogene Namen wie AutoMita werden erkannt; Ladestationen, Parkplätze und reine Waschanlagen werden ausgeschlossen. Bei einer Änderung der Suchstrategie macht deren Versionskennung frühere erfolglose Zuordnungen erneut prüfbar.

Es werden nur Place IDs und eigene Prüf-/Wiederholungsmetadaten dauerhaft gespeichert. Ungeklärte Treffer werden nach sieben Tagen erneut geprüft, Providerfehler frühestens nach 15 Minuten. Gleichzeitige Aufrufe teilen eine kurze Lease. Eine Änderung des Profils löst eine neue Zuordnung aus; erfolgreiche Zuordnungen werden nach einem Jahr erneut geprüft.

Sichtbare Karten laden aktuelle Sterne und Anzahl direkt über die Google Places JavaScript API. Es gibt keine Speicherung dieser API-Sterne oder Rezensionen in D1, R2 oder Browser Storage. Google Maps erhält seine Quellenkennzeichnung; zusätzliche Providerattribution wird angezeigt. Google-Werte fließen weder in Riparim-Mittelwerte noch in Riparim-Sortierungen ein.

Bei der Sortierung „Google-Bewertung“ werden die zur aktuellen Suche passenden Werkstätten in Gruppen von höchstens vier gleichzeitig geladen. Die Sterne und Anzahl bleiben nur im Arbeitsspeicher der geöffneten Liste. Die Liste sortiert Google und Riparim getrennt nach Sternen; bei gleichem Wert folgt die höhere Anzahl zuerst, fehlende Sterne stehen am Ende. Ohne aktuelle Google-Werte stehen Werkstätten alphabetisch am Ende; historische Momentaufnahmen werden nicht verwendet. Eine Änderung der zentralen JSON-Quelle löst über deren Inhalts-Hash den Import aus; Profile und recherchierte Google-Angaben werden anhand ihrer getrennten Zeitstempel aktualisiert. Neuere manuell gepflegte Angaben bleiben erhalten.

Im Profil lädt der offizielle `gmp-place-details`-Baustein mit `gmp-place-rating` und `gmp-place-reviews`, sobald sein Bereich sichtbar wird. Die eingebauten Google- und Autorenattributionen werden beibehalten. Bei fehlender Konfiguration, fehlender Zuordnung oder einem Providerfehler steht der direkte Google-Maps-Link bereit.

## Live-Daten im Werkstattprofil

Das Profil lädt mit dem bestehenden, für die Website eingeschränkten Browser-Schlüssel Place Details (New): aktuelle Sterne/Anzahl, `currentOpeningHours`, reguläre Wochenzeiten als Ersatz, Geschäftsstatus, Standort und bis zu drei Fotos. Die zurückgelieferte ID muss exakt stimmen. Gleichzeitige Aufrufe teilen nur die laufende Anfrage; Antworten bleiben im Arbeitsspeicher des offenen Profils. Keine API-Öffnungszeiten oder Fotoreferenzen werden in Git, Datenbank oder Browser Storage geschrieben. Der Server-Schlüssel wird nicht an den Browser weitergereicht.

`openNow` und nächste Öffnungs-/Schließzeit kommen direkt von Google; die Darstellung verwendet Kosovo-Ortszeit (`Europe/Belgrade`) einschließlich Sommerzeit. Die aktuelle Wochenbeschreibung berücksichtigt abweichende Zeiten, sofern Google sie bereitstellt. Fehlende Öffnungszeiten, keine Rezensionen und Ladefehler haben unterschiedliche Anzeigen. Das Profil aktualisiert sich zum nächsten Statuswechsel bzw. in begrenzten Abständen; unsichtbare Tabs stellen keine neuen Anfragen.

Fotos werden mit frischen Google-Fotoreferenzen direkt geladen, behalten alle gelieferten Autorenlinks und eine sichtbare Google-Maps-Quellenangabe. Fehlen Fotos oder schlagen sie fehl, verschwindet der Fotobereich. Die aufklappbare Karte nutzt die Maps JavaScript API und ausschließlich die vom identischen Place-Details-Aufruf gelieferten Koordinaten. Routenlinks tragen `destination_place_id`; Verzeichniskoordinaten oder Namenssuchen bestimmen diese Karte nicht mehr.

Bestätigte WhatsApp-Kontakte erhalten eine mobile Aktion. Marken- und Leistungshervorhebungen beziehen sich nur auf bereits belegte Profilangaben. Private Fahrzeugdetails stammen ausschließlich aus der aktiven Suche im Arbeitsspeicher; sie werden nicht in Links oder Google-Anfragen übernommen.

## Primäre Dokumentation

- https://developers.google.com/maps/documentation/javascript/places-ui-kit/get-started
- https://developers.google.com/maps/documentation/javascript/places-ui-kit/place-details
- https://developers.google.com/maps/documentation/javascript/reference/place
- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/policies
