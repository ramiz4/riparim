# Anbieterwechsel mit geprüftem Rückweg

Riparim kann auf einem gewöhnlichen Node-Host mit lokaler SQLite und privatem
Dateispeicher laufen. Auth bleibt ein kleiner Adapter für das tatsächlich
verwendete Supabase-/GoTrue-Protokoll; eine kompatible selbst betriebene Instanz
ist möglich. Benachrichtigungen können über SMTP statt Resend gehen. Ein beliebiger
OIDC-Anbieter oder ein anderer Datenbanktyp benötigt weiterhin eine gezielte
Adapteränderung. Der Wechsel ist kein Ein-Klick-Vorgang.

## Reihenfolge

1. Den geprüften GitHub Release aus gemergtem `main` samt Commit/SHA-256 sichern.
   Die gleiche geprüfte Quelle mit `npm run build:node` bauen, Node 24 ab 24.10,
   privaten persistenten Datenträger und einen Dienstbenutzer vorbereiten.
   Feature-Branches und offene PRs werden nicht veröffentlicht. Keine Prozesse
   am neuen Datenverzeichnis starten, bevor die vollständige Wiederherstellung
   und Konfiguration abgeschlossen sind.
2. Alle alten Writer, Versand-Crons/Timer, laufenden Requests, Uploads und
   Kontolöschungen stoppen und abfließen lassen. Eine Schreibpause gilt für beide
   Seiten. Den vorhandenen geschützten Export aus [data-transfer.md](data-transfer.md)
   aktivieren: `MIGRATION_READ_ONLY=true`, gültigen Export-Tokenhash,
   kurze gültige Exportfrist und exakt geprüften `MIGRATION_SOURCE_COMMIT`
   konfigurieren. Der Token wird über geschütztes stdin und Authorization
   übertragen. Die Pause läuft nicht mit der Exportberechtigung ab.
   Der Node-Starter sperrt ebenfalls vor Next alle App-Requests, einschließlich
   GETs; `notifications:node` arbeitet während dieser Pause nicht.
3. `scripts/export-source.mjs` nach der bestehenden Anleitung ausführen und den
   vollständigen Abschlussbeleg prüfen. Backupverzeichnis/Elternverzeichnis 0700,
   Dateien 0600, außerhalb von Git/`public/`; keine Kontodaten, Keys, Objektpfade
   oder SQL-Bindings in Logs oder argv. Auth-Providerkonten, Passwort-Hashes,
   OAuth-Einstellungen, Secrets und DNS-Konfiguration separat sichern. Sie
   gehören nicht in das Appbackup. Im Appbackup enthaltene Session-/Grantdaten
   bleiben ebenfalls geschützt.
4. Das komplette Appbackup in ein **neues** Node-Datenverzeichnis importieren:

   ```sh
   node scripts/restore-node.mjs < /geschuetzter/pfad/restore-options.json
   ```

   Die Datei enthält ausschließlich die folgenden Optionen; Projekt und Commit
   sind aus dem unabhängig geprüften Abschlussbeleg zu übernehmen:

   ```json
   {
     "sourceDirectory": "/geschuetzter/pfad/backup",
     "expectedProjectId": "<verified-source-project>",
     "expectedCommit": "<40-character-reviewed-release-commit>",
     "directory": "/geschuetzter/pfad/new-node-data"
   }
   ```

   Der Elternpfad muss bereits privat und kanonisch sein. Alle Zielprozesse
   bleiben gestoppt. Der Import prüft Abschluss, Snapshot/Manifest-Fingerprints,
   vollständiges Schema und private Bytes/SHA-256. Er führt ausschließlich
   eingecheckte Drizzle-Migrationen aus, übernimmt Appdaten mit internen/externen
   Identitätszuordnungen, Rollen, Sperren, Lösch-Tombstones, Freigaben, Reservierungen
   und historische Outboxzustände. Quell-Migrationsdaten bleiben im Backup;
   die Zielhistorie belegt die tatsächlich ausgeführten Migrationen mit Hashes.
   `riparim_node_migrations` wird als exakt geprüfte Runtimehistorie anerkannt.
   Private Bytes, ursprüngliche ETags, Uploadzeiten und HTTP-/Custom-Metadaten
   werden erhalten. Der Import verwendet bewusst kein normales `bucket.put`,
   das Reservierungs-ETags ändern würde.

   Beide Datenbanken und ihr Abschlussbeleg entstehen im privaten temporären
   Verzeichnis; erst nach vollständiger Prüfung wird das ganze Verzeichnis
   veröffentlicht. Fehler vor diesem Schritt geben keinen Halbrestore frei.
   Eine identische Wiederholung ist ausschließlich eine vollständige Prüfung
   des unveränderten Ergebnisses. Jede neue Zeile, Änderung oder Löschung,
   auch neue Datei-Bytes, Authkonfiguration oder Identitätsverknüpfung, stoppt
   den alten Import. Es gibt keine Einfügungen in ein bereits benutztes Ziel
   und keine automatische Wiederbelebung gelöschter Bewertungen.
   Nach einem Prozesscrash können `.restore-lock` und das private Staging-
   Verzeichnis zurückbleiben. Retry löscht sie bewusst nicht blind. Der Betreiber
   prüft und bereinigt ausschließlich eigene Reste, nachdem Restore-/App-Prozesse
   sicher gestoppt und das vollständige Backup gesichert sind.
