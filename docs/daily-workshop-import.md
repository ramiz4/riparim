# Täglicher geprüfter Werkstattimport

Die lokale Codex-Automation **Riparim: täglicher geprüfter Werkstattimport**
gehört zum Projekt `/Users/ramizloki/workspace/riparim` und verwendet
`gpt-6.1-sol` mit Reasoning `high`. Ihr Auftrag umfasst Recherche, Quellen- und
Google-Identitätsprüfung, Dublettenabgleich, Dry Run, Katalogimport,
Übersetzungen, geprüften PR, Squash-Merge, Release und Live-Abnahme.
Der Nutzer hat diese wiederkehrenden Schritte ausdrücklich autorisiert;
tägliche erneute Freigaben sind nicht erforderlich. Kontaktaufnahme ist untersagt.

## Zeitplan und Laufzeit

Gewünschter Termin ist täglich **09:00 Europe/Berlin**. Die derzeitige
Automationsschnittstelle speichert eine lokale Uhrzeit ohne separates
Zeitzonenfeld. Das Desktopprofil verwendet Europe/Zurich, dessen aktuelle
UTC-Offsets und Sommerzeitwechsel mit Europe/Berlin übereinstimmen. Der
Zeitplan wird deshalb lokal auf 09:00 gespeichert. Das ist keine separat
gespeicherte Berlin-Zeitzone: bei Änderung der Desktopzeitzone den Zeitplan
vor weiterer Aktivierung erneut prüfen. Am 11.10.2026 entspricht der Termin
07:00 UTC. Eine pausierte Automation hat keinen ausführbaren nächsten Lauf.

Das ist ein ausführbarer lokaler Agentenauftrag, kein Cloud-Cron. Computer
und Codex-App müssen laufen und auf Repository und benötigte Verbindungen
zugreifen können. Der Zugang über GitHub CLI, Cloudflare-Connector und das
Browserprofil `ramizloki82@googlemail.com` wurde bei Einrichtung geprüft.
Browseraktionen sind über die vorhandene native Oberfläche möglich; die
Browserextension ist bislang nur im anderen Profil verbunden. Die Secrets
liegen im Produktions-Worker und werden nicht an die Automation exportiert.
Wrangler ist lokal nicht angemeldet. Remote-D1-Lesezugriff erfolgt über den
Cloudflare-Connector; das Deployment übernimmt GitHub Actions.
Anmeldung und Quoten können zwischen Läufen ablaufen und werden vor jedem
Lauf erneut geprüft. Eine Verbindung in dieser Sitzung beweist keinen
dauerhaften Zugriff eines späteren geplanten Laufs.

## Gemeinsame Sperre und Fortsetzung

Vor Synchronisierung von main und vor jeder Katalogbearbeitung aus einem
isolierten Worktree ausführen:

```sh
node scripts/daily-workshop-import.mjs acquire <eindeutige-chat-oder-lauf-id>
node scripts/daily-workshop-import.mjs status
```

Die Sperre liegt im gemeinsamen Git-Verzeichnis und gilt für alle Worktrees
dieses Repositorys auf diesem Host. Ein paralleler Erwerb schlägt fehl. Der
ausgegebene Token gehört zum Lauf, ist kein Providergeheimnis und dient nur
der kontrollierten Freigabe. Er bleibt außerhalb von Git in der lokalen
Sperrdatei. Sperre bis zum Abschluss von PR, Release und Liveprüfung halten.

```sh
node scripts/daily-workshop-import.mjs release <passender-lauf-token>
```

Ein Abbruch lässt die Sperre absichtlich bestehen. Keine automatische
Zeitüberschreitung und keine Freigabe nur anhand des Alters. Besitzerchat,
Worktree, datiertes Manifest, offene Import-PRs und laufende Release-Jobs
prüfen. Läuft der Besitzer noch, neuen Lauf ohne Mutation beenden. Ist er
beendet, die Aufgabe im bestehenden Worktree und Manifest fortsetzen; erst
nach geklärtem Import-/Deploymentausgang den passenden Token freigeben.
Das verhindert einen zweiten Import nach unbekanntem Teilerfolg.
Bei einer fehlenden oder beschädigten Sperrdatei nicht automatisch löschen.
Die Sperre schützt kooperierende Läufe auf diesem Host; zusätzliche Hosts
dürfen dieselbe Routine erst nach Einrichtung einer gemeinsamen Sperre starten.

