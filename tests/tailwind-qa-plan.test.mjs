import assert from "node:assert/strict";
import vm from "node:vm";
import { responsivePlan } from "../scripts/tailwind-qa/responsive-plan.mjs";
import {
  fixtureEnvironmentScript,
  withFixtureEnvironment,
} from "../scripts/tailwind-qa/environment.mjs";

const plan = responsivePlan();
for (const boundary of [360, 380, 480, 540, 600, 900, 960, 1600])
  for (const width of [boundary - 1, boundary, boundary + 1])
    assert(
      plan.some((item) => item.width === width),
      `Missing width ${width}`,
    );
for (const height of [599, 600, 601, 602])
  assert(
    plan.some((item) => item.scene === "catalogue" && item.height === height),
  );
assert(plan.some((item) => item.scene === "profile" && item.width === 960));
assert(plan.some((item) => item.scene === "admin-auth" && item.width === 900));
assert(plan.some((item) => item.scene === "business" && item.width === 600));
assert.equal(
  new Set(plan.map((item) => JSON.stringify(item))).size,
  plan.length,
);
console.log(
  "Native responsive plan: adjacent live boundaries and unique cases passed",
);

const fixture = '<body><script type="module" src="fixture.js"></script></body>';
assert(
  withFixtureEnvironment(fixture).indexOf('src="/fixture-environment.js"') >= 0,
  "The fixture environment initializes before application code",
);
assert(
  withFixtureEnvironment(fixture).indexOf('src="/fixture-environment.js"') <
    withFixtureEnvironment(fixture).indexOf('src="fixture.js"'),
);
const sample = () => {
  const context = vm.createContext({});
  vm.runInContext(fixtureEnvironmentScript, context);
  return Array.from(
    vm.runInContext("Array.from({length: 8}, Math.random)", context),
  );
};
assert.deepEqual(
  sample(),
  sample(),
  "Independent fixture loads use identical ordering",
);
assert.equal(
  new Set(sample()).size,
  8,
  "The fixture supplies a sequence, not a constant",
);
