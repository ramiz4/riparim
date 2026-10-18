import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import jsQR from "jsqr";

const dom = new JSDOM('<div id="root"></div>', {
  url: "https://riparim.example.test/en/workshop/issue-209-fixture?suche=private&token=secret#private",
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole(),
});
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLFormElement",
  "HTMLInputElement",
  "Element",
  "Node",
  "MutationObserver",
  "Event",
  "MouseEvent",
  "getComputedStyle",
])
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
window.scrollTo = () => {};
const output = ".test-runtime/profile-sharing";
await mkdir(output, { recursive: true });
await build({
  stdin: {
    contents:
      "export {default as Profile} from './app/[locale]/workshop/[id]/profile';export {WorkshopSharing} from './components/workshop-sharing';export {publicProfileShare} from './lib/profile-sharing';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  outfile: output + "/ui.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  plugins: [
    {
      name: "navigation-fixture",
      setup(b) {
        b.onResolve({ filter: /^next\/(link|navigation)$/ }, ({ path }) => ({
          path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          loader: "js",
          resolveDir: process.cwd(),
          contents:
            path === "next/link"
              ? "import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children)}"
              : "export function useRouter(){return {push(){},refresh(){}};}export function usePathname(){return '/en/workshops/issue-209-fixture';}export function useSearchParams(){return new URLSearchParams();}",
        }));
      },
    },
  ],
});
const api = await import(new URL("../" + output + "/ui.mjs", import.meta.url));
const { createElement: h, act } = await import("react"),
  { createRoot } = await import("react-dom/client");
const workshop = {
  id: "issue-209-fixture",
  name: "(#209) Fixture workshop",
  city: "Prishtina",
  address: "Fixture address",
  phone: "+38349123456",
  whatsapp: "",
  brands: [],
  services: [],
  serviceDetails: [],
  languages: [],
  rating: null,
  count: 0,
  description: "",
  specialty: "",
  lat: null,
  lng: null,
  sources: [],
  checkedAt: "2026-10-18",
  status: "published",
};
const root = createRoot(document.getElementById("root"));
await act(async () =>
  root.render(
    h(
      api.I18nProvider,
      { locale: "en", messages: api.getMessages("en") },
      h(api.Profile, {
        workshop,
        directory: [workshop],
        reviews: [],
        reviewError: "",
        signedIn: false,
        account: null,
        isAdmin: false,
      }),
    ),
  ),
);
const shared = [],
  copied = [];
Object.defineProperty(navigator, "share", {
  value: async (payload) => shared.push(payload),
  configurable: true,
});
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: async (value) => copied.push(value) },
  configurable: true,
});
const share = [...document.querySelectorAll("button")].find((button) =>
  button.textContent.includes("Share profile"),
);
assert(share, "published profiles expose a labeled sharing button");
await act(async () => share.click());
assert.deepEqual(
  shared,
  [
    {
      title: workshop.name,
      url: "https://riparim.com/en/workshop/issue-209-fixture",
    },
  ],
  "native sharing receives only the public name and canonical localized URL",
);
assert.deepEqual(
  copied,
  [],
  "successful native sharing does not write the clipboard",
);

const button = (label) =>
  [...document.querySelectorAll("button")].find(
    (element) => element.textContent === label,
  );
const click = async (element) => {
  assert(element);
  await act(async () => element.click());
};
const render = async (locale = "en", value = workshop, publicOrigin) =>
  act(async () =>
    root.render(
      h(
        api.I18nProvider,
        { locale, messages: api.getMessages(locale) },
        h(api.WorkshopSharing, {
          key: locale + value.status,
          workshop: value,
          publicOrigin,
        }),
      ),
    ),
  );
const status = () => document.querySelector('[role="status"]').textContent;
const setShare = (value) =>
  Object.defineProperty(navigator, "share", { value, configurable: true });
const setClipboard = (value) =>
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });

