import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
const dom = new JSDOM('<div id="root"></div>', {
  url: "https://riparim.example.test/werkstatt/fixture",
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
  "HTMLTextAreaElement",
  "HTMLFormElement",
  "HTMLSelectElement",
  "DocumentFragment",
  "Element",
  "Node",
  "NodeFilter",
  "MutationObserver",
  "CustomEvent",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "File",
  "FormData",
  "getComputedStyle",
])
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
  dom.window,
);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
window.scrollTo = () => {};
HTMLElement.prototype.scrollIntoView = () => {};
HTMLElement.prototype.hasPointerCapture = () => false;
HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.IntersectionObserver = class {
  observe() {}
  disconnect() {}
};
const requests = [];
let finishSubmission;
globalThis.fetch = async (url, init) => {
  assert.equal(url, "/api/visits", "Dialog tests do not make provider calls");
  requests.push(init);
  return new Promise((resolve) => {
    finishSubmission = () =>
      resolve(Response.json({ id: "fixture-submission" }));
  });
};
const output = ".test-runtime/profile-review-dialog";
await mkdir(output, { recursive: true });
await build({
  stdin: {
    contents:
      "export {default as Profile} from './app/[locale]/werkstatt/[id]/profile';export {I18nProvider} from './lib/i18n/client';export {getMessages,createTranslator} from './lib/i18n/messages';export {NavigationGuardProvider,useNavigationState} from './lib/i18n/navigation-guard';",
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
        b.onResolve({ filter: /^next\/(link|navigation)$/ }, (args) => ({
          path: args.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          loader: "js",
          resolveDir: process.cwd(),
          contents:
            args.path === "next/link"
              ? "import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children)}"
              : "export function useRouter(){return {push(){},refresh(){}};}export function usePathname(){return '/werkstatt/fixture';}export function useSearchParams(){return new URLSearchParams();}",
        }));
      },
    },
  ],
});
const api = await import(new URL("../" + output + "/ui.mjs", import.meta.url)),
  { createElement: h, act } = await import("react"),
  { createRoot } = await import("react-dom/client");
const workshop = {
  id: "fixture",
  name: "Fixture workshop",
  city: "Prishtina",
  address: "Fixture address",
  phone: "+38349123456",
  whatsapp: "",
  brands: [],
  services: ["Inspektion & Wartung"],
  serviceDetails: [],
  languages: [],
  rating: null,
  count: 0,
  description: "",
  specialty: "",
  lat: null,
  lng: null,
  sources: [],
  checkedAt: "2026-10-13",
  status: "published",
};
const props = {
  workshop,
  directory: [workshop],
  reviews: [],
  reviewError: "",
  signedIn: true,
  account: {
    provider: "email",
    email: "fixture@example.test",
    displayName: "Fixture user",
  },
  isAdmin: false,
};
let navigation;
function GuardProbe() {
  navigation = api.useNavigationState();
  return null;
}
const root = createRoot(document.getElementById("root")),
  settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const render = async (value = props) =>
  act(async () => {
    root.render(
      h(
        api.I18nProvider,
        { locale: "de", messages: api.getMessages("de") },
        h(
          api.NavigationGuardProvider,
          null,
          h(api.Profile, value),
          h(GuardProbe),
        ),
      ),
    );
    await settle();
  });
const click = async (el) =>
  act(async () => {
    el.click();
    await settle();
  });
const change = async (name, value) =>
  act(async () => {
    const input = document.querySelector(`[name="${name}"]`);
    Object.getOwnPropertyDescriptor(
      input.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    ).set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  });
const travel = async (direction) => {
  await act(async () => {
    await new Promise((resolve) => {
      window.addEventListener("popstate", resolve, { once: true });
      window.history[direction]();
    });
    await settle();
  });
  await act(settle);
};
const open = async () =>
  click(document.querySelector("#bewertungen .text-action"));
