# Stabile Konten und externe Anmeldeidentitäten

Riparim behandelt Konto-IDs als opake interne Schlüssel. Besitzrechte,
Dateipfade, Rollen, Sperren und Versandereignisse verwenden weiterhin diese
Schlüssel. Die private Tabelle `auth_identities` ordnet ihnen separat
`provider`, normalisierten HTTPS-`issuer` und `subject` zu. Ein Konto kann je
Provider und Issuer genau eine Identität haben; eine externe Identität gehört
zu genau einem Konto. E-Mail-Adressen und editierbare Profilmetadaten sind
keine Zuordnungsnachweise.

Historische Schlüssel wie `supabase:projekt.supabase.co:<uuid>` bleiben
unverändert. Ihr lesbares Format ist keine fachliche Bedeutung. Nur die
Migration und die Kompatibilitätsgrenze in `lib/auth/identities.ts` kennen
dieses Format. Auch neue Supabase-Konten erhalten während der kompatiblen
Einführungsphase solche Schlüssel, damit eine noch laufende Vorgängerversion
dieselben Konten beschreibt. Die vollständige normalisierte Issuer-Authority
unterscheidet dabei verschiedene Ports; Standard-HTTPS behält alte Schlüssel.
Andere Provider können einen neuen zufälligen internen Schlüssel erhalten.
Das Identitätsmodul bereitet deren Zuordnung vor; ein weiterer Login-Adapter
ist kein Bestandteil dieser Änderung.

## Migration und Einführung

Die neue additive Drizzle-Migration `0016_account_identities.sql` läuft vor
dem neuen Anwendungscode. Sie übernimmt historische Kontoreferenzen aus
Sitzungen, Altverknüpfungen, Rollen und Rollenvergabe, Sperren, Löschgrants,
Bewertungen und Moderation, Uploads, Betriebsdaten und Versandereignissen.
Besitzschlüssel und Dateien werden nicht umgeschrieben. Alte Writer können
nach der Migration weiterarbeiten; der Resolver registriert deren spätere
Konten bei Bedarf. Alte Sitzungen und Löschgrants ohne Issuerfelder gelten
ausschließlich an ihrer historischen Ursprungsidentität.
Backfill-Zuordnungen verwenden den festen Migrationsmarker
`2026-10-11T00:00:00.000Z` als `created_at`, damit wiederholte Aufrüstungen
derselben historischen Exportquelle dieselben übertragbaren Zeilen ergeben.
Spätere neue Zuordnungen verwenden ihren tatsächlichen Erstellungszeitpunkt.

Neue Sitzungseinträge speichern Provider, Issuer und Subject getrennt vom
Anmeldeverfahren Passwort/Google. Eine gleichlautende externe Session-ID
eines anderen Projekts kann deshalb keinen bestehenden Sitzungsgrant nutzen.
Rollenentzug und Sperren greifen weiterhin an der internen Konto-ID.

Diese Aufgabe verändert weder Livekonten noch Providerkonfigurationen. Ein
tatsächlicher Anbieterwechsel braucht einen gesonderten kontrollierten
Daten-/Identitätsübernahmeauftrag und vollständige, geprüfte Bestandslisten.

## Ausdrückliche geprüfte Zuordnung

`linkAccountIdentity(existing, next, verify)` ist eine ausschließlich
serverseitige/offline verwendete Funktion. Es gibt keine öffentliche Route
und keine automatische Verknüpfung gleicher E-Mail-Adressen. Der
vertrauenswürdige Aufrufer muss **beide** Identitäten unabhängig prüfen und
die ausdrückliche Zuordnung zu demselben internen Konto belegen. Bei einer
Migration kann dieser Nachweis aus einer geprüften Übernahmeliste mit exakten
Quell-/Zielkennungen stammen; bei einer kontogesteuerten Zuordnung aus zwei
frischen serverseitig geprüften Anmeldungen. Eine Providerabfrage allein
belegt nur, dass ein Konto existiert, und ersetzt die geprüfte Zuordnungsentscheidung
nicht. Niemals allein nach E-Mail vergleichen.

Die Quelle muss bereits registriert sein. Vor dem Schreibaufruf protokolliert
der kontrollierte Migrationsprozess intern Konto-ID und beide
Provider-/Issuer-/Subject-Paare, ohne Token, Geheimnisse oder E-Mail-Adressen.
Der Rückgabewert muss exakt der erwarteten internen Konto-ID entsprechen.
Ein minimaler Aufruf in einem vertrauenswürdigen Migrationsprogramm lautet:

```ts
const accountId = await resolveAccount(sourceIdentity);
if (accountId !== reviewedMapping.accountId) throw Error("SOURCE_MISMATCH");
const linked = await linkAccountIdentity(sourceIdentity, targetIdentity, async identity => {
  // Exact approved tuple, plus independent server-side provider verification.
  // The proof must include the issuer, never only subject or email.
  return verifyApprovedIdentity(reviewedMapping, identity);
});
if (linked !== reviewedMapping.accountId) throw Error("TARGET_MISMATCH");
```