## Vorprüfung und kostenfreier Betrieb

```sh
node scripts/daily-workshop-import.mjs health <profil-id> <profil-id>
```

Die Vorprüfung liest den öffentlichen Livebestand und Katalog-/Profilseiten
in DE/SQ/EN. HTTP-Fehler, Error 1102, fehlende Überschrift, falsche Sprache
und unvollständige HTML-Antworten sperren die Veröffentlichung. HTTP200
allein reicht wegen möglicher Streamingabbrüche nicht. Vor Aktivierung und
nach jedem Release außerdem Cloudflare-Outcome und aktive Version abgleichen.
Die Prüfung schreibt keine Produktionsdaten und sendet keine Nachrichten.

Der Nutzer wünscht **keine zusätzlichen Kosten**. Keine kostenpflichtigen
Tarife aktivieren, keine neuen API-Abonnements oder bezahlten Ressourcen
anlegen. Bestehende Codex-Kontingente verwenden. Google-API-Aufrufe nur,
wenn die aktuelle kostenlose Quote und passende harte Begrenzungen geprüft
sind; ein Abrechnungsbudget allein verhindert keine Kosten. Bei unbekannter
Restquote keine potenziell zahlungspflichtigen Aufrufe ausführen. Das
gemeinsame Serverlimit von 100 Such-/Detailanfragen pro Tag bleibt zusätzlich
verbindlich. Öffentliche Maps-UI-Prüfung ohne API-Export ist möglich;
Providerbedingungen gelten weiterhin.

Am 10.10.2026 wurde im Cloudflare-Dashboard **Workers Free / 10 ms CPU pro
Anfrage** bestätigt. Die öffentliche SSR-Anwendung überschreitet diese
Grenze; auch Version v1.11.1 erzeugt `exceededCpu` und HTTP503/Error1102.
Die Routine bleibt bis zur bestätigten Live-Abnahme pausiert. Der Nutzer
hat den kostenfreien Umbau auf öffentliche HTML-Release-Artefakte autorisiert.
Die Umsetzung rendert Katalog und Profile in DE/SQ/EN ausschließlich in
einem lokalen workerd mit isolierter D1-Datenbank aus der Canonicalquelle.
Keine Produktionszugänge oder Provideranfragen werden beim Rendern verwendet.
Ein kleiner Worker-Abgleich der veröffentlichten IDs und Profilrevisionen
geht der Asset-Auslieferung voraus: neuere Adminänderungen invalidieren nur das betroffene Profil. Es wird dann
eine datenfreie Shell ausgeliefert und der aktuelle öffentliche Inhalt über
die API geladen. Eine Ausblendung ergibt unmittelbar HTTP404. Bei Änderungen
am Gesamtbestand verwendet der Katalog ebenfalls eine datenfreie Shell;
unveränderte Profile behalten ihre vollständige statische Antwort. Anmeldedaten und öffentliche
Riparim-Bewertungen werden nach Hydration über private Session- bzw. öffentliche
Review-APIs geladen; RSC-Anfragen bleiben dynamisch. Direkte Zugriffe auf den
internen Assetpfad sind gesperrt. Diese Statusabfrage zählt zu den bestehenden
Workers-Free-Kontingenten; es wird kein zusätzlicher Tarif aktiviert.

Der bisherige Katalogleser validierte vor jedem Abruf die komplette
unveränderte Quelle. Jetzt wird bei vorhandenem Abschlussmarker auf diese
Prüfung verzichtet. Tatsächliche Imports behalten die vollständige Validierung,
Revisionstests, Begrenzungen und idempotente Abschlusskennung. Die Release-CI
prüft weiterhin Katalog und sämtliche Übersetzungshashes. Die statischen
Artefakte werden im bestehenden unveränderlichen Releasearchiv mitgesichert.
Der Build erzeugt zusätzlich einen Importplan aus derselben zentralen
Statementfactory wie der Runtimeimport. Der Deploymentjob vergleicht diesen
Plan exakt mit dem geprüften Quellcommit und führt ihn nach Migrationen,
aber vor dem Workerupload extern über D1 aus. 50er-Batches bleiben
wiederholbar; der Abschlussmarker kommt zuletzt. Neue Daten benötigen
damit keine erste CPU-intensive Importanfrage im Free-Worker. Vor einem
Katalogrelease die betroffenen Katalogtabellen lokal geschützt sichern,
die Wiederherstellung isoliert prüfen und die Sicherung bis zur sicheren
Übergabe erhalten; keine privaten Kundentabellen oder Secrets exportieren.

