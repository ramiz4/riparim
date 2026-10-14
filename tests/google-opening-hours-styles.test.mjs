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
  for (const locale of ["de", "sq", "en"])
    for (const dark of [false, true]) {
      const dom = new JSDOM(
        `<html lang="${locale}" class="${dark ? "dark" : ""}"><style>${styles}</style><div class="profile-overview-details"><div class="google-reviews-panel google-overview-panel"><div class="google-official-widget"><gmp-advanced-place-details><gmp-place-opening-hours></gmp-place-opening-hours><gmp-place-attribution></gmp-place-attribution></gmp-advanced-place-details></div></div></div><div class="profile-google-reviews"><div class="google-official-widget"><gmp-advanced-place-details></gmp-advanced-place-details></div></div></html>`,
      );
      try {
        const widget = dom.window.document.querySelector(
          ".google-overview-panel gmp-advanced-place-details",
        );
        const style = dom.window.getComputedStyle(widget);
        assert.equal(
          style.height,
          "auto",
          `${variant}, ${locale}, dark=${dark}: the opening-hours widget must grow when Google expands the weekly list instead of clipping it to the summary height`,
        );
        assert.equal(
          style.maxHeight,
          "",
          "expanded opening hours have no height cap",
        );
        assert.equal(
          style.width,
          "100%",
          "the overview fits narrow profile columns",
        );
        assert.equal(
          style.maxWidth,
          "none",
          "the overview fills desktop profile columns",
        );
        assert(
          widget.querySelector("gmp-place-attribution"),
          "native Google attribution remains present",
        );
        assert.equal(
          dom.window.getComputedStyle(
            dom.window.document.querySelector(
              ".profile-google-reviews gmp-advanced-place-details",
            ),
          ).height,
          "480px",
          "the separate review list retains its scrollable height",
        );
      } finally {
        dom.window.close();
      }
    }
}
console.log(
  "Google opening hours: expandable overview height survives source and production CSS in DE/SQ/EN and both themes",
);
