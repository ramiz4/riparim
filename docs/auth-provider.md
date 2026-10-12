# Auth-Anbieter und Wechsel

Riparim besitzt den Auth-Vertrag in `lib/auth/contract.ts`: verifizierte Nutzer
mit `provider`, exaktem `issuer` und `subject`, Sitzungsnachweise, die benötigten
Anmeldeabläufe, verfügbare Fähigkeiten und normalisierte Fehler. Fachliche
Rollen, Sperren, Besitzrechte und interne Konto-IDs liegen in der App-Datenbank.
Es gibt genau zwei Adapter: Supabase Auth und PocketBase. Eine andere Adresse
muss zum ausgewählten Protokoll passen; eine beliebige OIDC-URL ist kein Adapter.

`lib/auth/provider.ts` wählt die beiden konkreten Implementierungen aus.
Supabase-SDKs, GoTrue-Claims, UUIDs, Public-Key-Formate und SSR-/PKCE-Cookies
bleiben in `lib/auth/adapters/supabase.ts`; historische Kontoschlüssel,
Sitzungskennungen und Tombstones in `lib/auth/legacy-supabase.ts`.
`lib/auth/adapters/pocketbase.ts` spricht dessen REST-Protokoll direkt, ohne
zusätzliches SDK. Die Fachrouten verwenden camelCase-Daten und kennen keine
Providerclaims. Google wird zusätzlich über Googles serverseitiges `userinfo`
geprüft. Profildaten, gleichlautende E-Mail-Adressen und editierbare Rollenfelder
verleihen keine Rechte.

## Bestehende Supabase-Installation

Migration `0018_auth_providers.sql` ergänzt `auth_settings.provider` und die
Providerbindung privater Löschgrants mit Default `supabase`. Bestehende
Einstellungen, Kontoschlüssel und Hosted-SSR-Cookies funktionieren weiter.
Alte und neue Sitzungen werden anhand der exakten Identität geprüft. Neue
App-Sitzungsschlüssel trennen auch gleiche Provider-SIDs verschiedener Issuer;
vorhandene Supabase-SIDs besitzen eine ausdrücklich begrenzte Lesekompatibilität.
Angewendete Migrationen wurden nicht verändert. Der alte zeitgesteuerte
Supabase-Aktivierungswert kann kein PocketBase-Profil aktivieren.

Hosted Supabase unter einer portlosen `*.supabase.co`-Origin bleibt der Standard.
Für eine alternative kompatible Instanz:

```dotenv
AUTH_TRUSTED_PROVIDER=supabase
AUTH_TRUSTED_ORIGIN=https://auth.example.test
SUPABASE_SECRET_KEY_ORIGIN=https://auth.example.test
SUPABASE_SECRET_KEY=<server-only-key-issued-by-that-instance>
```

Ein fehlendes `AUTH_TRUSTED_PROVIDER` bedeutet aus Kompatibilitätsgründen
`supabase`. Für neue Installationen kann der Adminschlüssel alternativ unter
`AUTH_ADMIN_KEY` mit **beiden** expliziten Bindungen `AUTH_ADMIN_KEY_PROVIDER`
und `AUTH_ADMIN_KEY_ORIGIN` liegen. Dieser Schlüssel hat Vorrang; eine falsche
Bindung fällt nicht auf den alten Schlüssel zurück. Hosted-Installationen
behalten die bisherige Credentialkompatibilität, solange keine explizite
Originbindung vorliegt. Eine freigegebene öffentliche Origin gibt niemals
Administrationsgeheimnisse frei.

Supabase benötigt den öffentlichen Publishable-/Anon-Key in der Verwaltung.
E-Mail-Bestätigung, Signup, Recovery, PKCE, Adminendpunkte und der getrennte
serverseitige Google-Proof behalten ihre bisherigen Verträge. Die vorhandenen
Supabase-E-Mail-Vorlagen und Hinweise gehören nur zu diesem Adapter.

## PocketBase-Profil