await render();
setShare(undefined);
await click(button("Share profile"));
assert.equal(
  copied.at(-1),
  "https://riparim.com/en/workshop/issue-209-fixture",
);
assert.equal(status(), api.getMessages("en").sharing.copied);
const copyCount = copied.length;
setShare(async () => {
  throw new DOMException("Private provider detail", "AbortError");
});
await click(button("Share profile"));
assert.equal(status(), "", "cancellation is quiet");
assert.equal(
  copied.length,
  copyCount,
  "cancellation never copies without intent",
);
for (const failure of [
  new DOMException("Private provider detail", "NotAllowedError"),
  Error("Private provider detail"),
]) {
  setShare(async () => {
    throw failure;
  });
  await click(button("Share profile"));
  assert.equal(
    status(),
    api.getMessages("en").sharing.copied,
    "native failure falls back to a clean copy",
  );
  assert(!document.body.textContent.includes("Private provider detail"));
}
setShare(undefined);
for (const clipboard of [
  undefined,
  {
    writeText: async () => {
      throw Error("Private clipboard detail");
    },
  },
]) {
  setClipboard(clipboard);
  await click(button("Share profile"));
  assert.equal(status(), api.getMessages("en").sharing.manual);
  const input = document.querySelector("input[readonly]");
  assert.equal(
    input.value,
    "https://riparim.com/en/workshop/issue-209-fixture",
  );
  assert(
    document.querySelector(`label[for="${input.id}"]`),
    "manual copy input has a visible associated label",
  );
  await act(async () => input.focus());
  assert.equal(
    input.selectionEnd,
    input.value.length,
    "keyboard focus selects the complete clean link",
  );
  assert(!document.body.textContent.includes("Private clipboard detail"));
}
setClipboard({ writeText: async (value) => copied.push(value) });
setShare(async () => {
  throw Error("The copy button must not use native share");
});
await click(button("Copy link"));
assert.equal(status(), api.getMessages("en").sharing.copied);

let finishShare;
let nativeCalls = 0;
setShare(() => {
  nativeCalls++;
  return new Promise((resolve) => {
    finishShare = resolve;
  });
});
await click(button("Share profile"));
assert(
  button("Share profile").disabled && button("Copy link").disabled,
  "in-flight native share disables duplicate actions",
);
await click(button("Share profile"));
assert.equal(nativeCalls, 1);
await act(async () => finishShare());
assert(!button("Share profile").disabled);

// Rasterize the actual SVG's integer module rectangles; jsQR is an independent decoder.
function decode(svg) {
  const size = Number(svg.getAttribute("viewBox").split(" ")[2]);
  const scale = 6,
    width = size * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  const path = svg.querySelectorAll("path")[1].getAttribute("d");
  const rectangles = [...path.matchAll(/M(\d+)[, ](\d+)\s*h(\d+)v1H\d+z/g)];
  assert.equal(
    rectangles.map((match) => match[0]).join(""),
    path,
    "all actual SVG module commands are rasterized",
  );
  for (const [, x, y, length] of rectangles)
    for (let row = Number(y) * scale; row < (Number(y) + 1) * scale; row++)
      for (
        let column = Number(x) * scale;
        column < (Number(x) + Number(length)) * scale;
        column++
      ) {
        const index = (row * width + column) * 4;
        data[index] = data[index + 1] = data[index + 2] = 0;
      }
  return jsQR(data, width, width)?.data;
}
for (const [locale, path] of [
  ["de", "/werkstatt/"],
  ["sq", "/sq/servis/"],
  ["en", "/en/workshop/"],
]) {
  const origin = "https://canonical.example.test/base?token=ignored#private";
  await render(locale, workshop, origin);
  const messages = api.getMessages(locale).sharing;
  await click(button(messages.copy));
  const expected = `https://canonical.example.test${path}${workshop.id}`;
  assert.equal(copied.at(-1), expected);
  const card = document.querySelector('[data-ui="profile-print-card"]');
  assert.equal(card.lang, locale);
  assert.equal(card.querySelector("a").href, expected);
  assert.equal(
    decode(card.querySelector("svg")),
    expected,
    "the rendered QR decodes to the same clean localized URL",
  );
  assert.equal(
    card.querySelector('svg[role="img"] title').textContent,
    messages.qr.replace("{name}", workshop.name),
  );
  const links = [...card.querySelectorAll("a")];
  assert(links.every((link) => !link.search && !link.hash));
  assert(
    !card.innerHTML.includes("example.test/en/workshop/issue-209-fixture?"),
  );
}

