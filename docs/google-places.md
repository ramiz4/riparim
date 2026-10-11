# Google-Bewertungen für Riparim

Die Google-Schlüssel sind in der gehosteten Laufzeit eingerichtet. Sterne und Anzahl werden ausschließlich aktuell von Google geladen; alte Momentaufnahmen werden nicht mehr angezeigt oder zur Sortierung verwendet. Alle **160 veröffentlichten Kfz-Servicebetriebe einschließlich Fahrzeugaufbereitung** besitzen eine eindeutig bestätigte Place ID. Die Zuordnungen werden einzeln anhand offizieller Karten, eigener Betriebswebsites oder übereinstimmender unabhängiger Kontakt-/Standortnachweise geprüft. Am 5. Oktober kamen 32 bestätigte IDs hinzu; zwei bestehende Identitäten konnten nach Korrektur überholter Verzeichnisstandorte veröffentlicht werden. `google.verification` dokumentiert Methode, Beleglinks und eigene Prüfnotiz. Auto Electronics gehört zu den 27 auf Nutzerauftrag entfernten, nicht eindeutig zugeordneten Entwürfen. Die sechs in `data/workshop-scope.json` begründeten fachlichen Ausschlüsse, der unabhängig als geschlossen belegte Opel-Rakovica-Betrieb und das alte Reno-Südprofil wurden nach abschließender Prüfung auf Nutzerauftrag entfernt. Der belegte Reno-Nordstandort wird als neues öffentliches Profil geführt. Die tatsächliche Anzeige hängt zusätzlich von der verfügbaren Google-Anbindung im Browser ab.

Die zentrale Importquelle ist `data/workshops.json`; sie enthält Profile, stabile Riparim-IDs, Google-Zuordnungen und belegte Momentaufnahmen getrennt. Datenformat, Bestandsprüfung und Importbefehle stehen in `docs/workshop-data.md`. API-Inhalte werden nicht dauerhaft in Git gespeichert; ein Google-Bulkexport benötigt passende Datenrechte.

Am 4. Oktober wurden neun weitere Entwürfe individuell bestätigt und veröffentlicht. 13 unabhängig belegte Plus-Code-Adressen wurden offline in genaue Koordinaten umgerechnet und gegen den bestehenden Google-Eintrag geprüft. Zwei weitere Prüfungen ergaben ungeklärte Standortkonflikte bei Autodiagnoza Kosove und BMW Service Ferizaj; diese Profile wurden damals bis zur unabhängigen Klärung ausgeblendet. Kennungen, historische Zuordnungen und Bewertungen bleiben erhalten. Der damalige Bestand umfasste deshalb 78 veröffentlichte Profile, davon 19 mit genauen Koordinaten, und 85 Entwürfe. Die eigenen Nachweise stehen in `data/catalogue-review-2026-10-04.json`.

Am 5. Oktober wurden alle 85 verbleibenden Entwürfe überprüft und **34 freigegeben**. Autodiagnoza Kosove und BMW Service Ferizaj behalten ihre bisherigen IDs; ihre aktuellen Standorte sind nun aus eigenen Betriebsquellen präzise belegt. Der Bestand nach diesem ersten Prüfschritt umfasste **112 öffentliche Profile, davon 21 mit genauen Koordinaten, und 51 Entwürfe**. Davon benötigten damals 45 weitere Identitätsbelege; sechs blieben fachlich ausgeschlossen. Die Freigabesperre und das Tageslimit von 100 serverseitigen Identitätsabfragen bleiben bestehen. `data/catalogue-review-2026-10-05.json` dokumentiert jedes Prüfergebnis. Neue Google-API-Inhalte wurden nicht dauerhaft gespeichert.

Die anschließende Weiterprüfung der 51 Entwürfe bestätigt **13 weitere IDs**. Aktuelle Betriebsquellen lösen alte Kontaktdaten und Bezeichnungen auf; genaue profilspezifische Verzeichnismarker bestätigen Kimi und Gazi trotz fehlender Google-Telefonnummer. Jede ID wurde von Google Maps mit einer absichtlich unpassenden Ersatzsuche auf genau denselben Betrieb zurückgeprüft. Keine zusätzlichen Server-Abfragen oder Lockerung der Identitätsprüfung waren nötig. Der Bestand nach diesem Prüfschritt umfasste **125 öffentliche Profile, davon 23 mit unabhängig belegten genauen Koordinaten, und 38 Entwürfe**. 30 Identitäten, eine Reno-Filialkontinuität, ein belegter geschlossener Betrieb und sechs fachliche Ausschlüsse blieben damals offen bzw. ausgeblendet. Der vollständige Folgebericht ist `data/catalogue-followup-2026-10-05.json`.

Die vertiefte Prüfung dieser 30 Identitäten bestätigt **drei weitere bestehende Profile**: Sfishta Auto Home, Niki und Fatosi. Eigene Anzeigen, Betriebsbeiträge, amtliche Aliasbelege und genaue unabhängige Geschäftspunkte verbinden den bisherigen Betrieb jeweils mit seinem gültigen Google-Eintrag. Die direkten ID-Rücktests erfolgten im vom Nutzer vorgegebenen Gmail-Browserprofil; weitere Serverabfragen wurden nicht ausgeführt. Der Bestand nach diesem Prüfschritt umfasste **128 öffentliche Profile, davon unverändert 23 mit unabhängig belegten genauen Koordinaten, und 35 Entwürfe**. 27 Identitäten benötigen weiterhin einen eindeutigen Beleg; die acht übrigen Entwürfe bleiben unverändert. Alle 30 Prüfausgänge stehen in `data/catalogue-identity-2026-10-05.json`.

