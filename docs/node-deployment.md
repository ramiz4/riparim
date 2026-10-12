# Node-Releases installieren und betreiben

Ein geprüfter Semantic Release enthält neben den bisherigen Cloudflare-/Sites-
Archiven `riparim-node-vX.Y.Z.tar.gz` und `riparim-node-vX.Y.Z.json`. Das Nodepaket
enthält den vorgebauten Next-Server samt Frontend, unseren HTTP-Starter,
Migrationen, das Outbox-Kommando, den Installer und Produktionsmanifest/-lock.
Auf dem Ziel gibt es keinen Git-Checkout und keinen App-Build. Der Installer
führt ausschließlich `npm ci --omit=dev --ignore-scripts` aus; Node.js **24 ab
24.10**, npm und POSIX `tar` sind erforderlich. Linux/systemd ist das folgende
Betriebsbeispiel; der hostlokale Installer benötigt keine Hostinganbieter-API.

## Abgeschlossene Hosting-Evaluierung

Oracle Always Free wurde am 11.–12. Oktober 2026 für Riparim evaluiert und
als Hostingziel verworfen.

## Veröffentlichung und Zielauswahl

CI prüft und paketiert alle drei Ziele aus demselben unveränderten Commit.
Semantic Release auf dem gemergten, geprüften `main` veröffentlicht alle sechs
Assets. Die Repositoryvariable `DEPLOYMENT_TARGET` darf `cloudflare` oder `node`
sein. Ohne Variable gilt Cloudflare. Ein anderer Wert bricht vor der
Veröffentlichung ab. Bei `node` wird kein Cloudflare-Deploymentjob gestartet;
Cloudflare-Secrets sind dafür nicht erforderlich. Das Nodepaket wird anschließend
auf dem gewünschten Host installiert. Es gibt keine neue SSH-/Cloud-
Orchestrierung. Dieses Issue schaltet die vorhandene Produktion nicht um.

Alte vollständige Veröffentlichungen mit vier Assets bleiben für den bisherigen
Cloudflare-/Sites-Weg wiederholbar. Neue Veröffentlichungen tragen im Release-
Text den Marker `riparim-release: node-v1` und benötigen alle sechs Assets.
Ein Nodehost benötigt in jedem Fall das vollständige Nodepaar. Der Installer
prüft GitHub-Publikation, Stable-Tag, Tagcommit, Main-Abstammung, den erfolgreichen
Prüfjob dieses Main-Release-Laufs, Zieltyp und SHA-256. Ein späterer Cloudflare-
Deployfehler verhindert die Verwendung des bereits geprüften Nodepakets nicht.
Drafts, offene Branches, beliebige lokale Builds und gefährliche Archive werden
abgewiesen. GitHub ist die Veröffentlichungs-/Vertrauensquelle; dies ist keine
zusätzliche kryptografische Signatur unabhängiger Maintainer.

## Host einmal vorbereiten

Einen eigenen Dienstbenutzer verwenden. `/opt/riparim` gehört ihm exklusiv und
hat Modus `0700`. Vorhandene Daten über den [Anbieterwechsel](provider-exit.md)
übernehmen; eine leere migrierte Datenbank ersetzt keine Konto-/Dateiübernahme.
Der vorhandene `restore-node`-CLI bleibt ein Administrationswerkzeug und ist
kein Bestandteil des Node-Laufzeitpakets. Den geschützten Export auf der
Administrationsmaschine mit den Transfer-/Restorewerkzeugen des geprüften
Releasecommits in ein frisches privates Verzeichnis übernehmen und dessen
Daten-/Dateiprüfung ausführen. Bei gestoppten Prozessen anschließend **beide**
SQLite-Dateien und eventuell verbleibende WAL-/SHM-Dateien aus diesem geprüften
Verzeichnis geschützt nach `/opt/riparim/shared/data` übertragen. Danach die
Migration/HTTP-/Kundenprüfung des Node-Releases ausführen. Der Zielhost benötigt
weder Quellcheckout noch Build-/Restore-Abhängigkeiten.