const escape = async () => {
  await act(async () => {
    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await settle();
  });
  await act(settle);
};
try {
  window.history.replaceState(
    {},
    "",
    "/werkstatt/fixture?suche=%2Fwerkstaetten%3Fort%3Dpeja",
  );
  await render();
  assert(
    !document.querySelector(".inline-review"),
    "Only the existing write-review action remains",
  );
  await open();
  assert(
    document.querySelector("[role=dialog]").contains(document.activeElement),
    "Opening moves focus into the dialog",
  );
  const form = document.querySelector(".combined-review-form"),
    submit = document.querySelector(".profile-review-dialog [type=submit]");
  assert.equal(
    submit.getAttribute("form"),
    form.id,
    "The fixed footer submits the real form",
  );
  assert.equal(
    new URLSearchParams(window.location.search).get("bewerten"),
    "1",
    "Opening updates the URL",
  );
  assert.equal(
    new URLSearchParams(window.location.search).get("suche"),
    "/werkstaetten?ort=peja",
    "Opening preserves the search return",
  );
  await travel("back");
  assert(
    !document.querySelector("[role=dialog]"),
    "Browser Back closes the dialog",
  );
  await travel("forward");
  assert(
    document.querySelector("[role=dialog]"),
    "Browser Forward opens the dialog again",
  );
  assert(
    !document.querySelector(".review-account-name"),
    "The redundant public-name label is removed",
  );
  await click(
    document.querySelector(
      '[role=combobox][aria-label="Durchgeführte Arbeit"]',
    ),
  );
  await click(
    [...document.querySelectorAll("[role=option]")].find(
      (el) => el.textContent === "Bremsen & Fahrwerk",
    ),
  );
  await escape();
  await change("vehicle", "Fixture car");
  await change("date", "2026-10-01");
  await change("review", "Fixture draft");
  await click(document.querySelectorAll("[role=radio]")[3]);
  await click(document.querySelector("[role=checkbox]"));
  const file = new File(["fixture proof"], "fixture-proof.png", {
    type: "image/png",
  });
  await act(async () => {
    const input = document.querySelector("[type=file]");
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
  });
  await escape();
  assert(!document.querySelector("[role=dialog]"), "Escape closes the dialog");
  assert(
    document.activeElement ===
      document.querySelector("#bewertungen .text-action"),
    "Focus returns to write review",
  );
  assert(navigation.dirty, "A retained closed draft still guards navigation");
  await open();
  assert.equal(document.querySelector("[name=vehicle]").value, "Fixture car");
  assert.equal(document.querySelector("[name=review]").value, "Fixture draft");
  assert.equal(
    document.querySelector("[role=checkbox]").getAttribute("aria-checked"),
    "true",
  );
  assert(
    document
      .querySelector(".review-selected-file")
      .textContent.includes(file.name),
  );
  assert.equal(
    document.querySelector("[type=file]").required,
    false,
    "The retained file satisfies required proof after reopening",
  );
  await act(async () => {
    document
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
  });
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].body.get("file").name,
    file.name,
    "The retained file reaches the existing submission API",
  );
  assert.equal(requests[0].body.get("vehicle"), "Fixture car");
  assert.deepEqual(
    JSON.parse(requests[0].body.get("services")),
    ["Inspektion & Wartung", "Bremsen & Fahrwerk"],
    "All selected services survive closing and reopening",
  );
  await escape();
  assert(
    document.querySelector("[role=dialog]"),
    "Busy submissions cannot be dismissed",
  );
  await act(async () => {
    finishSubmission();
    await settle();
  });
  assert(document.querySelector(".review-submission-success"));
  assert(!navigation.dirty, "Successful submission clears the retained draft");
  await escape();
  await travel("forward");
  assert(
    document.querySelector(".profile-review-dialog [type=submit]"),
    "Browser Forward after success opens a usable new review",
  );
  assert.equal(
    document.querySelector("[name=vehicle]").value,
    "",
    "Browser Forward after success starts empty",
  );
  await escape();
  await open();
  assert.equal(
    document.querySelector("[name=vehicle]").value,
    "",
    "A new review after success starts empty",
  );
  await change("vehicle", "Private fixture draft");
  await escape();
  await render({
    ...props,
    account: {
      ...props.account,
      email: "other-fixture@example.test",
      displayName: "Other fixture",
    },
  });
  await open();
  assert.equal(
    document.querySelector("[name=vehicle]").value,
    "",
    "Drafts do not cross account boundaries",
  );
  await escape();
  const otherWorkshop = {
    ...workshop,
    id: "other-fixture",
    name: "Other fixture workshop",
  };
  await render({
    ...props,
    workshop: otherWorkshop,
    directory: [otherWorkshop],
  });
  await open();
  assert.equal(
    document.querySelector("[name=vehicle]").value,
    "",
    "Drafts do not cross workshop boundaries",
  );
  await escape();
  await act(async () => root.render(null));
  window.history.replaceState({}, "", "/werkstatt/fixture#bewerten");
  await render({ ...props, signedIn: false, account: null });
  assert(
    document.querySelector("[role=dialog]"),
    "Login return opens the dialog automatically",
  );
  assert(document.querySelector(".login-prompt"));
  const returnUrl = new URL(
    new URL(document.querySelector(".login-prompt a").href).searchParams.get(
      "weiter",
    ),
    "https://fixture.test",
  );
  assert.equal(returnUrl.pathname, "/werkstatt/fixture");
  assert.equal(returnUrl.searchParams.get("bewerten"), "1");
  await escape();
  assert(
    !new URLSearchParams(window.location.search).has("bewerten"),
    "Closing a directly loaded dialog removes its URL flag",
  );
  await act(async () => root.render(null));
  window.history.replaceState({}, "", "/werkstatt/fixture?bewerten=1");
  await render({ ...props, signedIn: false, account: null });
  assert(
    document.querySelector("[role=dialog]"),
    "A direct routable URL opens the dialog after reload",
  );
  assert.equal(
    requests.length,
    1,
    "Only the explicitly submitted fixture reaches the mocked API",
  );
  console.log(
    "Profile review dialog: one entry, focus, retained fields/file, busy dismissal, success reset, account isolation and guest return passed; no live submission",
  );
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