Die anschließend vom Nutzer verworfenen 27 Identitäten sind in `data/workshop-removals.json` dokumentiert. Der Bestand nach dieser ersten Entfernung umfasste **128 öffentliche Profile und 8 Entwürfe**, insgesamt **136 Profile**. Der Katalog umfasste nach dem Abschluss am 5. Oktober **129 öffentliche Profile und keine Entwürfe**. Zugehörige Cache-/Kartenmetadaten werden entfernt; Entfernungsmarker schützen vor erneutem Import. Die früheren Prüfergebnisse und ihre damaligen Zahlen bleiben als Historie erhalten.

## Konfiguration im bestehenden Google-Cloud-Projekt Riparim

1. Maps JavaScript API, Places API (New) und Places UI Kit API sind bereits aktiviert. Vor Änderungen an vorhandener Nutzung gelten die unten dokumentierten Billing-/Freimengen-/Quotenprüfungen; keine zusätzlichen Dienste oder kostenpflichtigen Tarife aktivieren.
2. Den Produktions-Browser-Key nur für tatsächlich benötigte HTTPS-Referrer und die drei genannten APIs freigeben. Maßgeblich ist die belegte produktive Runtime-Zuordnung; ein alter Sites-Host oder lokale Fixtures begründen keine Freigabe des Produktionskeys.
3. Der separate private Server-Key darf ausschließlich Places API (New) verwenden und bleibt im geschützten Server-Runtime-Secret. Ohne feste belegte Cloudflare-Ausgangs-IP wird keine ungeprüfte IP-Beschränkung eingerichtet.
4. `GOOGLE_MAPS_BROWSER_API_KEY` und `GOOGLE_PLACES_SERVER_API_KEY` gehören ausschließlich in die geschützte Laufzeitkonfiguration. App-Veröffentlichungen erfolgen über den geprüften Main-Release gemäß `docs/releases.md`; keine Schlüssel in Git oder `.openai/hosting.json`, keine manuelle Feature-Branch-Veröffentlichung.
5. Tatsächlich unterstützte Quoten und vorhandene Billing-Warnungen prüfen. Ein Benachrichtigungsbudget stoppt keine Nutzung; das App-Limit von 100/Tag begrenzt ausschließlich serverseitige Identitätsabfragen. Wirksame Istwerte, Solländerungen und Rückweg stehen im Betriebsrunbook unten.
6. Live-Validierung nur als begrenzter Schritt mit bestätigtem kostenlosem Restkontingent. Ohne dieses Kontingent genügen isolierte Ausfall-/Anfragefixtures und die lesende Providerkonfiguration; direkte Maps-Links bleiben verfügbar und Fehler werden nicht als fehlende Bewertungen ausgegeben.

## Vorhandene Google-Maps-Links als Identität

Die gespeicherten Links werden zuerst ausgewertet. `query_place_id`, `place_id` und `q=place_id:…` identifizieren den Eintrag unmittelbar und benötigen keine erneute Suchanfrage. Ein CID-Link wird anhand der identischen CID im von Google zurückgegebenen Maps-Link bestätigt. Fremde Domains und Suchtext werden niemals als Place ID behandelt.

Für Suchlinks wird deren vorhandene Suchanfrage einschließlich Adresse verwendet. Ein eindeutiger Treffer muss zusätzlich über Telefonnummer oder den passenden Namen und einen präzisen Standort (belegte Koordinaten, Plus Code oder mindestens zwei passende Adresswörter) bestätigt werden. Ein Suchlink allein belegt keine Identität. Bestätigte Links werden mit der Place ID gespeichert; Kontaktlink und eingebetteter Bewertungsbereich verwenden denselben Eintrag. Ein geänderter Link invalidiert den Zuordnungscache.

## Zuordnung und Darstellung

Ein veröffentlichtes Profil benötigt eine bestätigte Google-Identität, auch wenn keine Rezensionen oder Sterne vorhanden sind. Importvalidator und Verwaltungsroute prüfen diese Voraussetzung. Ein unverändertes bestätigtes Profil behält seine Identität; Änderungen an Name, Telefon, Ort, Adresse oder Koordinaten benötigen eine neue Bestätigung. Doppelt verwendete Place IDs werden zurückgewiesen. Kartenlink, Route, Bewertungen, Öffnungszeiten und Fotos verwenden dieselbe ID. Öffnungszeiten und Fotos werden ausschließlich live geladen, nicht in die Importquelle übernommen.

