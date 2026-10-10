# UI-, UX- und Performance-Prüfung vom 10.10.2026

Geprüft wurden Startseite, Werkstattkatalog und gemeinsame Navigation auf Basis
von `main` (`522c339`). Die Änderungen liegen im Branch
`codex/ui-ux-performance`. Die Live-Domain war über den Webzugang nicht erreichbar
und ist in der Cloud-Umgebung nicht für ausgehende HTTP-Zugriffe freigegeben.
Die Ergebnisse beziehen sich deshalb auf den lokalen Produktions-Worker und
isolierte Komponentenprüfungen, nicht auf Produktionsmessungen.

## Befunde und Änderungen

| Befund | Auswirkung | Änderung |
| --- | --- | --- |
| Startseite und Katalog importierten `app/journeys.tsx`. | Auch Bewertungsformular, Nachweis- und Löschdialogcode gehörten zu ihren Browserabhängigkeiten. | Fahrzeugsuche als eigene Komponente; öffentliche Seiten importieren sie direkt und erhalten nur benötigte Sprachkataloge. |
| Beide Fotos wurden immer als vollständige JPEG-Dateien ausgeliefert. | Mobile Geräte luden unnötig große Bilder. | WebP in 640, 1024 und 1536 Pixeln mit `srcSet` und `sizes`; Hero bleibt priorisiert, zweites Foto bleibt lazy und wird asynchron dekodiert. |
| Auswahlwerte fehlten im Server-HTML. | Suchfelder erschienen vor JavaScript leer. | `Picker` gibt die übersetzte aktuelle Auswahl schon beim Serverrendern aus. |
| Der Gastheader ragte bei 390 Pixeln bis etwa 391 Pixel über den Bildschirmrand. | Anmeldung und rechter Seitenabstand wurden abgeschnitten. | Anmeldung als beschriftetes 44-Pixel-Icon auf kleinen Displays; kompakteres Logo und Kontomenü bis 380 Pixel. |
| Nach „Mehr anzeigen“ blieb der Fokus am nach unten verschobenen Button. | Tastaturnutzer übersprangen die neuen Ergebnisse; am Listenende verschwand das Fokusziel. | Fokus auf den ersten neu hinzugefügten Profillink nach dem Rendern. |
| Escape in der Fahrzeugsuche setzte den Fokus auf `BODY`. | Die Tastaturnavigation verlor ihre Ausgangsposition. | Dialog merkt sich den tatsächlichen Auslöser und stellt dessen Fokus wieder her, sofern er noch vorhanden ist. |

## Gemessene Dateigrößen

Die statischen JavaScript-Abhängigkeiten der jeweiligen Produktionseinträge
wurden aus `dist/client/.vite/manifest.json` rekursiv ermittelt, dedupliziert und
je Datei mit Nodes `gzipSync` komprimiert. Startseite und Katalog benötigen damit
jeweils ungefähr **5 % weniger JavaScript**. Das ist ein Vergleich der
Browserabhängigkeiten, keine Messung der gesamten Dokumentantwort oder realer
Übertragungszeiten. Frameworkcode bleibt enthalten.

| Foto | JPEG vorher | WebP 640 px | WebP 1024 px | WebP 1536 px |
| --- | ---: | ---: | ---: | ---: |
| Hero | 422.856 Bytes | 38.726 Bytes (−90,8 %) | 82.872 Bytes (−80,4 %) | 153.342 Bytes (−63,7 %) |
| Diagnose | 369.208 Bytes | 29.594 Bytes (−92,0 %) | 51.602 Bytes (−86,0 %) | 83.212 Bytes (−77,5 %) |

Chromium wählte bei 390 Pixeln die 640-Pixel-Varianten mit DPR 1 und die
1024-Pixel-Varianten mit DPR 2. Beide Fotos zusammen sinken damit von 792.064 auf
68.320 beziehungsweise 134.474 Bytes. Die Originalbilder bleiben erhalten.
Die Varianten wurden mit Sharp erzeugt: `resize({width, withoutEnlargement:true})`
und `webp({quality:78, effort:6})`. Es gibt keine neue Laufzeitabhängigkeit.

## Prüfung

- Lokaler Produktions-Worker: Startseite und Katalog in DE/SQ/EN, hell/dunkel,
  jeweils 320, 390, 768 und 1280 Pixel. Alle 48 Kombinationen ohne horizontale
  Überbreite, leere Auswahlwerte oder Browserfehler.
- Namenssuche, Leerzustand, Zurücksetzen, Filterdialog mit Escape und
  Tastaturpagination in den mobilen Katalogen; serverseitig sichtbare
  Auswahlwerte zusätzlich ohne JavaScript in allen drei Sprachen.
- Tatsächlicher Header mit synthetischem Google-Konto, Projekt-CSS und
  ThemeProvider: 24 Sprach-/Theme-/Breitenkombinationen, vollständige Darstellung,
  mindestens 44 Pixel großes Kontoziel, Menü per Tastatur und Fokus nach Escape.
  Diese Fixture-Prüfung ist keine echte Anmeldung.
- `tests/public-performance-ui.test.mjs` schützt Auswahlwerte vor Hydration,
  die erste neue Karte und das Listenende sowie Dialogfokus in DE/SQ/EN.
- `tests/public-assets.test.mjs` prüft beide gebauten öffentlichen
  Abhängigkeitsgraphen und die ausgelieferten kompakten Bildvarianten.
  Der native Worker-Test prüft auch die neuen WebP-Dateien als technische,
  nicht lokalisierte Ressourcen.

Die Übergabeprüfung umfasst `catalog:check`, die vollständige Testsuite,
TypeScript, Lint, Cloudflare- und Sites-Build einschließlich ihrer Browser- und
Workerprüfungen sowie die Paketierung beider Artefakte aus sauberem,
committetem Quellcode. Es gibt keine Migration oder Änderung an Authentifizierung,
Freigaberechten, Providerkonfiguration oder Produktionsdaten.

## Offene Produktionsmessung

Nach dem regulären Main-Release sollten reale mobile LCP-, INP- und CLS-Werte
geprüft werden. Ein Lighthouse-/PageSpeed-Score oder eine Verbesserung der
Live-Ladezeit wird hier nicht behauptet. Ebenfalls offen bleiben Netzwerk- und
Ladeverhalten mit produktiv aktiviertem Google-Places-Dienst und echte
Anmeldeabläufe; dafür waren keine Laufzeitverbindungen eingerichtet.