Der ausführbare Installer liegt unter `node/.node-runtime/install.mjs` im
veröffentlichten Archiv. Ein Administrator übernimmt ihn einmal aus dem
geprüften Main-Release in ein geschütztes Werkzeugverzeichnis. Zum Beispiel auf
der Administrationsmaschine das Nodepaar über `gh release download vX.Y.Z --repo
ramiz4/riparim --pattern 'riparim-node-vX.Y.Z.*'` herunterladen, GitHubrelease und
Provenienz prüfen, dessen Archiv-SHA-256 abgleichen und dann nur den benannten
Installer mit `tar -xOzf riparim-node-vX.Y.Z.tar.gz
node/.node-runtime/install.mjs > install.mjs` lesen. Diese vertrauenswürdige
Werkzeugdatei auf dem Host als `/opt/riparim-tools/install.mjs` mit Modus `0700`
ablegen. Nicht einen ungeprüften Installer aus einem fremden Archiv ausführen.
Der Bootstrap führt keine App-Kompilation auf dem Ziel aus.

```sh
install -d -m 0700 /opt/riparim /opt/riparim/shared /opt/riparim/shared/data
install -m 0600 /dev/null /opt/riparim/shared/runtime.env
```

`runtime.env` anschließend privat bearbeiten. Minimales Beispiel:

```dotenv
SITE_ORIGIN=https://your-domain.example
PORT=3000
RIPARIM_TRUSTED_PROXIES=127.0.0.1
REVIEW_MODERATOR_EMAIL=moderator@example.invalid
```

Die tatsächlich benötigten Auth-, Google- und Versandwerte aus der geschützten
Konfiguration übernehmen. Zulässige Felder entsprechen dem
[Nodebetrieb](node-runtime.md), ergänzt um `PORT`. Keine GitHub-/Cloudflare-
Deploymenttokens in dieser Datei. `RIPARIM_DATA_DIR` wird vom Installer auf
`/opt/riparim/shared/data` erzwungen; wenn angegeben, muss es exakt diesem
absoluten Pfad entsprechen. Beide SQLite-Dateien, WAL/SHM und die Konfiguration
liegen außerhalb von `releases/` und `current`. Updates überschreiben sie nicht.
Konfiguration als Datei `0600`, Datenverzeichnisse `0700` halten. Ein privates
Repository benötigt einen GitHubtoken zum Lesen von Veröffentlichungen und
Actions-Prüfjobs; ausschließlich als geschützte `GITHUB_TOKEN`-Umgebung für den
Installer bereitstellen. Er wird nicht an npm oder Runtimeprozesse weitergegeben
und gehört weder in argv noch in Servicekonfiguration oder Logs.

## Release vorbereiten

Als Dienstbenutzer ausführen:

```sh
node /opt/riparim-tools/install.mjs prepare --root /opt/riparim --tag vX.Y.Z
```

Der Befehl lädt nur das veröffentlichte Nodepaar, verifiziert es, extrahiert in
ein separates privates Zwischenverzeichnis und installiert die gelockten
Produktionsabhängigkeiten. Erst nach erfolgreicher Prüfung wird daraus
`releases/vX.Y.Z/node`. Ein Fehler entfernt den Zwischenstand und verändert
`current` nicht. Wiederholung desselben Releases verwendet ausschließlich den
geprüften vollständigen Bestand. Die vorbereiteten Anwendungsdateien werden
beim Aktivieren erneut mit dem veröffentlichten Archiv verglichen.

## Dienst und manueller Versand

TLS und öffentliche Hostweiterleitungen liegen beim Reverse-Proxy. Der Server
bindet an Loopback. Der Proxy überschreibt `X-Real-IP` und erlaubt nur die
konfigurierte öffentliche Hostdomain; `SITE_ORIGIN` enthält die öffentliche
HTTPS-Origin. Die explizite Proxy-IP-Allowlist und alle Besitz-/Originprüfungen
bleiben aktiv. `next start` umgeht unseren Requestkontext und ist kein Startweg.

Beispiel `/etc/systemd/system/riparim.service`:

```ini
[Unit]
Description=Riparim Node server
After=network.target

[Service]
User=riparim
Group=riparim
WorkingDirectory=/opt/riparim/current
Environment=RIPARIM_DATA_DIR=/opt/riparim/shared/data
Environment=NEXT_TELEMETRY_DISABLED=1
ExecStart=/usr/bin/node --env-file=/opt/riparim/shared/runtime.env .node-runtime/server.mjs
Restart=on-failure
UMask=0077

[Install]
WantedBy=multi-user.target
```

