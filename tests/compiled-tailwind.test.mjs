import assert from "node:assert/strict";
import { cssForDom, matchesViewport } from "./helpers/style-fixture.mjs";
import { JSDOM } from "jsdom";
import { compileApplicationCss } from "./helpers/compiled-tailwind.mjs";

const result = await compileApplicationCss();
assert(
  result.source.includes("/*! tailwindcss v4.2.1"),
  "Styles come from the pinned Tailwind compiler",
);
assert(
  result.source.includes(".inline-flex"),
  "Literal component utilities are emitted",
);
assert(
  !result.source.includes('@import "tailwindcss"'),
  "Imports are resolved before consumers inspect styles",
);
assert(
  result.production.length > 0 &&
    result.production.length < result.source.length,
  "The production fixture runs the locked CSS minifier",
);
assert.equal(
  (await compileApplicationCss()).digest,
  result.digest,
  "Identical sources reuse the same style cache",
);
console.log(
  "Compiled Tailwind fixtures: real utilities, resolved imports, minified production and source cache",
);

assert(matchesViewport("(max-width:720px)", { width: 720 }));
assert(!matchesViewport("(max-width:720px)", { width: 721 }));
assert(
  matchesViewport("(width >= 1001px) and (height > 600px)", {
    width: 1001,
    height: 601,
  }),
);
assert(
  !matchesViewport("(width >= 1001px) and (height > 600px)", {
    width: 1000,
    height: 601,
  }),
);
const dom = new JSDOM(
  `<style>${cssForDom(result.source)}</style><div class="inline-flex"></div>`,
);
assert.equal(
  dom.window.getComputedStyle(dom.window.document.querySelector("div")).display,
  "inline-flex",
  "jsdom checks real emitted utilities after supported syntax normalization",
);
dom.window.close();
const layerFixture = new JSDOM(
  `<style>${cssForDom("@layer base, utilities;@layer utilities{.item{padding:1px;border-width:1px!important}}@layer base{#root .item{padding:0;border-width:2px!important}}.item{padding:3px;border-width:4px!important}:root{--size:0.25rem}.item{width:calc(var(--size) * 4)}")}</style><div id="root"><div class="item"></div></div>`,
);
const layerStyle = layerFixture.window.getComputedStyle(
  layerFixture.window.document.querySelector(".item"),
);
assert.equal(
  layerStyle.padding,
  "3px",
  "Unlayered normal rules outrank layered declarations regardless of selector specificity",
);
assert.equal(
  layerStyle.borderTopWidth,
  "2px",
  "Important declarations reverse named layer precedence",
);
assert.equal(
  layerStyle.width,
  "16px",
  "Fixed rem/variable/calc values normalize without a layout engine",
);
layerFixture.window.close();
