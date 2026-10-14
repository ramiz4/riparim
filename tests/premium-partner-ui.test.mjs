import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";
const dom = new JSDOM('<div id="root"></div>', {
  url: "https://riparim.example.test/",
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole(),
});
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "DocumentFragment",
  "Element",
  "Node",
  "NodeFilter",
  "MutationObserver",
  "CustomEvent",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "getComputedStyle",
])
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
  dom.window,
);
window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
await mkdir(".test-runtime/premium-ui", { recursive: true });
await build({
  stdin: {
    contents:
      "export {PremiumPartnerControl} from './components/premium-partner-control';export {I18nProvider} from './lib/i18n/client';export {getMessages,createTranslator} from './lib/i18n/messages';",
    loader: "tsx",
    resolveDir: process.cwd(),
  },
  outfile: ".test-runtime/premium-ui/ui.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
});
const { PremiumPartnerControl, I18nProvider, getMessages, createTranslator } =
  await import(new URL("../.test-runtime/premium-ui/ui.mjs", import.meta.url));
const { createElement: h, act } = await import("react"),
  { createRoot } = await import("react-dom/client");
const root = createRoot(document.getElementById("root"));
let saved = [],
  readFail = false,
  saveFail = false,
  active = false;
globalThis.fetch = async (url, options) => {
  assert(String(url).startsWith("/api/premium-workshops"));
  if (options?.method === "PUT") {
    saved.push(JSON.parse(options.body));
    return saveFail
      ? Response.json({ errorCode: "unavailable" }, { status: 503 })
      : Response.json({ messageCode: "saved" });
  }
  return readFail
    ? Response.json({ errorCode: "unavailable" }, { status: 503 })
    : Response.json({ active });
};
const click = async (node) => {
  assert(node);
  await act(async () => {
    node.focus();
    node.click();
  });
};
try {
  for (const locale of ["de", "sq", "en"]) {
    const t = createTranslator(getMessages(locale));
    const render = async (status = "published") =>
      act(async () =>
        root.render(
          h(
            I18nProvider,
            { locale, messages: getMessages(locale, ["common", "management"]) },
            h(PremiumPartnerControl, {
              workshop: {
                id: "fixture-workshop",
                name: "Fictional workshop",
                status,
              },
            }),
          ),
        ),
      );
    const open = async () => click(document.querySelector(".premium-control"));
    const save = () =>
      [...document.querySelectorAll('[role="dialog"] button')].find(
        (node) => node.textContent === t("management.premiumSave"),
      );
    active = false;
    readFail = false;
    saveFail = false;
    await render();
    await open();
    assert(
      document
        .querySelector('[role="dialog"]')
        .textContent.includes(t("management.premiumHelp")),
    );
    await click(document.querySelector('[role="checkbox"]'));
    await click(save());
    assert.deepEqual(saved.at(-1), {
      workshop: "fixture-workshop",
      active: true,
    });
    assert(!document.querySelector('[role="dialog"]'));
    await open();
    await click(document.querySelector('[role="checkbox"]'));
    saveFail = true;
    await click(save());
    assert(document.querySelector('[role="alert"]'));
    assert.equal(
      document.querySelector('[role="checkbox"]').getAttribute("aria-checked"),
      "true",
      "save failure retains the intended status",
    );
    saveFail = false;
    await click(save());
    assert(
      !document.querySelector('[role="dialog"]'),
      "same status can be retried without losing the draft",
    );
    readFail = true;
    await open();
    assert(save().disabled, "unavailable state cannot be overwritten");
    readFail = false;
    await click(
      [...document.querySelectorAll('[role="dialog"] button')].find(
        (node) => node.textContent === t("common.retry"),
      ),
    );
    assert(!save().disabled);
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    await act(async () => root.render(null));
    await render("draft");
    await open();
    assert(
      document.querySelector('[role="checkbox"]').disabled,
      "inactive drafts cannot be activated",
    );
    await act(async () => root.render(null));
    active = true;
    await render("draft");
    await open();
    assert(
      !document.querySelector('[role="checkbox"]').disabled,
      "existing hidden partner flags can be cleared",
    );
    await click(document.querySelector('[role="checkbox"]'));
    await click(save());
    assert.equal(saved.at(-1).active, false);
    await act(async () => root.render(null));
  }
  console.log(
    "Premium management UI: localized manual confirmation, read errors, retained save drafts/retry, published-only activation and hidden-placement removal passed",
  );
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
