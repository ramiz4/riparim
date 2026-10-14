import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
const output = ".test-runtime/opening-hours";
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["lib/opening-hours.ts"],
  outfile: output + "/contract.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
});
const {
  openingHoursSchema,
  openingWeekday,
  openingStatus,
  decodeOpeningHours,
  emptyOpeningHours,
} = await import(new URL("../" + output + "/contract.mjs", import.meta.url));
const closed = { mode: "closed" },
  open = {
    mode: "open",
    intervals: [
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ],
  };
const hours = {
  week: [open, open, open, open, open, closed, closed],
  exceptions: [],
};
assert.deepEqual(openingHoursSchema.parse(hours), hours);
assert.equal(
  openingWeekday(new Date("2026-10-12T23:00:00Z")),
  1,
  "Weekday highlighting follows the local Kosovo date",
);
for (const [time, status] of [
  ["2026-10-12T05:59:00Z", "closed"],
  ["2026-10-12T06:00:00Z", "open"],
  ["2026-10-12T10:00:00Z", "closed"],
  ["2026-10-12T11:00:00Z", "open"],
  ["2026-10-12T16:00:00Z", "closed"],
  ["2026-10-18T09:00:00Z", "closed"],
  ["2026-01-12T07:00:00Z", "open"],
  ["2026-01-12T06:59:00Z", "closed"],
])
  assert.equal(openingStatus(hours, new Date(time)), status, time);
assert.equal(
  openingStatus(
    { ...hours, exceptions: [{ date: "2026-10-12", day: closed }] },
    new Date("2026-10-12T09:00:00Z"),
  ),
  "closed",
);
assert.equal(
  openingStatus(
    { ...hours, exceptions: [{ date: "2026-10-18", day: open }] },
    new Date("2026-10-18T09:00:00Z"),
  ),
  "open",
);
assert.equal(
  openingStatus(
    {
      ...hours,
      exceptions: [{ date: "2026-10-12", day: { mode: "appointment" } }],
    },
    new Date("2026-10-12T09:00:00Z"),
  ),
  "appointment",
);
assert.equal(openingStatus(null, new Date()), "unknown");
assert.equal(openingStatus(emptyOpeningHours(), new Date()), "unknown");
const fullDay = { mode: "open", intervals: [{ start: "00:00", end: "24:00" }] };
assert.equal(
  openingStatus(
    { week: Array(7).fill(fullDay), exceptions: [] },
    new Date("2026-10-12T21:59:00Z"),
  ),
  "open",
);
for (const intervals of [
  [{ start: "12:00", end: "12:00" }],
  [{ start: "18:00", end: "08:00" }],
  [{ start: "24:00", end: "24:00" }],
  [
    { start: "08:00", end: "12:00" },
    { start: "11:00", end: "18:00" },
  ],
])
  assert(
    !openingHoursSchema.safeParse({
      ...hours,
      week: [{ mode: "open", intervals }, ...hours.week.slice(1)],
    }).success,
  );
for (const exceptions of [
  [{ date: "2026-02-30", day: closed }],
  [
    { date: "2026-12-25", day: closed },
    { date: "2026-12-25", day: open },
  ],
])
  assert(!openingHoursSchema.safeParse({ ...hours, exceptions }).success);
assert(
  !openingHoursSchema.safeParse({
    ...hours,
    confirmedAt: "forged",
    source: "google",
  }).success,
);
assert.equal(decodeOpeningHours(undefined), null);
assert.deepEqual(decodeOpeningHours(JSON.stringify(hours)), hours);
assert.throws(() => decodeOpeningHours("{broken"));
assert.throws(() => decodeOpeningHours("{}"));
console.log(
  "Owner hours: ordered intervals, invalid dates, midnight, exceptions, Kosovo winter/summer time, missing versus closed and untrusted metadata passed",
);
