# Google-Zuordnungen und Maps-Links für Riparim

Die Google-Schlüssel sind in der gehosteten Laufzeit eingerichtet. Google-Sterne und -Anzahlen werden nicht mehr öffentlich geladen oder angezeigt; historische Momentaufnahmen werden weiterhin nicht zur Sortierung verwendet. Alle **177 veröffentlichten Kfz-Servicebetriebe einschließlich Fahrzeugaufbereitung** besitzen eine eindeutig bestätigte Place ID. Die Zuordnungen werden einzeln anhand offizieller Karten, eigener Betriebswebsites oder übereinstimmender unabhängiger Kontakt-/Standortnachweise geprüft. Am 5. Oktober kamen 32 bestätigte IDs hinzu; zwei bestehende Identitäten konnten nach Korrektur überholter Verzeichnisstandorte veröffentlicht werden. `google.verification` dokumentiert Methode, Beleglinks und eigene Prüfnotiz. Auto Electronics gehört zu den 27 auf Nutzerauftrag entfernten, nicht eindeutig zugeordneten Entwürfen. Die sechs in `data/workshop-scope.json` begründeten fachlichen Ausschlüsse, der unabhängig als geschlossen belegte Opel-Rakovica-Betrieb und das alte Reno-Südprofil wurden nach abschließender Prüfung auf Nutzerauftrag entfernt. Der belegte Reno-Nordstandort wird als neues öffentliches Profil geführt. Google-Bewertungen, Rezensionen, Fotos und Öffnungszeiten werden weder im Katalog noch im Werkstattprofil geladen. Maps- und Routenlinks bleiben externe Links. Die tatsächliche Anzeige hängt zusätzlich von der verfügbaren Google-Anbindung im Browser ab.

Die zentrale Importquelle ist `data/workshops.json`; sie enthält Profile, stabile Riparim-IDs, Google-Zuordnungen und belegte Momentaufnahmen getrennt. Datenformat, Bestandsprüfung und Importbefehle stehen in `docs/workshop-data.md`. API-Inhalte werden nicht dauerhaft in Git gespeichert; ein Google-Bulkexport benötigt passende Datenrechte.

Am 4. Oktober wurden neun weitere Entwürfe individuell bestätigt und veröffentlicht. 13 unabhängig belegte Plus-Code-Adressen wurden offline in genaue Koordinaten umgerechnet und gegen den bestehenden Google-Eintrag geprüft. Zwei weitere Prüfungen ergaben ungeklärte Standortkonflikte bei Autodiagnoza Kosove und BMW Service Ferizaj; diese Profile wurden damals bis zur unabhängigen Klärung ausgeblendet. Kennungen, historische Zuordnungen und Bewertungen bleiben erhalten. Der damalige Bestand umfasste deshalb 78 veröffentlichte Profile, davon 19 mit genauen Koordinaten, und 85 Entwürfe. Die eigenen Nachweise stehen in `data/catalogue-review-2026-10-04.json`.

Am 5. Oktober wurden alle 85 verbleibenden Entwürfe überprüft und **34 freigegeben**. Autodiagnoza Kosove und BMW Service Ferizaj behalten ihre bisherigen IDs; ihre aktuellen Standorte sind nun aus eigenen Betriebsquellen präzise belegt. Der Bestand nach diesem ersten Prüfschritt umfasste **112 öffentliche Profile, davon 21 mit genauen Koordinaten, und 51 Entwürfe**. Davon benötigten damals 45 weitere Identitätsbelege; sechs blieben fachlich ausgeschlossen. Die Freigabesperre und das Tageslimit von 100 serverseitigen Identitätsabfragen bleiben bestehen. `data/catalogue-review-2026-10-05.json` dokumentiert jedes Prüfergebnis. Neue Google-API-Inhalte wurden nicht dauerhaft gespeichert.

Die anschließende Weiterprüfung der 51 Entwürfe bestätigt **13 weitere IDs**. Aktuelle Betriebsquellen lösen alte Kontaktdaten und Bezeichnungen auf; genaue profilspezifische Verzeichnismarker bestätigen Kimi und Gazi trotz fehlender Google-Telefonnummer. Jede ID wurde von Google Maps mit einer absichtlich unpassenden Ersatzsuche auf genau denselben Betrieb zurückgeprüft. Keine zusätzlichen Server-Abfragen oder Lockerung der Identitätsprüfung waren nötig. Der Bestand nach diesem Prüfschritt umfasste **125 öffentliche Profile, davon 23 mit unabhängig belegten genauen Koordinaten, und 38 Entwürfe**. 30 Identitäten, eine Reno-Filialkontinuität, ein belegter geschlossener Betrieb und sechs fachliche Ausschlüsse blieben damals offen bzw. ausgeblendet. Der vollständige Folgebericht ist `data/catalogue-followup-2026-10-05.json`.

