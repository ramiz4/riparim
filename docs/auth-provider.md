# Auth-Anbieter und Wechsel

Riparim verwendet einen kleinen eigenen Vertrag in `lib/auth/contract.ts`.
Nur `lib/auth/provider.ts` importiert Anbieter-SDKs. Anmeldung, Registrierung,
Tokenbestätigung/Recovery, Google-PKCE, Passwort-Reauth und administrative
Kontoverwaltung behalten ihre bisherigen Abläufe. Fachliche Rollen,
Besitzrechte, Sperren und interne Konto-IDs liegen weiterhin in der App-Datenbank.
Es gibt keine neue Abhängigkeit, eigene Passwortkryptografie oder Providerengine.

Der Standard bleibt Supabase Auth. Eine zweite Instanz muss das verwendete
Supabase-/GoTrue-Protokoll unter `/auth/v1/` unterstützen, einschließlich
Settings, Sessionclaims, PKCE, E-Mail-Token-Hashes und Adminendpunkten. Eine
beliebige OIDC-URL erfüllt diesen Vertrag nicht. Ein anders aufgebauter Anbieter
benötigt eine eigene kleine Implementierung dieses Vertrags; seine SDKs gehören
in den Adapter, nicht in Geschäftsregeln.

## Geschützte Konfiguration

Ein Betreiber kann eine exakte alternative HTTPS-Origin freigeben:

```dotenv
AUTH_TRUSTED_ORIGIN=https://auth.example.test
SUPABASE_SECRET_KEY_ORIGIN=https://auth.example.test
SUPABASE_SECRET_KEY=<server-only-key-issued-by-that-instance>
```

Die Werte gehören ausschließlich in geschützte Laufzeitkonfiguration:
`.env` beim Node-Server, Secrets beim Worker beziehungsweise im Sites-Betrieb.
Der Releaseweg akzeptiert diese Namen im bestehenden Runtime-Secret-JSON.
Sie werden nicht in Git, Build-Artefakte, Browser oder Adminformular übernommen.

Danach kann die Verwaltung die exakt freigegebene Adresse und ihren öffentlichen
Publishable-/Anon-Key in der bestehenden `auth_settings`-Zeile konfigurieren.
Der Pfad ist immer `/auth/v1/`; Originwerte enthalten keine Zugangsdaten,
Pfade, Query oder Fragment. Ein expliziter HTTPS-Port gehört zur Origin und
muss überall übereinstimmen. Ohne Freigabe werden Customhosts abgewiesen,
auch wenn sie bereits in der Datenbank gespeichert sind. Nur HTTPS-Originwerte
mit portloser `*.supabase.co`-Domain bleiben wie bisher unmittelbar unterstützt.

**Die Freigabe eines Endpunkts gibt keine Administrationsgeheimnisse frei.**
Customhosts erhalten einen Service-Key erst bei exakt passender separater
`SUPABASE_SECRET_KEY_ORIGIN`. Eine Bindung an das alte Projekt deaktiviert die
Administration am neuen Host; der Betreiber muss bewusst einen Zielschlüssel
mit passender Bindung hinterlegen. Für bestehende hosted Supabase-Installationen
bleibt die bisherige Verwendung ohne neue Bindung kompatibel. Auch dort sollte
der Betreiber die exakte Credential-Origin setzen: danach sperrt jede
abweichende Origin die Administration. Die Werte werden pro Request geprüft.

Providerrequests erhalten Timeouts, bleiben auf ihrer konfigurierten Origin
und folgen keinen HTTP-Redirects. Das gilt auch für öffentliche Keys, Sitzungs-
und Reauthtokens. Kundenrequests verwenden ausschließlich öffentliche Keys;
der separate Adminclient speichert oder erneuert keine Browser-Sitzungen.
HTTP-only-, Secure- und SameSite-Cookies sowie Callback-/Rückwegprüfungen bleiben
bestehen. Bei Customhosts enthält der Cookie-Name die gesamte Origin, damit
unterschiedliche Hosts oder Ports keine alten Sitzungs-/PKCE-Tokens teilen.
Hosted Cookie-Namen bleiben kompatibel. Eine aktive Instanz kann im Formular nicht direkt gewechselt werden.

Der Transport verwendet `redirect: "manual"` und weist jede 3xx-Antwort zurück,
bevor ein weiteres Ziel kontaktiert wird. `redirect: "error"` wirft im verwendeten
Workers-Runtime bereits vor dem Netzwerkaufruf eine Exception. Bei einer anstehenden
Session-Erneuerung führte die SDK-Wiederholung dadurch zu 25,4 Sekunden Wartezeit
pro Auth-Prüfung und zu 50,8 beziehungsweise 76,2 Sekunden bei wiederholten Prüfungen.
Die native Workerprüfung schützt deshalb sowohl den erfolgreichen Provideraufruf
als auch die Redirect-Sperre.

Cookiebasierte Auth-Clients teilen innerhalb eines HTTP-Requests ein Zeitbudget
von 1,5 Sekunden ab dem ersten Provideraufruf, einschließlich Antwortkörper.
Netzwerkfehler, 5xx, Redirects und ungültige Antworten beenden die Prüfung ohne
SDK-Wiederholung; weitere Clients desselben Requests übernehmen diesen Ausfall.
Dabei werden keine Session-Cookies gelöscht oder überschrieben. Ein späterer
Request kann erneut prüfen. Eine eindeutige Ablehnung abgelaufener Credentials
bleibt hingegen wirksam. Provider- und App-Prüfungen sind weiterhin Voraussetzung
für private Rechte; der Ausfallzustand wird niemals zwischen Requests geteilt.
Explizite Anmelde- und Kontoänderungsoperationen beginnen eine neue Auth-Phase,
damit lokale Datenbank-/Dateiarbeit vor einer Mutation deren Budget nicht verbraucht.
Passwortclients ohne gespeicherte Sitzung und Adminclients behalten ihren
bisherigen Transport-Timeout.

