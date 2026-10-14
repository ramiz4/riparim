import { compileApplicationCss } from "./helpers/compiled-tailwind.mjs";
import { cssForDom } from "./helpers/style-fixture.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { JSDOM, VirtualConsole } from "jsdom";

const dom = new JSDOM('<div id="root"></div>', {
  url: "https://riparim.example.test/verwaltung/benutzer",
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole(),
});
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLFormElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "Option",
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

const require = createRequire(new URL("../package.json", import.meta.url));
const { build } = require("esbuild");
const { source: css, production: productionCss } =
  await compileApplicationCss();
function resolveTokens(styles, dark) {
  return cssForDom(styles, { dark, document });
}
const styleNode = document.createElement("style");
document.head.append(styleNode);
const output = ".test-runtime/user-management-ui";
const bundle = await build({
  stdin: {
    contents:
      "export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';export {default} from './app/[locale]/admin/users/users';",
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  outfile: output + "/users.mjs",
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  packages: "external",
  loader: { ".css": "empty" },
  plugins: [
    {
      name: "page-shell-boundaries",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(next\/link|@\/components\/site-header|@\/components\/admin-navigation)$/,
          },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          loader: "js",
          resolveDir: process.cwd(),
          contents:
            args.path === "next/link"
              ? `import React from 'react';export default function Link({children,href,...props}){return React.createElement('a',{...props,href},children);}`
              : args.path.includes("site-header")
                ? "export function SiteHeader(){return null;}"
                : "export function AdminNavigation(){return null;}",
        }));
      },
    },
  ],
});
await mkdir(output, { recursive: true });
await writeFile(output + "/users.mjs", bundle.outputFiles[0].contents);
const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const {
  default: AdminUsers,
  I18nProvider,
  getMessages,
} = await import(new URL("../" + output + "/users.mjs", import.meta.url));
const fixtureUser = (id, name, options = {}) => ({
  id,
  name,
  email: id + "@example.test",
  role: "user",
  protected: false,
  active: true,
  confirmed: true,
  providers: ["email"],
  createdAt: "2026-10-04",
  lastSignInAt: null,
  ...options,
});
let users = [
  fixtureUser("self", "Current Admin", { role: "admin", protected: true }),
  fixtureUser("member", "Fixture Member"),
  fixtureUser("other-admin", "Other Admin", { role: "admin" }),
  fixtureUser("inactive", "Inactive Member", { active: false }),
];
let pendingDeletions = [],
  configured = true,
  mode = "success",
  pending = null;
const requests = [];
globalThis.fetch = async (url, options) => {
  const request = {
    url,
    method: options?.method ?? "GET",
    body: options?.body ? JSON.parse(options.body) : null,
  };
  requests.push(request);
  const respond = () => {
    if (request.method === "GET")
      return mode === "load-error"
        ? Response.json(
            {
              error: "Fixture: Laden fehlgeschlagen",
              errorCode: "users_unavailable",
            },
            { status: 503 },
          )
        : Response.json({
            users,
            pendingDeletions,
            page: 1,
            perPage: 20,
            hasMore: false,
            configured,
          });
    const user = users.find((item) => "/api/users/" + item.id === url);
    assert(user, "Only fictional listed users can be changed");
    Object.assign(user, request.body);
    return Response.json({ user });
  };
  if (mode === "pending")
    return new Promise((resolve) => {
      pending = { resolve, respond };
    });
  return respond();
};
let root = createRoot(document.getElementById("root")),
  passed = 0;
const check = (condition, label) => {
  assert(condition, label);
  passed++;
};
const click = async (control) => {
  assert(control, "Requested action exists");
  await act(async () => {
    control.focus();
    control.click();
  });
};
const type = async (control, value) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
const button = (label) =>
  document.querySelector(`button[aria-label="${label}"]`);
const icon = (control, name) => {
  const svg = control?.querySelector("svg");
  check(
    svg &&
      control.firstElementChild === svg &&
      svg.getAttribute("aria-hidden") === "true" &&
      svg.getAttribute("width") === "15" &&
      svg.getAttribute("height") === "15" &&
      svg.classList.contains("lucide-" + name),
    "The " +
      control?.textContent +
      " action leads with a consistently sized decorative " +
      name +
      " icon",
  );
};
const mount = async () =>
  act(async () =>
    root.render(
      fixtureMessages(
        createElement(AdminUsers, {
          account: {
            email: "current-admin@example.test",
            displayName: "Current Admin",
            provider: "E-Mail",
          },
        }),
      ),
    ),
  );