5. Authkonten separat auf einer tatsächlich kompatiblen Zielversion übernehmen
   und die Passwort-Hash-/Google-Verträge mit isolierten Konten prüfen. Eine
   Admin-Liste exportiert keine vollständigen Passwort-Hashes. Die offizielle
   [Supabase-Restore-Anleitung](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
   nennt Versionsabgleich, enthaltene Authdaten sowie separate Keys, OAuth/SMTP
   und erneute Anmeldung. Falls das Ziel Hashes nicht verifiziert importieren
   kann, ist ein kontrollierter Reset nötig. Google-Subjects und Callback am
   Ziel gesondert einrichten. Alle exakten Quell-/Zieltuples einschließlich
   Sperren/Tombstones mit dem vorhandenen `linkAccountIdentity` und unabhängig
   geprüften Provideridentitäten an dieselben internen IDs binden; nie per
   gleicher E-Mail oder Rollenmetadaten. Bei weiterhin gestoppten Zielprozessen
   Mapping, Ziel-Authsettings und separat gebundene Secrets kontrolliert
   serverseitig/offline nach [auth-provider.md](auth-provider.md) konfigurieren.
   Eine deaktivierte oder noch an den alten Customhost gebundene Anmeldung
   setzt keinen verfügbaren Admin-UI-Zugang für den Wechsel voraus.
6. SMTP/Absender/TLS und den einzelnen Outbox-Timer nach
   [mail-transports.md](mail-transports.md) konfigurieren. Bereits
   begonnene Ereignisse behalten Transport und Credentialbindung. `unknown`
   beziehungsweise unklare SMTP-Annahmen benötigen externe Klärung; sie dürfen
   beim Anbieterwechsel nicht erneut gesendet werden. Ein SMTP-250 belegt nur
   Annahme durch den Server, keine Zustellung an das Postfach.
7. Auf dem Ziel öffentliche und ausgeblendete Werkstätten, neue Anmeldung,
   dieselben internen Besitzrechte, eigene/fremde private Nachweise, Moderation,
   Benachrichtigung sowie Kontolöschung prüfen. Rollenmetadaten und gefälschte
   native Header dürfen keine Verwaltungsrechte geben. Die neue Anmeldung
   ersetzt alte Provider- und App-Sitzungen; deren Stilllegung separat prüfen.
   Quelle bleibt gesperrt. Erst dann Domain/TLS/Proxy umstellen und das Ziel als
   **einzigen Writer** samt einem Versandjob freigeben. Freigabe und Domainwechsel
   sind Betriebsaktionen und gehören nicht zum automatisierten Wechseltest.

## Daten erhaltender Rückweg

Vor erster Zieländerung kann auf den unveränderten geprüften Quellbestand
zurückgegangen werden. Nach Betriebsaufnahme wird die alte Quelle niemals
blind wieder geöffnet. Zuerst den neuen Writer und seinen Versandjob stoppen,
alle laufenden Arbeiten abfließen lassen und einen **frischen vollständigen
Zielbestand** über denselben geschützten Export sichern. Node unterstützt diesen
Export inklusive seiner Runtimehistorie und privaten Objekte.

Diesen aktuellen Bestand in einer frischen kompatiblen Rückumgebung vollständig
wiederherstellen und prüfen. Neue Zeilen, Bearbeitungen, Löschungen, Tombstones,
Identitätsaliases und Versandannahmen müssen enthalten sein. Historische
`unknown`/gebundene Nachrichten bleiben so; ein alter Outboxbestand darf keine
bereits angenommenen Nachrichten erneut versenden. Auth-Providerdaten und Keys
separat abgleichen, neue Anmeldung verlangen. Erst nach Zugriffstests und
Bestandsabgleich Domain/Writer umstellen. Ein Rückimport in eine schon benutzte
D1/R2-Umgebung braucht einen gesonderten geprüften Reconciliation-Plan; der
Node-Restore verspricht dafür keinen pauschalen Merge.

## Tatsächlicher Nachweis und Grenzen

`npm test` registriert `node-restore.test.mjs` und die Wechselprobe innerhalb des
bestehenden `node-runtime.test.mjs`; nur ein Test baut Next. Die Probe verwendet
einen echten isolierten D1-/R2-Quellbestand mit geschütztem Export, einen frischen Node-/SQLite-/Private-Files-Restore,
den tatsächlichen Next-Produktionsserver und echte SDK-Requests zu zwei isolierten
HTTPS-Auth-Protokollinstanzen. Nur der Testchild vertraut ihrem synthetischen
Zertifikat. Kein Produktions-Testhook und keine deaktivierte TLS-Prüfung.
Die tatsächlichen HTTP-Routen prüfen Rollen, Sperren/Tombstones, Besitzrechte,
private Downloads, Moderation, eine Annahme je Ereignis durch einen isolierten
SMTP-Server und Kontolöschung. Danach nimmt der pausierte Node-Server einen neuen
Export mit dieser Löschung auf; dessen Restore belegt den Rückweg. Ein alter
Backup-Retry wird abgewiesen. Offline-Prüfungen belegen originale Bytes/Metadaten,
ETag-Reservierungen, Historienhashes sowie keine Freigabe bei unvollständigen Files.

Das ist ein reproduzierbarer App-/Protokollnachweis. Echte Passwort-Hashmigration,
Google-Kontoübernahme, externe DNS/TLS-Umstellung und Postfachzustellung sind
nicht durchgeführt. SQLite ist für einen Host mit lokalem persistentem Datenträger
abgenommen; mehrere Hosts oder Netzwerkdateisysteme sind nicht geprüft.
Cloudflare-/Sites-Releasepakete und deren bestehende Pflichtprüfungen bleiben
unverändert erforderlich. Es wird keine Produktion automatisch aktiviert.