Die vertiefte Prüfung dieser 30 Identitäten bestätigt **drei weitere bestehende Profile**: Sfishta Auto Home, Niki und Fatosi. Eigene Anzeigen, Betriebsbeiträge, amtliche Aliasbelege und genaue unabhängige Geschäftspunkte verbinden den bisherigen Betrieb jeweils mit seinem gültigen Google-Eintrag. Die direkten ID-Rücktests erfolgten im vom Nutzer vorgegebenen Gmail-Browserprofil; weitere Serverabfragen wurden nicht ausgeführt. Der Bestand nach diesem Prüfschritt umfasste **128 öffentliche Profile, davon unverändert 23 mit unabhängig belegten genauen Koordinaten, und 35 Entwürfe**. 27 Identitäten benötigen weiterhin einen eindeutigen Beleg; die acht übrigen Entwürfe bleiben unverändert. Alle 30 Prüfausgänge stehen in `data/catalogue-identity-2026-10-05.json`.

Die anschließend vom Nutzer verworfenen 27 Identitäten sind in `data/workshop-removals.json` dokumentiert. Der Bestand nach dieser ersten Entfernung umfasste **128 öffentliche Profile und 8 Entwürfe**, insgesamt **136 Profile**. Der Katalog umfasste nach dem Abschluss am 5. Oktober **129 öffentliche Profile und keine Entwürfe**. Zugehörige Cache-/Kartenmetadaten werden entfernt; Entfernungsmarker schützen vor erneutem Import. Die früheren Prüfergebnisse und ihre damaligen Zahlen bleiben als Historie erhalten.

## Konfiguration im bestehenden Google-Cloud-Projekt Riparim

1. Maps JavaScript API, Places API (New) und Places UI Kit API sind bereits aktiviert. Vor Änderungen an vorhandener Nutzung gelten die unten dokumentierten Billing-/Freimengen-/Quotenprüfungen; keine zusätzlichen Dienste oder kostenpflichtigen Tarife aktivieren.
2. Den Produktions-Browser-Key nur für tatsächlich benötigte HTTPS-Referrer und Maps JavaScript und Places UI Kit (kein Places API (New) im Browser-Key) freigeben. Maßgeblich ist die belegte produktive Runtime-Zuordnung; ein alter Sites-Host oder lokale Fixtures begründen keine Freigabe des Produktionskeys.
3. Der separate private Server-Key darf ausschließlich Places API (New) verwenden und bleibt im geschützten Server-Runtime-Secret. Ohne feste belegte Cloudflare-Ausgangs-IP wird keine ungeprüfte IP-Beschränkung eingerichtet.
4. `GOOGLE_MAPS_BROWSER_API_KEY` und `GOOGLE_PLACES_SERVER_API_KEY` gehören ausschließlich in die geschützte Laufzeitkonfiguration. App-Veröffentlichungen erfolgen über den geprüften Main-Release gemäß `docs/releases.md`; keine Schlüssel in Git oder `.openai/hosting.json`, keine manuelle Feature-Branch-Veröffentlichung.
5. Tatsächlich unterstützte Quoten und vorhandene Billing-Warnungen prüfen. Ein Benachrichtigungsbudget stoppt keine Nutzung; das App-Limit von 100/Tag begrenzt ausschließlich serverseitige Identitätsabfragen. Wirksame Istwerte, Solländerungen und Rückweg stehen im Betriebsrunbook unten.
6. Live-Validierung nur als begrenzter Schritt mit bestätigtem kostenlosem Restkontingent. Ohne dieses Kontingent genügen isolierte Ausfall-/Anfragefixtures und die lesende Providerkonfiguration; direkte Maps-Links bleiben verfügbar und Fehler werden nicht als fehlende Bewertungen ausgegeben.

## Vorhandene Google-Maps-Links als Identität