## Kontoübernahme vor dem Cutover

Ein URL-Wechsel migriert weder Konten noch Zugangsdaten. Zuerst die Quelle und
Zielversion sowie den kontrollierten Export-/Importzugang feststellen und den
Vorgang in einer isolierten Instanz prüfen. Bei kompatiblem Supabase-Self-Hosting
beschreibt die [offizielle Restore-Anleitung](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
eine Datenbankübernahme inklusive Authdaten; Versionsunterschiede können
Schemaanpassungen erfordern. Die Voraussetzungen für Riparim sind:

- **Konten und Passwort-Hashes:** Der Export muss Auth-Bestandskonten einschließlich
  Bestätigungs- und Sperrstatus sowie der benötigten Identitätsdaten enthalten.
  Eine Admin-Listenabfrage liefert keine vollständige Passwortmigration. Das
  Ziel muss Hashformat und Version tatsächlich importieren und verifizieren
  können; andernfalls ist ein kontrollierter Passwort-Reset nötig. Hashes und
  Exporte bleiben sensible Daten und gehören in geschützte Migrationswerkzeuge.
- **Google-Identitäten:** Exakte OAuth-Subjects/Verknüpfungen erhalten oder geprüft
  übernehmen. Providerkonfiguration und Clientschlüssel separat am Ziel
  einrichten; Google-Callback auf dessen `/auth/v1/callback` registrieren.
  Gleiche E-Mail oder editierbare Metadaten beweisen keine Kontoidentität.
- **Riparim-Zuordnung:** Alle exakten Quell-/Zielidentitäten nach
  [account-identities.md](account-identities.md) geprüft an dieselben internen
  IDs binden, einschließlich gesperrter und gelöschter Konten. Bestände,
  Besitzrechte, Rollen und private Dateien vergleichen. Die bestehende
  Providerkennung `supabase` bezeichnet auch kompatible Instanzen; die
  normalisierte Issuer-Origin trennt sie eindeutig.
- **Sitzungen:** Neue Zielschlüssel machen alte Tokens nicht automatisch gültig.
  Einen kontrollierten Abmelde-/Neuanmeldezeitpunkt einplanen, keine Refresh-
  Tokens oder PKCE-Flows blind übertragen. Riparim widerruft App-Sitzungen
  bei neuer Zuordnung und prüft weiter Issuer/Subject. Alte Anbieterzugänge
  und Sessions separat stilllegen; alte Browsercookies können bis zur
  Ablaufzeit vorhanden sein, geben am Ziel aber keine Rechte.
- **SMTP und Rückwege:** SMTP, Absenderdomain, E-Mail-Vorlagen, Site-Origin,
  Callback-Allowlist und Google-Provider separat konfigurieren. Bestätigung,
  Recovery und Zustellung mit isolierten Konten prüfen, bevor der Versand
  für den Zielhost bestätigt wird. Die
  [Self-Hosting-Konfiguration](https://supabase.com/docs/guides/self-hosting/auth/config)
  verwendet eigene Auth-Umgebungswerte für Redirects und Provider.

Vor Zielzuordnungen alle alten Writer stoppen. Erst nach vollständig geprüftem
Import und Zuordnung Anmeldung deaktivieren, Origin und öffentlichen Schlüssel
kontrolliert setzen, Ziel-Geheimnis mit seiner Bindung hinterlegen und aktivieren.
Ein Schlüssel desselben Formats ist kein Nachweis, dass er zum Ziel gehört;
der Betreiber belegt das mit dem isolierten Admincheck. Die Zielinstanz muss
vor ihrer Freigabe vertrauenswürdig sein und korrektes TLS/DNS verwenden.

Rollback erfolgt nur auf eine identitätsfähige App-Version und einen weiterhin
vorhandenen geprüften Quellbestand. Ursprüngliche Identitätszuordnungen behalten,
Credentialbindung zurücksetzen und eine neue Anmeldung verlangen. Fehlende
Zuordnungen niemals durch automatische Verknüpfung nach E-Mail ersetzen.
Dieser Umbau führt keine Liveübernahme oder Provideränderung aus.

## Abnahme

`tests/auth-provider.test.mjs` verwendet die tatsächlich installierten SDKs und
eine isolierte HTTP-Protokollinstanz auf Loopback. Ausschließlich der Transport
wird von der genehmigten synthetischen HTTPS-Origin auf den lokalen Server
geleitet; Clients, PKCE, Cookieabläufe, Claims und Fachrouten sind echt.
Die Instanz prüft Anfragen/Keys und synthetische Tokens; es gibt keine Live-
Providerrequests, echten Konten oder E-Mails. Sie belegt Login, Registrierung,
Recovery/Reset, Bestätigung, Google-PKCE mit separatem Google-Proof-Fixture,
Passwort-Reauth, Logout, Admin-CRUD und erhaltene interne Konto-ID nach Mapping.
Sie prüft außerdem Metadaten-Rollenverbot, falschen Claims-Subject,
Provider-/Runtime-Sperren und verweigerte Credential-Weiterleitung bei Redirects.

Das ist ein Protokoll-Kompatibilitätsnachweis, kein geprüfter Import echter
Passwort-Hashes oder ein Betriebsaudit einer konkreten Self-Hosting-Installation.
Die vorhandenen Auth-/Google-/Native-/Kundenprüfungen bleiben registriert,
einschließlich Node-Betrieb, echtem D1, Cloudflare und Sites-Build.
