import { build } from "esbuild";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { compileApplicationCss } from "../../tests/helpers/compiled-tailwind.mjs";

const variant = process.argv[2] ?? "after";
if (!["before", "after"].includes(variant))
  throw Error("Choose before or after");
const root = process.cwd();
const output = resolve(root, ".sites-runtime/tailwind-qa", variant);
if (variant === "before") {
  try {
    await access(output + "/manifest.json");
    throw Error(
      "The captured before baseline is frozen. Start a new QA session directory to capture another baseline.",
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["scripts/tailwind-qa/fixture.tsx"],
  outfile: output + "/fixture.js",
  bundle: true,
  platform: "browser",
  format: "esm",
  jsx: "automatic",
  loader: { ".css": "empty", ".module.css": "local-css" },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "fixture-navigation",
      setup(builder) {
        builder.onResolve({ filter: /^next\/(link|navigation)$/ }, (args) => ({
          path: args.path,
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          loader: "js",
          resolveDir: root,
          contents:
            args.path === "next/link"
              ? `import React from 'react';export default function Link({href,children,prefetch,...props}){return React.createElement('a',{href,...props},children);}`
              : `export function useRouter(){return {push(href){history.pushState({},'',href);window.dispatchEvent(new PopStateEvent('popstate'));},replace(href){history.replaceState({},'',href);window.dispatchEvent(new PopStateEvent('popstate'));},refresh(){}};}export function usePathname(){return window.location.pathname;}export function useSearchParams(){return new URLSearchParams(window.location.search);}`,
        }));
      },
    },
  ],
});
const css = await compileApplicationCss();
let moduleCss = "";
try {
  moduleCss = await readFile(output + "/fixture.css", "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await writeFile(output + "/styles.css", css.production + moduleCss);
await writeFile(
  output + "/scene.html",
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Riparim isolated Tailwind QA</title><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script type="module" src="fixture.js"></script></body></html>',
);
await writeFile(
  output + "/fixture-source.tsx",
  await readFile("scripts/tailwind-qa/fixture.tsx"),
);
const assets = {};
for (const file of ["styles.css", "fixture.js", "fixture-source.tsx"]) {
  const bytes = await readFile(output + "/" + file);
  assets[file] = {
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
await writeFile(
  output + "/manifest.json",
  JSON.stringify(
    {
      variant,
      head: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      compiledCssDigest: css.digest,
      stylesheets: css.stylesheets,
      assets,
      limits: [
        "Standalone real React component fixtures use synthetic session/API responses; they do not prove framework hydration or server authorization.",
        "Google providers are blocked and use unavailable fallback; provider-owned shadow layout requires separate acceptance.",
        "Pointer and preference media use real browser settings. System theme follows the host preference.",
      ],
    },
    null,
    2,
  ),
);
console.log(output);