Die öffentliche Zuordnungsroute nimmt ausschließlich eine vorhandene veröffentlichte Werkstattkennung entgegen. Die Suchanfrage stammt aus deren veröffentlichtem Kontakt. Eine Zuordnung braucht dieselbe internationale Telefonnummer, einen charakteristischen Namensbestandteil und passende bekannte Koordinaten bzw. den Ort in Kosovo. Ein ausdrücklich anderes Land wird abgewiesen. Google lässt das Land bei Kosovo-Einträgen teilweise auch in Place Details weg: Dann braucht es entweder höchstens 300 Meter Abstand zu den unabhängig belegten Werkstattkoordinaten oder den passenden Ort im Google-Adressfeld und höchstens 15 Kilometer Abstand zu dessen bekanntem Zentrum. Mehrere geeignete Place IDs werden zurückgewiesen.

Telefonabfragen verwenden ein Leerzeichen nach der Vorwahl und den dazugehörigen Regionscode: `+383`/`XK`, vorhandene `+381`-Nummern unverändert mit `RS`. Bekannte Werkstattkoordinaten setzen einen Suchbias von drei Kilometern; ohne Koordinaten wird das Gebiet Kosovo verwendet. So hängt die Suche nicht von der Ausgangs-IP des Servers ab. Die abschließende Landes- und Standortprüfung bleibt davon unabhängig; bei einer erfolglosen Telefonsuche folgt eine Suche nach Werkstattname und Ort, mit denselben strikten Identitätsprüfungen. Fehlende strukturierte Länderangaben werden für Kandidaten mit passender Telefonnummer über Place Details geprüft. Alle Such- und Detailanfragen zählen zum gemeinsamen Limit von 100/Tag. Zusammengezogene Namen wie AutoMita werden erkannt; Ladestationen, Parkplätze und reine Waschanlagen werden ausgeschlossen. Bei einer Änderung der Suchstrategie macht deren Versionskennung frühere erfolglose Zuordnungen erneut prüfbar.

Es werden nur Place IDs und eigene Prüf-/Wiederholungsmetadaten dauerhaft gespeichert. Ungeklärte Treffer werden nach sieben Tagen erneut geprüft, Providerfehler frühestens nach 15 Minuten. Gleichzeitige Aufrufe teilen eine kurze Lease. Eine Änderung des Profils löst eine neue Zuordnung aus; erfolgreiche Zuordnungen werden nach einem Jahr erneut geprüft.

Sichtbare Karten laden aktuelle Sterne und Anzahl direkt über die Google Places JavaScript API. Es gibt keine Speicherung dieser API-Sterne oder Rezensionen in D1, R2 oder Browser Storage. Google Maps erhält seine Quellenkennzeichnung; zusätzliche Providerattribution wird angezeigt. Google-Werte fließen weder in Riparim-Mittelwerte noch in Riparim-Sortierungen ein.

Der Katalog bietet ausschließlich Name, Riparim-Bewertung und Entfernung als Sortierungen an. Alte Links mit `sort=google` werden auf die Standardsortierung Name normalisiert; Suchbegriff, Leistung, Ort, Marke, Sprache und Locale bleiben erhalten. Es gibt keine globale oder auf die ersten zwölf Ergebnisse begrenzte Google-Sortierung. Historische Google-Momentaufnahmen werden weiterhin weder als aktuell angezeigt noch zur Sortierung verwendet.

Google-Sterne werden ausschließlich bei Sichtbarkeit einer Karte geladen (bestehender Vorlauf von 120 Pixeln). Bereits dargestellte Werte derselben Riparim-ID und Locale gehören nur zum Komponenten-Zustand der aktiven Liste. Bei Filteränderungen und erneutem Einblenden nutzt die Karte diesen Wert ohne identischen Zusatzabruf. Ein Localewechsel verwirft diesen Zustand; neue IDs und Sprachen laden ihre eigenen Werte. Verspätete Antworten einer vorherigen ID/Locale werden nicht angezeigt. Schließen/Neuladen der Liste verwirft die Werte. Es gibt keinen zusätzlichen Content-Cache, TTL, Hintergrundrefresh oder Schreiben in D1, R2, Redis, CDN oder Browser Storage. Die bestehende Place-ID-Zuordnung, Providerattribution und Maps-Fallbacks bleiben erhalten.

Eine Änderung der zentralen JSON-Quelle löst über deren Inhalts-Hash den Import aus; Profile und recherchierte Google-Angaben werden anhand ihrer getrennten Zeitstempel aktualisiert. Neuere manuell gepflegte Angaben bleiben erhalten.

### Isolierter Anfragenachweis für Issue #94

`tests/catalogue-google-requests.test.mjs` verwendet 158 synthetische öffentliche Werkstätten, kontrollierte Sichtbarkeit und einen Google-SDK-Fixture ohne echte Provideraufrufe. Der Red-Lauf vor der Änderung zählte bei `sort=google` **158 Places-Abfragen**, obwohl keine Karte sichtbar war. Der gleiche Lauf nach der Änderung prüft in DE/SQ/EN:

| Auslöser | Places-Abfragen nach Änderung |
| --- | ---: |
| Initialrender mit 158 Treffern und unsichtbaren Karten | 0 |
| Alte URL `sort=google` | 0 |
| Filteränderung, neue Karten weiterhin unsichtbar | 0 |
| Erste sichtbare Karte | 1 |
| Passende Karte nach Filterwechsel erneut sichtbar | 0 zusätzliche |
| Localewechsel und erste erneut sichtbare Karte | 1 zusätzliche |

