import assert from "node:assert/strict";
import {
  compareReports,
  compareReportSets,
} from "../scripts/tailwind-qa/compare.mjs";
const before = {
  scene: "controls",
  state: "ready",
  role: "member",
  locale: "de",
  theme: "light",
  width: 390,
  height: 900,
  ready: true,
  overflow: false,
  failures: [],
  geometries: [
    {
      tag: "BUTTON",
      role: "switch",
      slot: "switch",
      text: "",
      x: 16,
      y: 20,
      width: 36,
      height: 20,
      color: "rgb(1, 2, 3)",
    },
  ],
};
assert.deepEqual(
  compareReports(before, structuredClone(before)),
  [],
  "Unchanged browser reports have no differences",
);
const shifted = structuredClone(before);
shifted.geometries[0].x = 18;
assert(
  compareReports(before, shifted).some(
    (difference) => difference.property === "x",
  ),
  "A two-pixel control shift must fail the default tolerance",
);
const fractional = structuredClone(before);
fractional.geometries[0].x += 0.3;
assert.deepEqual(
  compareReports(before, fractional),
  [],
  "Subpixel rounding stays within the explicit tolerance",
);
const overflow = structuredClone(before);
overflow.overflow = true;
assert(
  compareReports(before, overflow).some(
    (difference) => difference.property === "overflow",
  ),
  "New horizontal overflow always fails",
);
const missing = structuredClone(before);
missing.geometries = [];
assert(
  compareReports(before, missing).some(
    (difference) => difference.property === "missing",
  ),
  "Removed controls are reported rather than silently skipped",
);
assert.equal(
  compareReportSets({ one: before }, {}).passed,
  false,
  "Missing after captures block the comparison gate",
);
assert.equal(
  compareReportSets({}, { one: before }).passed,
  false,
  "Missing before captures block the comparison gate",
);
assert.equal(
  compareReportSets({}, {}).passed,
  false,
  "An empty comparison cannot prove coverage",
);
assert.equal(
  compareReportSets({ one: before }, { one: structuredClone(before) }).passed,
  true,
  "Complete unchanged pairs pass the gate",
);

const unreadyEmpty = { ...before, ready: false, geometries: [] };
assert.notDeepEqual(
  compareReports(unreadyEmpty, structuredClone(unreadyEmpty)),
  [],
  "Identically unfinished empty captures cannot prove visual parity",
);
assert.equal(
  compareReportSets(
    { one: unreadyEmpty },
    { one: structuredClone(unreadyEmpty) },
  ).passed,
  false,
  "A paired report filename does not prove that either capture completed",
);

for (const [name, invalidate] of [
  ["unfinished", (report) => (report.ready = false)],
  ["missing readiness", (report) => delete report.ready],
  ["empty geometry", (report) => (report.geometries = [])],
  ["missing geometry", (report) => delete report.geometries],
  ["non-finite x", (report) => (report.geometries[0].x = NaN)],
  ["non-finite y", (report) => (report.geometries[0].y = Infinity)],
  ["missing width", (report) => delete report.geometries[0].width],
  ["null height", (report) => (report.geometries[0].height = null)],
  ["failed fixture", (report) => report.failures.push("Fixture render failed")],
  ["missing failures", (report) => delete report.failures],
  ["overflow", (report) => (report.overflow = true)],
  ["missing overflow", (report) => delete report.overflow],
]) {
  const invalid = structuredClone(before);
  invalidate(invalid);
  for (const [original, current] of [
    [invalid, before],
    [before, invalid],
    [invalid, structuredClone(invalid)],
  ]) {
    assert(
      compareReports(original, current).length > 0,
      `${name} on either or both sides blocks a report comparison`,
    );
    assert.equal(
      compareReportSets({ one: original }, { one: current }).passed,
      false,
      `${name} on either or both sides blocks the comparison gate`,
    );
  }
}

const borderless = structuredClone(before);
borderless.geometries[0].border = "0px none rgb(1, 2, 3)";
const zeroSolid = structuredClone(borderless);
zeroSolid.geometries[0].border = "0px solid rgb(4, 5, 6)";
assert.deepEqual(
  compareReports(borderless, zeroSolid),
  [],
  "Zero-width borders paint no line regardless of style or color",
);
const paintedBorder = structuredClone(zeroSolid);
paintedBorder.geometries[0].border = "1px solid rgb(4, 5, 6)";
assert(
  compareReports(borderless, paintedBorder).some(
    (difference) => difference.property === "border",
  ),
  "An added visible border remains a visual regression",
);
const hidden = structuredClone(before);
hidden.geometries[0] = {
  ...hidden.geometries[0],
  width: 0,
  height: 0,
  display: "none",
  background: "rgb(11, 29, 32)",
};
const hiddenTransparent = structuredClone(hidden);
hiddenTransparent.geometries[0].background = "rgba(0, 0, 0, 0)";
assert.deepEqual(
  compareReports(hidden, hiddenTransparent),
  [],
  "Unpainted hidden nodes do not differ visually in background color",
);
const visible = structuredClone(hiddenTransparent);
visible.geometries[0].width = 36;
visible.geometries[0].height = 20;
visible.geometries[0].display = "block";
assert(
  compareReports(hidden, visible).some(
    (difference) => difference.property === "width",
  ),
  "A hidden node becoming visible is still a regression",
);

const decorative = structuredClone(before);
decorative.geometries[0] = {
  ...decorative.geometries[0],
  tag: "SPAN",
  role: null,
  slot: "switch-thumb",
  text: "",
  background: "rgb(255, 255, 255)",
};
const inherited = structuredClone(decorative);
inherited.geometries[0].color = "rgb(255, 255, 255)";
assert.deepEqual(
  compareReports(decorative, inherited),
  [],
  "The empty decorative thumb paints its background, not inherited text color",
);
inherited.geometries[0].background = "rgb(0, 0, 0)";
assert(
  compareReports(decorative, inherited).some(
    (difference) => difference.property === "background",
  ),
  "A painted thumb background change must still fail",
);
console.log(
  "Browser report comparison: valid captures, geometry tolerance, painted styles and invalid-pair rejection passed",
);
