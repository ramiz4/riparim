import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const germanSegments = new Set([
  "anmelden",
  "antraege",
  "betriebe",
  "beanspruchen",
  "bewertungen",
  "datenschutz",
  "einstellungen",
  "passwort-neu",
  "passwort-vergessen",
  "registrieren",
  "verwaltung",
  "anmeldung",
  "benutzer",
  "werkstaetten",
  "werkstatt",
  "bestaetigen",
]);
// A bounded regression vocabulary, not a general-purpose language detector.
const germanProse =
  /\b(?:Bitte|Prüf\w*|Ungültig\w*|Werkstattkennung|Sicherung|Veröffentlich\w*|Zugangsdaten|Abweichende|Doppelte|Doppelter|benötigt|Mitarbeit|Regeln|Entfernte|Leistungskategorie|Koordinaten|Anmeldung|Berechtigung|Abnahmekriterien)\b|\b(?:Die|Der|Das|Ein|Eine|Nur|Keine?)\s+(?:Quelle|Datei|Anfrage|Prüfung|Auftrag|Betrieb|Konto|Agent|Haupt|Verbindung|Werkstatt)/u;
const internalFields = new Set([
  "note",
  "notes",
  "reason",
  "reasons",
  "method",
  "summary",
  "rationale",
  "limitations",
  "policy",
  "verificationNote",
]);
const immutable =
  /^(?:vendor\/|drizzle\/|components\/ui\/|hooks\/use-mobile\.ts$|cloudflare-env\.d\.ts$|monitor\/worker-env\.d\.ts$)|(?:^|\/)package-lock\.json$/;
const unquote = (text) =>
  text.replace(/`[^`]*`|"[^"\n]*"|'[^'\n]*'|„[^“]*“|“[^”]*”/gu, "");

export function checkCodebaseLanguage(files) {
  const findings = [];
  for (const { path, text } of files) {
    if (immutable.test(path)) continue;
    const report = (line, message) => findings.push({ path, line, message });
    if (path.split("/").some((segment) => germanSegments.has(segment)))
      report(1, "Use English physical source names.");
    if (/\.md$/.test(path)) {
      let fence = false;
      for (const [index, line] of text.split("\n").entries()) {
        if (/^\s*(```|~~~)/.test(line)) {
          fence = !fence;
          continue;
        }
        if (!fence && germanProse.test(unquote(line)))
          report(
            index + 1,
            "Translate known German engineering prose; quote preserved UI/source text explicitly.",
          );
      }
    } else if (/^data\/.*\.json$/.test(path)) {
      const walk = (value, field = "") => {
        if (typeof value === "string") {
          if (internalFields.has(field) && germanProse.test(unquote(value)))
            report(1, "Translate internal metadata prose in " + field + ".");
        } else if (Array.isArray(value))
          value.forEach((item) => walk(item, field));
        else if (value && typeof value === "object")
          for (const [key, item] of Object.entries(value)) walk(item, key);
      };
      walk(JSON.parse(text));
    } else if (/\.(?:ts|tsx|mts|mjs|js)$/.test(path)) {
      for (const [index, line] of text.split("\n").entries()) {
        if (
          /^\s*(?:\/\/|\/\*|\*)/.test(line) &&
          germanProse.test(unquote(line))
        )
          report(index + 1, "Use English engineering comments.");
      }
      const presentationResource =
        /^lib\/i18n\/(?:[^/]+-messages|messages|values|canonical-values|delete-confirmation|german-source-patterns)\.ts$/.test(
          path,
        );
      const tree = ts.createSourceFile(
        path,
        text,
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node) => {
        // Only the check's negative fixtures contain deliberately rejected source filenames.
        if (
          path !== "tests/codebase-language.test.mjs" &&
          ts.isStringLiteralLike(node) &&
          /\.(?:ts|tsx|mjs|mts|css)$/.test(node.text) &&
          !node.text.includes("://") &&
          node.text.split("/").some((segment) => germanSegments.has(segment))
        )
          report(
            tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
            "Update physical source/asset references to English names.",
          );
        if (
          ts.isStringLiteralLike(node) &&
          (ts.isImportDeclaration(node.parent) ||
            ts.isExportDeclaration(node.parent) ||
            (ts.isCallExpression(node.parent) &&
              node.parent.expression.kind === ts.SyntaxKind.ImportKeyword)) &&
          node.text.split("/").some((segment) => germanSegments.has(segment))
        )
          report(
            tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
            "Use English physical source import paths, including relative CSS imports.",
          );
        // Interpolations are data; only the template's authored static text is prose.
        const staticText = ts.isStringLiteralLike(node)
          ? node.text
          : ts.isTemplateExpression(node)
            ? [
                node.head.text,
                ...node.templateSpans.map((span) => span.literal.text),
              ].join(" ")
            : "";
        if (!presentationResource && germanProse.test(staticText)) {
          const parent = node.parent;
          const diagnostic =
            (ts.isPropertyAssignment(parent) &&
              ["error", "message"].includes(parent.name.getText(tree))) ||
            ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
              /(?:Error|ValidationError|console\.(?:error|warn|log))$/.test(
                parent.expression.getText(tree),
              ));
          if (diagnostic)
            report(
              tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
              "Keep presentation/legacy copy in explicit resources; technical diagnostics use English.",
            );
        }
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
  }
  return findings;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const names = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
  const files = [...new Set(names)].flatMap((path) => {
    try {
      return [{ path, text: readFileSync(path, "utf8") }];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  });
  const findings = checkCodebaseLanguage(files);
  for (const item of findings)
    console.error(item.path + ":" + item.line + ": " + item.message);
  if (findings.length) process.exitCode = 1;
  else
    console.log(
      "English engineering-language regression checks passed (manual language review still required).",
    );
}
