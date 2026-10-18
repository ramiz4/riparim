import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { localizeHref } from "../../scripts/lib/locale.mjs";

export function assertPublicHead(html, identity, locale, origin) {
  const dom = new JSDOM(html);
  try {
    const { document } = dom.window;
    const label = `${locale} ${identity}`;
    assert.equal(
      document.head.querySelectorAll("title").length,
      1,
      `${label}: one title belongs in the parsed head`,
    );
    assert(
      document.head.querySelector("title").textContent.trim(),
      `${label}: title is not empty`,
    );
    assert.equal(
      document.head.querySelectorAll('meta[name="description"]').length,
      1,
      `${label}: one description belongs in the parsed head`,
    );
    assert(
      document.head.querySelector('meta[name="description"]').content.trim(),
    );
    assert.equal(
      document.head.querySelectorAll('link[rel="canonical"]').length,
      1,
      `${label}: one canonical belongs in the parsed head`,
    );
    assert.equal(
      document.head.querySelector('link[rel="canonical"]').href,
      origin + localizeHref(identity, locale),
    );
    const alternatives = [
      ...document.head.querySelectorAll('link[rel="alternate"][hreflang]'),
    ];
    assert.equal(
      alternatives.length,
      4,
      `${label}: four reciprocal alternatives belong in the parsed head`,
    );
    assert.deepEqual(
      Object.fromEntries(
        alternatives.map((link) => [link.hreflang, link.href]),
      ),
      Object.fromEntries(
        ["de", "sq", "en", "x-default"].map((language) => [
          language,
          origin +
            localizeHref(identity, language === "x-default" ? "de" : language),
        ]),
      ),
    );
    assert.equal(
      [
        ...document.body.querySelectorAll(
          'title,meta[name="description"],link[rel="canonical"],link[rel="alternate"][hreflang]',
        ),
      ].filter((node) => node.namespaceURI === "http://www.w3.org/1999/xhtml")
        .length,
      0,
      `${label}: SEO metadata must not be frozen in the body`,
    );
  } finally {
    dom.window.close();
  }
}
