import assert from "node:assert/strict";
import { compileApplicationCss } from "./helpers/compiled-tailwind.mjs";
import { cssForDom } from "./helpers/style-fixture.mjs";
import { createGoogleStyleFixture } from "./helpers/google-style-fixture.mjs";
const { source, production } = await compileApplicationCss();
const fixture = await createGoogleStyleFixture("workshop-review-styles");
try {
  for (const [variant, css] of [
    ["source", source],
    ["production", production],
  ])
    for (const dark of [false, true]) {
      fixture.document.documentElement.classList.toggle("dark", dark);
      fixture.document.getElementById("fixture-style").textContent = cssForDom(
        css,
        { dark },
      );
      await fixture.render("de", fixture.widget("reviews"));
      const widget = fixture.document.querySelector(
        "gmp-advanced-place-details",
      );
      assert(
        widget,
        "The actual review component mounts its isolated provider host",
      );
      const style = fixture.dom.window.getComputedStyle(widget);
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
          `${variant}, dark=${dark}: provider ${size} inset remains normal (${spacing})`,
        );
      }
      assert.equal(style.width, "100%");
      assert.equal(style.maxWidth, "none");
      assert(
        widget.querySelector("gmp-place-attribution"),
        "Native provider attribution remains present",
      );
      await fixture.render(
        "de",
        fixture.h(fixture.api.ReviewForm, {
          workshop: fixture.workshop,
          directory: [fixture.workshop],
          signedIn: true,
          returnTo: "/werkstatt/fixture-workshop",
        }),
      );
      const date = fixture.document.querySelector('input[type="date"]');
      assert(date, "The actual review form renders its native date control");
      for (const [node, message] of [
        [date.closest("fieldset"), "fieldset"],
        [date.closest("label"), "grid label"],
        [date, "native date control"],
      ]) {
        assert.equal(
          parseFloat(fixture.dom.window.getComputedStyle(node).minWidth),
          0,
          `${variant}: ${message} shrinks below intrinsic content width`,
        );
      }
      const dateStyle = fixture.dom.window.getComputedStyle(date);
      assert.equal(
        dateStyle.maxWidth,
        "100%",
        "Date controls stay inside the grid cell",
      );
      assert.equal(
        dateStyle.boxSizing,
        "border-box",
        "Date padding remains inside available width",
      );
    }
} finally {
  await fixture.close();
}
console.log(
  "Workshop review styles: actual provider hosts and review/date form contracts pass compiled source and production CSS in both themes",
);
