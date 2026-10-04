import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { format } from "node:util";
import { JSDOM, VirtualConsole } from "jsdom";

// Run after the production build. Unbundled shim tests cannot detect a dynamic
// import that the bundler redirects to a chunk with incompatible exports.
const client = new URL("../dist/client/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL(".vite/manifest.json", client), "utf8"));
const linkEntry = Object.values(manifest).find(entry => entry.name === "link");
assert(linkEntry, "The production client manifest must include Vinext Link.");
const frameworkEntry = linkEntry.imports.map(key => manifest[key]).find(entry => entry?.name === "framework");
assert(frameworkEntry, "Vinext Link must share the production React runtime.");

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", error => errors.push(error.message));
const dom = new JSDOM('<div id="root"></div>', {
  url: "https://riparim.example.test/",
  pretendToBeVisual: true,
  virtualConsole,
});
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "MouseEvent", "KeyboardEvent", "PopStateEvent", "self"]) {
  Object.defineProperty(globalThis, key, { value: key === "self" ? dom.window : dom.window[key], configurable: true });
}
// The real browser entry may be imported alongside navigation. This test owns
// the navigation boundary and has no server-rendered RSC document to hydrate.
window.__VINEXT_RSC_BOOTSTRAP_STATE__ = "hydrated";
const navigations = [];
window[Symbol.for("vinext.navigationRuntime")] = {
  bootstrap: { routeManifest: null, rsc: undefined },
  functions: {
    async navigate(href, scroll, kind, mode) {
      navigations.push({ href, scroll, kind, mode });
      window.history[mode === "replace" ? "replaceState" : "pushState"]({}, "", href);
    },
  },
};

const observers = new Set();
class FixtureIntersectionObserver {
  constructor(callback) { this.callback = callback; this.targets = new Set(); observers.add(this); }
  observe(target) { this.targets.add(target); }
  unobserve(target) { this.targets.delete(target); }
  disconnect() { this.targets.clear(); observers.delete(this); }
}
globalThis.IntersectionObserver = window.IntersectionObserver = FixtureIntersectionObserver;

const requests = [];
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const rejected = error => errors.push(format(error));
console.error = (...args) => errors.push(format(...args));
process.on("unhandledRejection", rejected);
globalThis.fetch = window.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
  assert.equal(url.origin, window.location.origin, "The fixture must never contact a live host.");
  requests.push({ url, options });
  // A failed speculative request must not prevent a later intentional click.
  return new Response(null, { status: 503 });
};

let root;
async function waitFor(predicate, description) {
  const deadline = Date.now() + 2000;
  while (!predicate() && errors.length === 0 && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.deepEqual(errors, [], `${description}: no client runtime errors`);
  assert(predicate(), description);
}

try {
  const framework = await import(new URL(frameworkEntry.file, client));
  // Production exports are minified. Discover runtime factories by their
  // public contracts instead of relying on generated export letters.
  const namespaces = Object.values(framework).map(value => typeof value === "function" ? value() : value);
  const React = namespaces.find(value => typeof value?.createElement === "function");
  const ReactDOM = namespaces.find(value => typeof value?.createRoot === "function");
  const DOM = namespaces.find(value => typeof value?.flushSync === "function");
  assert(React && ReactDOM && DOM, "Use the exact React instance shipped with Link.");
  const link = await import(new URL(linkEntry.file, client));
  const Link = Object.values(link).find(value => value?.$$typeof === Symbol.for("react.forward_ref"));
  assert(Link, "Exercise the real production Link component.");
  root = ReactDOM.createRoot(document.getElementById("root"));
  const render = props => {
    DOM.flushSync(() => root.render(React.createElement(Link, { scroll: false, ...props }, "Einstellungen")));
    return document.querySelector("a");
  };
  const click = async (anchor, options = {}) => {
    const count = navigations.length;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...options });
    anchor.dispatchEvent(event);
    await waitFor(() => navigations.length > count, "A production Link click reaches the navigation runtime");
    assert(event.defaultPrevented, "The client router handles an ordinary internal click.");
    return navigations.at(-1);
  };

  let anchor = render({ href: "/einstellungen?weiter=%2Fwerkstaetten#konto", prefetch: false });
  anchor.focus();
  assert.equal(document.activeElement, anchor, "Link remains keyboard focusable.");
  let navigation = await click(anchor, { detail: 0 });
  assert.equal(navigation.href, "/einstellungen?weiter=%2Fwerkstaetten#konto");
  assert.equal(navigation.kind, "navigate");
  assert.equal(navigation.mode, "push");
  assert.equal(window.location.pathname + window.location.search + window.location.hash, "/einstellungen?weiter=%2Fwerkstaetten#konto");

  const count = navigations.length;
  const modified = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
  let routerPreventedModifiedClick;
  const observeModifiedClick = event => {
    if (!(event.ctrlKey || event.metaKey)) return;
    routerPreventedModifiedClick = event.defaultPrevented;
    // jsdom cannot open a new tab. Observe React's result at window before
    // cancelling only this browser-owned modified click in the fixture.
    event.preventDefault();
  };
  window.addEventListener("click", observeModifiedClick);
  anchor.dispatchEvent(modified);
  window.removeEventListener("click", observeModifiedClick);
  assert.equal(routerPreventedModifiedClick, false, "Ctrl-click preserves the browser's new-tab action.");
  assert.equal(navigations.length, count);

  anchor = render({ href: "/werkstaetten?ort=prizren", prefetch: false, replace: true });
  navigation = await click(anchor);
  assert.equal(navigation.mode, "replace", "Replace links retain their history mode.");
  assert.equal(window.location.pathname + window.location.search, "/werkstaetten?ort=prizren");

  anchor = render({ href: "/einstellungen?prefetch=fixture", prefetch: true });
  await waitFor(() => [...observers].some(observer => observer.targets.has(anchor)), "Production Link registers viewport prefetch");
  for (const observer of observers) {
    if (observer.targets.has(anchor)) observer.callback([{ target: anchor, isIntersecting: true, intersectionRatio: 1 }]);
  }
  await waitFor(() => requests.length > 0, "Viewport prefetch reaches the local request fixture");
  assert(requests.every(request => request.options.purpose === "prefetch"), "Only speculative fixture requests are sent.");
  for (const { url, options } of requests) {
    assert.equal(url.pathname, "/einstellungen");
    assert.equal(url.searchParams.get("prefetch"), "fixture", "Prefetch preserves the target query.");
    assert.equal(new Headers(options.headers).get("RSC"), "1", "Prefetch uses the RSC request contract.");
    assert.equal(new Headers(options.headers).get("Accept"), "text/x-component");
  }
  await new Promise(resolve => setTimeout(resolve, 20));
  navigation = await click(anchor);
  assert.equal(navigation.href, "/einstellungen?prefetch=fixture", "Failed prefetch preserves intentional navigation.");
  assert.deepEqual(errors, [], "Prefetch setup and navigation have no production runtime errors.");
  console.log("Production navigation: bundled Link push/replace, keyboard activation, modified click and viewport prefetch failure passed; no live requests executed.");
} finally {
  root?.unmount();
  dom.window.close();
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
  process.off("unhandledRejection", rejected);
}
