# Geprüfte Datenübernahme vom 4. Oktober 2026

## Ergebnis und Betriebszustand

Die bestehende Anwendung wurde vollständig auf den eigenen Cloudflare-Datenbestand
übernommen und dort geprüft. Der Import endete am **4. Oktober 2026 um
19:45:56 UTC**. Die Domain bleibt bis #19 auf Sites. Nach dem zwischenzeitlichen
Schreibstopp ist die bisherige Site wieder verfügbar und der einzige produktive
Schreibpfad; das eigene Ziel steht bis zum koordinierten Domainwechsel auf
`MIGRATION_READ_ONLY=true`. Vor dem Wechsel ist ein neuer Delta-Abgleich erforderlich.

Der technische Verantwortliche für die Durchführung und das dokumentierte Go/No-Go
ist der in diesem Chat beauftragte Codex-Agent. Das Go gilt für die geprüfte
Datenübernahme und die Target-Abnahme, nicht für eine unkoordinierte Domainumstellung.

## Nachweise

- Quellenveröffentlichung: unverändertes geprüftes Sites-Archiv aus
  [v1.2.0](https://github.com/ramiz4/riparim/releases/tag/v1.2.0), Commit
  `bf0af1913102710925efcadbfa9d3fff7631b694`, Sites-Version 42.
- Ziel und Transferwerkzeuge: vollständig grüner
  [Main-Workflow](https://github.com/ramiz4/riparim/actions/runs/37228912201),
  [v1.2.3](https://github.com/ramiz4/riparim/releases/tag/v1.2.3), Commit
  `03bce9429492519de1af7067bca240eca9f53395`.
- Vorbereitung und geprüfte Korrekturen:
  [PR #27](https://github.com/ramiz4/riparim/pull/27),
  [PR #28](https://github.com/ramiz4/riparim/pull/28) und
  [PR #30](https://github.com/ramiz4/riparim/pull/30).
- Beide vollständigen logischen Backups liegen außerhalb von Git unter
  `.sites-runtime/backups`, Verzeichnisse 0700, Dateien 0600. Snapshot-, Manifest-
  und Datei-Prüfsummen wurden geprüft. Beide Datenbestände wurden isoliert aus
  vertrauenswürdigem eingechecktem SQL wiederhergestellt.
- Der geschützte Abschlussbericht liegt unter `.sites-runtime/transfer-reports`.
  Er enthält Backupreferenzen, Schemabeweis, Abgleich und Zeitpunkte; keine
  privaten Datensätze werden in Repository oder PR-Text übernommen.

## Daten- und Identitätsabgleich

Quelle und Ziel enthalten jeweils 19 logische Tabellen samt erreichbarer
Migrationshistorie. Die Quelle nutzt `__appgarden_migrations`, das Ziel
`d1_migrations`; beide Historien beweisen genau die 13 eingecheckten Migrationen.
Die originale Quellhistorie ist archiviert und wurde nicht über die Zielhistorie
geschrieben. Anbieterinterne `_cf_*`-Tabellen sind für SQL-Zugriffe gesperrt und
ausdrücklich als ausgeschlossene Plattformdaten dokumentiert.

| Bestand | Geprüftes Ergebnis |
| --- | --- |
| Quell-Datensätze | 386 |
| Ergänzte Ziel-Datensätze | 35 |
| Werkstattprofile | 163 vollständig identisch, Freigabestatus/Quellen erhalten |
| Bewertungsquellen | 87 vollständig identisch |
| Google-Zuordnungen | 88 gleiche Kennungen/Place IDs |
| Adminrollen | 3 unverändert übernommen |
| Sitzungen | 16 unverändert übernommen |
| Aktive Anmeldekonfiguration | 1 unverändert übernommen |
| Bestätigte Legacy-Verknüpfungen | 0; keine Zuordnung anhand gleicher E-Mail erfunden |
| Besuche, Lösch-/Uploadzustände, Betriebsentwürfe | Vollständig abgeglichen, jeweils leer |
| Private R2-Dateien | Beide vollständigen Inventare leer, keine fehlenden Verweise |

Alle Rollen und Sitzungen gehören zum unveränderten Supabase-Projektnamensraum.
Kontokennungen, Moderationsrechte und Status wurden bytegleich übernommen.
Kein vorhandener Geschäftsdaten-Datensatz wurde ersetzt. Die 48 ausdrücklich
ausgewiesenen gleichwertigen Metadaten betreffen lediglich Importzeitpunkt und
bereits validierten Google-Cache; die Originalwerte bleiben im geschützten
Quellbackup erhalten. Quotenzähler und Geschäftsdaten fallen nicht unter diese
Ausnahme. Vor und nach den Einfügeabschnitten wurden Quelle und Ziel vollständig
neu geprüft; ein wiederholter Plan findet keine fehlenden Quelldatensätze.

## Authentifizierung und private Zugriffe am echten Ziel

15 Vertragsprüfungen wurden am eigenen Worker mit drei ausschließlich temporären
Supabase-Testkonten ausgeführt. Der Provider erzeugte keine E-Mails; die private
PNG-Einreichung wurde nie veröffentlicht und erzeugte kein Versandereignis.

Geprüft sind anonyme und gefälschte native Header, normale Konten ohne
Verwaltungsrechte, authentifizierte Verwaltung und Moderationsliste, gemeinsamer
Login mit erhaltenem Rücksprung, eigener privater Besuch/Dateiabruf, fremder und
anonymer Zugriff, administrativer Dateizugriff, öffentliche Nichtanzeige,
Kontosperre mit Sitzungswiderruf, erneuter Login nach Entsperrung sowie Logout mit
Widerruf. Der private Dateiinhalt entsprach exakt der Testdatei.

Die Bereinigung ist abschließend nachgewiesen: keine temporären Providerkonten,
keine zusätzlichen Rollen, keine Testbesuche oder Uploadreservierungen und ein
erneut leeres R2-Inventar. Der SDK-spezifische Zustand bereits widerrufener
Sitzungen wurde anhand der offiziellen `AuthSessionMissingError`-Klasse korrekt
behandelt; unbekannte Fehler wurden nicht pauschal ignoriert. Die drei echten
Adminrollen und 16 ursprünglichen Sitzungen bleiben erhalten.

R2 ist privat: `r2.dev` deaktiviert, keine Custom Domains. Google-OAuth wurde
auf der bisherigen Produktion bereits mit dem Nutzer geprüft; die zusätzliche
Domain-/Callback-Abnahme und die Beobachtung nach dem Routingwechsel gehören
zu #19. Sie werden durch diesen Bericht nicht als erledigt bezeichnet.

## Wiederaufnahme und Rückweg

Die Quellhistorie wurde vor dem ausdrücklich freigegebenen, exakt begrenzten
Lease-Push remote unter `codex/sites-source-backup-e3d92c7` und als lokales
Git-Bundle gesichert und wiederhergestellt. Die alte Veröffentlichung sowie alle
Backups bleiben erhalten. Die Betriebsanleitung steht in
[data-transfer.md](data-transfer.md).

Bis #19 bleibt Sites alleiniger Writer. Die frisch verifizierten Backups dürfen
nicht als dauerhaft synchroner Stand ausgegeben werden. Der Domainwechsel
benötigt einen finalen Source-/Target-Abgleich unter einer angekündigten kurzen
Schreibpause. Nach einem Wechsel ist ein einfaches Zurückrouten auf eine veraltete
Datenbank verboten; neue Schreibvorgänge müssen rückübernommen oder mit einem
dokumentierten Forward-Fix erhalten werden. #20 beginnt erst nach abgenommener
Umstellung und beendeter Beobachtungs-/Rückfallphase.
