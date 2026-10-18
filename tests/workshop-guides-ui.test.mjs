import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
const output = ".test-runtime/workshop-guides-ui.mjs";
const bundle = await build({
  stdin: {
    contents: `export {GuideIndexContent,GuideArticleContent} from './components/workshop-guide-content';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  outfile: output,
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  packages: "external",
  external: ["react", "react-dom", "react/jsx-runtime"],
  plugins: [
    {
      name: "navigation-boundary",
      setup(builder) {
        builder.onResolve({ filter: /^next\/link$/ }, () => ({
          path: "link",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          loader: "js",
          contents: `import {createElement} from 'react';export default function Link({href,children,...props}){return createElement('a',{...props,href},children);}`,
        }));
      },
    },
  ],
});
await mkdir(".test-runtime", { recursive: true });
await writeFile(output, bundle.outputFiles[0].contents);
const { GuideIndexContent, GuideArticleContent, I18nProvider, getMessages } =
  await import(new URL("../" + output, import.meta.url));
const expectations = {
  de: {
    index: "Werkstatt-Ratgeber für Kosovo",
    catalogue: "/werkstaetten",
    paths: [
      "/ratgeber/werkstatt-auswaehlen",
      "/ratgeber/werkstattbesuch-vorbereiten",
    ],
    titles: [
      "Eine Werkstatt in Kosovo auswählen",
      "Werkstattbesuch und Kostenvoranschlag vorbereiten",
    ],
    review: "Besuchsnachweis",
    estimate: "Arbeitskosten",
  },
  sq: {
    index: "Udhëzues për serviset në Kosovë",
    catalogue: "/sq/serviset",
    paths: [
      "/sq/udhezues/zgjedhja-e-servisit",
      "/sq/udhezues/pergatitja-e-vizites",
    ],
    titles: [
      "Si të zgjedhësh një servis në Kosovë",
      "Përgatit vizitën në servis dhe vlerësimin e kostos",
    ],
    review: "dëshmisë private",
    estimate: "punës së dorës",
  },
  en: {
    index: "Workshop guides for Kosovo",
    catalogue: "/en/workshops",
    paths: ["/en/guides/choosing-a-workshop", "/en/guides/preparing-a-visit"],
    titles: [
      "How to choose a workshop in Kosovo",
      "Prepare your workshop visit and repair estimate",
    ],
    review: "private visit evidence",
    estimate: "labour",
  },
};
for (const [locale, expected] of Object.entries(expectations)) {
  const render = (Component, props = {}) =>
    new JSDOM(
      renderToStaticMarkup(
        h(
          I18nProvider,
          { locale, messages: getMessages(locale, ["common", "public"]) },
          h(Component, { locale, ...props }),
        ),
      ),
    );
  const index = render(GuideIndexContent);
  try {
    const doc = index.window.document;
    assert.equal(
      doc.querySelector("main h1")?.textContent,
      expected.index,
      "The guide index has a localized accessible title",
    );
    for (const path of expected.paths)
      assert(
        doc.querySelector(`main a[href='${path}']`),
        "The index links to both localized articles",
      );
  } finally {
    index.window.close();
  }
  for (const [position, id] of [
    "choosing-a-workshop",
    "preparing-a-visit",
  ].entries()) {
    const article = render(GuideArticleContent, { id });
    try {
      const doc = article.window.document;
      assert.equal(doc.querySelectorAll("h1").length, 1);
      assert.equal(
        doc.querySelector("article h1")?.textContent,
        expected.titles[position],
      );
      assert(
        doc.querySelector("main a[href='" + expected.catalogue + "']"),
        "A useful localized catalogue entry follows the guidance",
      );
      assert(
        doc.querySelector(
          "main a[href='" + expected.paths[1 - position] + "']",
        ),
        "The related guide remains reachable",
      );
      for (const city of [
        "prishtina",
        "prizren",
        "ferizaj",
        "peja",
        "gjakova",
      ]) {
        const prefix = {
          de: "/werkstaetten",
          sq: "/sq/serviset",
          en: "/en/workshops",
        }[locale];
        assert(
          doc.querySelector(`main a[href='${prefix}/${city}']`),
          "Each guide leads to the real localized city entry: " + city,
        );
      }
      assert.equal(
        doc.querySelectorAll("[data-ui='guide-checklist'] li").length,
        5,
        "Each guide offers a practical checklist",
      );
      assert(
        doc.querySelector("article").textContent.split(/\s+/).length >= 300,
        "The article contains substantive guidance rather than thin SEO copy",
      );
      assert(
        doc
          .querySelector("article")
          .textContent.includes(
            position === 0 ? expected.review : expected.estimate,
          ),
      );
      assert(
        doc.querySelector(
          "a[href='https://www.aaa.com/autorepair/articles/questions-to-ask-when-picking-an-auto-repair-shop']",
        ),
      );
      assert(
        doc.querySelector(
          "a[href='https://www.adac.de/rund-ums-fahrzeug/reparatur-pflege-wartung/werkstatt-tipps/autowerkstatt-auftrag-kosten-termine/']",
        ),
      );
      assert.equal(
        doc.querySelectorAll("form,input,iframe").length,
        0,
        "Public guidance collects no personal data or provider embeds",
      );
    } finally {
      article.window.close();
    }
  }
}
console.log(
  "DE/SQ/EN semantic guide index, substantial articles, checklists, safe sources and contextual navigation passed",
);
