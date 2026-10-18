import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { publicAnalyticsBindings } from "../scripts/lib/public-analytics.mjs";

assert.deepEqual(publicAnalyticsBindings(), {
  POSTHOG_KEY: "",
  POSTHOG_HOST: "",
  POSTHOG_TEST_MODE: "false",
});
assert.deepEqual(
  publicAnalyticsBindings({
    POSTHOG_KEY: "phc_fixture_project",
    POSTHOG_HOST: "https://eu.i.posthog.com",
    POSTHOG_TEST_MODE: "true",
    SUPABASE_SECRET_KEY: "must-not-reach-public-html",
    UNRELATED_PUBLIC_VALUE: "not-analytics",
  }),
  {
    POSTHOG_KEY: "phc_fixture_project",
    POSTHOG_HOST: "https://eu.i.posthog.com",
    POSTHOG_TEST_MODE: "true",
  },
  "public release rendering preserves analytics configuration without copying unrelated runtime bindings",
);
for (const value of [undefined, null, false, 123, "TRUE", "false"])
  assert.equal(
    publicAnalyticsBindings({ POSTHOG_TEST_MODE: value }).POSTHOG_TEST_MODE,
    "false",
    "verification mode requires the exact explicit true string",
  );
assert.deepEqual(
  publicAnalyticsBindings({ POSTHOG_KEY: 42, POSTHOG_HOST: {} }),
  { POSTHOG_KEY: "", POSTHOG_HOST: "", POSTHOG_TEST_MODE: "false" },
  "unexpected non-string configuration stays disabled",
);
const production = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
const bindings = publicAnalyticsBindings(production.vars);
assert.match(bindings.POSTHOG_KEY, /^phc_[A-Za-z0-9]+$/);
assert.equal(bindings.POSTHOG_HOST, "https://eu.i.posthog.com");
assert.equal(bindings.POSTHOG_TEST_MODE, "false");
console.log(
  "Analytics config: disabled defaults, explicit public allowlist, verification opt-in and release-bound EU project passed",
);