Die gespeicherten Links werden zuerst ausgewertet. `query_place_id`, `place_id` und `q=place_id:…` identifizieren den Eintrag unmittelbar und benötigen keine erneute Suchanfrage. Ein CID-Link wird anhand der identischen CID im von Google zurückgegebenen Maps-Link bestätigt. Fremde Domains und Suchtext werden niemals als Place ID behandelt.

Für Suchlinks wird deren vorhandene Suchanfrage einschließlich Adresse verwendet. Ein eindeutiger Treffer muss zusätzlich über Telefonnummer oder den passenden Namen und einen präzisen Standort (belegte Koordinaten, Plus Code oder mindestens zwei passende Adresswörter) bestätigt werden. Ein Suchlink allein belegt keine Identität. Bestätigte Links werden mit der Place ID gespeichert; Kontaktlink und eingebetteter Bewertungsbereich verwenden denselben Eintrag. Ein geänderter Link invalidiert den Zuordnungscache.

## Zuordnung und Darstellung

Ein veröffentlichtes Profil benötigt eine bestätigte Google-Identität, auch wenn keine Rezensionen oder Sterne vorhanden sind. Importvalidator und Verwaltungsroute prüfen diese Voraussetzung. Ein unverändertes bestätigtes Profil behält seine Identität; Änderungen an Name, Telefon, Ort, Adresse oder Koordinaten benötigen eine neue Bestätigung. Doppelt verwendete Place IDs werden zurückgewiesen. Kartenlink, Route, Bewertungen und Öffnungszeiten verwenden dieselbe ID. Öffnungszeiten werden ausschließlich im nativen Google-Baustein des Profilkopfs dargestellt; Fotos bleiben auf Google Maps. Inhalte werden nicht in die Importquelle übernommen.

Die öffentliche Zuordnungsroute nimmt ausschließlich eine vorhandene veröffentlichte
Werkstattkennung entgegen und liest deren bereits bestätigte Place ID aus dem
direkten Maps-Link oder dem vorhandenen `workshop_google_places`-Datensatz mit
gültiger ID und passendem Geschäftsdatenhash. Auch Profile ohne historische
Google-Momentaufnahme behalten dadurch ihre bestätigte Identität. Sie startet
keine Google-Suche, aktualisiert keinen Zuordnungsdatensatz (der bestehende Katalog-Bootstrap bleibt unverändert) und verwendet keine
neuen Google-Details. Ohne bestätigte unveränderte ID liefert sie `placeId:null` und die
Oberfläche bietet den vorhandenen Maps-Link. Neue oder geänderte Geschäftsdaten
werden ausschließlich im gesonderten geprüften Veröffentlichungs-/Rechercheweg
bestätigt. Die nachfolgenden Suchregeln gelten für diesen serverseitigen Weg.

Telefonabfragen verwenden ein Leerzeichen nach der Vorwahl und den dazugehörigen Regionscode: `+383`/`XK`, vorhandene `+381`-Nummern unverändert mit `RS`. Bekannte Werkstattkoordinaten setzen einen Suchbias von drei Kilometern; ohne Koordinaten wird das Gebiet Kosovo verwendet. So hängt die Suche nicht von der Ausgangs-IP des Servers ab. Die abschließende Landes- und Standortprüfung bleibt davon unabhängig; bei einer erfolglosen Telefonsuche folgt eine Suche nach Werkstattname und Ort, mit denselben strikten Identitätsprüfungen. Fehlende strukturierte Länderangaben werden für Kandidaten mit passender Telefonnummer über Place Details geprüft. Alle Such- und Detailanfragen zählen zum gemeinsamen Limit von 100/Tag. Zusammengezogene Namen wie AutoMita werden erkannt; Ladestationen, Parkplätze und reine Waschanlagen werden ausgeschlossen. Bei einer Änderung der Suchstrategie macht deren Versionskennung frühere erfolglose Zuordnungen erneut prüfbar.

Es werden nur Place IDs und eigene Prüf-/Wiederholungsmetadaten dauerhaft gespeichert. Ungeklärte Treffer werden nach sieben Tagen erneut geprüft, Providerfehler frühestens nach 15 Minuten. Gleichzeitige Aufrufe teilen eine kurze Lease. Eine Änderung des Profils löst eine neue Zuordnung aus; erfolgreiche Zuordnungen werden nach einem Jahr erneut geprüft.

