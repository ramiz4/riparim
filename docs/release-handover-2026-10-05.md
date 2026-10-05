# Gesamtabschluss der Produktionsumstellung vom 5. Oktober 2026

Die Folgearbeiten zu [#17](https://github.com/ramiz4/riparim/issues/17) sind
abgeschlossen: [Datenübernahme #18](data-transfer-2026-10-04.md),
[Domain-/Auth-Umstellung #19](domain-cutover-2026-10-05.md) und
[öffentliche Sites-Stilllegung #20](sites-retirement.md). Die zugehörigen
Ausführungsberichte bleiben die maßgeblichen Nachweise; dieser Bericht ordnet
sie den übergeordneten Abnahmekriterien zu. Alle Ortszeiten gelten für
Europe/Belgrade (UTC+02:00).

## Erfüllte Abnahmekriterien und belegter Umfang

| Kriterium aus #17 | Tatsächlich nachgewiesen |
| --- | --- |
| Geprüfte Main-Pipeline und geschützte Konfiguration | PR #8 samt Bootstrap-Fixes ist integriert; Production-Environment nur für Main, getrennte Cloudflare-/Anwendungs-Secrets und geprüfte feste Bindings. |
| Zugeordnete, unveränderliche Release-Bytes | [v1.2.9](https://github.com/ramiz4/riparim/releases/tag/v1.2.9), Commit `53ae6ce7a896e779b75e5f249d25b7993c8c12d4`; Tag, Provenienz, Archivhash und ausgelieferter `X-Riparim-Release-Commit` stimmen überein. Wiederholung baut kein neues Archiv. |
| Bestehende D1-/R2-Daten vollständig übernehmen | #18: 19 logische Tabellen, 386 Source-Zeilen, 13 belegte Migrationen; Besitzrechte, Freigabestatus und Quellen erhalten. Beide R2-Inventare waren leer; private Dateiabläufe wurden mit isolierten PNG-Daten geprüft. Vollständige Backups und lokale Wiederherstellung bestanden. #19: finaler Dreifachabgleich, 0 Einfügungen/Änderungen/Löschungen; Wiederholung als No-op geprüft. |
| Identitäten, Sitzungen und Zugriffskontrollen | Supabase-Projekt unverändert; ursprüngliche drei Adminrollen, 16 Sitzungen und aktive Auth-Konfiguration abgeglichen. Null vorhandene bestätigte Legacy-Verknüpfungen; keine E-Mail-basierte Zuordnung erfunden. Serverrechte, Sperren, fremder/anonymer Privatdateizugriff und eigene/Admin-Zugriffe tatsächlich geprüft. |
| Produktionsdomain, Google-Datei und Auth-Callbacks | Apex/www mit TLS, kanonischer Pfad-/Query-Weiterleitung und direkter unveränderter Google-Datei; vorhandene Laufzeitwerte geschützt übernommen. Echte Google-Anmeldung, korrekter Rücksprung, Verwaltung und Abmeldung auf riparim.com bestanden. |
| Go/No-Go und Rückweg | Erstes No-Go mit tatsächlicher Wiederaufnahme der unveränderten Quelle vor Zielschreibvorgängen; finales Go nach Daten-/TLS-/Release-Abgleich. Technische Abnahme um 07:16:24; der zeitlich begrenzte Sites-Rückweg und sein ausdrücklich beschlossenes Ende sind unten präzisiert. |
| Weitere automatische, serialisierte Main-Releases | v1.2.7–v1.2.9 wurden nach dem Domainwechsel automatisch auf derselben Produktion veröffentlicht. Workflow-Gruppe `production-release`, `cancel-in-progress: false`; exakte Provenienz, feste Ressourcen und Vorrang neuerer vollständig veröffentlichter Releases. |
| Betriebsdokumentation einschließlich Migrationen | [Release-Betrieb](releases.md#produktionsmigrationen-wiederholung-und-rollback), [Transfer/Wiederholung](data-transfer.md), [Domainwechsel](domain-cutover.md) und [Archiv/Retention](sites-retirement.md) enthalten geprüfte Abläufe und ihre Grenzen. |

Aktives Worker-Archiv v1.2.9, SHA-256:
`f3bd2b57c03e7f42c192bbdde92f4d0ebb17b6ee3a7984bfd30b83a2093a1353`.
Der [automatische Produktionslauf](https://github.com/ramiz4/riparim/actions/runs/37260211387)
ist erfolgreich. Nachfolgende reine Test-/Dokumentationscommits erzwingen keinen
neuen Release. Der [Main-Lauf nach der Stilllegung](https://github.com/ramiz4/riparim/actions/runs/37282985174)
ist ebenfalls vollständig erfolgreich; sein Deploy-Job wurde mangels neuen
semantischen Releases planmäßig übersprungen.

## Rückweg vor und nach der Writer-Freigabe

Vor der Freigabe des Ziel-Writers konnte die unveränderte Sites-Veröffentlichung
wieder aufgenommen werden. Dieser konkrete Weg wurde beim ersten No-Go um
01:03:38 tatsächlich ausgeführt, ohne Domain-/DNS-Änderung oder Daten-Delta.
Seit 04:57:35 ist der eigene Cloudflare-Datenbestand die einzige maßgebliche
Schreibquelle. Ein Code-Rollback setzt diese Daten nicht zurück.

Eine Rückübernahme neuer D1-/R2-Daten nach Sites ist **weder implementiert noch
getestet** und wird nicht als verfügbarer automatisierter Rückweg bezeichnet.
Die vorhandenen Transferwerkzeuge schreiben ausschließlich auf das feste
Cloudflare-Ziel. Der dokumentierte Rückabgleich ist eine Voraussetzung für eine
eventuell gesondert vorzubereitende Rückkehr, kein ausgeführter Source-Import.
Tatsächlich erprobt sind Forward-Fixes über geprüfte Main-Releases: Die
Callback- und Eigentumsdatei-Korrekturen aus PR #38/#39 wurden bei verfügbarer
Produktion automatisch veröffentlicht und anschließend abgenommen.

Der Nutzer beendete das ursprüngliche Rückfallfenster mit „Ja, jetzt stilllegen.“
um 09:51:01 ausdrücklich. Die öffentliche alte Veröffentlichung wurde daraufhin
bis 09:58:38 gesperrt, ihre Domainzuordnungen entfernt und der alte Exportzugang
aus der Laufzeit genommen. Dies ersetzt die vorher offene Rückfallphase aus dem
Domainbericht. Die alte Site ist jetzt aufbewahrter Wiederherstellungsbestand,
kein unmittelbar aktivierbares Produktionsziel. Ein künftiger Wechsel zurück
benötigt frische beidseitige Backups, angekündigte Schreibpause, vollständige
geprüfte Rückübernahme neuer Änderungen/Löschungen/Dateien und erneute Rechte-QA.
Ohne diesen Nachweis bleibt der eigene Datenbestand erhalten und der
Forward-Fix der verfügbare Wiederherstellungsweg.

## Prüfung, Aufbewahrung und Übergabe

Die Domainabnahme beobachtete 2 Stunden, 18 Minuten und 49 Sekunden mit 584
Fetch- und 27 Scheduled-Aufrufen, ohne Worker-Ausführungsfehler oder HTTP-5xx.
Nach der Stilllegung bestanden erneut fünf Vorabprüfungen und 15 echte Auth-/
Privatdateiprüfungen um 10:02:59. Die drei markierten Testkonten, ihre Daten und
die private Datei sind vollständig bereinigt; null verbleibende Konten oder
Bereinigungsfehler. Echte Google-Anmeldung/Verwaltung/Abmeldung wurden zusätzlich
geprüft. Es wurden keine echten E-Mails versandt oder echten Bewertungen moderiert.

Die frische öffentliche Abschlussprüfung bestätigt Apex und technischen Host
mit HTTP 200 und unverändertem v1.2.9-Commit, www mit HTTP 308 und erhaltener
Query, Google-Verifikationsdatei direkt mit HTTP 200 und unveränderten Bytes
sowie die alte generierte URL anonym mit HTTP 401. Sie verändert keine Daten.

Der vollständige verschlüsselte Source-Bestand und getrennte Recovery-Schlüssel
sind lokal außerhalb verwalteter Worktrees und im geschützten Projekt-Vault
wiederherstellbar gesichert. Archiv, alte Versionen und Ressourcen bleiben
**mindestens bis 4. November 2026** erhalten; keine automatische oder endgültige
Löschung ist beauftragt. Gemeinsam genutzte Supabase-, Google-, Resend- und
Cloudflare-CI-Zugänge bleiben bestehen. Aufgaben-Worktrees und benötigte private
Prüfjournale werden bis zur sicheren Übergabe bewahrt.

Der Abschluss ändert weder Produktionscode noch Schema oder Daten. Die
abschließende Dokumentation durchläuft Spec-/Standards-Review und die
verpflichtenden GitHub-Prüfungen; Integration erfolgt ausschließlich per
Squash-PR. Die Issue-Folge endet nach dessen Integration und einer frischen
GitHub-Abfrage ohne offene Issues.
