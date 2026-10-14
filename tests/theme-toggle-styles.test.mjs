import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { compileApplicationCss } from "./helpers/compiled-tailwind.mjs";
import { cssForDom } from "./helpers/style-fixture.mjs";
const output = ".test-runtime/theme-toggle-styles";
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["components/theme-toggle.tsx"],
  outfile: output + "/toggle.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  jsx: "automatic",
});
const { ThemeToggle } = await import(
  new URL("../" + output + "/toggle.mjs", import.meta.url)
);
const { source, production } = await compileApplicationCss();
const markup = renderToStaticMarkup(createElement(ThemeToggle));
function offset(style, width) {
  const translate = style.translate.startsWith("calc(")
    ? width - 2
    : parseFloat(style.translate) || 0;
  const transform = parseFloat(
    style.transform.match(/^translate(?:X)?\(([-.\d]+)/)?.[1] ?? "0",
  );
  return translate + transform;
}
for (const [variant, css] of [
  ["source", source],
  ["production", production],
]) {
  for (const [dark, checked, mounted] of [
    [false, false, true],
    [true, true, true],
    [true, false, false],
    [false, false, false],
  ]) {
    const dom = new JSDOM(
      `<html class="${dark ? "dark" : ""}"><head><style></style></head><body>${markup}</body></html>`,
    );
    try {
      const document = dom.window.document;
      const control = document.querySelector("[data-mounted]");
      const trackNode = document.querySelector("[data-slot=switch]");
      const thumbNode = document.querySelector("[data-slot=switch-thumb]");
      const glyphNode =
        document.querySelector("[data-slot=theme-glyph]") ??
        control.querySelector('span[aria-hidden="true"]');
      assert(glyphNode, "The actual component renders its decorative glyph");
      control.dataset.mounted = String(mounted);
      trackNode.dataset.state = thumbNode.dataset.state = checked
        ? "checked"
        : "unchecked";
      document.querySelector("style").textContent = cssForDom(css, {
        dark,
        document,
      });
      const track = dom.window.getComputedStyle(trackNode),
        thumb = dom.window.getComputedStyle(thumbNode),
        glyph = dom.window.getComputedStyle(glyphNode);
      const inset =
          parseFloat(track.borderLeftWidth) + parseFloat(track.paddingLeft),
        thumbWidth = parseFloat(thumb.width),
        trackWidth = parseFloat(track.width);
      const thumbLeft = inset + offset(thumb, thumbWidth),
        glyphLeft =
          parseFloat(glyph.left) + offset(glyph, parseFloat(glyph.width));
      const context = `${variant}: dark=${dark}, checked=${checked}, mounted=${mounted}`;
      assert(
        thumbLeft >= inset && thumbLeft + thumbWidth <= trackWidth - inset,
        `${context}: thumb stays inside the pill`,
      );
      assert.equal(
        thumbLeft + thumbWidth / 2,
        glyphLeft + parseFloat(glyph.width) / 2,
        `${context}: icon remains centered on the thumb`,
      );
      assert(
        !(
          thumb.translate &&
          thumb.translate !== "none" &&
          thumb.transform &&
          thumb.transform !== "none"
        ),
        `${context}: movement uses only one CSS property`,
      );
    } finally {
      dom.window.close();
    }
  }
}
console.log(
  "Theme toggle: actual component and compiled source/production keep the thumb contained and glyph centered for light/dark pre- and post-hydration attributes",
);