Sichtbare Karten stellen aktuelle Sterne und Anzahl im nativen Google Advanced-
UI-Kit-Widget dar. Die App exportiert keine Ratingwerte und speichert keine
API-Sterne oder Rezensionen in D1, R2 oder Browser Storage. Google- und
Providerattribution bleiben im Baustein erhalten. Google-Werte fließen weder in
Riparim-Mittelwerte noch in Riparim-Sortierungen ein.

Der Katalog bietet ausschließlich Name, Riparim-Bewertung und Entfernung als Sortierungen an. Alte Links mit `sort=google` werden auf die Standardsortierung Name normalisiert; Suchbegriff, Leistung, Ort, Marke, Sprache und Locale bleiben erhalten. Es gibt keine globale oder auf die ersten zwölf Ergebnisse begrenzte Google-Sortierung. Historische Google-Momentaufnahmen werden weiterhin weder als aktuell angezeigt noch zur Sortierung verwendet.

Google-Bausteine starten ausschließlich bei Sichtbarkeit und aktivem Tab
(120-Pixel-Vorlauf). Ein unverändertes Widget bleibt im aktuellen Komponentenstand
verbunden; Filter blenden die ganze bereits montierte Karte aus und wieder ein.
Die IDs dieser Karten bleiben auf den aktuellen veröffentlichten Katalog begrenzt;
es werden keine Google-Werte extrahiert. Locale-/Identitätswechsel entfernen alte
Google-Inhalte. Neue Sortierung, geänderter Entfernungsursprung oder geänderte
Sortierfolge des Livekatalogs beginnen eine neue Ansicht, damit DOM- und
Tastaturreihenfolge der sichtbaren Sortierung entsprechen. Es gibt keinen Content-
Cache, TTL, Hintergrundrefresh oder Schreiben in D1, R2, Redis, CDN oder Browser
Storage. Place-ID-Zuordnung und direkte Maps-Fallbacks bleiben erhalten.

Eine Änderung der zentralen JSON-Quelle löst über deren Inhalts-Hash den Import aus; Profile und recherchierte Google-Angaben werden anhand ihrer getrennten Zeitstempel aktualisiert. Neuere manuell gepflegte Angaben bleiben erhalten.

### Historischer Anfragenachweis für Issue #94

Bei Abschluss von #94 verwendete `tests/catalogue-google-requests.test.mjs` 158 synthetische öffentliche Werkstätten, kontrollierte Sichtbarkeit und einen Google-SDK-Fixture ohne echte Provideraufrufe. Der Red-Lauf vor der Änderung zählte bei `sort=google` **158 Places-Abfragen**, obwohl keine Karte sichtbar war. Der gleiche Lauf nach der Änderung prüft in DE/SQ/EN:

| Auslöser                                               | Places-Abfragen nach Änderung |
| ------------------------------------------------------ | ----------------------------: |
| Initialrender mit 158 Treffern und unsichtbaren Karten |                             0 |
| Alte URL `sort=google`                                 |                             0 |
| Filteränderung, neue Karten weiterhin unsichtbar       |                             0 |
| Erste sichtbare Karte                                  |                             1 |
| Passende Karte nach Filterwechsel erneut sichtbar      |                 0 zusätzliche |
| Localewechsel und erste erneut sichtbare Karte         |                 1 zusätzliche |

Damals prüfte dieselbe Fixture zusätzlich in DE/SQ/EN die datenfreie statische Katalog-Shell: Die Hydration liest alle Filter und die Locale aus der echten URL, der bestehende Live-Katalogabruf bleibt erhalten und verursacht keine Google-Abfrage für unsichtbare Karten. Sichtbare Karten und ihre Wiederverwendung behalten dieselben Anfragezahlen. Der aktuelle Test verwendet 160 synthetische Datensätze und prüft null Google-Anfragen auch für sichtbare Katalogkarten; die obigen Zählungen beschreiben den damaligen SDK-Einzelratingpfad.

Die damals gezählten Aufrufe waren SDK-`fetchFields`-Anfragen, keine Kostenmessung oder Aussage zur Abrechnungskategorie. Auch reguläre URL-/Sortierverträge, Lade-/Leer-/Fehlerfälle und verspätete Antworten werden ohne Live-Google-Verbindungen geprüft.

## Historischer UI-Kit-Betrieb im Werkstattprofil (bis v1.26.2)