Zusätzlich prüft dieselbe Fixture in DE/SQ/EN die datenfreie statische Katalog-Shell: Die Hydration liest alle Filter und die Locale aus der echten URL, der bestehende Live-Katalogabruf bleibt erhalten und verursacht keine Google-Abfrage für unsichtbare Karten. Sichtbare Karten und ihre Wiederverwendung behalten dieselben Anfragezahlen. Der reale Canonicalbestand enthält inzwischen 160 Profile; die 158 Datensätze im Test sind weiterhin ausschließlich synthetisch.

Die gezählten Aufrufe sind SDK-`fetchFields`-Anfragen, keine Kostenmessung oder Aussage zur Abrechnungskategorie. Auch reguläre URL-/Sortierverträge, Lade-/Leer-/Fehlerfälle und verspätete Antworten werden ohne Live-Google-Verbindungen geprüft.

## Live-Daten im Werkstattprofil

Eigene Riparim-Bewertungen beziehungsweise ihr leerer Hinweis stehen immer vor Google. Der Google-Host bleibt dadurch auch während des Nachladens an derselben DOM-Position und wird nicht verschoben oder erneut verbunden; seine eigene Panelsichtbarkeit steuert weiterhin den Abruf. Daraus wird keine Aussage über Googles internes Abrechnungsverhalten abgeleitet.

Ein sichtbarer gemeinsamer Google-Bereich verwendet genau einen Standard-
`gmp-place-details`-Baustein mit `gmp-place-rating`,
`gmp-place-opening-hours` und `gmp-place-reviews`. Der Profilkopf zeigt die
eigene Riparim-Bewertung und verlinkt diesen Bereich; er löst keinen separaten
Google-Ratingabruf aus. Es gibt weder eine parallele Enterprise-Profilabfrage
noch einen vollständigen REST-Refresh zum nächsten Öffnungs-/Schließwechsel.
Die native Google-Darstellung unterscheidet fehlende Rezensionen, unbekannte
Öffnungszeiten und Schließstatus. Die App liest diese Daten nicht aus dem DOM,
Shadow-DOM oder dem Widget aus. Die dokumentierte öffentliche `place`-Property
enthält lediglich ID, Standort und Viewport. Ein fehlgeschlagener Provideraufruf
wird als Ladefehler angezeigt, niemals als null Bewertungen ausgegeben.

Der Baustein startet nur bei Sichtbarkeit (120-Pixel-Vorlauf) und aktivem Tab.
Konfiguration und gemeinsame Zuordnungsroute starten erst, wenn mindestens der
Google- oder Fotobereich sichtbar und der Tab aktiv ist; die Zuordnungsroute kann
serverseitig eine Google-Identitätsprüfung auslösen. Beide Bereiche teilen genau
eine Identität für die aktuelle Werkstatt, Sprache und Maps-Zuordnung. Beim
Verschwinden meldet sich die jeweilige Sichtbarkeitsquelle ab. Nach wartender
Konfiguration wird die aktuelle Sichtbarkeit erneut geprüft; ein inzwischen
sichtbarer anderer Bereich kann übernehmen. Sind beide unsichtbar, wird die
Zuordnung bis zum nächsten sichtbaren Bereich zurückgestellt. Sichtbarkeit wird
auch nach asynchronem SDK-Laden erneut geprüft. Themewechsel und normale Profilzustandsänderungen
bewahren dieselbe Widgetinstanz; Farben und Schriften werden ausschließlich
über die offiziellen CSS-Eigenschaften und `color-scheme` geändert. Der
Standardbaustein erhält höchstens 400 Pixel Breite mit interner Scrollfunktion.
Die Google- und Autorenattribution des Bausteins bleibt vollständig erhalten.
Advanced-/Pro-Elemente, Zusammenfassungen und `all-content` werden nicht verwendet.

Die App zeigt den Ladezeitpunkt in Kosovo-Ortszeit (`Europe/Belgrade`, inklusive
Sommerzeit). Nach 30 Minuten wird der alte Baustein ausgeblendet und eine klare
Veraltungsanzeige mit Aktion **Google-Angaben aktualisieren** angeboten. Der
Timer ändert ausschließlich die Anzeige: Er startet keine Google-Abfrage.
Auch ein Wechsel zurück in den Tab aktualisiert nicht automatisch. Erst die
explizite Aktion im sichtbaren Bereich und aktiven Tab ersetzt die Widgetinstanz;
sie lädt weder individuelle Details noch Fotoreferenzen. Interne Abfragen des
Google-Bausteins gehören zum Providervertrag und lassen sich aus App-Mocks nicht
als tatsächliche Abrechnungsereignisse ableiten. Bei deaktiviertem Provider,
Timeout oder Quotenfehler bleibt der bestätigte direkte Maps-Link verfügbar;
Fehler verursachen keine automatische Wiederholungsschleife. Ein SDK-Ladefehler
bietet ausdrücklich **Seite neu laden**, da der SDK-Lader seinen Fehlversuch
innerhalb desselben Browserlaufs behält. Bei einem bereits geladenen SDK kann
ein Widgetfehler durch die sichtbare Aktualisierungsaktion erneut versucht werden.

### Fotos separat und nur bei Bedarf

