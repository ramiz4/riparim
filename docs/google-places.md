# Google-Bewertungen für Riparim

Die Google-Anbindung ist vorbereitet, aber ohne eingerichtete API-Schlüssel inaktiv. Vorhandene recherchierte Angaben und Google-Maps-Links bleiben erhalten. Es wurden noch keine Werkstätten über die echte Places API zugeordnet.

## Aktivierung im bestehenden Google-Cloud-Projekt Riparim

1. Maps JavaScript API, Places API (New) und Places UI Kit API aktivieren. Das bestehende Abrechnungskonto verwenden.
2. Einen Browser-Schlüssel auf die HTTP-Referrer `https://riparim.com/*` und den bestätigten generierten Site-Host beschränken. Nur Maps JavaScript API, Places API (New) und Places UI Kit API zulassen. Keine allgemeinen Wildcard-Domains freigeben.
3. Einen separaten Server-Schlüssel erstellen, nur für Places API (New). Dieser Schlüssel bleibt ausschließlich im Server-Runtime-Secret.
4. `GOOGLE_MAPS_BROWSER_API_KEY` und `GOOGLE_PLACES_SERVER_API_KEY` als Sites-Runtime-Werte speichern und eine neue Version veröffentlichen. Keine Schlüssel in Git oder `.openai/hosting.json` aufnehmen.
5. Für browserseitige Places-Aufrufe und das UI Kit im Cloud-Projekt geeignete niedrige Quoten setzen und die Abrechnung beobachten. Ein Abrechnungsbudget allein ist kein harter Ausgabenstopp. Die Anwendung begrenzt serverseitige Identitätssuchen unabhängig davon auf 100/Tag.
6. Mehrere reale Profile prüfen und Zuordnungsabdeckung feststellen. Fehler oder mehrdeutige Treffer bleiben als Maps-Link verfügbar und werden nicht als fehlende Google-Bewertungen ausgegeben.

## Zuordnung und Darstellung

Die öffentliche Zuordnungsroute nimmt ausschließlich eine vorhandene veröffentlichte Werkstattkennung entgegen. Die Suchanfrage stammt aus deren veröffentlichtem Kontakt. Eine Zuordnung braucht dieselbe internationale Telefonnummer, einen charakteristischen Namensbestandteil, das Land Kosovo und passende bekannte Koordinaten bzw. den Ort. Mehrere geeignete Place IDs werden zurückgewiesen.

Es werden nur Place IDs und eigene Prüf-/Wiederholungsmetadaten dauerhaft gespeichert. Ungeklärte Treffer werden nach sieben Tagen erneut geprüft, Providerfehler frühestens nach 15 Minuten. Gleichzeitige Aufrufe teilen eine kurze Lease. Eine Änderung des Profils löst eine neue Zuordnung aus; erfolgreiche Zuordnungen werden nach einem Jahr erneut geprüft.

Sichtbare Karten laden aktuelle Sterne und Anzahl direkt über die Google Places JavaScript API. Es gibt keine Speicherung dieser API-Sterne oder Rezensionen in D1, R2 oder Browser Storage. Google Maps erhält seine Quellenkennzeichnung; zusätzliche Providerattribution wird angezeigt. Google-Werte fließen weder in Riparim-Mittelwerte noch in Riparim-Sortierungen ein.

Im Profil lädt der offizielle `gmp-place-details`-Baustein mit `gmp-place-rating` und `gmp-place-reviews`, sobald sein Bereich sichtbar wird. Die eingebauten Google- und Autorenattributionen werden beibehalten. Bei fehlender Konfiguration, fehlender Zuordnung oder einem Providerfehler steht der direkte Google-Maps-Link bereit.

## Primäre Dokumentation

- https://developers.google.com/maps/documentation/javascript/places-ui-kit/get-started
- https://developers.google.com/maps/documentation/javascript/places-ui-kit/place-details
- https://developers.google.com/maps/documentation/javascript/reference/place
- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/policies
