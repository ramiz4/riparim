import assert from "node:assert/strict";
import { build } from "esbuild";
const bundle = await build({
  entryPoints: ["lib/i18n/locale.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const routes = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);
for (const slug of ["prishtina", "prizren", "ferizaj", "peja", "gjakova"])
  for (const [locale, prefix] of [
    ["de", "/werkstaetten"],
    ["sq", "/sq/serviset"],
    ["en", "/en/workshops"],
  ]) {
    const path = `${prefix}/${slug}`;
    assert.equal(routes.isPagePath(path), true, `supported city ${path}`);
    assert.equal(routes.pageIdentityPath(path), `/workshops/${slug}`);
    assert.equal(routes.localizeHref(`/workshops/${slug}`, locale), path);
  }
for (const path of [
  "/werkstaetten/unknown",
  "/en/workshops/unknown",
  "/sq/serviset/prishtina/extra",
  "/werkstaetten/Prishtina",
  "/werkstaetten/prishtina.json",
])
  assert.equal(routes.isPagePath(path), false, `unsupported city ${path}`);
console.log(
  "Allowlisted city route localization and unknown-path rejection passed",
);