Eigene Riparim-Bewertungen beziehungsweise ihr leerer Hinweis stehen immer vor Google. Der Google-Host bleibt dadurch auch während des Nachladens an derselben DOM-Position und wird nicht verschoben oder erneut verbunden; seine eigene Panelsichtbarkeit steuert weiterhin den Abruf. Daraus wird keine Aussage über Googles internes Abrechnungsverhalten abgeleitet.

Das Profil verwendet zwei getrennte Advanced-UI-Kit-Bausteine: Im Profilkopf
zeigt `gmp-advanced-place-details` nur `gmp-place-rating`,
`gmp-place-opening-hours` und `gmp-place-attribution`. Unter den eigenen
Rezensionen zeigt `gmp-advanced-place-details` nur `gmp-place-reviews` und
`gmp-place-attribution`. Beide verwenden dieselbe bestätigte Identität und die
aktive Sprache; die Zuordnungsroute wird gemeinsam genutzt. Jeder Baustein
startet erst bei seiner eigenen Sichtbarkeit. Die zusätzliche App-Überschrift,
der wiederholte Werkstattname und native Maps-Aktionen entfallen. Öffnungszeiten
stehen ausschließlich oben, Google-Kommentare ausschließlich im Rezensionenbereich.
Es gibt weder eine parallele Enterprise-Profilabfrage noch einen vollständigen
REST-Refresh zum nächsten Öffnungs-/Schließwechsel.
Die native Google-Darstellung unterscheidet fehlende Rezensionen, unbekannte
Öffnungszeiten und Schließstatus. Die App liest diese Daten nicht aus dem DOM,
Shadow-DOM oder dem Widget aus. Die dokumentierte öffentliche `place`-Property
enthält lediglich ID, Standort und Viewport. Ein fehlgeschlagener Provideraufruf
wird als Ladefehler angezeigt, niemals als null Bewertungen ausgegeben.

Jeder Baustein startet nur bei Sichtbarkeit (120-Pixel-Vorlauf) und aktivem Tab.
Konfiguration und Zuordnungsroute starten erst bei Sichtbarkeit des Google-Bereichs
und aktivem Tab.
Die öffentliche Zuordnungsroute liest nur die bereits bestätigte ID. Nach wartender
Konfiguration wird die aktuelle Sichtbarkeit erneut geprüft; ist der Bereich
unsichtbar, wird die Zuordnung bis zur erneuten Sichtbarkeit zurückgestellt.
Sichtbarkeit wird auch nach asynchronem SDK-Laden erneut geprüft. Themewechsel
und normale Profilzustandsänderungen
bewahren dieselbe Widgetinstanz; Farben und Schriften werden ausschließlich
über die offiziellen CSS-Eigenschaften und `color-scheme` geändert. Der
Rezensionenbaustein nutzt die gesamte Hauptspaltenbreite mit interner Scrollfunktion;
der rahmenlose Profilkopf erhält 152 Pixel Höhe und dieselbe interne Scrollfunktion für
ausgeklappte Wochenzeiten. Der vollständige Baustein ist nötig, weil
`gmp-place-opening-hours` laut Inhaltsreferenz nur dort unterstützt ist; das
kompakte Beispiel in Googles Advanced-Anleitung zeigt diese Zeiten im Live-SDK
nicht an. Abstände werden ausschließlich über die dokumentierten
`--gmp-mat-spacing-*`-Eigenschaften reduziert. Quellenhinweis und Infofunktion
bleiben sichtbar; deren native Reihenfolge wird nicht verändert. Katalogratings
behalten den kompakten Baustein mit Inhaltshöhe.
Die Google- und Autorenattribution des Bausteins bleibt vollständig erhalten.
Das Profil verwendet keine Zusammenfassungen oder `all-content`.

Der Ladezeitpunkt bleibt internes Veraltungsmetadatum. Nach 30 Minuten wird der
jeweilige alte Baustein ausgeblendet und eine klare
Veraltungsanzeige angeboten. Status, die kompakte Aktion **Erneut laden** und
der Maps-Fallback stehen in einer umbrechenden Zeile. Bei SDK-Ladefehlern heißt
die Aktion weiterhin **Seite neu laden** und lädt den Browser tatsächlich neu. Der
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

### Eigene Öffnungszeiten und Profile ohne Google-Abfragen

