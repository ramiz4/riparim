# Produktionsumstellung vom 5. Oktober 2026

Dieser Bericht hält die tatsächlich ausgeführte Umstellung aus
[#19](https://github.com/ramiz4/riparim/issues/19) fest. Technische Abnahme,
Nutzerabnahme und Beobachtungsphase werden getrennt nachgewiesen. Die alte
Sites-Instanz bleibt eingefroren erhalten; die Voraussetzungen zum Beginn von #20 sind noch offen.

## Verantwortung und Betriebsfenster

Die Durchführung und der Go/No-Go-Entscheid lagen beim in diesem Chat
beauftragten Agent. Der Nutzer genehmigte ausdrücklich den Ersatz der beiden
Sites-Apex-A-Einträge und des www-CNAME sowie die zusätzliche CI-Berechtigung
`Workers Routes Write` ausschließlich für die eigene Zone von `riparim.com`.

Alle folgenden Ortszeiten gelten für Europe/Belgrade (UTC+02:00).

| Vorgang | Tatsächlicher Zustand |
| --- | --- |
| Erster angekündigter Wechselversuch | 5. Oktober 00:50–01:05; No-Go wegen kollidierender DNS-Einträge und noch ausstehender konkreter Ersatzfreigabe |
| Quelle nach No-Go wieder verfügbar | 01:03:38; keine Domain-/DNS-Änderung und kein Daten-Delta angewendet |
| Zweites angekündigtes Fenster | 5. Oktober 04:45–05:00 |
| Quelle tatsächlich eingefroren | 04:46:21 |
| Neues Ziel als alleiniger Writer geöffnet | 04:57:35; öffentliche Wartung damit beendet |

Die Vorbereitungen und nachfolgenden Codekorrekturen erfolgten bei verfügbarer
Website. Es wurde keine weitere Wartungspause für die Abnahmefixes benötigt.

## Finaler Datenabgleich und Schreibrechte

Die geschützte Datenübernahme aus [#18](data-transfer-2026-10-04.md) wurde nicht
blind wiederholt. Neue vollständige Sicherungen von eingefrorener Quelle und
Ziel wurden gegen den verifizierten Übernahmestand verglichen. Der finale
Abgleich war ein geprüfter No-op: **0 Einfügungen, 0 Änderungen, 0 Löschungen**.
19 logische Tabellen und 386 Zeilen wurden auf jeder Seite inventarisiert.
48 bereits geprüfte Ziel-Metadaten blieben erhalten. Quelle und Ziel enthielten
vor den synthetischen Prüfungen keine privaten R2-Objekte und keine Besuche.

Die vorangegangene technische Auth-Prüfung hatte ausschließlich abgelaufene
`auth_attempts`-Zeilen verändert. Ein geschützter Vorher-/Nachher-Beleg mit festem
Zeitpunkt weist diese begrenzte Abweichung nach. Der Abgleich ignoriert nur
unabhängig belegbar abgelaufene Zeilen für den Vergleich; er stellt keine alten
Zähler wieder her und löscht keine aktiven Limits. Alle übrigen Tabellen und
Spalten stimmten exakt überein. IP-Identität ist mit diesem Beleg nicht bewiesen.

| Geschützter Nachweis | Kennung / SHA-256 |
| --- | --- |
| Finaler Delta-Bericht | `8aaaf863-ab64-462e-b49c-341815beedd1` |
| Source-Sicherung | `domain-source-e3eeddf6-86e7-434e-9eaf-0cd972a976eb` |
| Ziel vor Abgleich | `domain-target-527a4b08-41f2-4272-93b0-03ef1b2be587` |
| Ziel nach Abgleich | `domain-target-complete-90fbf0c5-d896-4be1-8c7d-2a975fdf1c6e` |
| Vollständiger Ziel-Fingerprint vor Wiederaufnahme | `5ae859d9af4a45ed83fe3a6e6123d7848b9742a6a0a8fc32926a16df58ac9922` |
| Begrenzter Ablaufbeleg | `1fcf2a2537f45b7d68a4c821bca26a59c2ae44fb2f4f694568e3db5dd190ebb4` |

Diese Sicherungen, private Konfiguration und Testjournale liegen geschützt
außerhalb von Git. Die vollständige Wiederherstellung wurde lokal geprüft.
Seit der Wiederaufnahme ist der eigene D1-/R2-Bestand maßgeblich; spätere
Anmeldungen, reguläre Google-Metadaten und Nutzerschreibvorgänge sind kein Anlass,
den alten Fingerprint erneut durch Restore zu erzwingen.

Das eigene Ziel steht auf `MIGRATION_READ_ONLY=false`. Die alte Site steht
dauerhaft auf `true`, Umgebungsrevision 17; auch ihr Scheduled-Handler überspringt
Schreibarbeit. Die generierte alte URL antwortet mit HTTP 503 und `no-store`.
Das Ablaufen des geschützten Exportzugangs öffnet die Quellschreibrechte nicht.

## Domain, Ressourcen und Release-Nachweise

Die eigene aktive Zone `cb2470c7a7d49b8a3e6aa3e697c3355e` verwendet
`bailey.ns.cloudflare.com` und `ignacio.ns.cloudflare.com`. Ausschließlich die
drei freigegebenen Web-DNS-Einträge wurden ersetzt; acht Mail- und
Verifikationseinträge blieben erhalten. Apex und www sind aktivierte Custom
Domains des Workers `riparim`, ohne Preview. TLS ist aktiv, HTTP wird auf HTTPS
umgeleitet und www erhält Pfad und Query bei der Weiterleitung auf den Apex.

| Ressource | Produktives Ziel |
| --- | --- |
| Cloudflare-Account | `ec181b3a61c7c3da13910600953fc3ea` |
| Origin | `https://riparim.com` |
| D1 | `riparim-production`, `b395ea3a-5316-4b0b-bdee-533bdb68d6a0` |
| R2 | `riparim-evidence-production`, privat; kein r2.dev / keine Dateidomain |
| Scheduled-Handler | `*/5 * * * *` |
| Technischer Workerhost | gleicher Code und gleicher Zielbestand, keine zweite Datenquelle |

Das bestehende Supabase-Projekt und sein Identitätsnamensraum bleiben erhalten.
Projektadresse, öffentliche Auth-Konfiguration und aktivierter Zustand wurden
geschützt zwischen Source-Sicherung und produktiver `auth_settings`-Zeile
abgeglichen. Site URL und erlaubter App-Callback berücksichtigen riparim.com;
Google-Provider-Callback, Client und Scopes bleiben bestehen. Moderatoridentität,
Supabase-Verwaltungszugang, beide Google-Schlüssel und Resend-Werte wurden als
geschützte Laufzeitwerte übernommen. Der Deployment-Token ist kein Worker-Secret.
Echte Google-Verwaltung und produktive Anmeldung bestätigen die Übernahme.

| Geprüfter Main-Release | Commit | Archiv-SHA-256 | Automatischer Lauf |
| --- | --- | --- | --- |
| v1.2.6, Vorbereitung | `130d5d4db6f0cfe6d874f1112bd362200973f6b6` | `91a5388e883f4a5cd30727c038f7605836d73b675efc9fdd0ec9ddcb0eb3fc7c` | [37239579311](https://github.com/ramiz4/riparim/actions/runs/37239579311) |
| v1.2.7, dauerhaftes Routing | `2934a3fb70d4ca384aa9f75e0773a8a8be9e6597` | `96002104ce24969b5db063fff70b4a1b062cfe7c82be2abd996d3454b92afc21` | [37257149551](https://github.com/ramiz4/riparim/actions/runs/37257149551) |
| v1.2.8, Callback-Datenschutz | `527d37d83c4d88dcb4100556941ce0207dc25763` | `cfe56aa950b331b07107ebd0f6e46aca4929c9a1086abe8da9d0b01e874087e9` | [37259289616](https://github.com/ramiz4/riparim/actions/runs/37259289616) |
| v1.2.9, exakte Eigentumsdatei | `53ae6ce7a896e779b75e5f249d25b7993c8c12d4` | `f3bd2b57c03e7f42c192bbdde92f4d0ebb17b6ee3a7984bfd30b83a2093a1353` | [37260211387](https://github.com/ramiz4/riparim/actions/runs/37260211387) |

Nach dem kontrollierten Domainwechsel veröffentlichte bereits v1.2.7 automatisch
auf derselben Produktionsdomain. v1.2.8 belegt eine weitere automatische
Veröffentlichung bei verfügbarer Website. Ausgelieferter Commit, Release-
Provenienz und Archivhash wurden unabhängig geprüft. Die Quelle blieb auf
Sites-Version 42, geprüftem v1.2.0 / `bf0af1913102710925efcadbfa9d3fff7631b694`.

## Tatsächliche Prüfung und entdeckte Abweichungen

- Echte Google-Anmeldung vollständig auf riparim.com: erwarteter Rücksprung zu
  `/werkstaetten?ort=prishtina`, 18 passende Werkstätten, vorhandener
  Verwaltungszugang. Anschließende echte Abmeldung führte zur Gast-Anmeldeseite.
- Navigation im veröffentlichten Bundle: Suche, Werkstattprofil per Tastatur,
  Foto öffnen und Escape, erhaltener Suchfilter, Einstellungen, Datenschutz und
  Browser Vor-/Zurück. Kein Fehler aus #33 im Browserlog.
- Mobil 390 × 844, dunkles Theme und Desktop 1280 × 900, helles Theme: kein
  horizontaler Überlauf; Beschriftungen und Anmeldung/Navigation sichtbar.
  Die temporäre Viewport-Einstellung wurde anschließend zurückgesetzt.
- Verwaltung und Moderationsansicht mit vorhandenem Google-Zugang schreibfrei
  geöffnet; keine echte Bewertung oder Benutzerverwaltung verändert.
- Gefundener Callback-Fehler: der gemeinsame Proxy überschrieb `no-referrer`.
  [PR #38](https://github.com/ramiz4/riparim/pull/38) korrigierte beide Pfade und
  Cookie-Refresh. Produktiv geprüft: Signup-, Recovery- und Google-Fehlercallback
  HTTP 303, `no-referrer`, `no-store`, kanonisches erhaltenes Rücksprungziel.
- Gefundene statische Weiterleitung: die Eigentumsdatei erhielt HTTP 307 statt
  direkter HTTP 200. [PR #39](https://github.com/ramiz4/riparim/pull/39) korrigiert
  die Cloudflare-HTML-Normalisierung und erzwingt denselben Vertrag im Release.
  Die native Miniflare-Regression reproduzierte den Fehler und prüft GET/HEAD,
  unveränderte Bytes, dynamische Root-Seite und fehlende Dateien.

Die beiden Codekorrekturen haben Standards-/Spec-Reviews, vollständige Tests,
TypeScript, Katalogprüfung, Lint sowie Cloudflare-/Sites-Build und Packaging
bestanden. Lint behält sieben bestehende Warnungen ohne Fehler.

v1.2.9 wurde am 5. Oktober um 05:41:24 automatisch veröffentlicht, Deployment
`961b802f-0987-47aa-99e8-af5165a6ba67`, Version
`c4d865d2-3702-402f-993c-54c568083ecb` mit 100 Prozent Verkehr.
Apex und technischer Host lieferten HTTP 200 und den gebackenen Main-Commit.
Die Eigentumsdatei lieferte direkt HTTP 200 für GET und HEAD, ohne Location;
GET enthielt die unveränderten Verifikationsbytes. Drei HTTP-/www-Prüfungen
bestätigten HTTPS und den erhaltenen Suchpfad mit Query.

Die endgültige Produktionsprüfung begann am 5. Oktober um 05:42:31.
**Fünf Produktions-Vorabprüfungen und 15 Auth-/Privatdateiprüfungen bestanden.**
Drei markierte, zufällige Testkonten wurden bestätigt angelegt und über den
produktiven E-Mail-/Passwort-Endpunkt angemeldet. Die Vorabprüfungen benutzen
ungültige/fehlende Callback-Tokens; sie bestätigen keine neue E-Mail-Zustellung.
Echte Google-Anmeldung und Rücksprung sind separat oben nachgewiesen.

Geprüft wurden anonyme und gefälschte Sites-Identität, verweigerte Kundenrechte
auf Verwaltungsendpunkten, echte Adminrechte, privater Pending-Besuch mit
synthetischer PNG-Datei, eigener/Admin-Dateizugriff, verweigerter fremder und
anonymer Zugriff, Ausschluss aus öffentlichen Bewertungen, kein Versandereignis
für den Pending-Besuch, Sitzungswiderruf bei Sperre und Abmeldung sowie nötige
neue Anmeldung nach Entsperrung. Keine echte Bewertung wurde moderiert; die
Entscheidungs-/Benachrichtigungsverträge sind durch isolierte Tests abgedeckt.
Bestätigte Legacy-Verknüpfungen wurden im finalen Bestand mitgezählt: null
bestehende Datensätze; die Zuordnungs- und Besitzrechte sind in Fixtures geprüft.

**Bereinigung bestätigt:** alle drei Testkonten, ihre Rollen/Status/Sessions,
der Pending-Besuch und seine private Datei wurden entfernt. Null verbleibende
Testkonten, null Bereinigungsfehler; privates R2-Inventar anschließend null
Objekte. D1 enthielt anschließend null Besuche, Upload-Reservierungen und
Versandereignisse; 163 Werkstätten, davon 78 freigegeben, blieben vorhanden.
Bestehende gemeinsame IP-Limits blieben erhalten. Es wurden keine
echten E-Mails versandt. Das geschützte Journal trägt die Kennung
`3cce58df-259a-4461-9d0f-79a0e298feac`.

## Beobachtung, Abnahme und Rückfall

Erste tatsächliche Beobachtung: 5. Oktober 04:57:35 bis 05:36:06. Die
Cloudflare-Aggregate zeigen 230 Fetch- und acht Scheduled-Aufrufe mit Outcome
`ok`, keine HTTP-5xx. 86 HTTP-404 betrafen automatisierte Aufrufe nicht vorhandener
Git-/Umgebungs-/Konfigurationsdateien, WordPress und `.well-known/ucp`; keine
geprüfte App-Seite war darunter. Im Browser wurden keine Navigations- oder
Google-Autorisierungsfehler erfasst. Dies belegt den genannten Zeitraum, keine
beliebige künftige Verfügbarkeit. Es wurden nur Mengen und Kategorien gespeichert.

**Nutzerabnahme und vereinbartes Ende der Beobachtungs-/Rückfallphase sind noch
offen.** #19 bleibt offen; die alte Site und alle benötigten Sicherungen bleiben
erhalten. #20 beginnt erst nach diesen Voraussetzungen.

Ein Codefehler wird bevorzugt durch einen geprüften Forward-Fix über Main
behoben; die erfolgreichen Abnahmefixes zeigen diesen Weg bereits produktiv.
Ein Code-Rollback setzt keine D1-/R2-Daten zurück. Zur alten Site darf erst nach
einer angekündigten Schreibpause beider Seiten, neuen Sicherungen, vollständiger
Rückübernahme aller seit dem Wechsel entstandenen Änderungen/Löschungen/Dateien
und erneutem Auth-/Berechtigungsabgleich geroutet werden. Ungeprüftes Zurückrouten
auf die eingefrorene alte Datenbank ist kein freigegebener Rückweg.

Nach Ende der vereinbarten Phase folgen in #20 Inventar, Archiv/Retention,
gewünschtes Verhalten alter URLs, kontrolliertes Deaktivieren von Veröffentlichung,
Domainzuordnungen und alten Hintergrundarbeiten sowie gezielter Widerruf
ausschließlich alter Zugänge. Gemeinsam genutzte Supabase-/Google-/Maildienste
bleiben bestehen. Eine endgültige Ressourcenlöschung benötigt nach Ablauf der
Aufbewahrung eine separate Freigabe.
