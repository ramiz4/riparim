import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export * from './lib/i18n/locale'; export {publicMetadata} from './lib/i18n/public-metadata';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { isPagePath, localizeHref, pageIdentityPath, publicMetadata } =
  await import(
    "data:text/javascript;base64," +
      Buffer.from(bundle.outputFiles[0].contents).toString("base64")
  );
const routes = [
  ["/guides", "/ratgeber", "/sq/udhezues", "/en/guides"],
  [
    "/guides/choosing-a-workshop",
    "/ratgeber/werkstatt-auswaehlen",
    "/sq/udhezues/zgjedhja-e-servisit",
    "/en/guides/choosing-a-workshop",
  ],
  [
    "/guides/preparing-a-visit",
    "/ratgeber/werkstattbesuch-vorbereiten",
    "/sq/udhezues/pergatitja-e-vizites",
    "/en/guides/preparing-a-visit",
  ],
];
for (const [identity, ...paths] of routes) {
  for (const [index, locale] of ["de", "sq", "en"].entries()) {
    const path = paths[index];
    assert.equal(
      isPagePath(path),
      true,
      `The public guide route is recognized: ${path}`,
    );
    assert.equal(pageIdentityPath(path), identity);
    assert.equal(localizeHref(identity, locale), path);
    const metadata = publicMetadata(
      locale,
      path + "?private=ignored",
      "https://riparim.test",
      { title: "Guide", description: "Useful guidance" },
    );
    assert.equal(metadata.alternates?.canonical, "https://riparim.test" + path);
    assert.deepEqual(metadata.alternates?.languages, {
      de: "https://riparim.test" + paths[0],
      sq: "https://riparim.test" + paths[1],
      en: "https://riparim.test" + paths[2],
      "x-default": "https://riparim.test" + paths[0],
    });
  }
}
for (const path of [
  "/ratgeber/missing",
  "/sq/udhezues/missing",
  "/en/guides/missing",
  "/sq/guides/choosing-a-workshop",
  "/ratgeber/werkstatt-auswaehlen/extra",
])
  assert.equal(
    isPagePath(path),
    false,
    `Unknown or mixed-language guides remain real 404s: ${path}`,
  );
console.log(
  "Localized fixed guide routes and clean reciprocal public metadata passed",
);