Referenzen: [Cloudflare Limits](https://developers.cloudflare.com/workers/platform/limits/),
[Static-Asset-Abrechnung](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/),
[lokale geplante Aufgaben](https://learn.chatgpt.com/docs/automations?surface=app).

## Recherche, Abgleich und Import

Gemeinden und Tätigkeiten wechseln; kleinere Orte einbeziehen. Ziel sind
bis zu 30 belegte neue Pkw-Servicebetriebe täglich, darunter Autoelektrik,
Fahrzeugglas und echtes Detailing/Polieren/Keramikschutz. Bei weniger als
10 geeigneten Betrieben nur diese übernehmen und den Grund dokumentieren.
Anhaltspunkte ohne Kontakt-, Standort-, Leistungs- und aktive eindeutige
Google-Zuordnung bleiben zurückgestellt.

Vor Katalogmutation aktuelle öffentliche Profile, zugängliche Entwürfe,
Place-Zuordnungen, öffentliche Admin-/Betriebsänderungen und Live-
Entfernungsmarker über den autorisierten Zugang lesen. Nur Katalogtabellen
und öffentliche Profilfelder abrufen; keine privaten Nutzer-/Besuchsbelege
exportieren. Prüfe gegen `data/workshops.json`, sämtliche früheren Import-
und Recherchemanifeste sowie Scope-/Entfernungsdateien. Historische
Profilnamen und Kontakte entfernter IDs anhand der vorhandenen Historie
berücksichtigen. Place-ID, internationale normalisierte Nummer, Name/Alias,
Adresse und Standort vergleichen; Filialen separat bewerten. Unklarheit
führt zur Rückstellung. Bei fehlendem vollständigem Liveabgleich stoppen.

Zuerst die bestätigten neueren Adminänderungen in die Canonicalquelle
übernehmen; die Runtime schützt ältere Imports, ersetzt diesen Export aber
nicht. Für neue vollständige Datensätze vorhandene Werkzeuge verwenden:

```sh
npm run catalog:merge -- /absoluter/pfad/zum/bestaetigten-import.json
npm run catalog:merge -- /absoluter/pfad/zum/bestaetigten-import.json --write
npm run catalog:check
```

DE-Originale und SQ-/EN-Overlay vollständig ergänzen. Übersetzungshashes
ausschließlich mit `workshopTranslationSourceHash` berechnen. Neuere Profile,
Besitzrechte, Moderation und private Tabellen bewahren. Keine unmittelbaren
Liveinserts; der Release übernimmt die geprüfte Canonicalquelle wiederholbar.

`data/import-YYYY-MM-DD-daily.json` ist das datierte Laufmanifest. Wiederholung
setzt dasselbe Manifest fort. Darin Quellen und Prüfzeit, Gemeindeabdeckung,
Kandidaten/Dubletten/Rückstellungen, eigene Google-Identitätsnachweise,
Anfragen/Quoten, Vorbestand, Dry Run, Importresultat, IDs, Übersetzungsprüfung,
PR, Release und abschließenden Liveabgleich dokumentieren. Google-Identität
beweist keine bestätigte Inhaberschaft. Keine kopierten aktuellen Google-
Geschäftsdaten, Sterne, Rezensionen, Öffnungszeiten oder Fotos speichern.

## PR, Release und Nachprüfung

Die vollständigen Prüfungen aus `.github/workflows/ci.yml`, vollständiger
Diff, `git diff --check` und unabhängiges Review sind verbindlich. PR und
Commits folgen Conventional Commits. Ein neuer Katalogimport verwendet
`feat(catalogue)`, damit Semantic Release eine Veröffentlichung erzeugt.
Nach erfolgreichen aktuellen Checks ausschließlich Squash-Merge nach main.
GitHub-Release mit vier Artefakten/Provenienz und erfolgreichem Deploy-Job
bestätigen. Kein Featurebranchdeployment und keine Sites-Veröffentlichung.

Nach dem Deployment alle neuen Profile in DE/SQ/EN mit der Vorprüfung
prüfen; Livebestand, eindeutige Place-IDs und vorherige Profilrevisionen
abgleichen. Erfolg erst danach melden. Bei Nullkandidaten oder Fehlern
Manifest und konkreten Grund sichern; weder Import noch Release erfinden.
