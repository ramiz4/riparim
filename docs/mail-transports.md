# Bewertungsnachrichten und Anbieterwechsel

Die bestehende Outbox übernimmt weiterhin Moderationsereignisse, Leases,
Backoff und Verarbeitung alle fünf Minuten. Die Moderationsentscheidung bleibt
auch bei Versandfehlern erfolgreich. Der kleine Vertrag in
`lib/notifications/transports.ts` wählt Resend oder SMTP; es gibt keinen
zusätzlichen Queue-Dienst und keinen automatischen Provider-Fallback.

## Konfiguration

Ohne `EMAIL_TRANSPORT` gilt weiterhin Resend. `EMAIL_TRANSPORT=resend`,
`RESEND_API_KEY` und `TRANSACTIONAL_EMAIL_FROM` funktionieren wie bisher.
Der Worker verwendet diesen HTTP-Transport. Ein SMTP-Auswahlwert im Worker
blockiert neue Ereignisse vor Netzwerkzugriff; SMTP-Zugangsdaten gehören dort
nicht in die Deployment-Secrets.

Der portable Node-Betrieb unterstützt zusätzlich `EMAIL_TRANSPORT=smtp`:

```dotenv
EMAIL_TRANSPORT=smtp
SMTP_URL=smtps://fixture-user:replace-with-secret@smtp.example.test:465
SMTP_SECRET_ORIGIN=smtps://smtp.example.test:465
TRANSACTIONAL_EMAIL_FROM=Riparim <no-reply@auth.example.test>
SITE_ORIGIN=https://riparim.example.test
```

`SMTP_URL` ist ein serverseitiges Geheimnis. Benutzer und Passwort werden bei
Bedarf URL-kodiert. `SMTP_SECRET_ORIGIN` muss genau Protokoll, normalisierten Host
und expliziten Port des credentialfreien Ziels angeben. Pfade (außer `/`),
Queryparameter, Fragmente und ungebundene Zugangsdaten sind ungültig. Der
SMTP-Server muss den Absender für die gewählte Domain erlauben. SPF, DKIM und
DMARC sowie Providerlimits bleiben Aufgabe der Domain-/Mailserverkonfiguration.

`smtps://` verwendet sofort TLS; `smtp://` verlangt STARTTLS. Zertifikate werden
mit Node-Vertrauensankern und mindestens TLS 1.2 geprüft. TLS lässt sich nicht
über die URL abschalten. Nur ein Relay auf der **numerischen** Loopback-Adresse
`127.0.0.1` oder `::1` darf ohne Zugangsdaten unverschlüsselt arbeiten; dies ist
der lokale Testweg. `localhost` ist keine Klartext-Ausnahme. Interne CAs müssen
im geschützten Node-Betrieb über den normalen Node-Truststore eingerichtet
werden. Die TLS-Probe nutzt ausschließlich eine isolierte Fixture-CA.

DNS, Verbindungsaufbau, Greeting und Socket-Inaktivität sind auf jeweils acht
Sekunden begrenzt; zusätzlich schließt ein Gesamtlimit von 20 Sekunden die
SMTP-Verbindung. Die Outbox-Lease bleibt 120 Sekunden. Nodemailer 10.1.0 liefert
MIME-Erzeugung und den dokumentierten einzelnen SMTPConnection-Lifecycle;
Connection-Pools und deren automatische Requeues werden nicht verwendet.
Nodemailer wird nur in Node-Builds geladen.

`SUPABASE_SECRET_KEY` beziehungsweise der gebundene Adminschlüssel des
[kompatiblen Auth-Hosts](auth-provider.md) bleibt für die Prüfung der bestätigten
Kontoadresse erforderlich. Browserdaten können Absender, Empfänger und Inhalte
nicht überschreiben. Neue Nachrichten verwenden die bestätigte DE/SQ/EN-Präferenz.

## Persistenz und Wiederholung

Migration `0017_mail_transports.sql` ist vor dem neuen Code anzuwenden. Sie
ergänzt ausschließlich nullable `transport`, nullable `wire_payload` und
`smtp_in_flight` mit Default 0. Eine Datenübernahme ist nicht nötig. Bereits
begonnene Ereignisse mit `transport=NULL` gehören immer zu Resend.

Vor dem ersten Netzwerkzugriff werden Transport, Hash der Zugangskonfiguration
und ursprüngliche JSON-Payloadbytes atomar gespeichert. SMTP friert zusätzlich
die gesamten RFC-5322/MIME-Bytes ein, einschließlich Datum, Message-ID, Absender,
Sprache und Kodierung. Der Hash umfasst SMTP-Host, Port, TLS-Modus, lokale
Relay-Ausnahme, Benutzer und Passwort; Geheimnisse werden nicht in der Tabelle
kopiert. Bekannte Wiederholungen behalten diese Bytes selbst nach Änderungen an
Absender oder Sprachpräferenz. Geänderte bestätigte Empfänger blockieren sie.

