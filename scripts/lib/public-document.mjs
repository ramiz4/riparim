import { JSDOM } from "jsdom";
import { localizeHref } from "./locale.mjs";

// Reject an invalid snapshot before it can be written into a release artifact.
// This inspects the parsed document; metadata stranded in body is not a head.
export function validatePublicDocumentHead(html, identity, locale, origin) {
  const dom = new JSDOM(html);
  try {
    const { document } = dom.window;
    const head = document.head;
    const title = head.querySelectorAll("title");
    const description = head.querySelectorAll('meta[name="description"]');
    const canonical = head.querySelectorAll('link[rel="canonical"]');
    const alternatives = [
      ...head.querySelectorAll('link[rel="alternate"][hreflang]'),
    ];
    const expected = new Map(
      ["de", "sq", "en", "x-default"].map((language) => [
        language,
        origin +
          localizeHref(identity, language === "x-default" ? "de" : language),
      ]),
    );
    if (
      title.length !== 1 ||
      !title[0].textContent.trim() ||
      description.length !== 1 ||
      !description[0].content.trim() ||
      canonical.length !== 1 ||
      canonical[0].href !== origin + localizeHref(identity, locale) ||
      alternatives.length !== expected.size ||
      alternatives.some((link) => expected.get(link.hreflang) !== link.href) ||
      new Set(alternatives.map((link) => link.hreflang)).size !==
        expected.size ||
      [
        ...document.body.querySelectorAll(
          'title,meta[name="description"],link[rel="canonical"],link[rel="alternate"][hreflang]',
        ),
      ].some((node) => node.namespaceURI === "http://www.w3.org/1999/xhtml")
    )
      throw Error(
        `Public release metadata is not a complete parsed head: ${locale} ${identity}`,
      );
  } finally {
    dom.window.close();
  }
}
