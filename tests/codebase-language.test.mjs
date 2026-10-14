import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { checkCodebaseLanguage } from "../scripts/check-codebase-language.mjs";

const findings = checkCodebaseLanguage([
  {
    path: "app/[locale]/anmelden/page.tsx",
    text: "export default function Login() {}",
  },
  {
    path: "app/[locale]/login/page.tsx",
    text: "export default function Login() {}",
  },
]);
assert.equal(
  findings.length,
  1,
  "German physical source directories must be rejected",
);
assert.equal(findings[0].path, "app/[locale]/anmelden/page.tsx");
console.log("English physical source path policy passed");

const prose = checkCodebaseLanguage([
  {
    path: "docs/guide.md",
    text: "# Prüfung\n\nDie Quelle muss geprüft werden.\n",
  },
  {
    path: "lib/import.ts",
    text: '// Bitte ergänze die Quelle.\nthrow Error("Ungültiges Datum");',
  },
  {
    path: "lib/i18n/customer-messages.ts",
    text: 'const de = {label: "Bitte anmelden"}, sq = {label: "Hyr këtu"};',
  },
  {
    path: "data/workshops.json",
    text: JSON.stringify({
      workshops: [
        { name: "Graçanicë", description: "Eine Werkstatt für alle Marken." },
      ],
    }),
  },
  {
    path: "data/import.json",
    text: JSON.stringify({ notes: "Die Quelle wurde geprüft." }),
  },
  { path: "vendor/source.ts", text: "// Bitte ergänze die Quelle." },
  { path: "drizzle/0001_applied.sql", text: "-- Prüfung\n" },
  {
    path: "lib/source.ts",
    text: '// Preserve the original label "Alle Marken" and the place name Graçanicë.',
  },
]);
assert(
  prose.some((item) => item.path === "docs/guide.md"),
  "Known German engineering prose must be reported",
);
assert(
  prose.some((item) => item.path === "lib/import.ts"),
  "German comments and technical diagnostics must be reported",
);
assert(
  prose.some((item) => item.path === "data/import.json"),
  "Author-controlled internal metadata must be checked",
);
for (const path of [
  "lib/i18n/customer-messages.ts",
  "data/workshops.json",
  "vendor/source.ts",
  "drizzle/0001_applied.sql",
  "lib/source.ts",
])
  assert(
    !prose.some((item) => item.path === path),
    path +
      ": translations, originals, quoted labels and immutable artifacts remain valid",
  );
console.log("Engineering prose and explicit multilingual exceptions passed");

assert(
  checkCodebaseLanguage([
    { path: "lib/module.ts", text: 'import "../betriebe/business.css";' },
  ]).length,
  "A German relative source import must be rejected even when the importing filename is English",
);

assert(
  checkCodebaseLanguage([
    {
      path: "tests/styles.test.mjs",
      text: 'const file = "verwaltung/benutzer/users.css";',
    },
  ]).length,
  "German physical references in data-driven asset tests must be rejected",
);

assert(
  checkCodebaseLanguage([
    { path: "lib/i18n/locale.ts", text: 'throw Error("Ungültige Anfrage.");' },
  ]).length,
  "Engineering modules in i18n must not inherit catalog exemptions",
);

const templateFindings = checkCodebaseLanguage([
  {
    path: "scripts/cli.mjs",
    text: "throw Error(`Ungültige Werkstattkennung: ${id}`);",
  },
  {
    path: "scripts/report.mjs",
    text: "console.error(`Entry ${id}: Die Quelle ist ungültig: ${file}`);",
  },
  {
    path: "lib/input.ts",
    text: 'throw Error(`Invalid entry: ${record["Prüfung"]}`);',
  },
  {
    path: "lib/i18n/customer-messages.ts",
    text: "const message = {error: `Ungültige Anfrage: ${id}`};",
  },
]);
assert.deepEqual(
  templateFindings.map((item) => item.path),
  ["scripts/cli.mjs", "scripts/report.mjs"],
  "Check template static heads/tails without treating interpolated input or localized resources as engineering prose",
);

execFileSync(process.execPath, ["scripts/check-codebase-language.mjs"], {
  stdio: "inherit",
});
