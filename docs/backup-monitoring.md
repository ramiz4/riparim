# Backup-Überwachung vorbereiten

**Stand 12.10.2026: implementiert, ausdrücklich deaktiviert.** Der Betreiber hat
für Issue #144 E-Mail gewählt und die Aktivierung zurückgestellt. Es wurden keine
Monitorzugänge, externen Checks, Dienste oder Timer eingerichtet und keine echten
Benachrichtigungen verschickt. Der tatsächliche Empfangstest steht bei der
späteren Aktivierung aus.

`scripts/monitor-backups.mjs` prüft `Supabase Auth Backup` und `Platform Backup`
getrennt über GitHub-Metadaten. Der kleine Node-Prozess benötigt keine zusätzlichen
npm-Pakete. Ein unabhängiger Linux/systemd-Timer auf einem vorhandenen, ständig
erreichbaren Betreiberhost soll ihn alle 15 Minuten aufrufen. Ein separater
Healthchecks.io-Check überwacht das Ausbleiben des Monitors. Ein weiterer
GitHub-Zeitplan wäre für diese Aufgabe nicht ausreichend.

## Erfolg, Alarmgrenzen und Zustellung

Gesund ist nur ein abgeschlossener erfolgreicher Main-Lauf mit dem exakten,
nicht leeren, veröffentlichten und nicht abgelaufenen Artefakt des aktuellen
Versuchs: `supabase-auth-<run_id>-<run_attempt>` beziehungsweise
`platform-<run_id>-<run_attempt>`. Die Veröffentlichungszeit muss zwischen Start
und Abschluss des Laufs liegen. Der Monitor lädt weder Archive noch Inhalte
herunter und besitzt keine Entschlüsselungsschlüssel.

| Zustand | Grenze und Begründung |
| --- | --- |
| Fehler, Abbruch, Timeout, Überspringen, ungültiges Artefakt oder deaktivierter Workflow | Alarm beim nächsten Aufruf, normalerweise binnen 15 Minuten. Beide Jobs bleiben unabhängig. |
| Kein gültiges Backup | Ab 36 Stunden seit dem letzten verifizierten Abschluss: täglicher Abstand von 24 Stunden plus zwölf Stunden Spielraum für GitHub-Verzögerungen. Ohne verifizierte Sicherung sofort alarmieren. |
| Lauf hängt | Ab 30 Minuten seit Laufstart. Beide Backup-Jobs haben ein Zehn-Minuten-Limit; die zusätzlichen 20 Minuten tolerieren verzögerte Statusmeldungen. |
| Lauf wartet | Ab zwei Stunden seit Erstellung des aktuellen Versuchs. Fehlt ein eindeutiger Zeitwert einer Wiederholung, gilt ihre erste dauerhaft gespeicherte Beobachtung. Das gibt verzögertem Runnerstart mehr Spielraum als der eigentlichen Ausführung. |
| Unveränderter Vorfall | Höchstens eine Erinnerung pro Job und 24 Stunden. Eine neue gültige Folgesicherung ermöglicht eine Entwarnung. |
| Monitor oder Versand nicht verifiziert | Kein Erfolgs-Heartbeat; Fehlerstatus und Exitcode 1. Unbekannte Zustellung zählt nicht als Erfolg. |

