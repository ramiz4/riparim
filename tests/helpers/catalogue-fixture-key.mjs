import { build } from "esbuild";
import { readFile } from "node:fs/promises";

let key;
export function catalogueFixtureKey() {
  return (key ??= (async () => {
    const bundled = await build({
      entryPoints: ["db/catalogue-import.ts"],
      bundle: true,
      write: false,
      platform: "node",
      format: "esm",
    });
    const { catalogueImportKey } = await import(
      "data:text/javascript;base64," +
        Buffer.from(bundled.outputFiles[0].contents).toString("base64")
    );
    const catalogue = JSON.parse(await readFile("data/workshops.json", "utf8"));
    const { contacts } = JSON.parse(
      await readFile("data/workshop-contacts.json", "utf8"),
    );
    const { contacts: emails } = JSON.parse(
      await readFile("data/workshop-emails.json", "utf8"),
    );
    return catalogueImportKey(catalogue, contacts, emails);
  })());
}
