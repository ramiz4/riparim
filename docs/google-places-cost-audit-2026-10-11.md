# Google-Places-Kostenprüfung am 11.10.2026 (#96)

[Betriebsrunbook und Wiederherstellung](google-places.md#betrieb-kosten-und-ausfallweg-96).
Dieser datierte Bericht trennt synthetische App-Zählwerte, tatsächlich gelesene
Providerdaten sowie gespeicherte Änderungen und noch offene Prüfungen.

## Abrufmodell und SKU-Zuordnung

Die Vergleichsbasis ist `2d593346c2337f827801835787bd4f4424da5ccc`
(10.10.2026); der Nachher-Stand enthält #94 und #95. Die folgende Matrix zählt
App-Abrufanlässe bei freigegebener Google-Konfiguration, bestätigter Identität,
gleicher Sprache und erfolgreichen Antworten. Die weiter unten dokumentierte
vorläufige Browserpause ist ein separater aktueller Betriebszustand. Die Zwölfkarten-/Filter-/Pagination-Vorherwerte wurden mit derselben
SDK-Fixture gegen einen isolierten Quellarchiv-Stand der Basis ausgeführt; die
übrigen Vorher-Angaben folgen den damaligen Quellen und Red-Fixtures von #94/#95.
Nachher-Werte werden durch die beiden genannten Anfrage-Fixtures geprüft. Sie sind **keine Produktionsmessung und keine Rechnung**.

| Szenario | Vorher | Nachher |
| --- | --- | --- |
| Name-Sortierung, zwölf erstmals sichtbare Karten | 12 einzelne Ratingabrufe | 12 einzelne Ratingabrufe |
| Filter ohne Treffer, zurück zu denselben zwölf sichtbaren Karten | 12 zusätzliche Ratingabrufe nach vollständigem Aus-/Einfiltern | 0 zusätzliche Ratingabrufe |
| Weitere zwölf Karten einblenden, noch unsichtbar | 0 zusätzliche Ratingabrufe bei Name-Sortierung | 0 zusätzliche Ratingabrufe |
| Diese weiteren zwölf erstmals sichtbar | 12 zusätzliche Ratingabrufe | 12 zusätzliche Ratingabrufe |
| Alter Link `sort=google`, 158 synthetische Treffer, keine sichtbare Karte | 158 Ratingabrufe im Red-Lauf | 0; URL wird auf Name normalisiert |
| Profilmount, Google-Bereiche unsichtbar | 1 vollständiger Enterprise-Detailsabruf im Red-Lauf | 0 Google-Abrufe |
| Google-Bereich sichtbar, einschließlich Rezensionen | zusätzlich Standard-Widget; Header nutzt Vollprofilantwort | 1 gemeinsames Standard-Widget, kein Header-Ratingabruf |
| Fotobereich sichtbar | Fotos aus vollständiger Profilantwort | 1 separate Metadatenabfrage `id,photos,attributions`, bis zu 3 Vorschauen |
| Galerie öffnen / anderes Foto auswählen | gewählte Großdatei; zusätzliche Vorschaubilder im Dialog möglich | gewählte Großdatei; zusätzliche Vorschaubilder im Dialog möglich |
| Erfolgreiches Profil 30 Minuten offen, keine Öffnungszeiten-Transition | Vollprofil-Refresh alle 5 Minuten; bei bekannter Transition bis 30 Minuten bzw. Transition + 1,5 Sekunden | 0 automatische Abrufe; Veraltungsanzeige |
| Explizit sichtbares Aktualisieren nach Veraltung | Vollprofil-Refresh über Timer/Tabrückkehr | 1 neues Standard-Widget, 0 Fotometadatenabrufe |

Filter-/Galeriewerte sind keine Garantie für beliebige Navigationen: Neue ID,
Locale, neuer Browserlauf oder erneutes Öffnen verwerfen den jeweiligen
Anzeigestand. Browser-Caching, native Widget-Innenanfragen, Bild-Lazy-Loading und
Google-Abrechnungsereignisse werden durch die Fixtures nicht vermessen. Das
Erzeugen eines Widgets ist insbesondere keine zugesicherte SKU-Anfragezahl.

| Aktueller Aufruf | Zu prüfende Google-SKU / Quotenfamilie |
| --- | --- |
| Sichtbare Katalogbewertung, JS `rating,userRatingCount,googleMapsURI,attributions` | Place Details Enterprise; Places-/Maps-JavaScript-Projektquoten |
| Standard `gmp-place-details`, Rating/Öffnungszeiten/Rezensionen | Places UI Kit Query Essentials (`0678-4F72-DA7C`), unabhängig von Inhaltsauswahl |
| Foto-Metadaten `id,photos,attributions` | Place Details Essentials IDs Only; keine Enterprise-Felder |
| Vorschau- und Großbild `/photos/.../media` | Place Details Photos; jeden tatsächlichen Bildabruf getrennt betrachten |
| Serverseitiges `places:searchText` mit Telefonnummer und eigener Standortprüfung | Text Search Enterprise; alle Suchmodi teilen das App-Limit |
| Identitätsprüfung `addressComponents` für Kandidaten ohne Land | Place Details Essentials; zählt ebenfalls zum App-Limit |
| SDK laden, direkte Maps-/Routenlinks | SDK-Laden und externe Links sind keine eingebettete Karte; keine Route-API-Abfrage der App |
| Advanced-/Pro-UI-Kit oder Dynamic Maps | im aktuellen öffentlichen Profil nicht verwendet; unerwartete Rechnungszeilen prüfen |

Die höchste angeforderte Feldstufe bestimmt den Details-/Suchtarif. Die Tabelle
ordnet Quellcode zu offiziellen Verträgen zu; der Nachweis tatsächlich
abgerechneter SKU, Freimengen, Währung und Sondertarife stammt ausschließlich aus
Google Cloud Billing. Maßgeblich für regionale Vertragsbedingungen ist die
Abrechnungsadresse, nicht der Standort der Werkstätten. Ohne bestätigte verbleibende
kostenlose SKU-Menge werden keine Google-API-Proben oder täglichen Recherche-API-
Aufrufe ausgeführt; Recherche nutzt dann offizielle Maps-Oberflächen oder wird
zurückgestellt. Keine kostenpflichtigen Pläne, Projekte oder Zusatzdienste aktivieren.

## Beobachteter Betriebsnachweis vom 11.10.2026

Im angemeldeten Google-Cloud-Projekt `riparim-510521` wurden Nutzung, Preise
und Konfiguration lesend geprüft; anschließend wurden ausschließlich die unten
belegten Quoten/Referrer angepasst. Es wurden keine Dienste, kostenpflichtigen
Tarife oder Providerproben aktiviert.

| Quelle / Zeitraum | Tatsächlich beobachtet | Aussagegrenze |
| --- | --- | --- |
| API-Dashboard, 10.10.2026 00:42:26 UTC bis 11.10.2026 00:42:26 UTC, Auswahl „1 Tag“ | Places API (New): 143 Requests; Places UI Kit API: 1 Request; angezeigte Fehler: 0 | API-Aggregate, keine SKU-/Billing-Zuordnung oder getrennte Vorher-/Nachher-Messung |
| API-Dashboard, gleicher Zeitraum | Maps JavaScript API aktiv, Requestanzeige „—“ | Kein belegter Nullverbrauch |
| Billing-Kontoübersicht, aktueller Monat 01.–11.10.2026 | Gesamtkosten 2,73 CHF; Einsparungen 0,00 CHF; Konto bereits als „Kostenpflichtiges Konto“ geführt | Kontogesamtsumme, noch kein Nachweis von Riparim-Projekt-/SKU-Kosten, Freimengen oder Vertragsregion |

Der kontoweite tabellarische Bericht **„SKUs – diesen Monat“** hat den sichtbaren
Datenstand **01.–10.10.2026** und umfasst neun SKU-Zeilen aus drei Diensten:

| SKU | SKU-ID | Nutzungsmenge („count“) | Angezeigte Kosten |
| --- | --- | ---: | ---: |
| Place Details Enterprise | `2D9A-3DE0-3766` | 1164 | 2,73 CHF |
| Places UI Kit Query | `0678-4F72-DA7C` | 37 | 0,00 CHF |
| Text Search Pro | `4FDA-34B1-A910` | 1 | 0,00 CHF |
| Place Details Essentials IDs Only | `5C36-E272-E88F` | 2 | 0,00 CHF |
| Text Search Essentials IDs Only | `635D-A9DD-C520` | 1 | 0,00 CHF |
| Place Details Essentials | `6E05-E1C3-8D85` | 126 | 0,00 CHF |
| Place Details Photos | `DCD1-FE97-8C71` | 144 | 0,00 CHF |
| Text Search Enterprise | `E967-44BC-B44D` | 472 | 0,00 CHF |
| Dynamic Maps | `FAF4-3B2D-51B2` | 1 | 0,00 CHF |

Dies sind **tatsächlich im Billing-Bericht angezeigte Mengen und Kosten**, keine
Preisfallrechnung. Die 2,73 CHF sind im Bericht Enterprise Details zugeordnet;
die separate Projekt-Billing-Tabelle führt für denselben Zeitraum ausschließlich
Riparim (`riparim-510521`) mit 2,73 CHF auf. Eine Pro-UI-Kit-Zeile war in dieser
Tabelle nicht vorhanden; daraus wird kein Nullverbrauch abgeleitet. Die
Billing-Übersicht reicht bis 11.10., der sichtbare SKU-Datenstand nur bis 10.10.;
eine Nachher-Abrechnung von #94/#95 ist damit noch nicht nachgewiesen. Kostenlose
Zeilen belegen keine verbleibende Freimenge für eine weitere Probe. Währung und
Kontostatus belegen weder eine einzelne SKU-Preisstaffel noch die
Abrechnungsadresse. Der bestehende Kontotarif wurde nicht aktiviert oder
geändert. Ohne bestätigte freie Restmenge werden keine zusätzlichen potenziell
kostenpflichtigen API-Abfragen zur Messung ausgeführt.

Die Zahlungseinstellungen bestätigen als **Abrechnungsland Schweiz (CH)**.
Es wurden keine Adresse oder Zahlungsdaten übernommen. Die konto-eigene
**Preise**-Tabelle zeigt folgende aktuelle Default-Listenpreisstufen in CHF pro
1000 Ereignisse (gerundet); ein Sonderrabatt ist nicht belegt:

| Relevante SKU | Kostenfreie Stufe laut Kontotabelle | Erste bezahlte Stufe, CHF/1000 |
| --- | --- | ---: |
| Standard UI Kit Query | bis 10000 Monatsereignisse | 0,83185 |
| Place Details Enterprise | bis 1000 | 16,637 |
| Place Details Photos | bis 1000 | 5,82295 |
| Text Search Enterprise | bis 1000 | 29,11475 |
| Dynamic Maps | bis 10000 | 5,82295 |
| Place Details Essentials | bis 10000 | 4,15925 |
| Details / Text Search Essentials IDs Only | Tabellenpreis ab Ereignis 0 jeweils 0 CHF, Einheit 1 | 0 |

Diese Kontopreisstufen ersetzen globale USD-Modellpreise. Die bereits berichteten
1164 Enterprise-Details-Ereignisse liegen oberhalb der kostenfreien 1000; für
diese SKU ist im aktuellen Monat keine kostenfreie Restmenge belegt. Die
tatsächlich berichteten 2,73 CHF bleiben eine eigene Beobachtung, keine aus der
Preistabelle errechnete Rechnung. Preisstufen, Billing-Nachlauf und andere
Verbraucher des Abrechnungskontos müssen vor weiteren Live-Proben erneut geprüft
werden; kostenlose Zeilen allein sind keine Freigabe zusätzlicher Aufrufe.

Der aktuelle **Budgets & caps**-Bildschirm enthält keine Budgetzeilen; eine
wirksame Budgetwarnung oder automatische Abschaltung ist damit nicht belegt.
Die aktuelle Budget-Form enthält zusätzlich eine Option **„Erzwingung der
Ausgabenobergrenze“**, aber ihre auswählbaren Dienste sind ausschließlich
Cloud Run, Cloud Run Functions, Gemini API und Vertex AI. Maps/Places sind nicht
wählbar. Dieser ungespeicherte Entwurf wurde nach lesender Prüfung abgebrochen;
keine Budgets, Caps, Alerts, automatischen E-Mails, Pub/Sub-, BigQuery- oder
Cloud-Run-Dienste wurden angelegt. Ein Benachrichtigungsbudget ohne wirksame
Erzwingung stoppt keine Maps-Nutzung. Der gewählte Warnweg bleibt tägliche manuelle
Billingprüfung gegen die zuletzt belegten 2,73 CHF und deren SKU-/Ereignisdatum;
Reporting-Verzug darf nicht als aktueller Neuverbrauch ausgegeben werden.
Manuelle Warnschwellen sind 50/80/100 % der bestätigten freien SKU-Menge:
Enterprise Details/Text Search Enterprise/Fotos 500/800/1000, Standard-UI-Kit
5000/8000/10000. Bei 80 % Restmenge/Verzug/Tagesgrenzen prüfen, bei 100 % den
betreffenden API-Pfad pausieren; Enterprise Details liegt mit 1164 bereits
oberhalb 100 %, die Browserpause ist unten dokumentiert. Jede Erhöhung gegenüber
2,73 CHF wird separat anhand Ereignisdatum und Reporting-Verzug geprüft. Dies
sind manuelle Beobachtungsgrenzen, keine angelegten Budgetalarme oder Geldbudgets.
Folgende Places-API-(New)-Quoten waren im UI als anpassbar angezeigt; die
Tabelle hält den **Vorher-Zustand und Rückweg** fest:

| Methode | Vorherlimit pro Tag | Nutzung bei Erstprüfung | Vorherlimit pro Minute |
| --- | ---: | ---: | ---: |
| GetPlaceRequest | 125000 | 97 | 600 |
| SearchTextRequest | 75000 | 45 | 600 |
| PhotoMedia | 175000 | 1 | 600 |

Die angezeigte Minuten-Nutzung war jeweils null; das ist keine Monatsnutzung.
Diese großzügigen Vorherlimits sind keine Zusicherung kostenloser Nutzung. Andere
aktivierte Quoten und Dienste wurden nicht verändert. Die Quotenzahlen ersetzen den Konto-Preisstufen-/Vertragsregionsnachweis und
die Prüfung von Billing-Nachlauf nicht.

Die generische **IAM-Quotenansicht** mit dem Dienstfilter
`placewidgets.googleapis.com` belegt die UI-Kit-Quoten. Der produktspezifische
Maps-Quotenlink leitete auf „alle Maps APIs“ und wird deshalb nicht als Nachweis
einer UI-Kit-Grenze verwendet. Der ebenfalls anpassbare UI-Kit-Vorherzustand lautete:

| UI-Kit-Methode | Vorherlimit pro Tag | Nutzung bei Erstprüfung | Vorherlimit pro Minute |
| --- | ---: | ---: | ---: |
| Query Requests (Standard) | Unbegrenzt | 1 | 6000 |
| Advanced Requests | 8000 | 0 | Unbegrenzt |
| Sessions | Unbegrenzt | 0 | 6000 |

Die oben gelesene konto-eigene Standard-Query-Preisstufe nennt 10000 freie
Monatsereignisse; Billing-Nachlauf und andere Verbraucher bleiben bei der
Restmengenprüfung zu berücksichtigen. Die gewählten Grenzen Standard/Tag 30, Advanced/Tag 0 und
Sessions/Tag 0 schützen die aktuelle ausschließliche Standard-Nutzung und sperren
ungenutzte Pro-/Autocomplete-Wege. Diese drei Tageslimits wurden anschließend in GCP gespeichert; die Oberfläche
bestätigte drei aktualisierte Limits und zeigte Standard **30**, Advanced **0**,
Sessions **0**. Die Minutenwerte blieben 6000/Unbegrenzt/6000. Eine exakte
Write-Zeit wurde nicht aufgezeichnet; der frische persistierte Readback um
**11.10.2026 01:07:43 UTC** bestätigt diese drei Werte nach Propagationszeit. Die alten Werte dienen dem Rückweg. Nach Ausschöpfen des kleinen
Standard-Tageslimits steht der Maps-Fallback statt einer Nullbewertung bereit.

Am **11.10.2026** wurde
**GetPlaceRequest pro Tag von 125000 auf 0** reduziert. Die native GCP-Form
akzeptierte den Wert, bestätigte eine Reduktion um 100 % und meldete, dass das
angeforderte Limit aktualisiert wurde. Der Tabellen-Readback zeigt **0 mit
Override**; der bereits erfolgte Tagesverbrauch 97 bleibt als Historie sichtbar.
Es wurde keine echte Places-Abfrage zur Gegenprobe ausgeführt. Die erneute
lesende Kontrolle um **11.10.2026 01:10:06 UTC** bestätigt GetPlace **0**,
SearchText **20** und PhotoMedia **20** nach Propagationszeit. Eine
vollständige globale Sperrwirkung wird damit nicht behauptet.

Diese manuelle GetPlace-Sperre betrifft REST-Foto-Metadaten
(auch Essentials IDs Only) und serverseitige ergänzende Land-Details; unklare
Neuveröffentlichungen werden zurückgestellt. Bestehende eigene Profile,
Bewertungen und bestätigte Maps-/Routenlinks bleiben nutzbar. Alte Browser können
bereits geladene Anzeigen behalten. Andere Methoden, insbesondere Text Search,
PhotoMedia, UI-Kit und Maps-Produkte, werden dadurch nicht als abgeschaltet
behauptet. Die Sperre ist auch für SDK-Einzelratings vorgesehen; die genaue
Durchsetzung von `Place.fetchFields` über die GetPlace-Tagesquote wurde jedoch
nicht durch eine Live-Probe belegt. Die amtliche
[Maps-JavaScript-Nutzungsdokumentation](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
führt die neuen Places-Library-SKUs separat auf und bestätigt, dass UI-Kit-
Unteranfragen an Places/Geocoding deren Projektquoten nicht verbrauchen. UI-Kit
bleibt daher durch seine eigenen Quoten begrenzt. Die
[Places-Nutzungsdokumentation](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
beschreibt getrennte Methodquoten für Places (New), belegt aber allein nicht die
SDK-GetPlace-Durchsetzung. Es gibt keine automatische Monats-Wiederaktivierung oder allgemeine
Geldobergrenze; Wiederanhebung erfordert manuelle Prüfung von Billing-Reset,
Verzug, verbleibender kostenloser Menge und anderen Verbrauchern. SearchTextRequest/Tag **20** und PhotoMedia/Tag **20** wurden anschließend mit
Erfolgsbestätigung gespeichert. Die ersten Tabellen zeigten noch alte Werte;
der vorgenannte frische Readback bestätigt beide Werte. Die gespeicherten
UI-Kit-Tagesgrenzen stehen oben.

Die Browser-Key-Detailseite zeigte vor den Änderungen **Website-Beschränkung** und ausschließlich
**Maps JavaScript API, Places API (New), Places UI Kit API**. Die sieben ursprünglichen
Referrer waren `https://riparim.com/*`,
`https://mjeshter-kosovo.r-loki.chatgpt.site/*`, `http://127.0.0.1`,
`http://127.0.0.1:5175/*`, `http://127.0.0.1/*`, `http://localhost`,
`http://localhost/*`. Es gibt keine allgemeine Domain-Wildcard und keinen
`www`-Eintrag. Legacy-Sites und Loopback sind für die aktuelle Produktion nicht
benötigt; eine Reduktion erfordert vorher sichere Zuordnung zum tatsächlich
ausgelieferten Runtime-Browser-Key und Sicherung der alten Liste. Ein zusätzlicher
Host wird nur bei belegter Notwendigkeit freigegeben; ein Redirect allein benötigt
keinen Google-Referrer. Die Server-Key-Liste zeigt ausschließlich Places API (New);
die Detailseite bestätigt diese eine API und keine Anwendungsbeschränkung.
Feste Cloudflare-Ausgangs-IPs sind nicht belegt. Die Übereinstimmung des
Produktions-Browser-Keys aus der Konfigurationsroute mit dem benannten GCP-Key
wurde ausschließlich per In-Memory-SHA-256-Vergleich bestätigt; keine
Schlüsselwerte oder Hashes werden dokumentiert. Anschließend wurden genau die sechs Legacy-/Loopback-Referrer entfernt und
ausschließlich **`https://riparim.com/*`** gespeichert. Eine erneute Navigation
von der Credentials-Liste in den Key zeigte nur diesen einen Referrer bei
unverändert drei APIs. Die Speicherprüfung ist per Tool-Uhr **11.10.2026
01:00:33 UTC** belegt; GCP nennt bis zu fünf Minuten Propagation. Der spätere
Readback um **11.10.2026 01:09:12 UTC** bestätigte diesen Apexzustand. Lokale Fixtures benötigen keinen echten
Provider-Key.

### Vorläufige Browserpause statt unbelegter SDK-Sperrgarantie

Der amtliche [Places-Library-Einstieg](https://developers.google.com/maps/documentation/javascript/place-get-started)
nennt Places API sowie Places API (New) für neue Textsuche/Autocomplete; er belegt
keine eindeutige `fetchFields`-Durchsetzung durch GetPlace/Tag. GetPlace 0 allein
ist deshalb keine ausreichend belegte Kostensperre für SDK-Einzelratings. Ohne
potenziell kostenpflichtige Gegenprobe wurde stattdessen der nachweislich
produktiv verwendete Browser-Key kontrolliert **vorläufig pausiert**.

Am **11.10.2026 01:11:45 UTC** wurde der einzige Apex-Referrer durch genau
**`https://riparim-google-paused.invalid/*`** ersetzt, ohne leere Allow-all-Liste,
Key-Löschung/-Rotation oder neue APIs. Frische Navigation aus der Credentials-
Liste und beobachteter Ladevorgang bestätigen im persistierten Detail-Readback
um **01:12:07 UTC** den einen `.invalid`-Referrer und unverändert drei erlaubte
APIs. Die erneute lesende Kontrolle nach fünf Minuten, frühestens **01:16:45 UTC**,
ist vom Konfigurationsbeleg getrennt zu bewerten; dieser Bericht behauptet
keinen beobachteten Live-SDK-Autorisierungsfehler oder vollständigen Kostenstop.

Die Provider-Website-Beschränkung sperrt den regulären Produktionsbrowserpfad
unabhängig von der fraglichen SDK-Methodquote: Einzelratings, Öffnungszeiten,
Rezensionen, Fotoabrufe und Standard-UI-Kit stehen vorläufig nicht bereit. Die
Runtime-Konfiguration bleibt **`enabled:true`**; keine Secrets wurden entfernt.
Eigene Profile/Bewertungen und direkte Maps-/Routenlinks bleiben nutzbar. Bereits
geöffnete Anzeigen, Propagationszeit, Billing-Verzug und separat nutzbarer
Server-Key sind Grenzen; Referrerregeln sind keine allgemeine Geldobergrenze.
Der Serverpfad bleibt separat durch GetPlace 0/SearchText 20 begrenzt und darf
nur mit bestätigter freier Restmenge zur Recherche genutzt werden, sonst Maps UI
oder Rückstellung. Die anderen kleinen Tagesquoten bleiben für eine spätere
kontrollierte Wiederfreigabe bestehen.

Der gezielte Rückweg ist ausschließlich **`https://riparim.com/*`**; die sechs
alten Dev-/Legacy-Referrer bleiben entfernt. Manuelle Aufhebung erst nach
bestätigter kostenloser Restmenge und belastbar nachgewiesener SDK-Quotenwirkung
oder einem anderen bestätigten kostenlosen Anzeigeweg. Kein automatischer
Monatsreset. Nach SDK-Autorisierungsfehlern bewusst neu laden, da das SDK seinen
abgelehnten Ladezustand im offenen Browser beibehält. Die vorhandene sowie
hier ergänzte Offline-Fehlerprüfung belegt eigene Profile/Bewertungen und
Maps-Fallbacks ohne falsche Nullbewertungen oder automatische Retries;
sie ist keine Live-SDK-Probe. Eine reine HTML-Liveprüfung der drei Kataloge und
drei AHP-Profile in DE/SQ/EN ergab HTTP 200/DOCTYPE ohne Cloudflare 1102, aber
führte kein JavaScript und keine Google-Abfrage aus.

Die generische Quotenansicht für **Maps JavaScript (`maps-backend`)** zeigt
Map loads/Tag **Unbegrenzt**, aktuelle Tagesnutzung **0**, pro Minute **30000** und
pro Minute/Nutzer **300**; die Quote ist anpassbar. Anschließend wurde
ausschließlich Map loads/Tag **30** gespeichert und in Erfolgsmeldung/Tabelle
bestätigt (spätestens kontrollierte Tool-Uhr **11.10.2026 01:02:04 UTC**). Andere Maps-/Static-/3D-/Grounding-Methoden werden nicht
verändert. Die aktuelle App initialisiert keine eingebettete Karte; alte
Browser oder Providerinternes können dennoch getrennte Anlässe haben. SDK-Laden
und direkte externe Maps-/Routenlinks werden nicht als Map-Load-Preisereignis
behauptet. Konto-Monatsmenge 1 plus 22 weitere Tagesfenster × 30 ergibt 661
Modellanlässe gegenüber der bestätigten kostenlosen 10000er-Stufe; dies ist
keine echte Nachher-Messung oder Geldgrenze. Der spätere frische Readback
um **11.10.2026 01:07:21 UTC** bestätigt Map loads/Tag **30**;
die Vorherwerte dienen dem Rückweg.

## Begrenzungsmodell und offene Kontrollen

Die umgesetzte GetPlaceRequest/Tag-Sperre **0** bleibt bis zur genannten
Wiederaktivierungsprüfung bestehen. SearchTextRequest/Tag **20**, PhotoMedia/Tag **20** und Standard-UI-Kit/Tag **30**
sind ebenfalls erfolgreich gespeichert und nach Propagationszeit frisch
lesend bestätigt. Die oben dokumentierten Readbacks bestätigen Konfiguration,
keine Live-SDK-Durchsetzung oder vollständige Geldgrenze. GetPlace
0 blockiert bewusst auch kostenfreie Foto-Metadaten und serverseitige
Land-Details; ungeklärte Neuveröffentlichungen werden zurückgestellt. Standard-
UI-Kit ist durch die Browserpause vorläufig ebenfalls nicht verfügbar;
seine eigene Quote ist zusätzliche Absicherung für eine spätere kontrollierte
Wiederfreigabe, keine aktuelle Nutzungsfreigabe. Bei bereits 45 Tages-Suchen bedeutet SearchText 20 einen
bewussten Tagesausfall, keinen stillen Mehrverbrauch.

Zu den bis 10.10. berichteten Mengen werden vorsichtshalber die jeweils
aktuellen Tagesmengen (45 Such-, 1 Foto-, 1 UI-Kit-Anlass) hinzugezählt, auch wenn
sie sich teilweise überschneiden können. Mit weiteren 22 möglichen
Tages-Resetfenstern und den gespeicherten Tagesquoten ergeben sich modellhaft
**957 Text-Search-, 585 Foto- und 698 UI-Kit-Anlässe**. Diese Werte liegen unter
den konto-eigenen kostenfreien Stufen 1000/1000/10000, sofern keine weiteren
unberichteten oder fremden Billing-Verbräuche hinzukommen. Dieses
Modell beschreibt die Tagesquoten unabhängig von der zusätzlichen Browserpause;
es ist keine Rechnung und setzt passende SKU-/Quoten-Zuordnung, bestätigte
Freimengen, berücksichtigte andere Billing-Verbraucher und Zeitgrenzen voraus.
Auch ein späterer vollständiger Monat mit 31 Tagen hätte bei 20/30 Tagesanlässen
620/930 Anlässe; ein automatischer Reset der GetPlace-Sperre wird nicht eingerichtet
oder behauptet. Wiederanhebung erst manuell nach geprüftem Billing-Reset,
Datenverzug und neuer freier Restmenge. Alte Werte aus den Vorhertabellen dienen dem
Rückweg; bei einem Nullkostenauftrag nicht ungeprüft auf diese hohen Grenzen
zurücksetzen. Bereits geladene Browseranzeigen bleiben bis zum Neuladen erhalten,
Anbietersperren können eine Propagationszeit haben.