Der konkrete Adapter wurde gegen PocketBase **0.40.5** geprüft. Er verwendet
`/api/collections/users/` und die aktuelle Systemcollection `_externalAuths`,
deren providerverwaltete Beziehungen `recordRef`/`collectionRef` enthalten.
Er setzt die Standard-Authcollection `users` mit ID `_pb_users_auth_` voraus.
Kein öffentlicher Supabase-Key wird verwendet.

```dotenv
AUTH_TRUSTED_PROVIDER=pocketbase
AUTH_TRUSTED_ORIGIN=https://auth.example.test
AUTH_ADMIN_KEY_PROVIDER=pocketbase
AUTH_ADMIN_KEY_ORIGIN=https://auth.example.test
AUTH_ADMIN_KEY=<private-superuser-auth-token-issued-by-pocketbase>
```

Der Betreiber richtet diese konkrete Instanz ein:

- Authcollection `users`: Passwortauth mit Identitätsfeld `email`, kein MFA
  für die hier unterstützten Abläufe. Textfeld `name` und zusätzlich Textfeld
  `preferredLocale` für `de`, `sq`, `en`. Die normalen Riparim-Grenzen für
  Name und Passwort gelten weiter. Fehlende zurückgelesene Profilfelder werden
  als Fehler behandelt, nicht als erfolgreiche Speicherung.
- Registrierung freigeben, ohne Gäste `verified` setzen zu lassen, z.B.
  `createRule: @request.body.verified:isset = false`. Öffentliche Schreibrechte
  dürfen weder `verified`, E-Mail-Identität noch Providerverknüpfungen freigeben.
  Profiländerungen in Riparim laufen über den separat gebundenen Adminclient.
  API-Regeln und aktuelle Berechtigungen in einer isolierten Instanz prüfen.
- SMTP und die E-Mail-Vorlagen einrichten. Der bestätigte Versandstatus in
  Riparim wird erst nach tatsächlicher Prüfung gesetzt. Der Adapter ruft
  `request-verification` bzw. `request-password-reset` auf; diese APIs erhalten
  keine requestbezogene Redirectadresse.
- Bestätigungslink in der PocketBase-Vorlage:
  `https://riparim.com/auth/bestaetigen?type=signup&token_hash={TOKEN}`.
  Recoverylink:
  `https://riparim.com/auth/bestaetigen?type=recovery&token_hash={TOKEN}`.
  `{TOKEN}` ist der PocketBase-Vorlagenplatzhalter. In einer Testinstanz die
  eigene Site-Origin verwenden. Locale/Rückweg werden im gleichen Browser über
  ein privates kurzlebiges Intentcookie erhalten; auf einem anderen Gerät gilt
  der sichere Standardrückweg. Bestätigung erfordert danach eine neue Anmeldung.
- Google-OAuth im Provider einrichten. Google erhält die **vollständige**
  Rücksprungadresse der App unter `/auth/bestaetigen`, inklusive Locale und
  Flowquery. Der Adapter erhält State und PKCE-Verifier von `auth-methods`,
  erlaubt nur Googles HTTPS-Autorisierungsadresse und hält den Austauschzustand
  privat. Die serverseitigen Providerlinks und ein unabhängiger Google-Proof
  müssen dieselbe Google-Identität und bestätigte E-Mail ergeben.
- Einen privaten PocketBase-Superuser-Authtoken betreiberseitig ausstellen,
  geschützt hinterlegen, dessen Ablauf und Erneuerung planen. Er wird nie als
  Browsertoken oder Public-Key verwendet. Fehlende, abgelaufene oder falsch
  gebundene Credentials verweigern administrative Vorgänge.

PocketBase hat weder GoTrue-AMR noch eine individuelle Sitzungs-ID. Es kann
für zwei Anmeldemethoden desselben Kontos in derselben Sekunde denselben Token
minten. Deshalb erzeugt Riparim **pro erfolgreicher Anmeldung** eine zufällige
private App-Nonce und bindet den Grant an Nonce, Token, Provider und Issuer.
Ein unabhängiger Passwortbrowser erbt keine Google-Rechte. Cookies enthalten
keine behauptete Authmethode; Rollen kommen aus dem eingeschriebenen App-Grant.

