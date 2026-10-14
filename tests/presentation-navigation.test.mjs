import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { JSDOM } from "jsdom";
const dom = new JSDOM('<div id="root"></div><main id="page"></main>', {
  url: "https://riparim.example.test/werkstaetten",
  pretendToBeVisual: true,
});
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
])
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const output = ".test-runtime/presentation-navigation";
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["components/workshop-navigation-link.tsx"],
  outfile: output + "/link.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  jsx: "automatic",
  plugins: [
    {
      name: "navigation-transport",
      setup(builder) {
        builder.onResolve(
          {
            filter:
              /^(@\/lib\/profile-navigation|next\/navigation|next\/link)$/,
          },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          loader: "js",
          resolveDir: process.cwd(),
          contents:
            args.path === "@/lib/profile-navigation"
              ? "export function navigateToWorkshopPage(target, navigation){globalThis.fixtureNavigation={target,navigation};return ()=>{};}"
              : args.path === "next/link"
                ? "import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children);}"
                : "export function useRouter(){return {push(){}};}export function usePathname(){return window.location.pathname;}",
        }));
      },
    },
  ],
});
const { WorkshopNavigationLink } = await import(
  new URL("../" + output + "/link.mjs", import.meta.url)
);
const { createElement: h, act } = await import("react"),
  { createRoot } = await import("react-dom/client");
const root = createRoot(document.getElementById("root")),
  page = document.getElementById("page");
try {
  await act(async () =>
    root.render(
      h(
        WorkshopNavigationLink,
        { href: "/werkstaetten" },
        "Return to catalogue",
      ),
    ),
  );
  await act(async () => document.querySelector("a").click());
  const ready = globalThis.fixtureNavigation.navigation.isPageReady;
  assert.equal(
    ready("/werkstaetten"),
    false,
    "A URL without the destination page is not ready",
  );
  page.dataset.riparimPage = "catalogue";
  assert.equal(
    ready("/werkstaetten"),
    true,
    "The rendered catalogue uses a stable page identity without presentation classes",
  );
  assert.equal(
    ready("/werkstatt/fixture-workshop"),
    false,
    "The catalogue cannot stand in for a profile",
  );
  page.dataset.riparimPage = "workshop";
  page.dataset.workshopId = "fixture-workshop";
  assert.equal(
    ready("/werkstatt/fixture-workshop"),
    true,
    "A profile is ready only for the requested workshop",
  );
  assert.equal(
    ready("/werkstatt/another-workshop"),
    false,
    "A stale profile never completes a different workshop navigation",
  );
  page.removeAttribute("data-workshop-id");
  assert.equal(
    ready("/werkstatt/fixture-workshop"),
    false,
    "A shell without loaded identity does not satisfy navigation readiness",
  );
  console.log(
    "Presentation-independent navigation: catalogue identity, stale profile and unloaded shell contracts passed",
  );
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
