import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { compileApplicationCss } from "./helpers/compiled-tailwind.mjs";
import { cssForDom } from "./helpers/style-fixture.mjs";

const output = ".test-runtime/native-button-styles";
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["components/ui/button.tsx"],
  outfile: output + "/button.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  jsx: "automatic",
});
const { Button } = await import(
  new URL("../" + output + "/button.mjs", import.meta.url)
);
const { source, production } = await compileApplicationCss();
const variants = [
  "default",
  "destructive",
  "outline",
  "secondary",
  "ghost",
  "link",
];
const sizes = {
  default: 36,
  xs: 24,
  sm: 32,
  lg: 40,
  icon: 36,
  "icon-xs": 24,
  "icon-sm": 32,
  "icon-lg": 40,
};
const markup = renderToStaticMarkup(
  h(
    "main",
    { style: { fontSize: 16, fontWeight: 400, lineHeight: "24.8px" } },
    ...variants.flatMap((variant) =>
      Object.keys(sizes).map((size) =>
        h(Button, { key: variant + size, variant, size }, "Shared button"),
      ),
    ),
    h(Button, { disabled: true }, "Disabled button"),
    h(
      Button,
      {
        id: "caller",
        className:
          "border-2 border-[#123456] bg-[#abcdef] text-[18px] font-bold leading-[1.2] text-[#234567]",
      },
      "Caller presentation",
    ),
    h(
      Button,
      { asChild: true },
      h(
        "button",
        {
          id: "slotted-caller",
          className: "bg-[#abcdef] text-[18px] font-bold text-[#234567]",
        },
        "Composed presentation",
      ),
    ),
    h(
      Button,
      {
        asChild: true,
        id: "anchor-caller",
        className: "border-2 bg-[#abcdef] text-[#234567]",
      },
      h("a", { href: "/fixture" }, "Anchor presentation"),
    ),
  ),
);
// jsdom exposes explicit inheritance keywords rather than resolving them.
function inheritedStyle(window, node, property) {
  const value = window.getComputedStyle(node)[property];
  return (!value || value === "inherit") && node.parentElement
    ? inheritedStyle(window, node.parentElement, property)
    : value;
}
for (const [name, css] of [
  ["source", source],
  ["production", production],
])
  for (const dark of [false, true]) {
    const dom = new JSDOM(
      `<html class="${dark ? "dark" : ""}"><head><style></style></head><body>${markup}</body></html>`,
      { pretendToBeVisual: true },
    );
    try {
      const { document } = dom.window;
      document.querySelector("style").textContent = cssForDom(css, { dark });
      for (const button of document.querySelectorAll("button[data-size]")) {
        if (button.id) continue;
        const style = dom.window.getComputedStyle(button),
          context = `${name}, dark=${dark}, ${button.dataset.variant}/${button.dataset.size}`;
        assert.equal(
          inheritedStyle(dom.window, button, "fontSize"),
          "16px",
          context,
        );
        assert.equal(
          inheritedStyle(dom.window, button, "fontWeight"),
          "400",
          context,
        );
        assert.equal(
          inheritedStyle(dom.window, button, "lineHeight"),
          "24.8px",
          context,
        );
        assert.equal(style.backgroundColor, "rgba(0, 0, 0, 0)", context);
        assert.equal(parseFloat(style.borderTopWidth), 0, context);
        assert.equal(
          inheritedStyle(dom.window, button, "color"),
          dark ? "rgb(237, 247, 246)" : "rgb(24, 44, 48)",
          context,
        );
        assert.equal(
          parseFloat(style.height),
          sizes[button.dataset.size],
          context,
        );
        if (button.disabled) assert.equal(style.opacity, "0.45", context);
      }
      for (const id of ["caller", "slotted-caller", "anchor-caller"]) {
        const node = document.getElementById(id),
          style = dom.window.getComputedStyle(node);
        assert.equal(
          style.backgroundColor,
          "rgb(171, 205, 239)",
          `${name}: ${id} caller background wins`,
        );
        assert.equal(
          style.color,
          "rgb(35, 69, 103)",
          `${name}: ${id} caller color wins`,
        );
        if (id !== "anchor-caller") {
          assert.equal(style.fontSize, "18px", `${name}: ${id} font size`);
          assert.equal(style.fontWeight, "700", `${name}: ${id} font weight`);
        }
        if (id !== "slotted-caller") assert.equal(style.borderTopWidth, "2px");
      }
    } finally {
      dom.window.close();
    }
  }
console.log(
  "Native Button: compiled source/production preserve inherited native appearance for every variant and size in both themes; direct, slotted and anchor caller utilities win",
);