await render(
  "en",
  { ...workshop, name: "(#209) <script>private()</script> & Workshop" },
  "https://canonical.example.test",
);
let printCalls = 0;
const appendChild = document.body.appendChild.bind(document.body);
document.body.appendChild = (node) => {
  const result = appendChild(node);
  if (node.tagName === "IFRAME") {
    node.contentWindow.focus = () => {};
    node.contentWindow.print = () => {
      printCalls++;
    };
  }
  return result;
};
await click(button("Print profile card"));
assert.equal(printCalls, 1);
let frame = document.querySelector("iframe"),
  printDoc = frame.contentDocument;
assert.equal(printDoc.querySelectorAll("article").length, 1);
assert.equal(
  printDoc.querySelectorAll("script,input,button,iframe").length,
  0,
  "the print document contains no executable content or other profile UI",
);
assert.equal(
  printDoc.querySelector("h2").textContent,
  "(#209) <script>private()</script> & Workshop",
);
assert.equal(
  printDoc.querySelector("a").href,
  "https://canonical.example.test/en/workshop/issue-209-fixture",
);
assert.equal(
  decode(printDoc.querySelector("svg")),
  printDoc.querySelector("a").href,
);
assert(
  printDoc.querySelector("style").textContent.includes("50mm"),
  "print uses a fixed scannable physical QR size",
);
assert(!printDoc.documentElement.outerHTML.includes("token="));
await click(button("Print profile card"));
assert.equal(
  document.querySelectorAll("iframe").length,
  1,
  "reprinting replaces a stale print frame",
);
frame = document.querySelector("iframe");
frame.contentWindow.dispatchEvent(new frame.contentWindow.Event("afterprint"));
assert.equal(
  document.querySelectorAll("iframe").length,
  0,
  "printing or cancellation cleans up after the native print dialog",
);
document.body.appendChild = (node) => {
  const result = appendChild(node);
  if (node.tagName === "IFRAME")
    node.contentWindow.print = () => {
      throw Error("private printer error");
    };
  return result;
};
await click(button("Print profile card"));
assert.equal(status(), api.getMessages("en").sharing.printError);
assert(!document.querySelector("iframe"));
document.body.appendChild = appendChild;

for (const value of ["draft", "pending", "rejected", undefined]) {
  await render("en", { ...workshop, status: value });
  assert.equal(
    document.querySelector('[data-ui="profile-sharing"]'),
    null,
    "unpublished/unknown states expose no sharing or printable card",
  );
}
for (const id of [
  "",
  "../private",
  "fixture?token=secret",
  "https://evil.test",
])
  assert.equal(api.publicProfileShare({ ...workshop, id }, "en"), null);
for (const origin of [
  "javascript:alert(1)",
  "http://evil.test",
  "https://name:secret@example.test",
  "malformed",
])
  assert.equal(api.publicProfileShare(workshop, "en", origin), null);
assert.equal(api.publicProfileShare({ ...workshop, name: " " }, "en"), null);
await act(async () => root.unmount());
dom.window.close();
console.log(
  "Profile sharing: public localized payload, cancel/errors/busy/manual fallback, isolated print and decoded QR destinations passed (fictional #209 fixtures only)",
);
