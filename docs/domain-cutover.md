# Produktionsdomain und Anmeldung auf den eigenen Worker umstellen

Diese Anleitung führt [#19](https://github.com/ramiz4/riparim/issues/19) nach der
geprüften [Datenübernahme](data-transfer-2026-10-04.md) aus. Sie ist ein
Durchführungsplan, kein Nachweis einer bereits umgestellten Domain. Für den
Abschluss werden die tatsächlich ausgeführten Schritte, Zeiten und Ergebnisse
in einem eigenen Abnahmebericht festgehalten. Private Berichte und Backups
bleiben außerhalb von Git; öffentliche Nachweise enthalten nur Mengen,
Prüfsummen, Ressourcenkennungen und Prüfergebnisse.

Der tatsächlich ausgeführte Wechsel vom 5. Oktober und seine technischen
Prüfergebnisse stehen im [Abnahmebericht](domain-cutover-2026-10-05.md).
Die dort nachgewiesene technische Betreiberabnahme und die gesonderte,
noch offene Rückfallphase für #20 werden getrennt behandelt.

## Ausgangslage und Verantwortung

Bei der Vorbereitung am 4. Oktober 2026 ist Sites-Version 42 mit dem geprüften
Main-Release v1.2.0, Commit `bf0af1913102710925efcadbfa9d3fff7631b694`, wieder
online. Sites ist der einzige produktive Schreibpfad. Der eigene Worker steht
auf `MIGRATION_READ_ONLY=true`; sein zuletzt veröffentlichter Release ist v1.2.5,
Commit `0cdd587af67b54286cae7635c834e1926af3fdde`. Diese Bestände sind seit der
Wiederaufnahme der Quelle nicht dauerhaft synchron.

Der in diesem Chat beauftragte Agent koordiniert Veröffentlichung, Datenabgleich,
Routing und Go/No-Go. Andere laufende Chats dürfen ihre eigenen Änderungen
fertigstellen; sie erhalten dadurch keine zweite produktive Schreibquelle.
Vor dem Domainwechsel müssen der Header-/Start-Fix aus
[#31](https://github.com/ramiz4/riparim/issues/31) und die Produktionsnavigation
aus [#33](https://github.com/ramiz4/riparim/issues/33) integriert, veröffentlicht
und am tatsächlich gebauten Ziel geprüft sein. Die beiden Änderungen sind mit
[PR #34](https://github.com/ramiz4/riparim/pull/34) und
[PR #35](https://github.com/ramiz4/riparim/pull/35) integriert und in v1.2.5
veröffentlicht. Die abschließende Navigation über die Produktionsdomain gehört
weiter zur Abnahme nach der Freigabe des Ziels. Ein offener PR oder ein grüner
lokaler Build ersetzt keinen veröffentlichten Main-Release.

| Ressource | Festes Ziel |
| --- | --- |
| Quell-Site | `appgprj_6abfd028b7e48191822a15d44cbbda8d` |
| Produktionsdomain | `https://riparim.com` |
| Kanonische www-Weiterleitung | `https://www.riparim.com` nach `https://riparim.com`, Pfad und Query erhalten |
| Cloudflare-Account / Worker | `ec181b3a61c7c3da13910600953fc3ea` / `riparim` |
| Ziel-D1 | `riparim-production`, `b395ea3a-5316-4b0b-bdee-533bdb68d6a0` |
| Ziel-R2 | `riparim-evidence-production`, privat |
| Technischer Zielhost | `https://riparim.riparim-ec181b.workers.dev` |

## Vorbereitung bei verfügbarer Quelle

1. Aktuelle Releases, Main-Commit, offene PRs, Deploymentstatus und laufende
   Git-Arbeit neu prüfen. Den Aufgabenbranch aus dem sauberen, frisch geholten
   `main` aktualisieren. Veröffentlichung ausschließlich nach
   [releases.md](releases.md) aus dem geprüften GitHub-Release-Archiv.
2. Die bestehende DNS-Zone vollständig sichern und in der eigenen
   Cloudflare-Zone abgleichen. Apex, www, alle sonstigen Subdomains,
   Mail-/Verifikationsrecords, TTLs, CAA und DNSSEC-Zustand gehören ins Inventar.
   Ein automatischer DNS-Scan ersetzt keinen vollständigen Abgleich. SPF,
   DKIM, DMARC und Sites-Verifikation bleiben bis zur gesonderten Stilllegung
   erhalten. Nameserverwechsel und App-Routing sind getrennte Betriebsentscheidungen:
   zunächst dieselben Sites-Ziele erhalten, während die neue Zone aktiviert wird.
3. Aktive Zone, delegierte Nameserver und HTTPS für Apex sowie www nachweisen.
   Die eigene Zone verwendet `Always Use HTTPS`; HTTP-Anfragen müssen auch
   nach dem Serverwechsel mit unverändertem Pfad und Query auf HTTPS wechseln.
   Die alte Sites-Domainzuordnung wird noch nicht entfernt. Vorbereitungen, die
   einen DNS-Konflikt verursachen oder die bestehende Website unterbrechen
   würden, bleiben außerhalb des laufenden Betriebsfensters.
4. Den eigenen Worker mit `SITE_ORIGIN=https://riparim.com` aus einem geprüften
   Main-Release vorbereiten, zunächst ohne aktives Produktionsrouting. Das Ziel
   bleibt eingefroren. Runtimewerte, D1-/R2-Bindings, Cron und Sicherheitsgrenze
   werden gegen das unveränderte Release-Artefakt geprüft. Einen zweiten PR mit
   genau den beiden Custom Domains `riparim.com` und `www.riparim.com` für Zone
   `cb2470c7a7d49b8a3e6aa3e697c3355e` vorbereiten, reviewen und vollständig prüfen.
   Seine Integration erfolgt erst im finalen Betriebsfenster. Kein Release-Archiv
   und keine generierte `dist/server/wrangler.json` werden nachträglich bearbeitet.
5. Den finalen Abgleich gegen den archivierten Ausgangsstand aus #18 lokal
   vorbereiten. Er muss Quell-Ergänzungen, Änderungen und Löschungen erkennen,
   Zielabweichungen gesondert behandeln und private R2-Objekte einschließlich
   Metadaten/Referenzen vergleichen. Wiederholter Insert-only-Import reicht
   nach der Wiederaufnahme der Quelle nicht aus. Unbekannte Konflikte stoppen
   den Plan. Die Implementierung und ihre Wiederholbarkeit müssen vor der
   öffentlichen Pause mit isolierten Daten geprüft sein. Die geprüften
   Werkzeuge, geschützten Eingaben und die begrenzte Ablaufprojektion stehen
   in [domain-data-delta.md](domain-data-delta.md).

Cloudflare Custom Domains benötigen eine aktive eigene Zone und lassen sich
auf einem Host mit bestehendem CNAME nicht einrichten. Der zum Zeitpunkt der
Vorbereitung vorhandene www-CNAME zu `custom-domains.chatgpt.site` darf deshalb
nicht ungeprüft durch eine zweite Domainzuordnung überlagert werden. Den
konkreten Routingplan nach dem tatsächlichen DNS-/TLS-Inventar festlegen und
vor der Pause vollständig vorbereiten.
[Cloudflare Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

Das Aktivierungs-Deployment benötigt zusätzlich zur bestehenden Worker-/D1-
Berechtigung `Workers Routes Write`, ausschließlich für die Zone von
`riparim.com`. Die aktuelle Rollen-Anleitung verlangt diese Zonenberechtigung
auch für Custom Domains und Worker-Editor-Zugriff; Custom Domains unterstützen
derzeit keine auf einen einzelnen Worker begrenzten Rollen. Ein erfolgreicher
Worker-Code-Deploy beweist diese Berechtigung nicht. Das vorhandene CI-Token
darf erst nach der vorbereiteten Prüfung mit dem konkret nötigen Umfang
versehen werden. Allgemeine DNS-Schreibrechte gehören nicht automatisch zum
App-Deployment. Ein separater DNS-Abgleich kann weiterhin über den Betreiberzugang
erfolgen. Ein noch fehlender Routingzugang ist vor der öffentlichen Pause ein
No-Go.
[Cloudflare Routing-Berechtigungen](https://developers.cloudflare.com/workers/authorization/workers/#routes-and-custom-domains)

Der gepinnte Wrangler setzt beim nichtinteraktiven Custom-Domain-Deployment
die Optionen zum Ersetzen kollidierender DNS-Records und vorhandener Origins.
Deshalb muss die erwartete Änderung aller betroffenen Apex-/www-Records bereits
im Routingplan gesichert und abgeglichen sein. Eine automatische Konfliktauflösung
während der CI-Veröffentlichung ersetzt diesen Plan nicht. Die leere `routes`-
Liste des Vorbereitungs-Releases aktiviert keine Produktionsdomain.

## Konfiguration und Authentifizierung

| Vertrag | Prüfung vor dem Wechsel |
| --- | --- |
| Origin und Routing | Quelle und generiertes Artefakt verwenden dieselbe `SITE_ORIGIN`, dieselben vorgesehenen Routes/Custom Domains und denselben `workers_dev`-/Preview-Zustand. Keine zusätzliche Domain oder fremde Zone. |
| Release-Prüfung | `assertCloudflareDeployConfig` vergleicht auch Routing und Zugriff über technische URLs; verpflanzte oder unerwartete Routings werden abgewiesen. Vars, Cron, Account, Worker, DB und Bucket bleiben geprüft. |
| Auth-Daten | `auth_settings`, Rollen, Sperren, Sessions und bestätigte `auth_links` behalten ihren Supabase-Projektnamensraum. Keine Neuzuordnung anhand gleicher E-Mail. |
| Geschützte Werte | Bestehende Moderatoridentität, `SUPABASE_SECRET_KEY`, beide Google-Schlüssel, Resend-Konfiguration und nötige Aktivierungswerte geschützt übernehmen. Keine Werte im Bericht oder Quellcode; Deployment-Token bleibt außerhalb der Worker-Laufzeit. |
| Öffentliche Auth-Konfiguration | Projektadresse und Publishable-/Anon-Key stammen weiter aus `auth_settings`. Es ist keine neue `NEXT_PUBLIC_*`-Konfiguration oder neue Auth-Projektanlage nötig. Der Verwaltungsendpunkt `/api/auth-settings` bleibt geschützt. |
| Supabase | Site URL `https://riparim.com`; erlaubter App-Callback `/auth/bestaetigen` mit den vorhandenen Rücksprung-/Flow-Parametern. Bestätigungs-/Recovery-Vorlagen verwenden weiter Token-Hash und `.RedirectTo`. Nur den erforderlichen Callback erlauben, keine allgemeine Host-Wildcard. |
| Google OAuth | JavaScript-Origin `https://riparim.com`; Redirect-URI bleibt der Callback des unveränderten Supabase-Projekts. OAuth-Client, Secret und Scopes bleiben bestehen. |
| Google Maps | Browser-Key erlaubt den tatsächlichen HTTPS-Produktionshost; separate API-Beschränkungen bleiben erhalten. Server-Key wird weder ins HTML noch ins Browserbundle ausgegeben. |
| Eigentumsdatei | `/googled8cf505b6c63892b.html` antwortet mit dem unveränderten Verifikationsinhalt über die Produktionsdomain. |
| Private Nachweise | R2 bleibt privat, ohne `r2.dev` und ohne eigene Dateidomain. Eigentümer-, Moderations- und Sperrprüfungen gelten serverseitig. |
| Plattformheader | Der eigene Worker entfernt eingehende `oai-authenticated-user-*`; gefälschte Header bewirken weder Anmeldung noch Moderationsrechte. |

Der Wechsel des Webservers ändert weder den bestehenden Supabase-Provider-
Callback noch die Google-Konten. App-Callbacks entstehen dagegen aus
`siteOrigin()`. Nach Umstellung dieses Wertes laufen sie auf `riparim.com`.
Eine Anmeldung, die auf `workers.dev` beginnt und zur Produktionsdomain
zurückkehrt, ersetzt keine Google-Abnahme: die Flow-/PKCE-Cookies gehören zum
Start-Host. Die endgültige Abnahme muss vollständig auf der Produktionsdomain
erfolgen. Bestehende hostgebundene Cookies auf `riparim.com` sollen beim
Serverwechsel mit unverändertem Auth-Projekt weiter geprüft werden.
[Supabase Redirects](https://supabase.com/docs/guides/auth/redirect-urls),
[Google OAuth mit Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google),
[Google-Schlüsselbeschränkungen](https://developers.google.com/maps/api-security-best-practices)

## Ankündigung und finales Betriebsfenster

Die öffentliche Pause beginnt erst, wenn Vorbereitung, Release und finaler
Abgleich bereit sind. Vor ihrer Aktivierung im Chat ankündigen:

> Issue #19: Die abschließende Datenübernahme beginnt am [Datum] um [Uhrzeit,
> Zeitzone]. Riparim ist dafür voraussichtlich bis [Datum/Uhrzeit, Zeitzone]
> kurz nicht verfügbar. Danach folgt die Prüfung auf dem neuen Server. Bei
> Abweichungen melde ich vor diesem erwarteten Ende den aktuellen Stand und
> den nächsten Schritt.

Die tatsächlichen Werte werden aus dem bereitstehenden Arbeitsplan und der
gemessenen Transferlaufzeit bestimmt. Platzhalter sind keine Ankündigung.
Start, erwartetes Ende, tatsächliche Wiederaufnahme und ein möglicher
Abbruchentscheid werden dokumentiert. Bei Überschreitung der Ankündigung
informieren; eine Wartungssperre darf nicht unbeobachtet bestehen bleiben.

1. Ziel bleibt eingefroren. Die Quellpause einschalten und deren echten
   Wartungsmarker, Release-Identität und `Cache-Control: no-store` prüfen. Auch
   Scheduled-Aufgaben und bisherige Hintergrundarbeiten müssen abgeflossen
   sein. Ein allgemeiner HTTP503-Fehler beweist keine sichere Schreibpause.
2. Frische vollständige Source-/Target-Backups erstellen, Prüfsummen und
   Wiederherstellbarkeit nach [data-transfer.md](data-transfer.md) prüfen.
   Den finalen Dreifachvergleich mit dem verifizierten #18-Ausgangsstand
   erstellen. Keine fremden Änderungen automatisch überschreiben, keine
   Sitzungen oder Geschäftsdaten pauschal ersetzen.
3. Nur den geprüften Änderungsplan anwenden, danach erneut vollständige
   Bestände, Löschungen, private Objekte, Metadaten, Referenzen und Sperren
   abgleichen. Erfolgreiche Wiederholung ist ein No-op. Verlorene Bestätigung
   durch erneuten Abgleich klären; nicht blind erneut schreiben.
4. Go/No-Go protokollieren. Go benötigt den exakten bereitgestellten Release,
   alle Abhängigkeiten, gültige Domain/TLS, identische Auth-Projektidentität,
   erhaltene Admin-/Besitzrechte, konfliktfreien Abschlussabgleich und einen
   ausführbaren Rückweg. Bei No-Go bleibt das Ziel eingefroren. Vor Routing
   kann die unveränderte Quelle gezielt wieder freigegeben werden, sofern
   kein Zielschreibvorgang erfolgt ist und der Quellbestand unverändert blieb.
5. Einmalig die beiden oben festgelegten Custom Domains an den bereits
   geprüften Staging-Release des Workers `riparim` anbinden. Dieser im Main-Runbook
   freigegebene Betriebsschritt verändert dessen Code, DB und Release-Archiv
   nicht. Vorher den vollständigen bestehenden Domain-Satz erneut prüfen:
   unbekannte Worker-Zuordnungen stoppen den Wechsel. Nur die gesicherten
   Sites-Apex-A- und www-CNAME-Ziele dürfen ersetzt werden; Mail- und
   Verifikationseinträge bleiben erhalten. Beide Seiten bleiben eingefroren;
   HTTPS, Apex/www und den erwarteten Wartungsmarker/Release-Commit prüfen.
   Danach den vorbereiteten Routing-PR integrieren. Sein Main-Release übernimmt
   dieselben beiden Domains dauerhaft in Wrangler und muss automatisch auf der
   bereits angebundenen Produktionsdomain deployen. Release, Artefakthash,
   Deployment und tatsächlich ausgelieferten Commit nachweisen. Erst dann das
   Ziel als alleinigen Writer freigeben. Die Quelle bleibt eingefroren,
   auch für Clients mit alten DNS-Antworten und alternative Sites-Zugänge.
6. Sofort Abnahme ausführen. Der technische Workerhost verwendet denselben
   Zielbestand; er darf keine zweite, abweichende Datenquelle öffnen.
   Quelle, Exportzugänge, Domainzuordnungen und gesicherte Artefakte bleiben
   bis #20 kontrolliert erhalten. Zeitlich abgelaufene Exportwerte werden
   nicht mit automatischer Wiederaufnahme der Quellschreibrechte verwechselt.

## Abnahme und Beobachtung

Alle Prüfungen erhalten Zeitpunkt, Host, Release/Commit, erwartetes und
tatsächliches Ergebnis. Produktive Personen-, Token- und Dateidaten werden
nicht aufgezeichnet. Privilegierte Tests verwenden isolierte Konten und klar
abgegrenzte Testdaten; anschließend Bereinigung nachweisen.

- Apex und www: gültiges Zertifikat, HTTPS, erreichbare Root-Seite,
  kanonische Weiterleitung mit erhaltenem Pfad/Query, Google-Verifikationsdatei.
- Tatsächlich ausgeliefertes Produktionsbundle: Logo/Root, Suche,
  Einstellungen, Datenschutz, Konto-/Betriebslinks, Vor-/Zurück-Navigation,
  Prefetch ohne die Fehler aus #33, mobile und Desktop-Header aus #31.
- E-Mail und Google: Login, korrekter Callback/Rücksprung, Logout und
  Sitzungswiderruf. Bestehende Sessions, Sperren, bestätigte Legacy-Links und
  private Eigentumsrechte bleiben korrekt. Eine echte Google-Anmeldung wird
  getrennt von Provider-Fixtures nachgewiesen.
- Verwaltung und Moderation: Rechte, geschützte Konfiguration, offene Fälle,
  zulässiger eigener/admin Dateizugriff und verweigerter fremder/anonymer
  Dateizugriff. Gefälschte Plattformheader bleiben wirkungslos.
- Werkstattsuche/-profile: freigegebene Daten, stabile IDs, Google-Identität,
  Browser-API-Freigaben und Fehlerfallbacks. Kein falscher Entwurf erscheint
  öffentlich, kein Server-Key im Client.
- Erreichbarkeit und Betrieb: App-Fehler, Authfehler, Worker-/DNS-/TLS-Status,
  Scheduled-Benachrichtigungen und einzige Schreibquelle beobachten.
- Nachfolgender geeigneter Main-Release: automatisch erfolgreicher Deploy auf
  derselben Produktionsdomain, unveränderte Bindings/Routes, nachvollziehbarer
  Release-Commit und Archiv-SHA-256. Wiederholung nutzt exakt denselben Release.

Der beauftragte Betreiber führt die technische Abnahme aus und dokumentiert
den tatsächlich beobachteten Zeitraum mit konkretem Start, Ende, Prüfkriterien
und Ergebnis. Der Abschlussbericht nennt beobachtete Fehler, ihre geprüften
Korrekturen und die durchgeführten Fachabläufe. #19 wird nach dieser
nachgewiesenen technischen Betreiberabnahme geschlossen.

Die gesonderte Rückfallphase für #20 bleibt davon unabhängig. Ihr vereinbartes
Ende und die Entscheidung zur Stilllegung werden ausdrücklich dokumentiert,
bevor Veröffentlichung, Domainzuordnungen, Hintergrundabläufe oder alte Zugänge
deaktiviert werden. Eine vorgeschlagene Frist gilt nicht als vereinbartes Ende.
Inventar, geschütztes Archiv und ein reviewbarer Stilllegungsplan können bereits
bei eingefrorener Quelle vorbereitet werden. Rückfallressourcen bleiben bis zur
Freigabe erhalten und sind keine zweite Schreibquelle. Eine endgültige
Ressourcenlöschung benötigt nach Ablauf der Aufbewahrung eine separate Freigabe.

## Wiederherstellung nach dem Routingwechsel

Ein Code-Rollback ändert keine D1-/R2-Daten. Einen zum aktuellen Schema passenden
geprüften Release auf dem eigenen Worker wiederherstellen oder einen geprüften
Forward-Fix über Main veröffentlichen. Die eigene Datenbank bleibt dabei
maßgeblich. Eine neue Konfiguration darf nicht unbemerkt die Wartungssperre
oder das Routing zurücksetzen.
[Cloudflare Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

Falls der Domainverkehr tatsächlich zu Sites zurückgehen muss, zuerst beide
Writer und Hintergrundarbeiten einfrieren und dies belegen. Neue geschützte
Backups beider Seiten sichern. Den seit dem Cutover auf dem Ziel entstandenen
Delta gegen den Cutover-Ausgangsstand planen, alle Einfügungen, Änderungen,
Löschungen und privaten Dateien rückübernehmen und vollständigen Abgleich sowie
Auth-/Berechtigungsprüfung durchführen. Erst danach routen und allein die
Quelle freigeben. Eine ungeprüfte Rückübernahme ist kein verfügbarer Rückweg.
Wenn dieser Rückweg nicht nachweislich durchführbar ist, Zielbestand erhalten
und einen dokumentierten Forward-Fix nutzen. Keine Quelle freigeben, die seit
dem Cutover veraltet ist; kein Datenrestore darf neue Nutzerschreibvorgänge
vernichten.

Der Abnahmebericht hält mindestens Release/Commit/Archivhash und Deployment,
DNS-/TLS-/Routing-Nachweise, angekündigte und tatsächliche Zeiten, geschützte
Backup-/Delta-Referenzen, Go/No-Go mit Verantwortlichem, Fachprüfungen,
technischen Beobachtungszeitraum, Betreiberabnahme und den gesonderten Stand
der Rückfallphase sowie verbleibende Arbeit für #20 fest.