Der Standard-UI-Kit-Inhaltsbaustein `gmp-place-media` bietet laut Google einen
Einzelfoto-/Lightbox-Vertrag. Er ersetzt die bestehende gemeinsame Dreiergalerie
mit direkt auswählbaren Fotos, Pfeiltasten, Wischgeste und vergrößerten Dateien
nicht gleichwertig. Deshalb bleibt eine eigene minimale Place-Details-Abfrage
mit **`id,photos,attributions`** bei Sichtbarkeit des Fotobereichs und aktivem Tab.
Diese Feldmaske gehört laut offizieller REST-Feldtabelle zu **Essentials IDs Only**;
`googleMapsUri` würde Pro anfordern und wird nicht hinzugefügt. Es gibt keine
zusätzlichen Rating-, Stunden-, Status- oder Standortfelder. Die Antwort-ID und
jede Fotoreferenz müssen zum bestätigten Place passen. Gleichzeitige Abfragen
teilen ausschließlich die laufende Anfrage; Komponenten behalten ihre angezeigten
Metadaten nur im Arbeitsspeicher des offenen Profils. Es gibt keinen allgemeinen
Content-Cache, keine TTL und keine Speicherung in Git, D1, R2 oder Browser Storage.

Bis zu drei Vorschauen laden direkt von Google mit nativer Bild-Lazy-Loading-
Unterstützung (maximal 1000×700 Pixel). Die größere Datei (maximal 1600×1200 Pixel)
wird erst bei Fotoauswahl im Dialog geladen. Vorschauen, Großansicht und jedes
Galerie-Vorschaubild tragen Google-/Providerlinks und ihre jeweiligen erhaltenen
Autorenattributionen. Tastatur, Fokus-Rückgabe, Wischgeste und Galerie bleiben
bestehen. Ein Place-/Localewechsel schließt die alte Galerie und verwirft deren
Anzeigestand; verspätete Antworten eines vorherigen Profils erscheinen nicht.
Auch eine neue bestätigte Place ID im Liveprofil derselben Riparim-ID verwirft
den alten Identitäts-/Widget-/Fotostand. Die Identitätsantwort muss zur aktuellen
bestätigten Maps-ID passen; bei Abweichung steht ausschließlich der neue Maps-Link
als ehrlicher Fallback bereit.
Eine Antwort im versteckten Tab darf noch keine Bildressourcen mounten. Fehlende
Fotos und fehlgeschlagene Fotoabfragen erhalten unterschiedliche Anzeigen.
Auch wenn sämtliche Vorschaudateien fehlschlagen, bleibt ein Ladefehler mit dem
bestätigten Maps-Fallback sichtbar.
Standort und Route bleiben direkte Maps-Links mit bestätigter Place ID, ohne
zusätzliche eingebettete Karte. Eigene belegte Betriebsdaten bleiben unverändert.

### Compact-Prüfung für Katalogkarten

`gmp-place-details-compact` unterstützt einen eigenen Widgetblock mit festem
Inhaltslayout, integriertem Namen/Adresse und Maps-Schaltfläche; horizontal
empfiehlt Google 180–500 Pixel Breite, unter 160 Pixeln ist die Darstellung nicht
zuverlässig. Die bestehende Katalogkarte besitzt bereits einen belegten
Riparim-Namen/-Ort mit Profilnavigation und zwei schmale gemeinsame
Bewertungszeilen (Riparim und Google). Der Standard-Compact-Vertrag kann nicht
nur die benötigten Provider-/Sterne-/Anzahl-Zellen in dieser Zeile liefern und
hat keinen unterstützten öffentlichen Rating-/Count-Datenzugriff. CSS darf seine
Pflichtinhalte und Attribution nicht verbergen. Deshalb bleiben die durch #94
begrenzten individuellen Ratingabrufe für sichtbare Katalogkarten bestehen;
Filterremounts derselben ID/Locale verwenden den aktiven Listenstand. Es gibt
keinen zusätzlichen Compact-Baustein und keine DOM-Auslesung für Daten oder Sortierung.

### Isolierter Anfragenachweis für Issue #95

`tests/google-profile-requests.test.mjs` zählt einzelne REST-Feldmasken,
SDK-Ratingabrufe und Standard-Widgetmontagen getrennt. Der Red-Lauf vor dem Umbau
zählte bereits beim gewöhnlichen unsichtbaren Profilmount eine vollständige
Enterprise-Abfrage. Die isolierten DE/SQ/EN-Szenarien prüfen nach dem Umbau:

| Auslöser | Einzel-Details | Standard-Widgetmontagen | Foto-Bildressourcen |
| --- | ---: | ---: | --- |
| Profilmount, Google-Bereiche unsichtbar | 0 | 0 | 0 |
| Erster sichtbarer Google-Bereich | 0 | 1 | 0 |
| Theme-/Stateänderung | +0 | +0 | +0 |
| Erster sichtbarer Fotobereich | 1, nur `id,photos,attributions` | +0 | bis zu 3 Vorschauen |
| Fotoauswahl | +0 | +0 | ausgewählte Großdatei |
| 30-Minuten-Veraltung oder Rückkehr in den Tab | +0 | +0 | +0 |
| Explizites sichtbares Aktualisieren | +0 | +1 | +0 |

