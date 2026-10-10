# Unabhängige Prüfung des statischen öffentlichen Releases

**Aktueller Abschlussstand 11.10.2026:** Die vier nachfolgend historisch
dokumentierten konkreten Befunde sind korrigiert. Die abschließende Codeprüfung
hat keine weiteren konkreten Fehler ergeben. Gezielte Import-/Healthprüfungen
und der Katalogcheck mit 160 Datensätzen bestanden. Finaler Build, vollständige
CI und die tatsächliche Main-Release-/Live-Abnahme stehen noch aus; diese
Aussage ist keine Veröffentlichungsbestätigung.

Stand: 10.10.2026. Geprüfte Basis: `2d593346c2337f827801835787bd4f4424da5ccc`;
uncommittierter Diff einschließlich neuer Dateien im Aufgaben-Worktree
`codex/daily-workshop-import`. Die Prüfung änderte ausschließlich diesen Bericht.

## Befunde

### P1: Eine einzelne Adminänderung schaltet alle öffentlichen Snapshots ab

[`servePublicRelease`](../lib/public-release-routing.ts#L16) vergleicht bei jedem
Profilabruf die gesamte veröffentlichte Live-ID-/Revisionsliste mit der
Releasequelle. Ändert der Admin ein einziges Profil oder blendet es aus, liefert
auch jedes andere, unveränderte Profil `null` und wird anschließend vom
[SSR-Handler](../build/cloudflare-worker.ts#L16) gerendert. Der Katalog benötigt
eine Bestandsprüfung; die unveränderten Einzelprofile werden dadurch jedoch
unnötig ebenfalls vollständig auf den bekannten problematischen Pfad gesetzt.

Die unabhängige Probe bündelte das Routingmodul mit zwei Releaseprofilen und
änderte ausschließlich die Live-Revision des ersten Profils. Der Aufruf des
zweiten, unveränderten Profils ergab tatsächlich:

```json
{"untouchedProfileStaticResponse":null,"assetFetches":0}
```

Die [Einrichtungsdokumentation](daily-workshop-import.md#vorprüfung-und-kostenfreier-betrieb)
hält bereits bestätigte `exceededCpu`/1102 bei öffentlichem SSR unter Workers Free
fest. Damit kann eine normale Adminänderung den Verfügbarkeitsgewinn für den
gesamten Bestand zurücknehmen. Das konkrete erneute Auftreten von 1102 nach
dieser Änderung wurde in dieser unabhängigen Prüfung nicht live gemessen.

Für Einzelprofile mindestens die Revision und Veröffentlichung der angefragten
ID prüfen und deren nicht betroffene Snapshots weiter bedienen. Für tatsächlich
veränderte Profile sowie den Katalog einen unter dem Free-Limit geprüften
Aktualitätspfad schaffen; bloßer Rückfall auf den nachweislich zu teuren
SSR-Leser stellt die gewünschte kostenfreie Verfügbarkeit nicht sicher.

### P2: Dynamische Profilseiten übernehmen neue Review-Props nicht mehr

[`WorkshopProfile`](../app/[locale]/werkstatt/[id]/profile.tsx#L35) kopiert
`initialReviews` und `initialReviewError` jetzt einmal in React-State. Das
Rendering verwendet diesen State auch bei `publicSnapshot=false`. Anders als
bei `workshop`, `directory` und `display` gibt es für den dynamischen Pfad keinen
Rückgriff auf aktualisierte Props. Der vorhandene
[`onSubmitted`-Callback](../app/[locale]/werkstatt/[id]/profile.tsx#L73) verwendet
für diesen Pfad weiterhin `router.refresh()`.

Unabhängige React-/JSDOM-Probe: dieselbe montierte dynamische Profilkomponente
zuerst mit `reviews=[]`, danach mit einer neuen freigegebenen Bewertung in den
Props rendern. Tatsächliches Ergebnis:

```json
{"updatedReviewPresent":false,"emptyReviewMessagePresent":true}
```

Damit bleiben Bewertungen und Fehler vom ersten Render sichtbar, obwohl neue
Serverdaten vorliegen. Nur der Snapshotpfad sollte die nachgeladenen
Review-States verwenden; dynamische Profile müssen aktualisierte Serverprops
weiterhin unmittelbar übernehmen. Diesen Übergang als Regression prüfen.

## Vor Aktivierung noch zu belegen

- Ein Release mit neuen Canonicalprofilen passt zunächst nicht zu den alten
  Live-D1-Revisionen. Der statische Guard fällt vor
  [`ensureInitialCatalog`](../db/directory.ts#L23) in den dynamischen Leser zurück.
  Der erste vollständige Import validiert den gesamten Katalog und schreibt
  mehrere Batches. Sein tatsächlicher CPU-Verbrauch unter Workers Free ist
  zusätzlich zum warmen Snapshotpfad zu prüfen. Ohne diese Messung ist ein
  erfolgreicher lokaler Renderer kein Nachweis für tägliche Liveimports.
- Der neue [Worker-Integrationstest](../tests/public-release-worker.test.mjs#L12)
  verwendet globales `invoke_user_worker_ahead_of_assets: true`, während
  Produktion [selektive Muster](../wrangler.jsonc#L8) verwendet. Die konkrete
  Produktionskonfiguration einschließlich `html_handling: none`, GET/HEAD,
  interner Assetpfade und RSC muss separat geprüft werden. Meine zusätzliche
  Miniflare-Probe mit selektiven Mustern lieferte innerhalb der begrenzten
  Wartezeit kein Ergebnis und wurde beendet; dies ist kein Router-Erfolgsnachweis
  und kein bestätigter Routerfehler.
- Die [Livevorprüfung](../scripts/daily-workshop-import.mjs#L39) prüft Locale,
  vollständiges HTML und H1, aber nicht die tatsächlich gelieferte Profil-ID.
  Für die Abnahme neuer Profile zusätzlich `data-workshop-id` gegen die
  angefragte ID sowie Release-Commit/Snapshotheader abgleichen.

## Untersuchte Sicherheits- und Releaseverträge

Der [Renderer](../scripts/render-public-release.mjs#L11) verwendet isolierte
D1-/R2-Bindings und blockiert ausgehenden Providerzugriff. Er rendert ausschließlich
veröffentlichte Canonical-IDs in DE/SQ/EN. Der interne Renderoverride ist eine
lokale Bindingvariable, kein durch HTTP-Header aktivierbarer Bypass. Ein
zusätzlicher Produktionswert `PUBLIC_RELEASE_RENDER` ist in der geprüften
Wranglerquelle nicht enthalten. Die [Sessionroute](../app/api/session/route.ts#L4)
verwendet die bestehende serverseitige Nutzer-/Adminprüfung und den
[`no-store`-JSONvertrag](../lib/http.ts#L1). Die vorhandene Reviewroute liest nur
freigegebene Besuche veröffentlichter Werkstätten. Kein konkretes neues
Offenlegen privater Besuchsnachweise wurde festgestellt.

Die entfernte Runtime-Schemavalidierung für unveränderliche Quellen wird durch
die bestehenden [CI-Katalogchecks](../.github/workflows/ci.yml#L45) ergänzt;
tatsächliche Erstimports behalten die vollständige Validierung und Revisionen.
Live-Übersetzungen werden weiterhin gegen
[`workshopTranslationSourceHash`](../lib/workshop-display.server.ts#L14)
geprüft. Der [Release-Packer](../scripts/package-release.mjs#L40) archiviert den
vollständigen `dist`-Baum einschließlich der HTML-Dateien; dessen SHA-256 bleibt
durch die bestehende Releaseprovenienz gedeckt. Die Main-/PR-/CI-/Squash-Regeln
wurden durch diesen Diff nicht ersetzt.

## Primärquellen und Prüfgrenzen

Neben den oben verlinkten Repositoryquellen wurden die Nutzervorgaben sowie
[AGENTS.md](../AGENTS.md), [CONTRIBUTING.md](../CONTRIBUTING.md),
[Werkstattdaten](workshop-data.md), [Google Places](google-places.md) und
[Releases](releases.md) gelesen.

[Cloudflare Assetrouting](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
und [Bindings](https://developers.cloudflare.com/workers/static-assets/binding/)
bestätigen, dass Worker-first den vorgeschalteten Worker ausführt und dieser
Assets über das Binding holen kann. Die
[Workers-Limits](https://developers.cloudflare.com/workers/platform/limits/)
bleiben für den ausgeführten Worker relevant. Diese Primärquellen ersetzen
keine Messung der konkreten Riparim-Version in Produktion.

Ausgeführt wurden zwei gezielte unabhängige Reproduktionen in temporären
Verzeichnissen außerhalb des Repos. Keine Produktionsdatenmutation, kein
Deployment, kein Browserzugriff, kein E-Mail-/Kontaktversand und keine neue
Automation wurden durch diesen Review vorgenommen. Die vollständige CI sowie
die tatsächliche Live-Abnahme bleiben Aufgabe des implementierenden Agents.

## Nachprüfung vom 11.10.2026

Die ursprünglichen P1-/P2-Befunde sind im korrigierten Stand behoben. Eine
erneute unabhängige Routingprobe bestätigt die neuen Entscheidungen:

```json
{"assetPaths":["/__public/de/werkstatt/untouched-profile.html","/__public/de/werkstatt/first-profile-shell.html","/__public/de/werkstaetten-shell.html"]}
```

Das unveränderte Einzelprofil bleibt somit statisch, auch wenn ein anderes
Profil geändert wurde. Das geänderte Profil und der Katalog erhalten datenfreie
Shells. Ausgeblendete Einzelprofile liefern unmittelbar HTTP404. Zusätzlich
werden vollständige Profil-Snapshots nur noch mit dem betreffenden Profil als
Directory-Prop erzeugt. Die erneute React-/JSDOM-Probe mit aktualisierten
Server-Reviewprops ergab `{"updatedReviewPresent":true}`.

### Neuer P1: Der selektive Routertest verwendet einen falschen Optionstyp

Der tatsächlich ausgeführte Befehl `node tests/public-release-worker.test.mjs`
scheitert sofort mit Exitcode 1:

```text
MiniflareCoreError [ERR_VALIDATION]
invoke_user_worker_ahead_of_assets: [...]
Expected boolean, received array
```

[`tests/public-release-worker.test.mjs`](../tests/public-release-worker.test.mjs#L12)
setzt dort das Array `config.assets.run_worker_first`. Die installierte
Miniflare-Version erwartet für diese Option einen Boolean. Der installierte
Wrangler-Code (`node_modules/wrangler/wrangler-dist/cli.js`,
`getAssetsOptions`, Zeilen 309013–309019) verwendet für Arrays dagegen
`routerConfig.static_routing = parseStaticRouting(...)`; positive Regeln gehen
nach `user_worker`, negative ohne das führende `!` nach `asset_worker`.
Der Test muss die reale Konfiguration so abbilden und zusätzlich die
Produktions-Assetoption `html_handling: "none"` übernehmen. Aktuell blockiert
dieser Fehler die verpflichtende Buildprüfung und verhindert einen belastbaren
Nachweis des selektiven Routers.

### Neuer P2: Die Livevorprüfung wertet Fehlershells als Veröffentlichungserfolg

[`checkLive`](../scripts/daily-workshop-import.mjs#L39) akzeptiert jetzt
`data-public-profile-id` als Ersatz für die tatsächliche Profilkennung. Das
beweist nur die angeforderte Shell-ID. Die Shell verwendet diesen Marker auch
im [Fehlerzustand](../components/public-workshop-shell.tsx#L21), wenn die
Live-API das Profil nicht laden kann; sie liefert weiterhin eine H1 und
vollständiges HTML.

Eine unabhängige HTTP-Fixtureprobe lieferte für sämtliche Locales vollständiges
HTML mit diesem Marker und `<h1>Profile unavailable</h1>`. Der aktuelle Checker
meldete tatsächlich `{"unavailableShellHealthy":true}`. Ein Shell-Response darf
deshalb allein keine erfolgreich veröffentlichte, inhaltlich erreichbare
Profilseite bestätigen. Entweder die Vorprüfung Shells ausdrücklich als noch
nicht abgenommen melden lassen oder vor Erfolg zusätzlich die tatsächliche
Hydration einschließlich sichtbarer Profil-ID und erwarteter Inhalte prüfen.

### Externer Import und Releaseverträge

Die neue [zentrale Statementfactory](../db/catalogue-import.ts) wird von Runtime
und [Releaseplan](../scripts/catalogue-release-plan.mjs) verwendet. Der
[Deployimport](../scripts/apply-catalogue-release.mjs) regeneriert den Plan aus
dem ausgecheckten Releasecommit und vergleicht ihn vollständig vor den
Schreibvorgängen. Er fragt den Abschlussmarker ab, führt 50er-Batches aus und
schreibt den Abschlussmarker zuletzt. Stringparameter werden als SQL-Literale
mit verdoppelten Apostrophen geschrieben; keine Shellinterpolation findet statt.
Die bestehenden Revisionsprädikate schützen neuere Admintexte. Der
[Deploymentjob](../scripts/deploy-cloudflare.mjs#L86) führt dies nach den
Migrationen und vor dem geprüften Workerupload aus. Der zuvor beanstandete
Live-Erstimport benötigt damit im regulären Releasepfad keine Worker-CPU mehr.

`node tests/catalogue-release-plan.test.mjs` wurde unabhängig ausgeführt und
bestand: Teilabbruch ohne Abschlussmarker, Fortsetzung, abgeschlossene
Wiederholung ohne Schreibvorgänge, Erhalt neuerer Adminrevisionen,
Manipulations-/Commitabweichung und Parameterescaping. Es wurde dabei nur die
isolierte SQLite-Testdatenbank verändert. Kein zusätzlicher Auth-/Privacyfehler
im neuen Importpfad wurde gefunden. Die vom implementierenden Agent gemeldete
Produktionssicherung wurde in dieser Nachprüfung nicht geöffnet oder erneut
ausgeführt.

Diese Nachprüfung ersetzt weder vollständige CI noch Browser-/Live-Abnahme der
veröffentlichten Version und der API-Hydration. Nur dieser Bericht wurde als
Repositorydatei geändert.

## Abschlussnachprüfung vom 11.10.2026

Der Routertest verwendet jetzt die vom installierten Wrangler tatsächlich
vorgesehene Arrayabbildung `static_routing.user_worker` und übernimmt
`assetConfig.html_handling` aus der Produktionskonfiguration. Die frühere
Array-als-Boolean-Validierung ist damit korrigiert. Laut implementierendem Agent
bestand der vollständige Worker-Integrationstest gegen den zuvor erzeugten
158er-Build. Nach dem neuen Katalogstand muss der finale 160er-Build diesen Test
nochmals ausführen; dessen Erfolg wird hier nicht vorweggenommen.

Zusätzlich wurde unabhängig eine kleine echte Miniflare-Assetrouterprobe mit
selektivem Worker-first und `html_handling: none` ausgeführt. Der interne
`/__public/`-Pfad wurde auch bei kodierten Unterstrichen, kodiertem Slash und
doppeltem Slash jeweils normalisiert und vom Worker mit HTTP404 blockiert.
Kein direkter Assetzugriff wurde in diesen vier Varianten erlaubt.

Die Livevorprüfung fordert für Profilseiten nun tatsächliches
`data-workshop-id` und den aus der Live-API erwarteten Profilnamen. Der
Shell-Marker alleine gilt nicht mehr als Profilnachweis.
`node tests/daily-workshop-import.test.mjs` wurde erneut unabhängig ausgeführt
und bestand einschließlich der neuen Fehlershell-Regression. Somit ist auch
der zweite Befund der Nachprüfung geschlossen.

`node tests/catalogue-release-plan.test.mjs` bestand erneut mit der aktuellen
Quelle. Der zentrale Plan-/Runtimevertrag, der vollständige Vergleich vor den
Schreibvorgängen, die Wiederholbarkeit mit markerlast und der Schutz neuerer
Adminrevisionen bleiben erhalten. `npm run catalog:check` wurde unabhängig
ausgeführt: 160 Datensätze, 160 veröffentlicht, 160 zugeordnete Place-IDs,
keine Entwürfe oder ausstehenden Zuordnungen. Das einzige gemeldete gemeinsame
Telefon gehört zu den beiden bereits vorhandenen Eurogoma-Filialen.

Die zwei Ergänzungen und SQ-/EN-Overlays wurden gelesen. Der Katalogcheck prüft
die zentral erzeugten Übersetzungshashes. Die tatsächlich geöffneten
Google-unabhängigen Verzeichnisse
[Auto Enzo](https://www.autoyas.com/XK/Pristina/100237179537543/Auto-Enzo-Detailing)
und [Shine](https://www.autoyas.com/XK/Pristina/982725325082851/Shine-Detailing-Studio)
enthalten die gespeicherten Kontakt-, Straßen- und Leistungsangaben in
nachvollziehbaren Geschäftsbeiträgen. Auto Enzo belegt auch Lederreinigung und
PPF; Shine belegt die vollständige Hausnummer sowie Glas-/Lackkeramik und
Scheinwerferschutzfolien. Der zusätzliche Gjithebiznesi-Abruf lieferte in dieser
unabhängigen Webprüfung HTTP429; die AutoYas-Quelle enthält bereits die
entsprechenden Angaben. Die neue Google-ID-UI-Prüfung des implementierenden
Agents wurde hier nicht erneut im Browser ausgeführt. Es werden weder
Google-Inhaberschaft noch WhatsApp-Erreichbarkeit oder unbelegte Marken
behauptet; aktuelle Google-Geschäftsfelder und neue Sternebewertungen werden
nicht persistiert.

Das [datierte Importmanifest](../data/import-2026-10-11-daily.json) hält den
Import zutreffend als `prepared_for_verified_release` fest und meldet
`publishedCountConfirmed: 0`, `release.deployed: false` und eine noch offene
Live-Abnahme. Diese Zustände sind bei bestätigtem Release und tatsächlicher
Nachprüfung fortzuschreiben. Die Rechercheabdeckung kleinerer Städte und die
begründete Unterschreitung von zehn geeigneten Kandidaten sind dokumentiert.

Keine weiteren konkreten Code-/Datenfehler wurden im untersuchten Stand
gefunden. Releaseprovenienz, vollständige aktuelle CI, der finale Build sowie
Live-CPU-/Browserprüfungen aller unterstützten Locales verbleiben als reguläre
Abschlussprüfungen beim implementierenden Agent. Auch hier wurde nur dieser
Bericht als Repositorydatei verändert.
