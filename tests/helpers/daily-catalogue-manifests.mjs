import { readFile, readdir } from "node:fs/promises";
export async function dailyCatalogueManifests() {
  const files = (await readdir("data"))
    .filter((name) => /^import-\d{4}-\d{2}-\d{2}-daily\.json$/.test(name))
    .sort();
  return Promise.all(
    files.map(async (name) =>
      JSON.parse(await readFile("data/" + name, "utf8")),
    ),
  );
}