Weitere Fixtures prüfen null Konfigurations-/Zuordnungsabrufe beim unsichtbaren
Profilmount, genau eine gemeinsame Zuordnung für beide sichtbaren Bereiche,
Sichtbarkeitsübergabe während wartender Konfiguration, Rückstellung bei zwei
unsichtbaren Bereichen, versteckte Tabs, SDK-/Foto-Laderaces, schnellen Place-/
Localewechsel, StrictMode, Quotenfehler, Timeout ohne Retryschleife, leere Fotos,
Maps-Fallback und Attribution für jede dargestellte Fotoquelle. Dabei entsteht
keine echte Google-Verbindung. Gezählt werden App-Aufrufverträge und gemountete
Bildressourcen, keine gemessenen Produktionskosten. Der aktuelle Standard-
UI-Kit-SKU-Vertrag (Essentials, SKU `0678-4F72-DA7C`) zählt Requests der Standard-
Place-Details-Elemente unabhängig von den ausgewählten Feldern; tatsächliche
Kontingente, anwendbarer Kontotarif und Billing-Belege stehen im folgenden
Betriebsrunbook und datierten Prüfbericht von #96.

Bestätigte WhatsApp-Kontakte erhalten eine mobile Aktion. Marken- und Leistungshervorhebungen beziehen sich nur auf bereits belegte Profilangaben. Private Fahrzeugdetails stammen ausschließlich aus der aktiven Suche im Arbeitsspeicher; sie werden nicht in Links oder Google-Anfragen übernommen.

## Betrieb: Kosten und Ausfallweg (#96)

Der [datierte Prüfbericht vom 11.10.2026](google-places-cost-audit-2026-10-11.md)
enthält den reproduzierten Vorher-/Nachher-Abrufvergleich, alle neun tatsächlich
beobachteten SKU-Mengen/Kosten, die Schweizer Konto-Preisstufen in CHF,
Key-/Quoten-Vorherwerte und die Grenzen der Messung. Der Projekt-Billing-Bericht
weist **2,73 CHF** aus, davon Enterprise Details mit **1164 Ereignissen** bei einer
freien Kontostufe bis 1000. #94/#95 sind lokale Anfrageoptimierungen; ihr
Produktionskosten-Nachherwert ist wegen Billing-Verzug noch nicht belegt.

### Aktueller Kontrollstand

Manuell gespeicherte Tagesgrenzen; die Minutenlimits bleiben unverändert:

| Dienst / Methode | Tageslimit | Minutenlimit | Wirkung |
| --- | ---: | ---: | --- |
| Places (New): GetPlaceRequest | **0** | 600 | REST-Foto-Metadaten und ergänzende Land-Details gesperrt; SDK-Wirkung siehe unten |
| Places (New): SearchTextRequest | **20** | 600 | Identitätssuche, zusätzlich App-Limit 100/UTC-Tag |
| Places (New): PhotoMedia | **20** | 600 | einzelne Vorschau-/Großbildabrufe |
| UI-Kit Standard Query | **30** | 6000 | gemeinsame Profilangaben inklusive Rezensionen |
| UI-Kit Advanced | **0** | Unbegrenzt | von der aktuellen App ungenutzt |
| UI-Kit Sessions | **0** | 6000 | von der aktuellen App ungenutzt |
| Maps JavaScript: Map loads | **30** | 30000, pro Nutzer 300 | aktuelle App nutzt direkte Maps-/Routenlinks |

Frische persistierte GCP-Readbacks am **11.10.2026 UTC** bestätigen Maps um
**01:07:21**, UI-Kit um **01:07:43** und Places (New) um **01:10:06** mit diesen
Werten, jeweils nach angekündigter Propagationszeit. Diese Konfigurationsnachweise
sind keine Live-SDK-Probe oder globale Geldobergrenze. Andere Billing-Verbraucher
und SKU-/Quota-Zuordnung bleiben zu prüfen; Minutenquoten sind kein Monatsbudget.
Die GetPlace-Sperre ist auch für SDK-Einzelratings vorgesehen, deren tatsächliche
Enforcement-Zuordnung wurde ohne potenziell kostenpflichtige Live-Probe nicht
bestätigt. Standard-UI-Kit nutzt eigene Quoten: Seine zugrunde liegenden Places-/
Geocoding-Anfragen verbrauchen laut amtlicher Dokumentation keine entsprechenden
Projektquoten. GetPlace 0 ist deshalb keine belegte Abschaltung des UI-Kit oder
eine nachgewiesene Gesamtkostensperre.

Der produktive Browser-Key ist per ausschließlich internem Hashvergleich dem
GCP-Browser-Key zugeordnet. Nach Entfernen der sechs Loopback-/Legacy-Referrer
war nur `https://riparim.com/*` erlaubt. Wegen der ungeprüften SDK-Quotenzuordnung
und des Auftrags ohne Zusatzkosten ist er nun **vorläufig pausiert**: Der einzige
Website-Referrer ist **`https://riparim-google-paused.invalid/*`**, weiterhin nur
Maps JavaScript API, Places API (New) und Places UI Kit API erlaubt. Speichern
am **11.10.2026 01:11:45 UTC**, frische Navigation von der Credentials-Liste und
persistierter Readback um **01:12:07 UTC** bestätigen diesen Zustand. GCP nennt
bis zu fünf Minuten Propagation; eine Kontrolle ab 01:16:45 UTC ist vom
Konfigurationsbeleg getrennt zu bewerten. Es wurde kein Live-SDK-Sperrnachweis
durch eine potenziell kostenpflichtige Probe erhoben.