Die E-Mail enthält ausschließlich Jobname, Status, Zeitpunkt der letzten
verifizierten Sicherung und einen festen GitHub-Lauf- oder Workflowlink. Keine
Kontodaten, Tokens, Dokumente, Archivbytes oder Schlüssel werden versendet.
Resend-Annahme allein zählt nicht als Zustellung: `delivered`, `opened` oder
`clicked` bestätigen die Übergabe; andere Zustände bleiben offen. Auch dieser
Providerbeleg ersetzt nicht den tatsächlichen Empfangstest im Betreiberpostfach.
[Resend-Zustellstatus](https://resend.com/docs/api-reference/emails/retrieve-email).

Ein gesunder Heartbeat bestätigt die Funktionsfähigkeit von Prüfung, Zustand und
erforderlichem Versand. Er bedeutet nicht, dass beide Backups gesund sind: Ein
erfolgreich gemeldeter Backupfehler darf den Monitor weiterhin als funktionsfähig
ausweisen. Der JSON-Ausgang trennt `monitorHealthy` und `backupsHealthy`.
API-, Kontingent-, Zustands- und Versandfehler können keinen gesunden
Monitorstatus erzeugen. Healthchecks erhält einen leeren POST beziehungsweise
`/fail`, ohne Job- oder Kontoinhalte.
[Pinging API](https://healthchecks.io/docs/http_api/).

Die GitHub-Abfrage berücksichtigt die letzten 32 Tage erstellter Läufe. Das
umfasst GitHubs 30-Tage-Fenster für Wiederholungen zuzüglich der 36-Stunden-Grenze
für frische Sicherungen. Sie paginiert bis 500 Läufe und 500 Artefakte pro Lauf
und prüft höchstens 20 erfolgreiche Kandidaten. Wartende Wiederholungen verwenden
zusätzlich die Metadaten ihres aktuellen Versuchs, höchstens 20 Abfragen je Job.
Die ursprüngliche Erstellung des übergeordneten Laufs bestimmt nicht deren
Wartefrist. Ein fehlender aktueller Zeitwert erhält eine dauerhaft gespeicherte
Beobachtungsfrist; ebenso weitere Wiederholungen oberhalb der 20 Abfragen.
Spätere Statusupdates und Neustarts verschieben diese Frist nicht. Je Job sind
höchstens 500 Beobachtungseinträge erlaubt; nicht mehr wartende Versuche werden
entfernt. [Metadaten eines Versuchs](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run-attempt).
API-Ausfälle bleiben Prüfungsfehler. Überschrittene Listen-/Kandidatengrenzen und
unvollständige oder ungültige Antworten sind Prüfungsfehler. Eine neue Wiederholung
eines älteren Laufs wird anhand ihres aktuellen Versuchs und Artefakts geprüft.
[GitHub-Wiederholungsfenster](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs).
[Läufe](https://docs.github.com/en/rest/actions/workflow-runs),
[Artefakte](https://docs.github.com/en/rest/actions/artifacts).

## Kosten und benötigte Zugänge

Vor Aktivierung aktuelle Kontingente und deren vorhandenen Verbrauch erneut
prüfen. Keine Paid-Pläne oder kostenpflichtigen Overages einschalten.

- **Ausführung:** Keine zusätzliche Hostgebühr nur bei Nutzung eines bereits
  vorhandenen ständig laufenden Hosts. Ein solcher Host ist für Riparim noch
  nicht bestätigt. Neue Hardware, ein VPS und dessen Betrieb sind nicht durch
  diese Implementierung als kostenlos nachgewiesen.
- **GitHub:** Im Normalfall sechs Metadatenabfragen pro Aufruf, also 24 pro Stunde.
  Öffentlich unauthentifiziert gelten 60 pro Stunde und IP; andere Nutzung und
  Pagination können das überschreiten. Optional einen Fine-grained Token nur für
  `ramiz4/riparim`, ausschließlich **Actions: Read**, einsetzen; üblicherweise
  5.000 Requests pro Stunde. Die implementierte Obergrenze liegt bei 1.008
  Metadatenrequests pro Stunde bei vier Aufrufen. Bei Limits bleibt der Monitor
  fehlerhaft. [GitHub-API-Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
- **Resend Free:** 3.000 Nachrichten pro Monat, 100 pro Tag, gemeinsam mit den
  bestehenden App-/Authmails. Ein unveränderter Ausfall beider Jobs erzeugt etwa
  zwei Nachrichten täglich plus spätere Entwarnungen; häufig wechselnde Vorfälle
  und Tests erhöhen das. Die vorhandene bestätigte Domain verwenden. Ein
  Kontingentfehler blockiert die bestätigte Zustellung und löst keinen
  Erfolgs-Heartbeat aus. [Tarif](https://resend.com/pricing).
  API-Aufrufe werden mit mindestens 600 ms Abstand ausgeführt; ein geteiltes
  Teamlimit kann dennoch greifen. [API-Limits](https://resend.com/docs/api-reference/usage-limits).
- **Healthchecks.io Hobbyist:** Ein Check von 20 kostenlosen Checks; 100 rollierende
  Logeinträge je Check. 96 Aufrufe täglich benötigen keinen Paid-Tarif; die
  begrenzte Historie umfasst ungefähr einen Tag. Bei belegtem Checkkontingent
  nicht automatisch aufrüsten. E-Mail-Integration und begrenzte Erinnerungen
  konfigurieren und selbst testen. [Tarif und Logaufbewahrung](https://healthchecks.io/pricing/).

Ein separater Resend-Schlüssel muss Senden und Abrufen des Zustellstatus erlauben;
ein `sending_access`-Schlüssel genügt nicht. Das erforderliche `full_access`
gewährt weitergehenden Resend-Zugriff und gehört ausschließlich auf den privaten
Monitorhost. Der Monitor braucht keine Supabase-, D1-, R2- oder Git-Schreibrechte.
Neue Schlüssel und die geheime Heartbeat-URL im bestehenden
1Password-Projekteintrag `mkp7xa42clfbreiv2q3b3nrq5y` aufbewahren; niemals
Entschlüsselungsschlüssel an den Monitor übergeben.

## Spätere Einrichtung und Aktivierung

Verantwortlich ist der Riparim-Betreiber. Diese Schritte sind vorbereitet und
werden erst nach einem eigenen Aktivierungsauftrag ausgeführt:

1. Einen unabhängigen, dauerhaft laufenden Host und das Betreiberpostfach
   festlegen; Node gemäß `package.json` bereitstellen. Ein schlafender Laptop
   eignet sich nicht als täglicher Monitor. Kontingente und E-Mail-Absender prüfen.
2. Ausschließlich den zu einem vollständig veröffentlichten, geprüften GitHub
   Release gehörenden Main-Commit schreibgeschützt unter
   `/opt/riparim-monitor/current` bereitstellen. Release-Tag und Commit prüfen;
   keinen Featurebranch oder offenen PR installieren. Der Monitor ist in diesem
   Quellcheckout enthalten, nicht im Anwendungsarchiv. Updates verwenden ebenso
   einen geprüften Main-Release; der private Zustand bleibt außerhalb des Checkouts.
3. Einen Healthchecks.io-Hobbyist-Check für **Riparim Backup Monitor** mit
   15 Minuten Periode und 15 Minuten Grace einrichten. Seine eigene
   E-Mail-Integration an das Betreiberpostfach verifizieren, einschließlich
   Ausbleibealarm, Entwarnung und begrenzter Erinnerungen. Dieser zweite
   Versandweg muss auch bei ausgefallenem Resend-API-Zugang funktionieren.
4. Einen eigenen unprivilegierten Benutzer `riparim-backup-monitor` einrichten.
   [Env-Vorlage](examples/backup-monitor.env.example) geschützt nach
   `/etc/riparim-backup-monitor.env` übernehmen (`root`, Modus `0600`). Schlüssel
   aus 1Password einsetzen, ohne sie in Befehlsargumenten, Shellhistorie oder Logs
   auszugeben. `BACKUP_MONITOR_ENABLED=false` zunächst beibehalten.
5. [Service](examples/riparim-backup-monitor.service) und
   [Timer](examples/riparim-backup-monitor.timer) nach Prüfung der Hostpfade
   bereitstellen; zunächst nicht aktivieren. Das Stateverzeichnis hat Modus
   `0700`, die Zustandsdatei `0600`. Es enthält nur technische Status-, Zeit- und
   Versandbelege und darf nicht mit einem anderen Monitorhost geteilt werden.
6. Die ungefährliche Empfangsabnahme durchführen: mit synthetischen Main-Läufen
   und künstlichen Artefaktmetadaten `runBackupMonitor` an den realen E-Mail-
   Adapter anbinden. Pro Job Fehler, fehlenden/deaktivierten Lauf, ungültiges
   Artefakt, tolerierte Verzögerung, begrenzte Wiederholung und neue erfolgreiche
   Folgesicherung prüfen. Reale Backupjobs oder deren Archive dabei nicht ändern.
   Zustellbeleg **und** tatsächlichen Eingang der Alarm-/Entwarnungsmails prüfen.
   Die isolierten Fixtures in `tests/backup-monitor.test.mjs` zeigen den Vertrag;
   dieser Test selbst verwendet ausschließlich simulierte Transportadapter.
7. Zusätzlich einen ungefährlichen falschen Versandzugang und einen unterbrochenen
   Heartbeat simulieren. Es darf kein gesunder Monitorstatus entstehen;
   der externe E-Mail-Ausbleibealarm muss ankommen. Healthchecks-/GitHub-/Resend-
   Nichterreichbarkeit als unbekannten Zustand behandeln, nicht als Backup-Erfolg.
   Auch der externe Check und das Betreiberpostfach brauchen wiederkehrende
   manuelle Empfangsprüfungen; ein vollständiger Ausfall aller Alarmwege bleibt
   eine ausdrücklich dokumentierte Betriebsgrenze.
8. Erst nach dokumentierter Abnahme `BACKUP_MONITOR_ENABLED=true` setzen und
   den Timer aktivieren. Er läuft außerhalb von GitHub; ein deaktivierter
   Backup-Zeitplan bleibt erkennbar. Aktuellen Status und nächsten Timertermin
   kontrollieren. Die reine Installation und der folgende Standardaufruf
   aktivieren nichts:

   ```sh
   npm run backups:monitor
   # {"status":"inactive"}
   ```

## Fehler beheben und sicher fortsetzen

Bei einem Backupalarm zuerst den verlinkten Lauf und dessen Artefakt prüfen,
Ursache beheben und den betroffenen Main-Workflow erneut starten. Die andere
Sicherung ersetzt ihn nicht. Ein Backuprestore bleibt ein separater Auftrag nach
[Authbackup-Anleitung](auth-backups.md) beziehungsweise
[Plattformbackup-Anleitung](platform-backups.md).

Bei Monitoralarm Servicezustand, Host, Uhrzeit, Kontingente, Netzwerk,
Zustandsrechte und Versandbelege privat prüfen. Providerfehlertexte werden nicht
öffentlich geloggt. Dauerhafte Pending-Nachrichten nicht durch Löschen des
gesamten Zustands „reparieren“: Das verliert Vorfälle und Deduplizierung.
Versandpayload und Idempotenzschlüssel werden vor dem Senden atomar und mit
`fsync` gespeichert. Absender, Empfänger und Providerkonto bei offenen Sends
nicht ändern; zuerst deren Zustellung eindeutig abgleichen. Resend hält
Schlüssel 24 Stunden; unbestätigte Sends werden
höchstens 23 Stunden automatisch mit denselben Bytes wiederholt. Danach den
Providerbeleg privat abgleichen und den einzelnen Pending-Eintrag erst nach
eindeutiger Auflösung korrigieren. Kein automatischer Neuversand nach Ablauf.
[Idempotenz](https://resend.com/docs/dashboard/emails/idempotency-keys).

Die Lockdatei verhindert parallele Aufrufe. Nach abruptem Prozessende bleibt sie
bewusst bestehen. Erst den Timer stoppen, sicher ausschließen, dass noch ein
Monitorprozess läuft, und anschließend ausschließlich dessen verwaiste
`state.json.lock` entfernen. Den privaten Zustand erhalten. Bei einem Rollback
Timer stoppen und die Zustandsversion mit dem früheren geprüften Main-Release
abgleichen; unbekannte Versionen bleiben Fehler. Ohne Timer/Heartbeat bleibt die
Überwachung ausdrücklich deaktiviert und liefert keinen Schutz.

Die reguläre Testsuite führt die Offline-Regressionen aus:

```sh
node tests/backup-monitor.test.mjs
npm test
```

Sie prüfen die Anforderungen mit synthetischen Daten und simulierten GitHub-,
Resend- und Heartbeat-Antworten, inklusive Zustellfehlern und unterbrochenen
Versandzuständen. Sie behaupten keinen tatsächlichen Postfachempfang.
