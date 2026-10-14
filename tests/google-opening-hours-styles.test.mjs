import assert from "node:assert/strict";
import { compileApplicationCss } from "./helpers/compiled-tailwind.mjs";
import { cssForDom } from "./helpers/style-fixture.mjs";
import { createGoogleStyleFixture } from "./helpers/google-style-fixture.mjs";
const { source, production } = await compileApplicationCss();
const fixture = await createGoogleStyleFixture("google-opening-hours-styles");
try {
  for (const [variant, css] of [
    ["source", source],
    ["production", production],
  ]) {
    for (const locale of ["de", "sq", "en"])
      for (const dark of [false, true]) {
        fixture.document.documentElement.lang = locale;
        fixture.document.documentElement.classList.toggle("dark", dark);
        fixture.document.getElementById("fixture-style").textContent =
          cssForDom(css, { dark });
        await fixture.render(
          locale,
          fixture.h(
            "div",
            null,
            fixture.widget("overview"),
            fixture.widget("reviews"),
          ),
        );
        const widgets = fixture.document.querySelectorAll(
          "gmp-advanced-place-details",
        );
        assert.equal(
          widgets.length,
          2,
          "Actual overview and reviews mount isolated provider hosts",
        );
        const style = fixture.dom.window.getComputedStyle(widgets[0]);
        assert.equal(
          style.height,
          "auto",
          `${variant}, ${locale}, dark=${dark}: expanded weekly hours retain automatic height`,
        );
        assert.equal(style.maxHeight, "", "The weekly list has no height cap");
        assert.equal(
          style.width,
          "100%",
          "The actual provider host fits a narrow profile column",
        );
        assert.equal(
          style.maxWidth,
          "none",
          "The actual provider host fills the desktop column",
        );
        assert(
          widgets[0].querySelector("gmp-place-opening-hours"),
          "The overview retains opening-hours content",
        );
        assert(
          widgets[0].querySelector("gmp-place-attribution"),
          "Native provider attribution remains present",
        );
        assert.equal(
          fixture.dom.window.getComputedStyle(widgets[1]).height,
          "480px",
          "The separate review list keeps its scrolling height",
        );
      }
  }
} finally {
  await fixture.close();
}
console.log(
  "Google opening hours: actual component hosts retain automatic overview height, scrollable review height and attribution with compiled source/production CSS in DE/SQ/EN and both themes",
);