Die Funktion hängt bestehende Bindungen niemals um und führt keine Konten
zusammen. Auch ungemappte Konten, die ein alter Writer bereits benutzt hat,
sind geschützt. Datenbank-Eindeutigkeit und die atomare Prüfung verhindern
konkurrierende kontoübergreifende Bindungen. Bestehende Anwendungssitzungen
werden bei einer Zuordnung widerrufen; anschließend ist eine neue Anmeldung
nötig. Inaktive oder gelöschte Konten können kontrolliert auf dieselbe interne
ID übernommen werden; ihre Sperre beziehungsweise ihr Lösch-Tombstone bleibt
unverändert und gilt sofort für die Zielidentität. Unvollständige
Übernahmelisten sind kein freigegebener Cutover: alle Bestandskonten inklusive
Sperren und begonnenen Löschungen müssen geprüft zugeordnet sein, bevor
Zielanmeldungen aktiviert werden.

Während des kompatiblen Schema-Rollouts bleibt das alte Anmeldeprojekt aktiv.
Vor dem Schreiben von Zielzuordnungen oder dem Aktivieren des Zielprojekts
müssen alle alten Writer beendet sein. Eine alte Version würde sonst beim
Zielprojekt weiterhin andere Besitzschlüssel erzeugen. Nach der Zuordnung
verifiziert der Migrationsprozess jeden erwarteten Quell-/Zielbezug über den
Resolver, vergleicht Bestandszahlen und prüft Kunden-, Admin-, Sperr- und
Löschabläufe mit isolierten Konten. Der bestehende Supabase-Loginadapter
wechselt weiterhin nur zwischen dessen unterstützten Projekten.

## Löschung, Versand und Rückweg

Benutzerverwaltung und eigene Kontofunktionen übersetzen die aktuelle
externe Identität in die interne ID. Selbstschutz und Rollen verwenden die
interne ID; Provideroperationen verwenden das bestätigte aktuelle Subject.
Löschgrants speichern ihren Issuer und können nicht an einem anderen Projekt
verwendet werden. Vor einem Projektwechsel begonnene eigene Löschungen sind
am ursprünglichen Projekt abzuschließen oder danach administrativ über die
geprüfte neue Zuordnung fortzusetzen. Die Pending-Liste zeigt das aktuelle
gemappte Subject auch nach dessen Providerlöschung.

Nach erfolgreicher Löschung bleiben Identitätszuordnungen und lokale
Tombstones erhalten. Damit können überlebende Tokens oder alte externe
Konten keine neue interne Identität und keine früheren Rechte erhalten.
Dateien, Bewertungen, Betriebszuordnungen, Sitzungen und Versandereignisse
werden weiterhin bereinigt. Der aktuelle konfigurierte Provider wird
gelöscht; die Stilllegung alter Providerprojekte und ihrer verbliebenen
Konten gehört zum gesonderten Anbieterwechsel, für den deren administrative
Zugänge benötigt werden.

Die Outbox findet den aktuellen Providerkontakt über das Mapping, auch bei
bestätigten privaten Native-Altverknüpfungen. Sie parst keine internen IDs
und behält Sperrprüfung, bestätigte Kontakte, unveränderliche Retry-Payloads
und Idempotenz bei.

Vor Zielzuordnungen/Cutover darf die Anwendung auf die geprüfte
Vorgängerversion zurückgehen; die additiven Tabellen und nullable Spalten
bleiben bestehen. Keine angewendete Migration ändern oder zurücknehmen.
Nach einem Cutover ist nur eine identitätsfähige Version ein sicherer
Rollback. Ein Rückwechsel zum ursprünglichen Provider erfolgt mit den
erhaltenen ursprünglichen Zuordnungen und neuer Anmeldung; niemals
Identitätszeilen löschen, um eine Konfliktprüfung zu umgehen.

## Nachweise

`tests/account-identities.test.mjs` prüft die tatsächliche additive Migration,
Neu-/Altidentitäten, getrennte Issuer, ausdrückliche doppelte Prüfung,
konkurrierende Bindungen, spätere Vorgänger-Writer, unveränderte private
Dateipfade, fremde Identitäten mit gleicher E-Mail/gefälschten Metadaten,
Rollenentzug, Sperrung während der Zuordnung, Admin-Selbstschutz, aktuelle
Outboxkontakte und wiederholbare Kontolöschung. Die bestehenden Passwort-,
Google-, Native-Altverknüpfungs-, Account- und Verwaltungsprüfungen bleiben
registriert; `tests/account-settings.test.mjs` prüft zusätzlich verspätete
Vorgänger-Löschgrants. Alle Providerantworten sind synthetisch; keine echten
Nachrichten oder Kontomigrationen werden ausgelöst.

`tests/account-identities-worker.test.mjs` führt dieselbe Migration und die
Bindungs-/Konfliktprüfung außerdem gegen die tatsächliche D1-Implementierung
aus. Die Migration verwendet kleine verschachtelte Selects; die Bindung prüft
Referenzen mit direkten `NOT EXISTS`, damit beide Wege auch deren SQL-Limits
einhalten.