`/usr/bin/node` muss die dokumentierte Node24-Version sein. Dienste dürfen keinen
GitHubtoken erben. Beim Service enthält `runtime.env` den Port; als Benutzer ist
keine öffentliche Portbindung nötig. Mailversuche werden von der Moderationsroute abgewartet. Ein periodischer Notification-Dienst oder Timer wird nicht eingerichtet. Vorhandene `riparim-notifications.timer` und `.service` vor dem Wechsel stoppen/deaktivieren. Der Betreiber kann ein einzelnes gespeichertes Ereignis mit `node --env-file=/opt/riparim/shared/runtime.env .node-runtime/command.mjs notifications <ereignis-id>` manuell wiederholen; die serverseitigen Limits aus [Nodebetrieb](node-runtime.md) bleiben verbindlich. Der Installer richtet keinen Maildienst, Authprovider oder Reverse-Proxy automatisch ein.

## Migration, Aktivierung und HTTP-Prüfung

Vor dem ersten Produktivwechsel Domain/TLS, Authcallback, SMTP und die vollständige
Datenübernahme separat abnehmen. Bei jedem Update alle Writer stoppen, dann
beide Datenbanken einschließlich eventuell vorhandener WAL-/SHM-Dateien privat
sichern und Wiederherstellbarkeit prüfen. Das bewusste `--stopped` bestätigt
diese Betreiberbedingung; der Installer steuert keine beliebigen Hostdienste.

```sh
sudo systemctl stop riparim.service
node /opt/riparim-tools/install.mjs activate --root /opt/riparim --tag vX.Y.Z --stopped
sudo systemctl start riparim.service
curl --fail --silent http://127.0.0.1:3000/api/session
curl --fail --silent http://127.0.0.1:3000/en/workshops > /dev/null
```

`activate` prüft Release, Archiv und Code erneut, lädt ausschließlich die private
externe Konfiguration und führt die vorhandenen Migrationen aus. Anschließend startet er den
vorbereiteten Server kurz auf einem freien Loopbackport und prüft die Session-API;
die Ausgaben dieses Prüfprozesses werden nicht protokolliert. Nur bei Erfolg
wird `current` durch atomaren Symlinkwechsel aktiviert. Der Befehl meldet den
vorherigen Codepfad. Eine fehlgeschlagene Migration oder HTTP-Vorprüfung erhält bisherigen Code;
bereits erfolgreich angewendete additive Migrationen bleiben erhalten. Kein
automatischer Datenbank-Downgrade. Bei fehlgeschlagenem HTTP-/Kundencheck den
Dienst gestoppt lassen und Schema/Logs ohne Secrets prüfen. Die HTTP-Smokechecks
ersetzen nicht Anmeldung, Moderation und private Downloadabnahme der Zieldomain.

## Daten erhaltender Code-Rückweg

Bevorzugt einen geprüften Forward-Fix veröffentlichen. Falls der zuvor geprüfte
Code mit dem **aktuellen** Schema kompatibel ist, den bisherigen veröffentlichten
Release vorbereiten und nach erneutem Writerstopp aktivieren:

```sh
node /opt/riparim-tools/install.mjs prepare --root /opt/riparim --tag vPREVIOUS
sudo systemctl stop riparim.service
node /opt/riparim-tools/install.mjs rollback --root /opt/riparim --tag vPREVIOUS --stopped --schema-compatible
sudo systemctl start riparim.service
curl --fail --silent http://127.0.0.1:3000/api/session
```

`vPREVIOUS` durch einen echten Stable-Tag ersetzen. `rollback` wechselt nur den
Code und führt keine alten SQL-Dateien aus. Neue Daten, Konten, Rollen, Nachweise,
Outbox-Ereignisse und private Konfiguration bleiben erhalten. Eine alte Sicherung
zurückzuschreiben würde neuere Writes verlieren und ist kein Code-Rollback.
Nicht mehr benötigte Releases erst nach Ende der Rückfallphase kontrolliert
entfernen; `shared/` bleibt erhalten. Verwaiste `.deployment-lock` nur nach
Prüfung entfernen, dass kein Installationsprozess mehr läuft.

Der Betriebsweg bleibt auf einen Host mit lokalem persistentem SQLite-Datenträger
beschränkt. Keine Mehrhost-/Netzlaufwerkfreigabe, kein Auth-Protokollwechsel und
kein automatischer produktiver Hosting-/Domaincutover. Der Pakettest startet den
echten HTTP-Server nach Entfernung des ursprünglichen Buildcheckouts und prüft
Frontendbytes, APIs, Migration/Outbox und Datenerhalt bei Update/Retry/Rückweg.

Quellen: [Next Custom Server](https://nextjs.org/docs/app/guides/custom-server)
(Custom Server und standalone werden nicht kombiniert), [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci),
[GitHub Release API](https://docs.github.com/en/rest/releases/releases),
[GitHub Actions Jobs](https://docs.github.com/en/rest/actions/workflow-jobs).