Damit wird der reguläre Produktionsbrowserpfad unabhängig von der unklaren
GetPlace-SDK-Zuordnung gesperrt: Google-Sterne, Öffnungszeiten, Rezensionen,
Fotos und Widgets sind vorläufig nicht verfügbar. Eigene Profile/Bewertungen
und direkte Maps-/Routenlinks bleiben verfügbar. Die Runtime-Schlüssel sind
unverändert, `/api/google-places` bleibt `enabled:true`; dies ist eine Provider-
Referrerpause, keine Runtime-Konfigabschaltung. Bereits offene Anzeigen und
Billing-Nachlauf bleiben Grenzen; eine Referrerregel ist keine globale Geldgrenze.
Der getrennte Server-Key erlaubt nur Places API (New), ohne unbelegte feste
Cloudflare-Ausgangs-IP; sein Wert bleibt ausschließlich im Runtime-Secret.
Budgetliste leer: keine Budgetwarnung/automatische Maps-Kostensperre. Die aktuell
angebotene GCP-Ausgabenobergrenze unterstützt ausschließlich Cloud Run,
Cloud Run Functions, Gemini API und Vertex AI; Maps/Places waren nicht auswählbar.
Der nur inspizierte Entwurf wurde abgebrochen. Keine Budget-/Alert-Neuanlage,
automatischen E-Mails oder neuen Benachrichtigungsdienste.

### Prüfschritte und Rückweg

1. **Projekt-/Billing-Verantwortlicher:** Billing-Berichte nach Projekt, Datum und
   SKU filtern; Brutto-Nutzung, Credits/Rabatte und Kosten trennen. Konto-Schweiz/CHF,
   Tarifstufen, Zeitzone und Reporting-Verzug mitprüfen. API-Dashboardzahlen und
   fehlende SKU-Zeilen sind kein Nullkosten-/Restkontingent-Nachweis. Nach Release
   denselben Traffic/Zeitraum vergleichen; keine zusätzliche Backend-Telemetrie nötig.
