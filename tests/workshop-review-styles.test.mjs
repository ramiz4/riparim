import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const { transform } = createRequire(require.resolve("vite/package.json"))(
  "lightningcss",
);
const css = await readFile(
  new URL("../app/ratings.css", import.meta.url),
  "utf8",
);
const production = transform({
  filename: "ratings.css",
  code: Buffer.from(css),
  minify: true,
}).code.toString();
for (const [variant, styles] of [
  ["source", css],
  ["production", production],
]) {
  for (const dark of [false, true]) {
    const dom = new JSDOM(
      `<html class="${dark ? "dark" : ""}"><style>${styles}</style><div class="profile-google-reviews"><div class="google-reviews-panel"><div class="google-official-widget"><gmp-advanced-place-details><gmp-place-reviews></gmp-place-reviews><gmp-place-attribution></gmp-place-attribution></gmp-advanced-place-details></div></div></div></html>`,
    );
    try {
      const widget = dom.window.document.querySelector(
        "gmp-advanced-place-details",
      );
      const style = dom.window.getComputedStyle(widget);
      for (const size of [
        "large",
        "medium",
        "extra-large",
        "two-extra-large",
      ]) {
        const spacing = style
          .getPropertyValue(`--gmp-mat-spacing-${size}`)
          .trim();
        assert(
          !spacing || parseFloat(spacing) >= 16,
          `${variant}, dark=${dark}: Google header and review content must retain the provider's normal inset (${size}=${spacing})`,
        );
      }
      assert.equal(
        style.width,
        "100%",
        "the provider fits narrow profile columns",
      );
      assert.equal(
        style.maxWidth,
        "none",
        "the provider can fill a desktop profile column",
      );
      assert(
        widget.querySelector("gmp-place-attribution"),
        "provider attribution remains inside the native widget",
      );
    } finally {
      dom.window.close();
    }
  }
}
console.log(
  "Google review box: normal provider insets survive source and production CSS in both themes",
);

const controls = await readFile(
  new URL("../app/form-controls.css", import.meta.url),
  "utf8",
);
const compactControls = transform({
  filename: "form-controls.css",
  code: Buffer.from(controls),
  minify: true,
}).code.toString();
for (const [variant, styles] of [
  ["source", controls],
  ["production", compactControls],
]) {
  const dom = new JSDOM(
    `<style>${styles}</style><form class="journey-form combined-review-form"><fieldset class="review-section"><div class="form-grid"><label>Visit date<input type="date"></label><label>Vehicle<input></label></div></fieldset></form>`,
  );
  try {
    const style = (node) =>
      dom.window.getComputedStyle(dom.window.document.querySelector(node));
    assert.equal(
      parseFloat(style("fieldset").minWidth),
      0,
      `${variant}: fieldsets must shrink below their native min-content width`,
    );
    assert.equal(
      parseFloat(style("label").minWidth),
      0,
      `${variant}: date grid cells must shrink below their intrinsic width`,
    );
    assert.equal(
      parseFloat(style("input[type=date]").minWidth),
      0,
      `${variant}: native date inputs must be able to shrink`,
    );
    assert.equal(
      style("input[type=date]").maxWidth,
      "100%",
      `${variant}: native date inputs stay within their grid cell`,
    );
    assert.equal(
      style("input[type=date]").boxSizing,
      "border-box",
      `${variant}: date padding stays inside the available width`,
    );
  } finally {
    dom.window.close();
  }
}
console.log(
  "Review date controls: source and production CSS constrain native fieldset, grid and input widths",
);
