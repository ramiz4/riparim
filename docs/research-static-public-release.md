# Statische öffentliche Seiten im geprüften Release

Stand: 2026-10-10. Untersuchte Versionen: `vinext@1.0.0-beta.5`, `@cloudflare/vite-plugin@1.37.1`, `wrangler@4.92.0`. Ergebnis einer unabhängigen Quellen-/Codeprüfung; kein Implementierungs- oder Deploymentnachweis.

## Konkretes Ergebnis

Cloudflare Static Assets können öffentliche HTML-Dateien vor dem Worker bedienen; diese Asset-Requests und Asset-Speicherung sind laut [Cloudflare-Abrechnung](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) kostenlos. Aufrufe des Worker-Skripts bleiben kosten-/quotenrelevant. Ein vorgeschalteter Worker, der anschließend `ASSETS.fetch()` ausführt, erreicht daher nicht dasselbe Ziel.

Vinexts native Prerender-API existiert in der installierten Version. Sie allein reicht für Riparim jedoch nicht: alle drei öffentlichen Seiten sind `force-dynamic`, lesen Authentifizierung und D1; native Nicht-export-Prerenderartefakte landen außerhalb des Asset-Verzeichnisses; zudem scheitert der vorhandene gebaute Worker beim Node-Import an `cloudflare:workers`. Die kleinste belastbare Integration verwendet weiterhin denselben geprüften Worker-Build, erzeugt öffentliche anonyme HTML-Snapshots in einem isolierten lokalen workerd/Miniflare-Lauf und nimmt ausschließlich diese Ergebnisse in `dist/client` auf. Private Routen und APIs bleiben Worker-Routen.

## Tatsächlich geprüfte installierte APIs

`node_modules/vinext/dist/config/prerender.d.ts` und `.js` definieren:

```ts
vinext({ prerender: true })
vinext({ prerender: { routes: "*" } })
```

Die CLI unterstützt `vinext build --prerender-all` und `--prerender-concurrency`. Nur `routes: "*"` wird akzeptiert, kein Array ausgewählter URLs. Mit einem kurzen Node-Test wurden Normalisierung beider gültigen Konfigurationen, Zurückweisung eines Route-Arrays und Auswahlgrund `vinext-config` erfolgreich geprüft. `import('vinext/internal/build/run-prerender')` liefert tatsächlich eine Funktion. Diese interne API ist im installierten `package.json` exportiert; sie sollte bei Verwendung an die bestehende gepinnte Version gebunden bleiben.

`node_modules/vinext/dist/build/run-prerender.js` schreibt im normalen Worker-Build HTML und `.rsc` unter `dist/server/prerendered-routes`, mit `dist/server/vinext-prerender.json`. Nur `output: "export"` schreibt direkt nach `dist/client` und behandelt dynamische SSR-Routen als Exportfehler. Das globale Exportziel wäre für diese Anwendung ungeeignet. Eine native Prerenderkonfiguration verlangt außerdem statisch generierbare Locale- und Profilparameter; nicht veröffentlichte, entfernte und ausgeschlossene IDs dürfen darin niemals vorkommen.

Der native Runner startet `vinext/server/prod-server` in Node. Der direkte Import des vorhandenen `dist/server/index.js` wurde tatsächlich ausgeführt und lieferte:

```text
ERR_UNSUPPORTED_ESM_URL_SCHEME
Received protocol 'cloudflare:'
```

Die gebauten Chunks für Storage, Auth und Benachrichtigungen importieren `cloudflare:workers`. Dieser konkrete Befund geht über den allgemeinen Kompatibilitätskommentar in Vinexts Typdefinition hinaus. Ein vollständiger nativer Prerender-Build wurde nicht ausgeführt; der Importfehler genügt als nachgewiesene Voraussetzungssperre.

`node_modules/@cloudflare/vite-plugin/dist/index.d.mts` enthält `experimental.prerenderWorker` mit Auxiliary-Worker-Konfiguration sowie `experimental.headersAndRedirectsDevModeSupport`. Im gebauten Plugin wird eine eigene Prerender-Umgebung erzeugt. Daraus ergibt sich aber kein bereits vorhandener Vinext-Renderer für Riparim. Ein zusätzlicher experimenteller Worker ist für den ersten minimalen Snapshotpfad nicht erforderlich. Lokale Rewrite-Abnahme soll mit dem erzeugten Wrangler-/Miniflare-Produktionsbuild erfolgen, da Vite-dev diese Dateien nur mit der experimentellen Option behandelt.

