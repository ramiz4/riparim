import assert from "node:assert/strict";
import { compileApplicationCss } from "./helpers/compiled-tailwind.mjs";
import { cssForDom } from "./helpers/style-fixture.mjs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const { build } = require("esbuild");
const bundle = await build({
  entryPoints: ["components/ui/checkbox.tsx", "components/ui/switch.tsx"],
  outdir: ".test-runtime/form-controls",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  external: [
    "react",
    "react/jsx-runtime",
    "react-dom",
    "radix-ui",
    "lucide-react",
  ],
});
assert.equal(bundle.errors.length, 0);
const { Checkbox } = await import(
  pathToFileURL(".test-runtime/form-controls/checkbox.mjs").href
);
const { Switch } = await import(
  pathToFileURL(".test-runtime/form-controls/switch.mjs").href
);
await build({
  entryPoints: ["components/select-with-other.tsx"],
  outfile: ".test-runtime/form-controls/select-with-other.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  jsx: "automatic",
});
const { SelectWithOther } = await import(
  pathToFileURL(".test-runtime/form-controls/select-with-other.mjs").href
);
const { source: css, production } = await compileApplicationCss();
function resolveTokens(styles, dark, document) {
  return cssForDom(styles, { dark, document });
}
function movement(style, width) {
  const translate = style.translate.startsWith("calc(")
    ? width - 2
    : parseFloat(style.translate) || 0;
  const transform = parseFloat(
    style.transform.match(/^translate(?:X)?\(([-.\d]+)/)?.[1] ?? "0",
  );
  return translate + transform;
}
function markup(checked, size, context) {
  return renderToStaticMarkup(
    createElement(
      "label",
      { className: context },
      createElement(Switch, { checked, size, "aria-label": "Activation" }),
      createElement("span", null, "Activation"),
    ),
  );
}
for (const [variant, styles] of [
  ["source", css],
  ["production", production],
]) {
  for (const dark of [false, true]) {
    for (const presentation of ["default", "claim", "moderation"]) {
      for (const disabled of [false, true]) {
        const html = renderToStaticMarkup(
          createElement(SelectWithOther, {
            id: "visit-evidence",
            label: "Visit evidence",
            placeholder: "Choose evidence",
            options: [{ value: "invoice", label: "Invoice" }],
            value: { choice: "", detail: "" },
            onChange() {},
            detailLabel: "Other evidence",
            detailPlaceholder: "Describe evidence",
            minLength: 3,
            maxLength: 100,
            presentation,
            disabled,
          }),
        );
        const dom = new JSDOM(
          `<html class="${dark ? "dark" : ""}"><head><style></style></head><body>${html}</body></html>`,
        );
        try {
          const { document } = dom.window;
          document.querySelector("style").textContent = resolveTokens(
            styles,
            dark,
            document,
          );
          const trigger = document.querySelector("button[role=combobox]"),
            value = trigger?.querySelector("[data-slot=select-value]"),
            context = `${variant}, dark=${dark}, ${presentation}, disabled=${disabled}`,
            expected = dark ? "rgb(237, 247, 246)" : "rgb(24, 44, 48)";
          assert(trigger?.hasAttribute("data-placeholder"), context);
          assert.equal(value?.textContent, "Choose evidence", context);
          assert.equal(
            dom.window.getComputedStyle(trigger).color,
            expected,
            context,
          );
          assert.equal(
            dom.window.getComputedStyle(value).color,
            expected,
            context,
          );
        } finally {
          dom.window.close();
        }
      }
    }
  }
}
for (const [variant, styles] of [
  ["source", css],
  ["production", production],
]) {
  for (const dark of [false, true]) {
    for (const context of [
      "",
      "activation-switch",
      "activation-switch users-activation",
    ]) {
      for (const size of ["default", "sm"]) {
        for (const checked of [false, true]) {
          const dom = new JSDOM(
            `<html class="${dark ? "dark" : ""}"><style></style><form class="journey-form">${markup(checked, size, context)}</form></html>`,
          );
          try {
            dom.window.document.querySelector("style").textContent =
              resolveTokens(styles, dark, dom.window.document);
            const get = (selector) =>
              dom.window.getComputedStyle(
                dom.window.document.querySelector(selector),
              );
            const track = get("[data-slot=switch]"),
              thumb = get("[data-slot=switch-thumb]");
            const inset =
              parseFloat(track.borderLeftWidth) + parseFloat(track.paddingLeft);
            const trackWidth = parseFloat(track.width),
              thumbWidth = parseFloat(thumb.width);
            const left = inset + movement(thumb, thumbWidth);
            const message = `${variant}, dark=${dark}, context=${context}, size=${size}, checked=${checked}`;
            assert(
              left >= inset && left + thumbWidth <= trackWidth - inset,
              `${message}: thumb stays inside track`,
            );
            assert.equal(
              left,
              checked ? trackWidth - inset - thumbWidth : inset,
              `${message}: thumb reaches the correct end`,
            );
            const expected = dom.window.document.createElement("span");
            expected.style.backgroundColor = dom.window
              .getComputedStyle(dom.window.document.documentElement)
              .getPropertyValue(checked ? "--primary" : "--input");
            assert.equal(
              track.backgroundColor,
              expected.style.backgroundColor,
              `${message}: state remains visible`,
            );
          } finally {
            dom.window.close();
          }
        }
      }
    }
    for (const context of ["", "consent", "service-checkboxes"]) {
      for (const checked of [false, true, "indeterminate"]) {
        const html = renderToStaticMarkup(
          createElement(
            "label",
            { className: context },
            createElement(Checkbox, { checked, "aria-label": "Consent" }),
          ),
        );
        const dom = new JSDOM(
          `<html class="${dark ? "dark" : ""}"><style></style><form class="journey-form">${html}</form></html>`,
        );
        try {
          dom.window.document.querySelector("style").textContent =
            resolveTokens(styles, dark, dom.window.document);
          const node = dom.window.document.querySelector(
              "[data-slot=checkbox]",
            ),
            style = dom.window.getComputedStyle(node);
          const message = `${variant}, dark=${dark}, context=${context}, checked=${checked}`;
          assert.equal(
            style.width,
            "19px",
            `${message}: checkbox has a consistent width`,
          );
          assert.equal(style.height, "19px");
          assert.equal(style.padding, "0px");
          assert.equal(node.getAttribute("role"), "checkbox");
          assert.equal(
            node.getAttribute("aria-checked"),
            checked === "indeterminate" ? "mixed" : String(checked),
          );
          const expected = dom.window.document.createElement("span");
          expected.style.backgroundColor = dom.window
            .getComputedStyle(dom.window.document.documentElement)
            .getPropertyValue(checked ? "--primary" : "--background");
          assert.equal(
            style.backgroundColor,
            expected.style.backgroundColor,
            `${message}: state remains visible`,
          );
          assert.equal(style.borderLeftStyle, "solid");
          assert(parseFloat(style.borderLeftWidth) > 0);
          if (checked) {
            const check = dom.window.getComputedStyle(
              node.querySelector("[data-slot=checkbox-check]"),
            );
            const mixed = dom.window.getComputedStyle(
              node.querySelector("[data-slot=checkbox-mixed]"),
            );
            assert.equal(
              check.display === "none",
              checked === "indeterminate",
              `${message}: correct state icon`,
            );
            assert.equal(mixed.display === "none", checked !== "indeterminate");
          }
        } finally {
          dom.window.close();
        }
      }
    }
  }
}
console.log(
  "Shared form controls: compiled source/production preserve both switch sizes, checkbox states and empty SelectWithOther foreground in every presentation and theme",
);