Resend wiederholt die identische Anfrage mit dem bestehenden Ereignisschlüssel
nur innerhalb von 23 Stunden; der Provider hält die Idempotenzschlüssel 24
Stunden. Bei SMTP gibt es diese Provider-Idempotenz **nicht**. Die dauerhafte
Markierung `smtp_in_flight=1` wird vor Verbindungsbeginn gesetzt:

- Nur vom SMTP-Client eindeutig verarbeitete AUTH-/Envelope-/DATA-Ablehnungen
  (`EAUTH`, `EENVELOPE`, `EMESSAGE` mit 4xx/5xx) beweisen Nichtannahme. 4xx
  erhalten Backoff; 5xx bleiben für kontrollierte Reparatur blockiert. Nur eine
  erfolgreich gespeicherte Nichtannahme löscht den Marker. Connection-, Socket-,
  Timeout- und Protocolfehler bleiben `unknown`, auch mit `responseCode`: Eine
  unterminierte oder unvollständige Mehrzeilenantwort beweist keine Ablehnung.
- Verbindungsabbruch, Timeout, Prozessverlust, abgelaufene Lease und verlorene
  Erfolgs-/Start-Acknowledgements ergeben `unknown`. Auch administratives
  `force` darf daraus keine neue Sendung machen.
- Eine positive Providerantwort bedeutet Übergabe, keine endgültige Zustellung.
  Nach gespeichertem Erfolg werden private Payload und MIME-Inhalt entfernt.

Es gibt keine Exactly-once-Zustellgarantie. Bei `unknown` muss ein Betreiber die
Message-ID im Relay-/Providerprotokoll abgleichen und gegebenenfalls die
Bestätigung separat dokumentieren. Diese Änderung bietet bewusst keine Aktion
zum ungeprüften Freischalten solcher Ereignisse.

## Wechsel und Prüfung

1. Den geprüften Main-Release samt Migration im Zielbetrieb vorbereiten; vor
   Daten-/Domainumstellung den [portablen Betriebsweg](node-runtime.md) und
   die [Release-Regeln](releases.md) befolgen. Alte und neue Outbox-Prozesse nicht
   gleichzeitig gegen unterschiedliche Datenbankkopien schreiben lassen.
2. Historische begonnene Resend-Ereignisse unter der bisherigen Konfiguration
   innerhalb ihrer sicheren Frist abarbeiten oder beim bisherigen Anbieter
   prüfen. Begonnene Ereignisse dürfen keinen anderen Transport/Host/Schlüssel
   erhalten. Unbegonnene Ereignisse dürfen mit neuer Konfiguration starten.
3. SMTP-Host, TLS, Domainfreigabe und Authentifizierung in isolierter Umgebung
   prüfen. Zugangskonfiguration im geschützten Node-Betrieb setzen. Die bestehende
   geschützte Notification-API zeigt Fehler ohne Empfänger, Nachrichten oder Keys.
4. `npm run notifications:node` im Node-Betrieb alle fünf Minuten ausführen.
   Kein zusätzliches Queue-Produkt ist nötig. Nach dem Wechsel nur neue oder
   noch unbegonnene Ereignisse durch den neuen Anbieter verarbeiten lassen.
5. Bei Rückkehr zum alten Transport dessen ursprünglichen Scope wiederherstellen;
   `unknown` bleibt gesperrt. Keine Outboxzeilen löschen, kopieren oder Statuswerte
   zurücksetzen, um einen Retry zu erzwingen.

Die reguläre Testsuite prüft tatsächliches lokales SMTP, negative RCPT-/DATA-
Antworten, unterminierte 4xx/5xx- und Mehrzeilenantworten, Socketverlust nach
DATA, Datenbank-Ack-Verlust, Konkurrenz und Lease-
Verlust sowie TLS-Authentifizierung mit einer isolierten CA, Ablehnung eines
unvertrauten Zertifikats und Credentialzielbindung. Alle Testdaten sind fiktiv;
es werden keine echten E-Mails gesendet und keine Live-Provider verändert.

Primäre Verträge: [Nodemailer SMTP](https://nodemailer.com/smtp),
[SMTPConnection](https://nodemailer.com/extras/smtp-connection),
[Nodemailer-Fehlervertrag](https://nodemailer.com/errors) und
[Resend Idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