Katalog und Profil zeigen ausschließlich Riparim-Bewertungen. Das Profil startet
keine Google-Konfiguration, Identitätsroute, SDK-, Widget-, Foto- oder
Detailsabfrage. Maps- und Routenlinks werden aus vorhandenen bestätigten IDs
gebildet; der Browser öffnet Google erst beim Anklicken eines externen Links.
Der serverseitige Identitätsabgleich für Katalog- und Kontaktänderungen bleibt
getrennt bestehen. Die bisherigen Providerquoten werden nicht erhöht.

Öffnungszeiten werden über die bestätigte Inhaberfunktion eingereicht und nach
Moderation veröffentlicht. Wochenplan, Ausnahmen und serverseitiges
Bestätigungsdatum gehören zur eigenen DB. Fehlende Angaben sind ausdrücklich
unbekannt, nicht geschlossen. Details stehen in [workshop-data.md](workshop-data.md).
Google-Zeiten werden nicht einmalig importiert oder synchronisiert. Die obigen
und folgenden datierten Providerprüfungen dokumentieren den historischen Betrieb.

Die DE/SQ/EN-Katalog- und Profilfixtures prüfen null Google-Anfragen, eigene
Bewertungen, eigene Öffnungszeiten, Live-Hydration, Leerzustände und Maps-Links.

## Betrieb: Kosten und Ausfallweg (#96)

Der [datierte Prüfbericht vom 11.10.2026](google-places-cost-audit-2026-10-11.md)
enthält den reproduzierten Vorher-/Nachher-Abrufvergleich, alle neun tatsächlich
beobachteten SKU-Mengen/Kosten, die Schweizer Konto-Preisstufen in CHF,
Key-/Quoten-Vorherwerte und die Grenzen der Messung. Der damalige Projekt-Billing-Bericht
wies **2,73 CHF** aus, davon Enterprise Details mit **1164 Ereignissen** bei einer
freien Kontostufe bis 1000. #94/#95 sind lokale Anfrageoptimierungen; ihr
Produktionskosten-Nachherwert ist wegen Billing-Verzug noch nicht belegt.

### Providerfreigabe: begrenzte Standard- und Advanced-Widgets

Der datierte #96-Bericht bleibt unverändert als historischer Beleg der ersten
Browserpause. Beim Beginn dieser Korrektur war der Browser-Key noch auf
`https://riparim-google-paused.invalid/*` beschränkt. Die Standard-Freigabe ist
seit v1.12.7 aktiv. Advanced wurde nach frischer Kontopreis-/Nutzungsprüfung und
geprüftem Main-Release v1.12.9 auf 100 pro Tag freigegeben. Die Profilaufteilung
verwendet diese bestehende Quote ohne weitere Provideränderung. Der native
Readback vom 11.10.2026 bestätigt Advanced 100, Standard 250 und Sessions 0.

| Dienst / Methode                | Ziel-Tageslimit | Wirkung                                                                        |
| ------------------------------- | --------------: | ------------------------------------------------------------------------------ |
| Places (New): GetPlaceRequest   |           **0** | Einzel-Details bleiben gesperrt                                                |
| Places (New): SearchTextRequest |          **20** | nur getrennte serverseitige Identitätsprüfung bei bestätigter freier Restmenge |
| Places (New): PhotoMedia        |           **0** | öffentliche App lädt keine Google-Fotos                                        |
| UI-Kit Standard Query           |         **250** | nur noch offene ältere Profil-/Katalogansichten                                |
| UI-Kit Advanced Query           |         **100** | getrennte Profilbausteine, ohne Name/Aktionen                                  |
| UI-Kit Sessions                 |           **0** | nicht verwendet und gesperrt                                                   |
| Maps JavaScript: Map loads      |           **0** | keine eingebetteten Karten; direkte Maps-/Routenlinks                          |