2. **Projekt-/Quota-Verantwortlicher:** Im bestehenden Projekt `riparim-510521`
   wirksame Methoden-/Tages-/Minutenquoten und API-/Referrer-Beschränkungen lesen.
   UI-Kit über IAM Quotas mit `placewidgets.googleapis.com` prüfen. Das App-Limit
   **100/UTC-Tag** betrifft nur Identitätssuche und ergänzende Land-Details;
   Browserratings, Widgets und Bilder fallen nicht darunter. Vor einer Änderung
   alten Wert, Soll, kostenlose Restmenge und Auswirkungen festhalten. Das
   [konservative Restmengenmodell](google-places-cost-audit-2026-10-11.md#begrenzungsmodell-und-offene-kontrollen)
   ist keine Rechnung oder Gesamtgeldgrenze. Der Warnweg ist **tägliche manuelle
   Billingprüfung** gegenüber zuletzt belegten 2,73 CHF und den relevanten SKUs.
   Manuelle Warnschwellen: **50/80/100 %** der bestätigten freien SKU-Menge;
   Enterprise Details/Text Search Enterprise/Fotos jeweils **500/800/1000**,
   Standard-UI-Kit **5000/8000/10000**. Bei 80 % Restmenge/Verzug und Tagesgrenzen
   prüfen, bei 100 % den betreffenden API-Pfad pausieren. Enterprise Details
   liegt mit 1164 bereits darüber; die Browserpause ist umgesetzt. Diese
   Beobachtungsgrenzen sind keine eingeschalteten Budgetalarme oder Geldbudgets.
   Ein Anstieg erfordert Prüfung von Ereignisdatum/Reporting-Verzug sowie Quoten/
   fremden Verbrauchern und gegebenenfalls die geprüfte Abschaltung. Ein
   Benachrichtigungsbudget allein stoppt keine Maps-Nutzung; ohne beauftragten
   Benachrichtigungsweg werden keine automatischen Warnungen eingerichtet.
3. **Runtime-/Release-Verantwortlicher:** Für die bestehende Konfigabschaltung
   `GOOGLE_PLACES_SERVER_API_KEY` oder `GOOGLE_MAPS_BROWSER_API_KEY` in der geschützten
   Runtime leer setzen/entfernen; die Google-Routen liefern `enabled:false`.
   Vorher Wiederherstellung im vorhandenen geschützten Secret-Weg sichern, nichts
   in Git/Logs schreiben. Dies deaktiviert auch neue Identitätsprüfungen für
   Veröffentlichungen. Browser behalten Konfiguration/SDK bis zum Neuladen;
   die Runtime-Abschaltung beendet keine bereits offenen SDK-Instanzen.
4. **Wiederherstellung:** Die Browserpause nur manuell auf exakt
   `https://riparim.com/*` aufheben: zuvor kostenlose Restmenge und belastbaren
   SDK-Quotenvertrag oder einen anderen bestätigten kostenlosen Anzeigeweg
   nachweisen. Die sechs alten Dev-/Legacy-Referrer bleiben entfernt. Keine
   automatische Aufhebung. Nach erneuter Konto-/Freimengen-/Propagationsprüfung
   gegebenenfalls ursprüngliches Secret bzw. gezielt geprüfte Quoten zurücksetzen;
   hohe Vorherlimits aus dem Prüfbericht sind kein pauschaler Rücksetzauftrag.
   Die GetPlace-Sperre wird auch beim Monatswechsel nicht automatisch aufgehoben.
   Nach SDK-Autorisierungsfehlern ist nach Wiederfreigabe bewusstes Neuladen
   erforderlich; die App startet keine automatische Retryschleife. Neue
   Browserinstanz: zuerst eigenes Verzeichnis/eigene Bewertung und direkte
   Maps-/Routenlinks ohne Providerprobe prüfen. Nur mit bestätigter kostenloser
   Restmenge einen sichtbaren Bereich als begrenzte Live-Validierung öffnen.
   App-Veröffentlichungen nur als geprüfter Main-Release gemäß `docs/releases.md`.

Google-Ausfälle dürfen eigene Profile/Bewertungen und bestätigte Maps-/Routenlinks
nicht unterbrechen. Die App zeigt Ladefehler statt null Google-Bewertungen und
startet im selben Bereich keine automatische Retryschleife; neue Navigation oder
explizite Aktualisierung kann neu anfordern. Die isolierten DE/SQ/EN-Fixtures
prüfen `enabled:false`, HTTP 429, Identity-/Foto-Timeouts und Widget-Timeouts ohne
echte Providerverbindungen. API-Recherche nur mit belegtem kostenlosen
Restkontingent, sonst offizielle Maps-Oberfläche oder Rückstellung; keine Betriebe
kontaktieren. Dauerhaft bleiben eigene/unabhängig belegte Geschäftsdaten, Place IDs
und Prüfmetadaten; kein neuer allgemeiner API-Contentcache/Bulkimport für Sterne,
Rezensionen, Öffnungszeiten oder Fotos. Vorhandene historische Momentaufnahmen
bleiben unverändert und werden nicht als Live-Google-Werte ausgegeben.

## Primäre Dokumentation

- https://developers.google.com/maps/documentation/javascript/usage-and-billing
- https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- https://developers.google.com/maps/documentation/javascript/places-ui-kit/get-started
- https://developers.google.com/maps/documentation/javascript/places-ui-kit/place-details
- https://developers.google.com/maps/documentation/javascript/reference/place
- https://developers.google.com/maps/documentation/javascript/reference/places-widget
- https://developers.google.com/maps/documentation/javascript/places-ui-kit/custom-styling
- https://developers.google.com/maps/documentation/places/web-service/place-details
- https://developers.google.com/maps/documentation/places/web-service/place-photos
- https://developers.google.com/maps/billing-and-pricing/sku-details#places-ui-kit-query
- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/policies

## Abschluss der übrigen acht Entwürfe

Der Bestand nach dem Abschluss am 5. Oktober umfasste **129 eindeutig Google-zugeordnete öffentliche Pkw-Werkstätten und keine Entwürfe**. Die acht alten Entwürfe werden auf Nutzerauftrag entfernt; `data/workshop-final-removals.json` schützt ihre Kennungen vor erneutem Import. Der unabhängig belegte Nordstandort Reno Muçiqi & Bllaca erhält eine eigene Kennung, die bestätigte Place ID `ChIJhxuISoKdVBMRjzIZ8rKjdEc` und keine übertragenen Kundenverknüpfungen des alten Südprofils. Die Place ID wurde direkt mit einer unpassenden Ersatzsuche auf denselben Geschäftspunkt zurückgeprüft. Der positive Pkw-Service-Nachweis stammt aus eigenen Betriebsbeiträgen und einem amtlichen Wartungsauftrag. Alle acht Ergebnisse und die unabhängige Standortquelle stehen in `data/catalogue-final-2026-10-05.json`. Buraks allgemeine Pkw-Textbausteine reichen nach Abgleich mit dem konkreten Lkw-/Bus- und Motorradauftritt nicht für einen eindeutig belegten Pkw-Werkstattumfang. Die fünf numerisch belegten historischen Google-Sterne bleiben unverändert; neue Google-Inhalte wurden nicht gespeichert und das Server-Tageslimit wurde nicht umgangen.

## Erweiterung am 10. Oktober 2026

29 neue Kfz-Servicebetriebe, darunter zehn Betriebe mit Detailing oder Lackaufbereitung, erweitern den Katalog auf 158 öffentliche Profile. Alle neuen Place IDs wurden über den offiziellen Maps-JavaScript-SDK direkt mit Place Details aufgelöst und einzeln mit unabhängig veröffentlichtem Kontakt, Namen und Standort abgeglichen. Es gab 45 Browser-Textsuchabfragen und 29 direkte ID-Prüfungen, aber keine serverseitigen Places-Abfragen. Google-Bewertungen, Adressen, Telefonnummern und Koordinaten wurden nicht in Git oder D1 kopiert. Neue Profile erhalten keine Google-Momentaufnahme. Die Prüfung belegt die Geschäftszuordnung, keinen Inhaber-Verifizierungsstatus bei Google. Eigene Belege und Prüfergebnisse stehen in `data/import-2026-10-10.json`.

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
