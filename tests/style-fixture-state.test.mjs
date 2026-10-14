import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { cssForDom } from "./helpers/style-fixture.mjs";

const dom = new JSDOM(
  '<html><head></head><body><button class="panel" data-docked="false">Search</button></body></html>',
);
try {
  const document = dom.window.document;
  const style = document.createElement("style");
  style.textContent = cssForDom(
    '.panel[data-docked="true"] { border-top-left-radius: 0; background: #096e61; } .later { color: #176b51; }',
    { document },
  );
  document.head.append(style);
  const panel = document.querySelector("button");
  panel.dataset.docked = "true";
  assert.equal(
    dom.window.getComputedStyle(panel).backgroundColor,
    "rgb(9, 110, 97)",
    "Compiled state rules must survive initial unmatched DOM and apply after the state changes",
  );
  assert.equal(
    dom.window.getComputedStyle(panel).borderTopLeftRadius,
    "0px",
    "The adapter resolves a valid unitless zero corner to its pixel representation",
  );
  const later = document.createElement("p");
  later.className = "later";
  document.body.append(later);
  assert.equal(
    dom.window.getComputedStyle(later).color,
    "rgb(23, 107, 81)",
    "Rules also remain available for components rendered after stylesheet installation",
  );
  style.textContent += cssForDom(
    ".font-reset { font: inherit; } .font-override { font-size: 18px; font-weight: 700; line-height: 1.2; }",
  );
  panel.className = "font-reset font-override";
  assert.equal(
    dom.window.getComputedStyle(panel).fontSize,
    "18px",
    "A later font longhand overrides the earlier inherited shorthand",
  );
  assert.equal(dom.window.getComputedStyle(panel).fontWeight, "700");
  assert.equal(dom.window.getComputedStyle(panel).lineHeight, "1.2");
  console.log(
    "Compiled style fixtures retain future state/component rules and zero-length corners",
  );
} finally {
  dom.window.close();
}