Der Browser-Key erhält ausschließlich **Maps JavaScript API und Places UI Kit API**
und genau `https://riparim.com/*`. **Places API (New) wird aus diesem Key entfernt**:
Das sperrt den bisherigen Einzel-Details-Pfad unabhängig von seiner ungeprüften
SDK-GetPlace-Quotenzuordnung. Der amtliche UI-Kit-Setupvertrag benötigt Maps
JavaScript und UI Kit; `PlaceDetailsPlaceRequestElement.place` akzeptiert einen
`Place`-Identitätsgegenstand oder eine ID. Das Erzeugen von `Place({id,
requestedLanguage})` lädt keine Details; `fetchFields` wird nicht aufgerufen.
UI-Kit-Widgets verwenden eigene Quoten; laut Google werden deren zugrunde
liegende Places-/Geocoding-Abfragen nicht gegen die jeweiligen Projektquoten
gezählt. Die GetPlace- und Map-loads-Sperren verhindern die UI-Kit-Bausteine deshalb
nicht. Pflichtinhalte und Google-Attribution bleiben vollständig im nativen Widget.

Das Schweizer Kontopreismodell aus #96 hat 10.000 freie Standard-UI-Kit-Ereignisse
pro Monat. 250 pro Tag ergeben selbst über 31 volle Tage höchstens 7750 zusätzliche
Standard-Queries dieses Projekts. Der frisch gelesene Billingbericht vom
11.10.2026 08:42:27 UTC meldet 38 Standard-UI-Kit-Ereignisse mit 0 CHF,
also 9962 Einheiten gegenüber der dokumentierten freien Kontostufe. Konservativ
38 + 22 weitere Tagesfenster × 250 = 5538 Standard-Ereignisse im laufenden Monat.
Dies ist ein Kontrollmodell, keine Live-Nachherabrechnung. Derselbe Bericht weist
1261 Enterprise-Ereignisse mit 4,34 CHF aus; diese historischen Kosten und der
Billingnachlauf beweisen keinen kostenlosen Enterprise-Rückweg. Bereits
verbrauchte, verspätet gemeldete und
andere gemeinsame Billing-Verbraucher müssen vor Freigabe separat berücksichtigt
werden. Kein anderer Projekt-Key darf die Quote erhöhen oder einen kostenpflichtigen
Ausweichpfad öffnen. Eine Tagesquote ist keine globale Geldobergrenze und kein
Monatsbudget; bei unbestätigter kostenloser Restmenge bleibt die Referrerpause.
Tagesreset-Zeitzone und Reporting-Verzug sind beim Provider zu prüfen.