Jeder Request prüft den gespeicherten Bearertoken serverseitig mit
`auth-refresh`, verwendet jedoch weiterhin den ursprünglich eingeschriebenen
Token. Die zurückgelieferte Tokenrotation ersetzt den Grant nicht. Nach Ablauf
des ursprünglichen Provider-Tokens ist eine neue Anmeldung nötig; die lokale
Grantlaufzeit bleibt maximal 30 Tage. PocketBase besitzt keinen individuellen
serverseitigen Logoutendpunkt: Riparim widerruft den aktuellen App-Grant und
entfernt die Browsercredentials. Ein kopiertes Cookie erhält damit keine
Riparim-Rechte mehr; der Upstreamtoken selbst läuft nach Providerregeln ab.

PocketBase validiert einen Recoverytoken erst bei `confirm-password-reset`.
Der Link öffnet daher ausschließlich eine zeitlich begrenzte Resetcapability;
auch ein syntaktisch korrektes JWT verleiht vorher **keine** App-Sitzung,
Moderation, Kontoidentität oder Löschberechtigung. Erst nachdem der Provider
diesen konkreten signierten Token akzeptiert hat, wird dessen Subject an die
interne Zuordnung gebunden und werden dessen App-Grants widerrufen. PocketBase
invalidiert bei erfolgreichem Reset auch die vorherigen Provider-Tokens. Die
Capability wird anschließend verbraucht; für normalen Passwortwechsel dieses
Kontrollverfahren verwenden.