const remount = async () => {
  await act(async () => root.unmount());
  root = createRoot(document.getElementById("root"));
  await mount();
};
function hasConciseTitle(scope) {
  const title = scope.querySelector("[data-ui~='admin-title']"),
    heading = title?.querySelector("h1"),
    action = title?.querySelector("button"),
    messages = getMessages("de").management;
  return Boolean(
    heading &&
    action &&
    title.children.length === 2 &&
    title.firstElementChild === heading.parentElement &&
    heading.parentElement.children.length === 1 &&
    heading.parentElement.textContent.trim() === messages.manageUsers &&
    heading.textContent.trim() === messages.manageUsers &&
    title.lastElementChild === action &&
    action.textContent.trim() === messages.createUser &&
    title.textContent.replace(/\s/g, "") ===
      (messages.manageUsers + messages.createUser).replace(/\s/g, ""),
  );
}
function hasPaginationWithoutProtectionNote(scope) {
  const main = scope.matches?.("main") ? scope : scope.querySelector("main"),
    pagination = main?.querySelector('nav[aria-label="Benutzerseiten"]'),
    normalize = (text) => text.replace(/\s+/g, " ").trim();
  return Boolean(
    pagination &&
    pagination === main.lastElementChild &&
    !normalize(main.textContent).includes(
      normalize(getMessages("de").management.userProtectionHelp),
    ),
  );
}
try {
  await mount();
  check(
    document.querySelector("h1").textContent === "Benutzer verwalten",
    "The user management title remains visible",
  );
  check(
    hasConciseTitle(document),
    "The title has no redundant eyebrow or subtitle",
  );
  check(
    document.querySelector("[data-ui~='admin-title'] button").textContent ===
      "Benutzer anlegen",
    "The account creation action remains visible",
  );
  check(
    document
      .querySelector("[data-ui~='users-toolbar'] input")
      .getAttribute("aria-label") === "Benutzer auf dieser Seite durchsuchen" &&
      !document.querySelector("[data-ui~='users-toolbar'] button"),
    "The toolbar retains its labelled search without a manual refresh action",
  );
  check(
    document.querySelector("table").getAttribute("aria-label") ===
      "Benutzerkonten" &&
      document
        .querySelector("[data-ui~='users-pagination']")
        .getAttribute("aria-label") === "Benutzerseiten",
    "The labelled account table and pagination remain visible",
  );
  check(
    hasPaginationWithoutProtectionNote(document),
    "Pagination ends the account list without the removed protection note",
  );
  const redundantTitle = document.querySelector("main").cloneNode(true),
    eyebrow = document.createElement("span");
  eyebrow.textContent = "Redundant account management label";
  redundantTitle.querySelector("h1").before(eyebrow);
  const redundantNote = document.querySelector("main").cloneNode(true),
    protectionNote = document.createElement("p");
  protectionNote.textContent = getMessages("de").management.userProtectionHelp;
  redundantNote
    .querySelector("[data-ui~='users-pagination']")
    .before(protectionNote);
  assert.deepEqual(
    [
      hasConciseTitle(redundantTitle),
      hasPaginationWithoutProtectionNote(redundantNote),
    ],
    [false, false],
    "Redundant title and protection-note content fail even without legacy CSS classes",
  );
  const contentAfterPagination = document.querySelector("main").cloneNode(true),
    trailingContent = document.createElement("p");
  trailingContent.textContent = "Content after pagination";
  contentAfterPagination.append(trailingContent);
  assert.equal(
    hasPaginationWithoutProtectionNote(contentAfterPagination),
    false,
    "Pagination must remain the last element independently of note content",
  );
  for (const [label, name] of [
    ["Fixture Member bearbeiten", "pencil"],
    ["Fixture Member zum Admin machen", "shield-plus"],
    ["Adminrechte für Other Admin entziehen", "shield-minus"],
    ["Fixture Member deaktivieren", "user-round-x"],
    ["Inactive Member aktivieren", "user-round-check"],
    ["Fixture Member löschen", "trash-2"],
    ["Current Admin bearbeiten", "pencil"],
    ["Adminrechte für Current Admin entziehen", "shield-minus"],
    ["Current Admin deaktivieren", "user-round-x"],
    ["Current Admin löschen", "trash-2"],
  ])
    icon(button(label), name);
  for (const label of [
    "Adminrechte für Current Admin entziehen",
    "Current Admin deaktivieren",
    "Current Admin löschen",
  ])
    check(
      button(label).disabled,
      "Protected accounts retain the disabled " + label + " action",
    );
  check(
    !button("Current Admin bearbeiten").disabled,
    "Protected accounts can still edit permitted profile details",
  );
  for (const [variant, styles] of [
    ["source", css],
    ["production", productionCss],
  ])
    for (const [dark, color] of [
      [false, "rgb(223, 231, 233)"],
      [true, "rgb(43, 75, 80)"],
    ]) {
      document.documentElement.classList.toggle("dark", dark);
      styleNode.textContent = resolveTokens(styles, dark);
      const get = (node) => getComputedStyle(node),
        table = document.querySelector("[data-ui~='users-table']");
      check(
        get(table).borderTopColor === color,
        variant +
          ": the table frame uses a subtle border in " +
          (dark ? "dark" : "light") +
          " mode",
      );
      for (const row of table.querySelectorAll("[data-slot=table-row]"))
        check(
          get(row).borderBottomColor === color,
          variant + ": header and account rows use the same subtle separator",
        );
      for (const control of table.querySelectorAll(
        "[data-ui~='users-actions'] button",
      )) {
        const styles = get(control);
        check(
          styles.display === "inline-flex" &&
            styles.alignItems === "center" &&
            styles.gap === "6px",
          "Every enabled and disabled account action aligns its icon and text consistently",
        );
      }
    }
  document.documentElement.classList.remove("dark");
  styleNode.textContent = "";
  mode = "pending";
  await remount();
  check(
    document.querySelector("[role=status]").textContent ===
      "Benutzer werden geladen …" && !document.querySelector("table"),
    "Initial loading announces progress before displaying account rows",
  );
  check(
    document.querySelector("[data-ui~='admin-title'] button").disabled &&
      document.querySelector("[data-ui~='users-search'] input").disabled,
    "Initial loading disables creation and search until configuration is known",
  );
  await act(async () => pending.resolve(pending.respond()));
  pending = null;
  mode = "success";
  await type(
    document.querySelector("[data-ui~='users-search'] input"),
    "Inactive Member",
  );
  check(
    document.querySelectorAll("tbody tr").length === 1 &&
      document
        .querySelector("[data-ui~='users-pagination']")
        .textContent.includes("1 Treffer"),
    "Search continues to filter account rows and report matching entries",
  );
  await type(
    document.querySelector("[data-ui~='users-search'] input"),
    "No matching fixture",
  );
  check(
    document.querySelector("[data-ui~='users-empty'] h2").textContent ===
      "Keine passenden Benutzer auf dieser Seite." &&
      !document.querySelector("[data-ui~='users-empty'] button"),
    "An unmatched search retains the labelled empty result without a redundant create action",
  );
  await type(document.querySelector("[data-ui~='users-search'] input"), "");
  mode = "pending";
  await click(button("Fixture Member deaktivieren"));
  icon(button("Fixture Member deaktivieren"), "loader-circle");
  check(
    [...document.querySelectorAll("[data-ui~='users-actions'] button")].every(
      (control) => control.disabled,
    ),
    "An account status mutation disables every conflicting action while retaining icons and labels",
  );
  await act(async () => pending.resolve(pending.respond()));
  pending = null;
  mode = "success";
  icon(button("Fixture Member aktivieren"), "user-round-check");
  check(
    document.querySelector("[role=status]").textContent ===
      "Benutzerkonto deaktiviert.",
    "Completed deactivation updates the action and announces its result",
  );
  await click(button("Fixture Member aktivieren"));
  icon(button("Fixture Member deaktivieren"), "user-round-x");
  check(
    document.querySelector("[role=status]").textContent ===
      "Benutzerkonto aktiviert.",
    "The activation counteraction preserves its success feedback",
  );
  await click(button("Current Admin bearbeiten"));
  check(
    document.querySelector("[data-ui~='users-form'] input[type=email]")
      .disabled &&
      document
        .querySelector("[data-ui~='users-form']")
        .textContent.includes("geschützten Verwaltungszugang"),
    "Editing a protected account still disables its email and explains the restricted fields",
  );
  await act(async () =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  check(
    !document.querySelector("[role=dialog]"),
    "The editor still supports keyboard dismissal",
  );
  mode = "load-error";
  await remount();
  check(
    document.querySelector("[role=alert]").textContent ===
      getMessages("de").management.users_unavailable &&
      !document.querySelector("[data-ui~='users-empty']"),
    "Failed initial loading displays the server error without claiming an empty account list",
  );
  mode = "success";
  users = [];
  await remount();
  check(
    document.querySelector("[data-ui~='users-empty'] h2").textContent ===
      "Noch keine Benutzer auf dieser Seite." &&
      document.querySelector("[data-ui~='users-empty'] button").textContent ===
        "Benutzer anlegen",
    "An empty account list retains its account creation action and explanatory state",
  );
  check(
    hasPaginationWithoutProtectionNote(document),
    "The empty list still retains pagination without the removed note",
  );
  configured = false;
  await remount();
  check(
    document.querySelector("#users-setup-title").textContent ===
      "Serverkonfiguration fehlt" &&
      document
        .querySelector("[data-ui~='users-setup-note'] a")
        .getAttribute("href") === "/verwaltung/anmeldung",
    "Missing configuration keeps its accessible setup guidance",
  );
  check(
    document.querySelector("[data-ui~='admin-title'] button").disabled &&
      document.querySelector("[data-ui~='users-search'] input").disabled &&
      !document.querySelector("table"),
    "Unconfigured management exposes no enabled account actions",
  );
  console.log(
    JSON.stringify({
      userManagementUiChecksPassed: passed,
      liveRequests: false,
    }),
  );
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}

function fixtureMessages(element) {
  return createElement(
    I18nProvider,
    {
      locale: "de",
      messages: getMessages("de", ["common", "customer", "management"]),
    },
    element,
  );
}