Advanced verwendet die separate SKU **Places UI Kit Pro (42AB-1FB3-B56A)**.
Die [offizielle Preisliste](https://developers.google.com/maps/billing-and-pricing/pricing)
nennt **5000 freie Ereignisse pro Monat**, darüber 5 USD pro 1000. Vor Aktivierung
müssen die tatsächliche kostenlose Schweizer Kontostufe und bisherige kontoweite
Pro-Nutzung frisch bestätigt sein. Die native Kontopreisliste vom 11.10.2026
bestätigt 0 CHF bis zur Staffelgrenze 5000 und danach 4,159249999 CHF pro 1000.
Der aktuelle Monatsbericht enthält neun SKUs, keine Pro-UI-Kit-Zeile; Gesamt
4,34 CHF bleiben ausschließlich den historischen Enterprise-Details zugeordnet.
Das Rechnungskonto ist nur mit `riparim-510521` verknüpft. Diese Billinganzeige
allein beweist wegen Reporting-Verzug keine Nullnutzung; vor der Freigabe
wurde zusätzlich die bisherige Advanced-Tagesquote 0 mit Nutzungsreadback geprüft. 100 pro Tag erlauben selbst über 31 Tage
höchstens 3100 Advanced-Queries; andere Kontoverbraucher und Reporting-Verzug
müssen zusätzlich in die freie Restmenge passen. Bei unbestätigter Restmenge
bleibt Advanced auf 0; es gibt keinen kostenpflichtigen Ausweichpfad.
Standard- und Pro-SKUs besitzen getrennte freie Mengen. Die Pro-Quote darf
keine Sessions oder Zusatzinhalte freigeben. Diese Begrenzung ist keine
allgemeine Geldobergrenze des Google-Kontos.

Der getrennte Server-Key bleibt auf Places API (New) beschränkt, ohne behauptete
feste Cloudflare-Ausgangs-IP. Öffentliche bestätigte Identitätsrouten starten keine
neue Provider-Suche. Recherche/Neuzuordnung darf die serverseitige Suche nur mit
belegtem kostenlosem Restkontingent verwenden; sonst offizielle Maps-Oberfläche
oder Rückstellung. Keine geheimen Werte, echte Kontodetails oder Google-Inhalte
werden in Git, D1, R2 oder Browser Storage übertragen. Historische Google-
Momentaufnahmen bleiben unverändert und werden nicht als aktuelle Werte angezeigt.

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
   UI-Kit-Widgets fallen nicht darunter; individuelle Browserratings und Bilder sind entfernt. Vor einer Änderung
   alten Wert, Soll, kostenlose Restmenge und Auswirkungen festhalten. Das
   [konservative Restmengenmodell](google-places-cost-audit-2026-10-11.md#begrenzungsmodell-und-offene-kontrollen)
   ist keine Rechnung oder Gesamtgeldgrenze. Der Warnweg ist **tägliche manuelle
   Billingprüfung** gegenüber zuletzt belegten 4,34 CHF und den relevanten SKUs.
   Manuelle Warnschwellen: **50/80/100 %** der bestätigten freien SKU-Menge;
   Enterprise Details/Text Search Enterprise/Fotos jeweils **500/800/1000**,
   Standard-UI-Kit **5000/8000/10000**, Pro-UI-Kit **2500/4000/5000**. Bei 80 % Restmenge/Verzug und Tagesgrenzen
   prüfen, bei 100 % den betreffenden API-Pfad pausieren. Enterprise Details
   liegt mit 1261 bereits darüber; dieser alte Pfad bleibt gesperrt. Diese
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
4. **Wiederherstellung mit UI-Kit-Widgets:** Vor Freigabe den vollständigen
   geprüften Main-Release kontrollieren: keine produktiven `fetchFields`- oder
   REST-Fotoabrufe. Aktuelles Billing einschließlich gemeinsam genutzter
   Kontofreimenge prüfen. Tagesgrenzen gemäß obiger Tabelle speichern und frisch
   lesen. Browser-Key nur Maps JavaScript und UI Kit zuordnen, dann exakt
   `https://riparim.com/*` freigeben; die sechs alten Dev-/Legacy-Referrer bleiben
   entfernt. Bis zu fünf Minuten Providerpropagation abwarten, erneut lesen und
   mit einer neuen Browserinstanz höchstens einen sichtbaren Bereich innerhalb
   der bestätigten freien Quote prüfen. Nach SDK-Autorisierungsfehlern bewusst
   neu laden; keine automatische Retryschleife. Keine Paid-Tarife, Abonnements,
   Budget-/Alertdienste oder automatische Nachrichten einrichten.
5. **Rückweg:** Bei fehlender kostenloser Restmenge, unerwartetem SKU-Verbrauch
   oder ungeklärter Quotenwirkung den Browser-Referrer wieder auf exakt
   `https://riparim-google-paused.invalid/*` setzen. Niedrige Methodenquoten und
   Ausschluss von Places (New) im Browser-Key beibehalten. GetPlace und Fotos
   werden auch bei Monatswechsel nicht automatisch wieder freigegeben.
   Eigene Profile/Bewertungen und direkte Maps-/Routenlinks zuerst prüfen;
   eine potenziell kostenpflichtige Providerprobe ist kein Abschaltnachweis.
   Änderungen/Readbacks getrennt von tatsächlichem Live- und Billingnachweis
   dokumentieren. Veröffentlichung nur als geprüfter Main-Release nach
   `docs/releases.md`.

Google-Ausfälle dürfen eigene Profile/Bewertungen und bestätigte Maps-/Routenlinks
nicht unterbrechen. Die App zeigt Ladefehler statt null Google-Bewertungen und
startet im selben Bereich keine automatische Retryschleife; neue Navigation oder
explizite Aktualisierung kann neu anfordern. Die isolierten DE/SQ/EN-Fixtures
prüfen `enabled:false`, HTTP 429, Identitäts-/Widget-Timeouts ohne
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

## Verbindlicher Rechercheweg der täglichen Routine

Seit der Nutzerentscheidung vom 12. Oktober 2026 prüft die tägliche
Importautomation neue Identitäten immer ausschließlich über die öffentliche
Google-Maps-Oberfläche. Sie verwendet keine eigenen API-Schlüssel,
Places-/Maps-API- oder SDK-Aufrufe, Einbettungen oder API-Finder.
Der vollständige Ablauf und die Rückstellungsbedingungen stehen in
[daily-workshop-import.md](daily-workshop-import.md). Bestehende produktive
Widgets und deren Providerquoten bleiben von dieser Rechercheregel unberührt.

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
