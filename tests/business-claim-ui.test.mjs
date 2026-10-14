import { localizeHref } from "../scripts/lib/locale.mjs";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";
const dom = new JSDOM('<div id="root"></div>', {
  url: "https://riparim.example.test/betriebe/beanspruchen?werkstatt=fixture-workshop",
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
  "HTMLTextAreaElement",
  "HTMLButtonElement",
  "HTMLSelectElement",
  "DocumentFragment",
  "Element",
  "Node",
  "NodeFilter",
  "MutationObserver",
  "CustomEvent",
  "Event",
  "KeyboardEvent",
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
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
HTMLElement.prototype.scrollIntoView = function () {};
const out = ".test-runtime/business-claim-ui";
await mkdir(out, { recursive: true });
const result = await build({
  stdin: {
    contents:
      "export {BusinessClaimForm} from './components/business-claim-form';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  outfile: out + "/ui.mjs",
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  packages: "external",
  alias: { "next/link": "vinext/shims/link" },
});
await writeFile(out + "/ui.mjs", result.outputFiles[0].contents);
const { createElement, act } = await import("react"),
  { createRoot } = await import("react-dom/client"),
  { BusinessClaimForm, I18nProvider, getMessages } = await import(
    new URL("../" + out + "/ui.mjs", import.meta.url)
  );
const workshop = {
  id: "fixture-workshop",
  name: "Fiktive Werkstatt",
  city: "Prizren",
  address: "Teststraße 10",
};
let root = createRoot(document.getElementById("root")),
  mode = "failure",
  finish,
  passed = 0;
const requests = [];
globalThis.fetch = async (url, init) => {
  assert.equal(url, "/api/business");
  assert.equal(init.method, "POST");
  assert(init.body instanceof FormData);
  requests.push(init.body);
  if (mode === "pending") return new Promise((resolve) => (finish = resolve));
  if (mode === "network") throw Error("Fixture network unavailable");
  return Response.json(
    mode === "success"
      ? { status: "pending" }
      : {
          errorCode:
            mode === "auth"
              ? "authentication_required"
              : "business_claim_unavailable",
        },
    { status: mode === "success" ? 201 : mode === "auth" ? 401 : 409 },
  );
};
const check = (value, label) => {
  assert(value, label);
  passed++;
};
async function render(locale, selected = workshop) {
  await act(async () => root.unmount());
  root = createRoot(document.getElementById("root"));
  await act(async () =>
    root.render(
      createElement(
        I18nProvider,
        {
          locale,
          messages: getMessages(locale, ["common", "management", "customer"]),
        },
        createElement(BusinessClaimForm, { workshop: selected }),
      ),
    ),
  );
}
async function type(node, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    ).set.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function select(upload, files) {
  await act(async () => {
    Object.defineProperty(upload, "files", {
      value: files,
      configurable: true,
    });
    upload.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function submit(form) {
  await act(async () =>
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
}
async function chooseConnection(label) {
  const trigger = document.querySelector('.claim-form [role="combobox"]');
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  const option = [...document.querySelectorAll('[role="option"]')].find(
    (node) => node.textContent === label,
  );
  assert(option);
  await act(async () => {
    option.focus();
    option.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}
try {
  for (const locale of ["de", "sq", "en"]) {
    await render(locale);
    const messages = getMessages(locale).management;
    check(
      document.querySelector("h1").textContent === messages.claimTitle &&
        document.querySelector("h2").textContent === workshop.name,
      "The claim page has its own localized title and fixed workshop",
    );
    check(
      document.querySelector('.claim-form [role="combobox"]') &&
        !document.querySelector("textarea") &&
        !document.querySelector(".business-request"),
      "The application starts with a role selection without free text or a workshop selector",
    );
    check(
      document.querySelector(
        'a[href="' + localizeHref("/werkstatt/" + workshop.id, locale) + '"]',
      ) && !document.querySelector(".business-section"),
      "The flat claim page offers one back link without a surrounding card",
    );
    const upload = document.querySelector("input[type=file]");
    await chooseConnection(messages.claimRoleOwner);
    check(
      !document.querySelector("textarea"),
      "A standard connection needs no extra explanation",
    );
    await select(upload, [
      new File(["%PDF-1.7 role fixture"], "role.pdf", {
        type: "application/pdf",
      }),
    ]);
    mode = "failure";
    await submit(document.querySelector("form"));
    check(
      requests.at(-1).get("evidence") === messages.claimRoleOwnerStatement &&
        requests.at(-1).get("evidence").length >= 40,
      "The chosen role produces a localized private declaration while the existing evidence contract is preserved",
    );
    await act(async () => document.querySelector(".claim-remove-file").click());
    await chooseConnection(messages.claimRoleOther);
    const proof = document.querySelector("textarea");
    check(
      upload.required &&
        upload.multiple &&
        proof.required &&
        proof.minLength === 40 &&
        proof.maxLength === 4000 &&
        document.querySelector('label[for="' + upload.id + '"]') &&
        document.getElementById(upload.getAttribute("aria-describedby"))
          .textContent === messages.claimFileTypes,
      "Text and document fields retain their labelled bounded contract",
    );
    await type(proof, "short");
    const shortCount = requests.length;
    await submit(proof.form);
    check(
      requests.length === shortCount &&
        document.querySelector("[role=alert]").textContent ===
          messages.claimConnectionRequired,
      "Other connections retain the minimum explanation requirement before networking",
    );
    await type(
      proof,
      "A sufficiently detailed fictional registered operator ownership explanation.",
    );
    const before = requests.length;
    await submit(proof.form);
    check(
      requests.length === before &&
        document.querySelector("[role=alert]").textContent ===
          messages.business_documents_required,
      "A missing required document is rejected before networking",
    );
    const file = new File(["%PDF-1.7 fictional evidence"], "fixture.pdf", {
      type: "application/pdf",
    });
    await act(async () => {
      Object.defineProperty(upload, "files", {
        value: [file],
        configurable: true,
      });
      upload.dispatchEvent(new Event("change", { bubbles: true }));
    });
    check(
      document.querySelector(".claim-upload strong").textContent ===
        messages.claimReplaceDocument &&
        document.querySelector(".claim-selected-file span").textContent ===
          "fixture.pdf",
      "The localized upload shows its selected file and replacement action",
    );
    const remove = document.querySelector(".claim-remove-file");
    check(
      remove.getAttribute("aria-label") ===
        messages.claimRemoveDocument.replace("{name}", "fixture.pdf"),
      "File removal has a localized accessible name",
    );
    await act(async () => remove.click());
    check(
      !document.querySelector(".claim-selected-file") &&
        document.activeElement === upload &&
        proof.value.includes("ownership"),
      "Removing the required document preserves text and restores focus to the chooser",
    );
    check(
      document.querySelector(".claim-upload strong").textContent ===
        messages.claimChooseDocument,
      "Clearing a document restores the localized empty upload state",
    );
    await act(async () =>
      upload.dispatchEvent(new Event("change", { bubbles: true })),
    );
    const second = new File(["%PDF-1.7 register"], "register.pdf", {
      type: "application/pdf",
    });
    await select(upload, [second]);
    check(
      document.querySelectorAll(".claim-selected-file").length === 2 &&
        !upload.required,
      "Documents can be added across separate selections",
    );
    await select(upload, []);
    check(
      document.querySelectorAll(".claim-selected-file").length === 2,
      "Cancelling the chooser preserves the selected documents",
    );
    await select(
      upload,
      Array.from({ length: 4 }, () => file),
    );
    check(
      document.querySelectorAll(".claim-selected-file").length === 2 &&
        document.querySelector("[role=alert]").textContent ===
          messages.business_documents_limit,
      "Excessive selections retain the existing draft",
    );
    await act(async () =>
      document.querySelectorAll(".claim-remove-file")[1].click(),
    );
    check(
      document.querySelectorAll(".claim-selected-file").length === 1 &&
        proof.value.includes("ownership"),
      "Removing one document preserves the others and ownership text",
    );
    await select(upload, [second]);
    mode = "failure";
    await submit(proof.form);
    check(
      document.querySelector("[role=alert]").textContent ===
        messages.business_claim_unavailable &&
        proof.value.includes("ownership"),
      "Rejected claims retain evidence and show a localized error",
    );
    check(
      requests.at(-1).get("workshopId") === workshop.id &&
        requests.at(-1).get("file").name === "fixture.pdf" &&
        requests.at(-1).getAll("file").length === 2 &&
        [...requests.at(-1).keys()].join("|") ===
          "workshopId|evidence|file|file",
      "A claim sends only the fixed workshop, text and private document",
    );
    mode = "pending";
    const form = proof.form;
    await submit(form);
    check(
      document.querySelector(".claim-submit button").textContent ===
        messages.claimSending &&
        form.querySelector("fieldset").disabled &&
        document.querySelector(".business-panel").getAttribute("aria-busy") ===
          "true",
      "Pending submission announces busy and freezes the fields",
    );
    const count = requests.length;
    await submit(form);
    check(
      requests.length === count,
      "Pending submissions cannot be duplicated",
    );
    await act(async () =>
      finish(Response.json({ status: "pending" }, { status: 201 })),
    );
    check(
      !document.querySelector("form") &&
        document.querySelector("[role=status]").textContent ===
          messages.claimSubmitted &&
        document.querySelector(
          'a[href="' + localizeHref("/antraege", locale) + '"]',
        ),
      "Successful claims replace the form with confirmation and a link to the separate overview",
    );
    check(
      document.activeElement ===
        document.querySelector(".claim-confirmation h2"),
      "Successful submission moves focus to the confirmation",
    );
    await submit(form);
    check(
      requests.length === count,
      "A saved application cannot be resubmitted from a stale form",
    );
  }
  for (const modeValue of ["auth", "network"]) {
    await render("de");
    mode = modeValue;
    await chooseConnection(getMessages("de").management.claimRoleOther);
    await type(
      document.querySelector("textarea"),
      "A fictional ownership description with enough detail for this isolated test.",
    );
    await select(document.querySelector("input[type=file]"), [
      new File(["%PDF-1.7"], "fixture.pdf", { type: "application/pdf" }),
    ]);
    await submit(document.querySelector("form"));
    check(
      document.querySelector("[role=alert]") &&
        document.querySelector("textarea").value.includes("fictional"),
      "Expired sessions and network failures preserve the private draft",
    );
  }
  await render("de", null);
  check(
    !document.querySelector("form") &&
      document.querySelector('a[href="/werkstaetten"]'),
    "A missing public workshop provides the finder instead of guessing another profile",
  );
  console.log(
    JSON.stringify({
      businessClaimUiChecksPassed: passed,
      liveRequests: false,
    }),
  );
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
