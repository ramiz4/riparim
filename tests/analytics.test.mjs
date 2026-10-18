import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
await mkdir(".test-runtime/analytics", { recursive: true });
await build({
  entryPoints: ["lib/analytics.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: ".test-runtime/analytics/controller.mjs",
});
await build({
  entryPoints: ["lib/analytics-provider.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: ".test-runtime/analytics/provider.mjs",
});
const {
  publicAnalyticsPage: page,
  createAnalyticsController,
  analyticsEnabled,
  analyticsStorageKeys: keys,
} = await import("../.test-runtime/analytics/controller.mjs");
const { send } = await import("../.test-runtime/analytics/provider.mjs");
const config = {
  key: "phc_analytics_test_fixture",
  host: "https://eu.i.posthog.com",
  testMode: false,
};
const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
};
const settle = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};
function fixture(overrides = {}) {
  let time = Date.UTC(2026, 9, 18),
    href = "https://riparim.com/",
    nextId = 0,
    loads = 0;
  const local = storage(),
    session = storage(),
    events = [];
  const controller = createAnalyticsController({
    config,
    href: () => href,
    storage: local,
    sessionStorage: session,
    now: () => time,
    uuid: () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`,
    load: async () => {
      loads++;
      return {
        send: async (_config, event, signal) => {
          if (!signal.aborted) events.push(event);
        },
      };
    },
    ...overrides,
  });
  return {
    controller,
    local,
    session,
    events,
    get loads() {
      return loads;
    },
    navigate(url, published) {
      href = new URL(url, href).href;
      controller.navigate(page(href, published));
    },
    elapse(ms) {
      time += ms;
    },
    setHref(url) {
      href = new URL(url, href).href;
    },
  };
}
assert.deepEqual(
  page("https://riparim.com/sq/serviset?q=private-name#search"),
  { path: "/sq/serviset", locale: "sq", type: "search" },
);
for (const slug of ["prishtina", "prizren", "ferizaj", "peja", "gjakova"])
  for (const [locale, prefix] of [
    ["de", "/werkstaetten"],
    ["sq", "/sq/serviset"],
    ["en", "/en/workshops"],
  ])
    assert.deepEqual(
      page(
        `https://riparim.com${prefix}/${slug}?q=private-city-search#private-fragment`,
      ),
      { path: `${prefix}/${slug}`, locale, type: "city" },
      "Only editorial city identities enter analytics with a clean path",
    );
for (const [locale, paths] of [
  [
    "de",
    [
      "/ratgeber",
      "/ratgeber/werkstatt-auswaehlen",
      "/ratgeber/werkstattbesuch-vorbereiten",
    ],
  ],
  [
    "sq",
    [
      "/sq/udhezues",
      "/sq/udhezues/zgjedhja-e-servisit",
      "/sq/udhezues/pergatitja-e-vizites",
    ],
  ],
  [
    "en",
    [
      "/en/guides",
      "/en/guides/choosing-a-workshop",
      "/en/guides/preparing-a-visit",
    ],
  ],
])
  for (const path of paths)
    assert.deepEqual(
      page(
        "https://riparim.com" +
          path +
          "?q=private-guide-search#private-guide-fragment",
      ),
      { path, locale, type: "guide" },
      "Only the three fixed guide identities enter analytics with clean localized paths",
    );
assert.deepEqual(
  page("https://riparim.com/en/workshop/fixture-205", "fixture-205"),
  {
    path: "/en/workshop/fixture-205",
    locale: "en",
    type: "profile",
    workshopId: "fixture-205",
  },
);
for (const path of [
  "/anmelden",
  "/sq/hyr",
  "/en/settings",
  "/einstellungen",
  "/verwaltung",
  "/betriebe",
  "/bewertungen",
  "/antraege",
  "/api/session",
  "/auth/bestaetigen?token=secret",
  "/unknown",
  "/ratgeber/unknown",
  "/en/guides/private@example.test",
  "/sq/guides/choosing-a-workshop",
  "/sq/udhezues/pergatitja-e-vizites/extra",
  "/en/guides?bewerten=1",
  "/ratgeber?einreichung=private",
  "/werkstaetten/unknown",
  "/en/workshops/private@example.test",
  "/sq/serviset/prishtina/extra",
  "/en/workshops/prishtina?bewerten=1",
  "/werkstatt/fixture-205",
  "/?besuche=1",
  "/?einreichung=private",
  "/?nachweis=fixture",
  "/werkstatt/fixture-205#bewerten",
  "/werkstaetten?bewerten=1",
  "/werkstatt/fixture-205%2Fprivate",
])
  assert.equal(
    page(`https://riparim.com${path}`),
    null,
    `Excluded route ${path}`,
  );
assert.equal(
  page("https://riparim.com/werkstatt/fixture-205", "foreign-id"),
  null,
);
assert.equal(
  page(
    "https://riparim.com/werkstatt/private@example.com",
    "private@example.com",
  ),
  null,
);
assert.equal(page("not a URL"), null);
assert.equal(analyticsEnabled(config, "https://riparim.com"), true);
for (const href of [
  "http://localhost:3000",
  "https://preview.example.com",
  "http://riparim.com",
])
  assert.equal(analyticsEnabled(config, href), false);
assert.equal(
  analyticsEnabled({ ...config, key: "" }, "https://riparim.com"),
  false,
);
assert.equal(
  analyticsEnabled(
    { ...config, host: "https://attacker.test" },
    "https://riparim.com",
  ),
  false,
);
assert.equal(
  analyticsEnabled({ ...config, testMode: true }, "http://localhost:3000"),
  true,
);

const guideFixture = fixture();
guideFixture.navigate(
  "/en/guides?q=private-guide-search#private-guide-fragment",
);
await settle();
assert.equal(
  guideFixture.events.length,
  0,
  "Guides remain silent before consent",
);
guideFixture.controller.setConsent("accepted");
await settle();
assert.deepEqual(
  guideFixture.events.map(({ event }) => event),
  ["$pageview"],
  "Reading a guide is a pageview, not an invented search or conversion step",
);
guideFixture.navigate("/en/guides?q=another-private-guide-search");
await settle();
assert.equal(
  guideFixture.events.length,
  1,
  "Guide query changes do not duplicate the pageview",
);
guideFixture.navigate("/en/guides/choosing-a-workshop");
guideFixture.controller.contact("fixture-210", "phone");
await settle();
assert.deepEqual(
  guideFixture.events.map(({ event }) => event),
  ["$pageview", "$pageleave", "$pageview"],
);
assert(
  guideFixture.events.every(
    ({ properties }) => properties.page_type === "guide",
  ),
);
assert(!JSON.stringify(guideFixture.events).includes("private-guide"));
const f = fixture();
f.navigate("/werkstaetten?q=personal-search&token=secret#never-send");
await settle();
assert.equal(f.loads, 0, "Transport stays unloaded without consent");
assert.equal(
  f.local.getItem(keys.browser),
  null,
  "No anonymous ID before consent",
);
assert.equal(
  f.session.getItem(keys.session),
  null,
  "No session before consent",
);
f.controller.setConsent("declined");
f.navigate("/");
await settle();
assert.equal(f.events.length, 0, "Decline captures nothing");
f.controller.setConsent("accepted");
await settle();
assert.deepEqual(
  f.events.map(({ event }) => event),
  ["$pageview"],
);
const first = f.events[0].properties;
assert.match(first.distinct_id, /^riparim_/);
assert.equal(first.$process_person_profile, false);
assert.equal(first.$geoip_disable, true);
assert.equal(first.is_verification, false);
const sessionPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sessionStartedAt = (id) =>
  Number.parseInt(id.replaceAll("-", "").slice(0, 12), 16);
assert.match(
  first.$session_id,
  sessionPattern,
  "PostHog session IDs are timestamped UUIDv7",
);
assert.equal(sessionStartedAt(first.$session_id), Date.UTC(2026, 9, 18));
assert.equal(
  f.events[0].timestamp,
  new Date(Date.UTC(2026, 9, 18)).toISOString(),
);
f.navigate("/");
f.navigate("/?q=different#anchor");
await settle();
assert.equal(
  f.events.length,
  1,
  "Initial, hash and query changes do not duplicate pageview",
);
f.elapse(12000);
f.navigate("/werkstaetten?q=secret-person#secret-fragment");
f.navigate("/werkstatt/fixture-205?suche=private-message", "fixture-205");
f.controller.contact("fixture-205", "phone");
f.controller.contact("fixture-205", "email");
f.controller.contact("fixture-205", "whatsapp");
f.controller.contact("fixture-205", "directions");
f.controller.contact("foreign-id", "phone");
f.controller.contact("fixture-205", "forged-channel");
await settle();
assert.deepEqual(
  f.events
    .filter(({ event }) => !event.startsWith("$"))
    .map(({ event }) => event),
  [
    "workshop_search_viewed",
    "workshop_profile_viewed",
    ...Array(4).fill("workshop_contact_clicked"),
  ],
);
assert.deepEqual(
  f.events
    .filter(({ event }) => event === "workshop_contact_clicked")
    .map(({ properties }) => properties.contact_channel),
  ["phone", "email", "whatsapp", "directions"],
);
assert.equal(
  f.events.find(({ event }) => event === "$pageleave").properties
    .duration_seconds,
  12,
);
assert(
  f.events.every(
    ({ properties }) =>
      properties.distinct_id === first.distinct_id &&
      properties.$session_id === first.$session_id,
  ),
  "One browser/session links funnel steps",
);
assert(!JSON.stringify(f.events).includes("secret"));
assert(!JSON.stringify(f.events).includes("private-message"));
assert(
  f.events.every(
    ({ properties }) =>
      !Object.hasOwn(properties, "$referrer") &&
      !Object.hasOwn(properties, "$title") &&
      !Object.hasOwn(properties, "email"),
  ),
);
const before = f.events.length;
f.setHref("/werkstatt/fixture-205#bewerten");
f.controller.contact("fixture-205", "phone");
await settle();
assert.equal(
  f.events.length,
  before,
  "Private review flow cannot emit a contact event",
);
f.navigate("/en/workshop/fixture-205", "fixture-205");
await settle();
assert.equal(f.events.at(-1).properties.locale, "en");
f.navigate("/en/login?token=private");
await settle();
assert.equal(f.events.at(-1).event, "$pageleave");
assert(!JSON.stringify(f.events).includes("login"));
f.navigate("/en/workshop/fixture-205", "fixture-205");
await settle();
const sessionBefore = f.events.at(-1).properties.$session_id;
f.elapse(30 * 60 * 1000);
f.controller.contact("fixture-205", "phone");
await settle();
assert.notEqual(
  f.events.at(-1).properties.$session_id,
  sessionBefore,
  "Thirty-minute inactivity rotates session",
);
f.controller.leave();
f.controller.leave();
await settle();
assert.equal(f.events.at(-1).event, "$pageleave");
const afterLeave = f.events.length;
f.controller.leave();
await settle();
assert.equal(f.events.length, afterLeave, "pagehide emits only one leave");
f.controller.setConsent("declined");
assert.equal(f.local.getItem(keys.browser), null);
assert.equal(f.session.getItem(keys.session), null);
f.navigate("/");
await settle();
assert.equal(f.events.length, afterLeave, "Revocation stops capture");
f.controller.setConsent("accepted");
await settle();
assert.notEqual(
  f.events.at(-1).properties.distinct_id,
  first.distinct_id,
  "New consent does not relink revoked browser ID",
);
// Storage events and a pre-contact refresh enforce revocation from another tab.
f.local.setItem(
  keys.consent,
  JSON.stringify({ value: "declined", expiresAt: Date.now() + 1e12 }),
);
f.controller.syncConsent();
assert.equal(f.controller.getConsent(), "declined");
assert.equal(f.local.getItem(keys.browser), null);

const expired = fixture();
expired.navigate("/");
expired.controller.setConsent("accepted");
await settle();
const count = expired.events.length;
expired.elapse(181 * 24 * 60 * 60 * 1000);
expired.navigate("/werkstaetten");
await settle();
assert.equal(expired.controller.getConsent(), "unknown");
assert.equal(expired.events.length, count);
assert.equal(expired.local.getItem(keys.browser), null);
const local = fixture();
local.navigate("http://localhost:3000/");
local.controller.setConsent("accepted");
await settle();
assert.equal(local.events.length, 0, "Local environment remains disabled");
const verification = fixture({ config: { ...config, testMode: true } });
verification.navigate("http://localhost:3000/");
verification.controller.setConsent("accepted");
await settle();
assert.equal(verification.events[0].properties.is_verification, true);
const marked = fixture();
marked.session.setItem(keys.verification, "true");
marked.navigate("/");
marked.controller.setConsent("accepted");
await settle();
assert.equal(marked.events[0].properties.is_verification, true);
let release;
let lateSends = 0;
const deferred = fixture({
  load: () =>
    new Promise((resolve) => {
      release = resolve;
    }),
});
deferred.navigate("/");
deferred.controller.setConsent("accepted");
deferred.controller.setConsent("declined");
release({
  send: async () => {
    lateSends++;
  },
});
await settle();
assert.equal(lateSends, 0, "Late provider loading cannot bypass revoke");
// Each cache restore starts a fresh public pageview while preserving the active visit.
const restored = fixture();
restored.navigate("/werkstatt/fixture-205", "fixture-205");
restored.controller.setConsent("accepted");
await settle();
for (let round = 0; round < 2; round++) {
  const views = restored.events.filter(
    ({ event }) => event === "$pageview",
  ).length;
  restored.elapse(2000);
  restored.controller.leave();
  await settle();
  const leaveId = restored.events.at(-1).properties.$pageview_id;
  restored.elapse(5 * 60 * 1000);
  restored.controller.resume(
    page("https://riparim.com/werkstatt/fixture-205", "fixture-205"),
  );
  await settle();
  assert.equal(
    restored.events.filter(({ event }) => event === "$pageview").length,
    views + 1,
  );
  assert.equal(restored.events.at(-1).event, "workshop_profile_viewed");
  assert.notEqual(
    restored.events.findLast(({ event }) => event === "$pageview").properties
      .$pageview_id,
    leaveId,
  );
  const count = restored.events.length;
  restored.controller.resume(
    page("https://riparim.com/werkstatt/fixture-205", "fixture-205"),
  );
  restored.navigate("/werkstatt/fixture-205", "fixture-205");
  await settle();
  assert.equal(
    restored.events.length,
    count,
    "Repeated restore and ordinary route scans keep the new view deduplicated",
  );
}
restored.elapse(4000);
restored.controller.leave();
await settle();
assert.equal(
  restored.events.at(-1).properties.duration_seconds,
  4,
  "Cache suspension time does not become restored page duration",
);
const revokedRestore = fixture();
revokedRestore.navigate("/");
revokedRestore.controller.setConsent("accepted");
await settle();
revokedRestore.controller.leave();
await settle();
let restoreCount = revokedRestore.events.length;
revokedRestore.local.setItem(
  keys.consent,
  JSON.stringify({ value: "declined", expiresAt: Date.UTC(2027, 1, 1) }),
);
revokedRestore.controller.resume(page("https://riparim.com/"));
await settle();
assert.equal(revokedRestore.events.length, restoreCount);
assert.equal(revokedRestore.controller.getConsent(), "declined");
const expiredRestore = fixture();
expiredRestore.navigate("/");
expiredRestore.controller.setConsent("accepted");
await settle();
expiredRestore.controller.leave();
await settle();
restoreCount = expiredRestore.events.length;
expiredRestore.elapse(181 * 24 * 60 * 60 * 1000);
expiredRestore.controller.resume(page("https://riparim.com/"));
await settle();
assert.equal(expiredRestore.events.length, restoreCount);
assert.equal(expiredRestore.controller.getConsent(), "unknown");
const privateRestore = fixture();
privateRestore.navigate("/werkstatt/fixture-205", "fixture-205");
privateRestore.controller.setConsent("accepted");
await settle();
privateRestore.controller.leave();
await settle();
restoreCount = privateRestore.events.length;
privateRestore.setHref("/anmelden?token=private");
privateRestore.controller.resume(null);
await settle();
assert.equal(
  privateRestore.events.length,
  restoreCount,
  "Restoration never replays the last public page into a private route",
);
privateRestore.setHref("/werkstatt/fixture-205");
privateRestore.controller.resume(null);
await settle();
assert.equal(
  privateRestore.events.length,
  restoreCount,
  "Profile readiness is required before restoration",
);
privateRestore.navigate("/werkstatt/fixture-205", "fixture-205");
await settle();
assert.equal(
  privateRestore.events.filter(
    ({ event }) => event === "workshop_profile_viewed",
  ).length,
  2,
  "A later published profile can complete restoration once",
);
// Provider contract: session IDs remain valid under sustained activity and stored-state changes.
const longVisit = fixture();
longVisit.navigate("/werkstatt/fixture-205", "fixture-205");
longVisit.controller.setConsent("accepted");
await settle();
const initialVisit = longVisit.events[0].properties.$session_id;
for (let interval = 0; interval < 72; interval++) {
  longVisit.elapse(20 * 60 * 1000);
  longVisit.controller.contact("fixture-205", "phone");
}
await settle();
assert.notEqual(
  longVisit.events.at(-1).properties.$session_id,
  initialVisit,
  "Sustained activity rotates session at24h even without idle expiration",
);
longVisit.controller.leave();
await settle();
for (const event of longVisit.events) {
  assert.match(event.properties.$session_id, sessionPattern);
  const start = sessionStartedAt(event.properties.$session_id),
    time = Date.parse(event.timestamp);
  assert(
    start <= time && time < start + 24 * 60 * 60 * 1000,
    "Every emitted event has a session timestamp within PostHog's accepted window",
  );
}
const at = Date.UTC(2026, 9, 18),
  sessionAt = (time) => {
    const hex = time.toString(16).padStart(12, "0");
    return `${hex.slice(0, 8)}-${hex.slice(8)}-7000-8000-000000000205`;
  };
for (const [id, lastActivity, reusable] of [
  ["00000000-0000-4000-8000-000000000205", at, false],
  [sessionAt(at + 1000), at, false],
  [sessionAt(at - 24 * 60 * 60 * 1000), at, false],
  [sessionAt(at), at + 1000, false],
  [sessionAt(at - 60000), at, true],
]) {
  const persisted = storage(),
    consentStore = storage();
  consentStore.setItem(
    keys.consent,
    JSON.stringify({ value: "accepted", expiresAt: at + 86400000 }),
  );
  persisted.setItem(keys.session, JSON.stringify({ id, lastActivity }));
  const recovered = fixture({
    storage: consentStore,
    sessionStorage: persisted,
  });
  recovered.navigate("/");
  await settle();
  assert.match(recovered.events[0].properties.$session_id, sessionPattern);
  assert.equal(
    recovered.events[0].properties.$session_id === id,
    reusable,
    "Stored sessions require a valid v7 timestamp and activity window",
  );
}
const failed = fixture({
  load: async () => {
    throw Error("Provider unavailable");
  },
});
assert.doesNotThrow(() => {
  failed.navigate("/");
  failed.controller.setConsent("accepted");
  failed.navigate("/werkstaetten");
});
await settle();
const unavailable = {
  getItem() {
    throw Error("Unavailable");
  },
  setItem() {
    throw Error("Unavailable");
  },
  removeItem() {
    throw Error("Unavailable");
  },
};
const memory = fixture({ storage: unavailable, sessionStorage: unavailable });
memory.navigate("/");
memory.controller.setConsent("accepted");
memory.navigate("/werkstatt/fixture-205", "fixture-205");
memory.controller.contact("fixture-205", "phone");
await settle();
assert.equal(
  memory.events.at(-1)?.event,
  "workshop_contact_clicked",
  "Storage errors retain in-memory consent and keep contacts working",
);
const requests = [];
globalThis.fetch = async (...args) => {
  requests.push(args);
  return new Response("1");
};
await send(
  config,
  {
    event: "$pageview",
    timestamp: "2026-10-18T00:00:00.000Z",
    properties: {
      $current_url: "https://riparim.com/",
      distinct_id: "fixture",
    },
  },
  new AbortController().signal,
);
assert.equal(requests[0][0], "https://eu.i.posthog.com/i/v0/e/");
assert.equal(requests[0][1].credentials, "omit");
assert.equal(requests[0][1].referrerPolicy, "no-referrer");
assert.equal(requests[0][1].keepalive, true);
assert.deepEqual(JSON.parse(requests[0][1].body), {
  token: config.key,
  event: "$pageview",
  timestamp: "2026-10-18T00:00:00.000Z",
  properties: { $current_url: "https://riparim.com/", distinct_id: "fixture" },
});
globalThis.fetch = async () => new Response("", { status: 503 });
await assert.rejects(
  send(
    config,
    {
      event: "$pageview",
      timestamp: "2026-10-18T00:00:00.000Z",
      properties: {},
    },
    new AbortController().signal,
  ),
  /capture unavailable/,
);
console.log(
  "Analytics consent, navigation, privacy, session, contact and transport contracts passed",
);