Die aktuellen [Vinext-Primärquellen](https://github.com/cloudflare/vinext) beschreiben inzwischen eine neuere Tool-/Adapteraufteilung. Deshalb wurden konkrete Integrationsaussagen anhand der installierten Version getroffen, statt aktuelle README-Kommandos ungeprüft auf beta.5 zu übertragen. Das [Upstream-Skill](https://raw.githubusercontent.com/cloudflare/vinext/main/.agents/skills/migrate-to-vinext/SKILL.md) wurde als Kontext gelesen; eine Neuinstallation oder Migration ist für diese bestehende Anwendung nicht nötig.

## Bestehender Releasepfad und minimale Ergänzung

`package.json` baut über `scripts/run-framework.mjs`. Native-macOS ruft die Vinext-CLI auf; Managed Linux verwendet `scripts/build-verified.sh`. Das Bash-Skript ruft `vinext build` ohne Weitergabe zusätzlicher CLI-Argumente auf. Eine gemeinsame Post-build-Phase ist daher verlässlicher als nur lokale zusätzliche Flags. Der bestehende Build führt anschließend Navigation-/Assettests und i18n-Workerprüfungen aus.

Minimale Integration:

1. Den bestehenden Worker-/Client-Build unverändert in seiner Providerisolation bauen. Danach eine klar begrenzte Snapshotphase vor `release:package` ausführen.
2. Die gebaute App lokal mit workerd/Miniflare und ausschließlich isolierten D1/R2-Bindings bedienen. Eine eigene lokale Datenbank erhält die vorhandenen Migrationen und den kanonischen veröffentlichten Katalog. Kein Produktionszugriff, keine echten Benutzer, keine Supabase-Session, kein Remote-Binding. Die normale Runtime-Importlogik darf dort den Katalog übernehmen. Alternativ kann ein eng begrenzter, ausschließlich lokaler Prerender-Env-Pfad den kanonischen öffentlichen Katalog lesen; dafür dürfen keine vom externen HTTP-Client kontrollierbaren Bypassheader eingeführt werden.
3. Eine explizite URL-Liste aus den unterstützten Locales und veröffentlichten Katalog-IDs rendern: öffentliche Startseite, Katalog und Profile. Die Snapshotphase darf nur HTTP200 mit erwarteter HTML-Struktur, korrekter Locale/Kanonik und vollständigem Katalog übernehmen. Auth-/Datenfehler, „unavailable“, Redirects oder verkürzte HTML-Streams müssen den Build abbrechen. Native HTML enthält die von Vinext erzeugten RSC-Hydrationsdaten; selbst konstruiertes HTML würde diesen Vertrag ersetzen und wäre aufwendiger.
4. Die fertigen HTML-Dateien ausschließlich unter einem kontrollierten öffentlichen Asset-Prefix in `dist/client` ablegen. Ein Manifest enthält genaue erlaubte Quell-/Zielpfade, Kataloghash, Commit und HTML-Hashes. Keine privaten HTML-Seiten, Storageobjekte, Entwürfe oder Runtime-Secrets in den Assets speichern.
5. Saubere bestehende URLs mit Assets-Routing erreichen. Produktion verlangt `assets.html_handling: "none"`, damit Eigentumsnachweis-HTML seine exakten Namen bewahrt. Diese Policy nicht global auf automatische HTML-Auflösung ändern. [Cloudflare `_redirects`](https://developers.cloudflare.com/workers/static-assets/redirects/) unterstützt interne `200`-Proxyregeln, etwa `/de/werkstaetten /__public/de/werkstaetten.html 200`. Die Grenzen sind 2.000 statische und 100 dynamische Regeln, zusammen 2.100; bei 30 neuen Profilen täglich wird eine Regel je Profil mittelfristig zu groß. Ein enger Profil-Platzhalter je Locale ist eine mögliche Alternative, aber unbekannte/entfernte IDs müssen weiterhin echte 404 liefern und dürfen kein generisches Profil erhalten. Dies muss im lokalen Assetrouter getestet werden.
6. `dist/client/_headers` ergänzt `X-Riparim-Release-Commit` für die Assets, weil der bisherige Worker-Stempel bei kostenfreiem Asset-Serving nicht läuft. [Cloudflare Headerregeln](https://developers.cloudflare.com/workers/static-assets/headers/) erlauben maximal 100 Regeln; daher geeignete Prefixregeln verwenden. Dateiendungen bestimmen den MIME-Typ, `Content-Type` darf nicht versehentlich Binärdownload ergeben. Den bestehenden revalidierenden Cachevertrag bevorzugen; das HTML ist keine dauerhaft immutable Datei.
7. Vor dem Packen alle Snapshot-/Routing-/Clientprüfungen durchführen. `package-release.mjs` archiviert bereits den vollständigen `dist`-Baum; der HTML-/Manifestinhalt ist somit durch die bestehende SHA-256-Provenienz abgedeckt. CI baut Cloudflare und Sites aus demselben Commit, also muss die Phase klar entscheiden, ob beide Ziele dieselben öffentlichen Assets erhalten. Die bestehenden Main-/PR-/CI-/Squash-/Semantic-Release- und Artefaktdeploymentprüfungen bleiben erhalten.

[Cloudflare Assetrouting](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) bedient vorhandene Assets standardmäßig zuerst und ruft bei fehlenden Assets den Worker auf. `run_worker_first: true` oder öffentliche Muster in dieser Liste würden das Ziel unterlaufen. Die installierte Vite-Implementierung begrenzt diese Liste auf 100 Muster. [HTML-Handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/) bestätigt, dass bei `none` eine saubere URL nicht automatisch ihre `.html`-Datei findet; genau deshalb sind explizite Assetregeln erforderlich.

## Authentifizierung, Aktualität und Navigation

Die öffentliche Seitenquelle liefert aktuell personalisierte Props: `account`, `isAdmin`, `signedIn`. `components/site-header.tsx` verwendet diese für Kontomenü, Abmeldung, Verwaltung und verifizierten Sprachwechsel. Eine anonym generierte HTML-Datei muss nach Hydration den echten Sitzungsstatus über einen serverseitig geprüften privaten APIvertrag beziehen, ohne Kontodaten in das statische Release zu schreiben. Das Abfrageergebnis gehört nicht in einen gemeinsam benutzten öffentlichen Cache. Autorisierung für Aktionen verbleibt auf dem Server.

Die Profilseite liest veröffentlichte Riparim-Bewertungen aus D1. Eine lokale leere Testdatenbank darf daraus nicht die Tatsachenbehauptung „keine Bewertungen“ für ein live bereits bewertetes Profil ableiten. Bewertungsdaten sollen nach Hydration über die vorhandene `/api/reviews?workshop=…`-Route geladen werden, mit ehrlichem Lade-/Fehlerzustand. `router.refresh()` nach Bewertung würde unter Asset-first eine RSC-Anfrage an einen HTML-Snapshot richten; stattdessen Bewertungen gezielt neu laden oder vollständig im Browser neu navigieren.

`components/locale-anchor.tsx` verwendet bereits native `<a>`-Navigation und ist dafür geeignet. Andere RSC-/Router-Push-/Refreshwege müssen geprüft werden: die Assetebene kann nicht anhand des `RSC: 1`-Headers zwischen HTML und RSC unterscheiden. In Clientcode mit notwendiger dynamischer Navigation entweder gezieltes API-Refetch oder vollständige Dokumentnavigation verwenden. Eine weitere Option wäre ein getrenntes explizites RSC-Ziel, aber das vergrößert den Diff.

Katalogfilter, `bewerten=1`, Profil-`suche` und alte Landingparameter (`besuche`, `einreichung`, `werkstatt`, `nachweis`) sind derzeit Server-Querylogik. Static Assets liefern für alle Queries denselben Snapshot; die bestehenden Bedeutungen müssen clientseitig vor/bei Hydration erhalten bleiben. `_redirects` kann keine bedingten Query-/Cookie-Regeln ausdrücken. Insbesondere Konto-/Nachweisnavigation darf nicht unbemerkt verschwinden.

Neue Adminänderungen werden weiterhin geschützt in Live-D1 gespeichert. Ein statischer Release repräsentiert den geprüften kanonischen Stand bis zum nächsten Release. Den Live-Abgleich vor jedem Katalogimport und die dokumentierte Exportpflicht beibehalten. Eine clientseitige Aktualisierung darf neuere Livefelder anzeigen, aber ein teures `/api/workshops` bei jedem öffentlichen Seitenaufruf würde die ursprüngliche CPU-Belastung teilweise zurückbringen. Notwendige Zusatzdaten möglichst über kleine dedizierte APIabfragen laden.

## Notwendige Prüfungen

- Vollständiger Snapshotbestand für DE/SQ/EN, korrekte Titel/Kanonik, Profile mit Kataloghash und Übersetzungshash, 0 private oder verworfene IDs. Fehler-/Redirect-/unvollständiges HTML führt zum Buildfehler.
- Lokaler Produktions-Assetrouter: öffentliche GET/HEAD-URLs, Query-/Hashnavigation, bekannte Profile, unbekannte/entfernte Profile, `.html`-Eigentumsnachweis, Canonical- und workers.dev-Host, korrekte MIME-/Release-/Cacheheader. Ein einfacher künstlicher Workerfehler darf vorhandene öffentliche Assets nicht beeinflussen; damit wird tatsächliches Assets-first geprüft.
- Keine Useridentität, E-Mail, Sessioncookies, private Besuche oder Zugangsdaten im Snapshot und Manifest. Cookies dürfen öffentliche HTMLbytes nicht verändern; private API-/Admin-/Authrouten müssen weiterhin Sessions und Rechte prüfen.
- Echte Browserabnahme in vorgegebenem Browserprofil: Hydration, Themes, responsive Tastaturbedienung, Suchfilter aus URL, Sprachwechsel, eingeloggter Header/Logout, Bewertungsformular und anschließender Datenrefresh, JavaScript-Fehler/RSC-MIMEfehler.
- Releasepolicy-Tests prüfen nicht nur Assetdirectory, sondern erwartete Header-/Rewriteartefakte und verbieten globales Worker-first, SPA-Fallback und nicht erlaubte öffentliche Snapshotrouten. Abschließend verpflichtende CIchecks, PRreview und Liveprüfung des tatsächlichen Main-Releases; Workerlogs/Requestzählung sollen bestätigen, dass öffentliche HTMLrequests nicht mehr SSR ausführen.

Ausgeführt wurden nur die oben beschriebenen API-Normalisierungs-/Importproben und Quellen-/Codeprüfungen. Es gab keine Codeänderung, keinen vollständigen Build, keine Veröffentlichung und keine Kosten-/Performancebehauptung über einen bereits produktiv geänderten Zustand.