Quellen: [PocketBase Auth](https://pocketbase.io/docs/authentication/),
[Records API](https://pocketbase.io/docs/api-records/),
[0.40.5 Tokenvertrag](https://github.com/pocketbase/pocketbase/blob/v0.40.5/core/record_tokens.go),
[0.40.5 ExternalAuth-Berechtigungen](https://github.com/pocketbase/pocketbase/blob/v0.40.5/apis/record_crud_external_auth_test.go).

## Konfiguration und sicherer Cutover

Alle Secrets und Trustbindungen liegen ausschließlich in geschützter
Laufzeitkonfiguration: Node-`runtime.env`, Worker-Secrets beziehungsweise dem
Sites-Runtime-Secret-JSON. Nodeinstaller und Cloudflare-/Sites-Secretallowlist
kennen die neuen Namen. Browserformular und API liefern nur Provider, exakte
HTTPS-Adresse, ggf. öffentlichen Key und Betriebsflags zurück. Endpunkte haben
keine Zugangsdaten, Pfade, Query oder Fragment; Ports gehören zur Origin.
Requests sind zeitlich begrenzt und folgen keinen Redirects. Google-Prooftokens
gehen ausschließlich an Googles festen HTTPS-Userinfo-Endpunkt.

Der Provider-/Originwechsel einer aktiven Anmeldung wird serverseitig
verweigert, auch wenn im selben Request `enabled=false` gesetzt wird. Zuerst
am bisherigen Profil deaktivieren, dann die neue Konfiguration als Entwurf
prüfen und bewusst aktivieren. Der geschützte Native-Bootstrapzugang bleibt
separat; ein Nodebetrieb benötigt die dokumentierte Betreiber-/Datenübernahme,
keinen öffentlichen Bootstrapendpunkt.

Vorher:

1. Quelle und Zielversion sichern und beide Writer für die Übernahme stoppen.
   Zielkonten, Bestätigungsstatus und Providerverknüpfungen isoliert prüfen.
   Auth-Adminlisten exportieren keine vollständigen Passwort-Hashes.
2. **Passwörter:** Hashübernahme ist an die nachgewiesenen Importfunktionen,
   Formate und Versionen beider konkreten Systeme gebunden. Dieser Adapter
   implementiert keinen Hashimport. Ohne separat belegte Importkompatibilität
   einen kontrollierten Passwort-Reset vorsehen. Geheimnisse/Exporte gehören
   nicht in Source, Browser, Logs oder normale argv.
3. **Identitäten:** Exakte Quell- und Zielidentität unabhängig beweisen und
   gemäß [account-identities.md](account-identities.md) an denselben internen
   Account binden. Die Zuordnung nutzt Provider **und den gesamten exakten
   HTTPS-Issuer**, einschließlich eines möglichen Realmpfads. Die beiden
   aktuellen Adapter verwenden Origins. Gleichlautende Subjects verschiedener
   Provider/Issuer oder gleiche E-Mail-Adressen werden niemals automatisch
   verknüpft. Rollen, Sperren, Lösch-Tombstones, Besitzrechte und private
   Dateipfade gehören weiter zum unveränderten internen Account.
4. **Sitzungen:** Zuordnung widerruft alte App-Grants. Laufende Browserlogins,
   OAuth-/PKCE-Flows und begonnene Löschgrants sind an ihre Quellidentität
   gebunden und bekommen am Ziel keine Rechte. Alte Providerzugänge separat
   stilllegen; keine Refresh-, Bearer- oder Recoverytokens übertragen.
5. SMTP, Googleclient, vollständige Callbackadressen, Datenbestände und
   Kundenabläufe mit isolierten Konten prüfen. Erst danach bewusst aktivieren.

Der Rückweg erhält Quell- und Zielzuordnungen sowie die unveränderten
Anwendungsdaten. Anmeldung am Ziel deaktivieren, ursprünglichen geprüften
Providerbestand, Konfiguration und Credentialbindungen herstellen und neue
Anmeldung verlangen. Kein Rückweg auf eine App-Version vor der additiven
Identitäts-/Providerschemaeinführung; keine automatische Datenbank-Downgrade
oder Verknüpfung nach E-Mail. Snapshot-/Transferwerkzeuge bewahren die
Providerauswahl und Bindungen privater Löschgrants. Ein Domain-Deltalauf darf
auch bei identischer Origin das Providerprotokoll nicht ändern.

## Ein weiterer Adapter

Für einen konkret beauftragten Anbieter eine kleine Implementierung von
`AuthClient`/`AuthAdminClient` und seiner verifizierten Fähigkeiten ergänzen,
Providerdaten an dieser Grenze validieren und die explizite Auswahl in
Provider/config/Setup erweitern. Sessionproof und OAuthidentitäten müssen aus
serververifizierten Quellen kommen; falls sein Recoveryprotokoll keine Sitzung
belegt, bleibt es wie bei PocketBase eine getrennte Capability. SDKs und
Protokollformen bleiben im Adapter. Fachrouten, Rollen, Kontozuordnung,
Nachweispfade und Löschverwaltung benötigen keine Provider-SDK-Umstellung.

## Abnahme und Grenzen

`tests/auth-provider.test.mjs` spricht mit den tatsächlich installierten
Supabase-SDKs eine isolierte GoTrue-HTTP-Instanz.
`tests/pocketbase-auth.test.mjs` verwendet eine unabhängige REST-Instanz mit
anderem Payload und Nicht-UUID-Subjects und führt die tatsächlichen Adapter
und App-Routen aus. Nur der Transport der synthetischen freigegebenen
HTTPS-Origin wird auf Loopback geleitet; SDKs, Adapter und Fachrouten werden
nicht durch interne Mocks ersetzt. Geprüft werden Login, Signup/Bestätigung,
Recovery/Reset, Google/State/PKCE, Reauth, Logout, Admin-CRUD/Löschretry,
Identitätszuordnung, private Besitzrechte und relevante negative Verträge.

Die zusätzliche reale lokale PocketBase-0.40.5-Probe bestätigte Login,
serverseitiges Refresh, Reauth, aktuelle private ExternalAuth-Beziehungen,
Admin-CRUD, Logout und Providerlöschung mit synthetischen Konten. Kein echter
Google-OAuthclient, produktiver Mailversand oder Import realer Passwort-Hashes
wurde damit betrieben. Die bisherigen Native-/Google-/Konto-/Kunden- und
Providerwechseltests bleiben registriert. Dieses Issue stellt keine Live-
Authinstanz bereit und verändert keinen produktiven Provider oder Kontobestand.
