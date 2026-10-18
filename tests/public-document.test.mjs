import assert from "node:assert/strict";
import { validatePublicDocumentHead } from "../scripts/lib/public-document.mjs";

const metadata = `<title>Workshop guides</title><meta name="description" content="Practical workshop guidance"><link rel="canonical" href="https://riparim.test/en/guides"><link rel="alternate" hreflang="de" href="https://riparim.test/ratgeber"><link rel="alternate" hreflang="sq" href="https://riparim.test/sq/udhezues"><link rel="alternate" hreflang="en" href="https://riparim.test/en/guides"><link rel="alternate" hreflang="x-default" href="https://riparim.test/ratgeber">`;
const validate = (html) =>
  validatePublicDocumentHead(html, "/guides", "en", "https://riparim.test");
assert.doesNotThrow(() =>
  validate(
    `<html lang="en"><head>${metadata}</head><body><h1>Guides</h1></body></html>`,
  ),
);
assert.doesNotThrow(
  () =>
    validate(
      `<html lang="en"><head>${metadata}</head><body><h1>Guides</h1><svg xmlns="http://www.w3.org/2000/svg"><title>Scan workshop profile</title></svg></body></html>`,
    ),
  "An accessible QR SVG title is not HTML head metadata",
);
for (const html of [
  `<html><head></head><body><h1>Guides</h1>${metadata}</body></html>`,
  `<html><head>${metadata}<title>Duplicate</title></head><body></body></html>`,
  `<html><head>${metadata.replace('href="https://riparim.test/en/guides"', 'href="https://riparim.test/en/guides?token=private"')}</head><body></body></html>`,
  `<html><head>${metadata.replace('hreflang="sq"', 'hreflang="de"')}</head><body></body></html>`,
])
  assert.throws(
    () => validate(html),
    /complete parsed head/,
    "Release capture rejects body-only, duplicated or contaminated metadata before writing HTML",
  );
console.log(
  "Release head guard: valid metadata passes; body-only, duplicate and private-query variants fail closed",
);
