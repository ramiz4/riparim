import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
const { transform } = createRequire(require.resolve("vite/package.json"))(
  "lightningcss",
);
const inFlight = new Map();

async function sourceFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(join(root, directory), {
      withFileTypes: true,
    })) {
      const name = join(directory, entry.name);
      if (entry.isDirectory()) await walk(name);
      else if (/\.(?:css|tsx?|json)$/.test(name)) files.push(name);
    }
  }
  for (const directory of ["app", "components", "lib"]) await walk(directory);
  return files.sort();
}

async function stylesheetOrder(root, files) {
  // Follow the actual root layout first. Remaining route sheets follow their
  // consumers' imports in a stable order, providing a shared superset fixture.
  const order = [];
  for (const file of [
    "app/[locale]/layout.tsx",
    "app/finder.tsx",
    ...files.filter((file) => /\.(?:tsx?|json)$/.test(file)),
  ]) {
    const source = await readFile(join(root, file), "utf8");
    for (const match of source.matchAll(/import\s+["']([^"']+\.css)["'];?/g)) {
      const target = match[1].startsWith("@/")
        ? match[1].slice(2)
        : join(file, "..", match[1]);
      if (!target.endsWith(".module.css") && !order.includes(target))
        order.push(target);
    }
  }
  return order;
}

export async function compileApplicationCss({ root = repository } = {}) {
  root = resolve(root);
  const files = await sourceFiles(root);
  const hash = createHash("sha256");
  // Tailwind auto-detection reads non-ignored repository text, including tests,
  // fixtures, docs and compiler configuration. Match those inputs rather than
  // caching only component sources; generated ignored outputs never enter it.
  const inputs = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean)
    .sort();
  for (const file of inputs) {
    hash.update(file);
    try {
      const bytes = await readFile(join(root, file));
      if (!bytes.includes(0)) hash.update(bytes);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      hash.update("deleted");
    }
  }
  const digest = hash.digest("hex");
  if (inFlight.has(digest)) return inFlight.get(digest);
  const pending = (async () => {
    const directory = join(root, ".test-runtime/compiled-tailwind");
    const path = join(directory, digest + ".json");
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const order = await stylesheetOrder(root, files);
    const imports = order
      .map((file) => `@import ${JSON.stringify("./" + file)};`)
      .join("\n");
    const source = (
      await postcss([tailwind({ base: root })]).process(imports, {
        from: join(root, "tailwind-test-entry.css"),
      })
    ).css;
    const production = transform({
      filename: "tailwind-test-entry.css",
      code: Buffer.from(source),
      minify: true,
    }).code.toString();
    const result = { digest, source, production, stylesheets: order };
    await mkdir(directory, { recursive: true });
    const temporary = path + "." + process.pid + ".tmp";
    await writeFile(temporary, JSON.stringify(result));
    await rename(temporary, path);
    return result;
  })();
  inFlight.set(digest, pending);
  return pending;
}
