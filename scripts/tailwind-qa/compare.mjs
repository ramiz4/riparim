import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function keyedGeometry(geometries = []) {
  const occurrences = new Map();
  return new Map(
    geometries.map((node) => {
      const identity = [
        node.tag,
        node.role ?? "",
        node.slot ?? "",
        node.text ?? "",
      ].join("|");
      const occurrence = occurrences.get(identity) ?? 0;
      occurrences.set(identity, occurrence + 1);
      return [identity + "|" + occurrence, node];
    }),
  );
}

function validateReport(report, capture) {
  const differences = [];
  const invalid = (property, observed, expected, target = "fixture") =>
    differences.push({ capture, target, property, observed, expected });
  if (report?.ready !== true) invalid("ready", report?.ready, true);
  if (report?.overflow !== false) invalid("overflow", report?.overflow, false);
  if (!Array.isArray(report?.failures) || report.failures.length)
    invalid("failures", report?.failures, []);
  let comparableGeometry = Array.isArray(report?.geometries);
  if (!comparableGeometry || !report.geometries.length)
    invalid("geometries", report?.geometries, "nonempty geometry array");
  if (comparableGeometry)
    report.geometries.forEach((node, index) => {
      for (const property of ["x", "y", "width", "height"])
        if (!Number.isFinite(node?.[property])) {
          comparableGeometry = false;
          invalid(
            property,
            node?.[property],
            "finite number",
            `geometry[${index}]`,
          );
        }
    });
  return { differences, comparableGeometry };
}

export function compareReports(before, after, { tolerance = 0.5 } = {}) {
  const originalReport = validateReport(before, "before"),
    currentReport = validateReport(after, "after");
  const differences = [
    ...originalReport.differences,
    ...currentReport.differences,
  ];
  // Equal incomplete or failed captures are not evidence of visual parity.
  if (!originalReport.comparableGeometry || !currentReport.comparableGeometry)
    return differences;
  for (const property of [
    "scene",
    "state",
    "role",
    "locale",
    "theme",
    "width",
    "height",
    "ready",
  ]) {
    if (before[property] !== after[property])
      differences.push({
        target: "fixture",
        property,
        before: before[property],
        after: after[property],
      });
  }
  const original = keyedGeometry(before.geometries),
    current = keyedGeometry(after.geometries);
  for (const [identity, node] of original) {
    const changed = current.get(identity);
    if (!changed) {
      differences.push({ target: identity, property: "missing", before: node });
      continue;
    }
    for (const property of ["x", "y", "width", "height"]) {
      if (Math.abs(node[property] - changed[property]) > tolerance)
        differences.push({
          target: identity,
          property,
          before: node[property],
          after: changed[property],
          delta: changed[property] - node[property],
        });
    }
    for (const property of [
      "display",
      "position",
      "color",
      "background",
      "overflow",
      "minWidth",
      "maxWidth",
      "border",
      "padding",
    ]) {
      // Switch.Thumb is an empty decorative span. Its painted background and
      // geometry remain checked; an unused inherited text color paints nothing.
      if (
        property === "color" &&
        node.slot === "switch-thumb" &&
        changed.slot === "switch-thumb" &&
        node.text === "" &&
        changed.text === ""
      )
        continue;
      // Hidden, zero-sized boxes cannot paint their foreground/background.
      // Geometry and display still detect a hidden control becoming visible.
      if (
        ["color", "background"].includes(property) &&
        (!node.width || !node.height) &&
        (!changed.width || !changed.height)
      )
        continue;
      const equivalent = (value) =>
        property === "border" && /^0(?:\.0+)?px\s/.test(value ?? "")
          ? "no painted border"
          : value;
      if (equivalent(node[property]) !== equivalent(changed[property]))
        differences.push({
          target: identity,
          property,
          before: node[property],
          after: changed[property],
        });
    }
  }
  for (const [identity, node] of current)
    if (!original.has(identity))
      differences.push({ target: identity, property: "added", after: node });
  return differences;
}

export function compareReportSets(before, after) {
  const results = [];
  for (const file of [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].sort()) {
    if (!before[file]) results.push({ file, missingBefore: true });
    else if (!after[file]) results.push({ file, missingAfter: true });
    else
      results.push({
        file,
        differences: compareReports(before[file], after[file]),
      });
  }
  return {
    results,
    passed:
      results.length > 0 &&
      results.every(
        (result) =>
          !result.missingBefore &&
          !result.missingAfter &&
          result.differences.length === 0,
      ),
  };
}

async function main() {
  const root = resolve(process.argv[2] ?? ".sites-runtime/tailwind-qa");
  async function readReports(variant) {
    const directory = resolve(root, variant, "geometry"),
      reports = {};
    let files;
    try {
      files = await readdir(directory);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return reports;
    }
    for (const file of files.filter((name) => name.endsWith(".json")))
      reports[file] = JSON.parse(
        await readFile(resolve(directory, file), "utf8"),
      );
    return reports;
  }
  const { results, passed } = compareReportSets(
    await readReports("before"),
    await readReports("after"),
  );
  await writeFile(
    resolve(root, "comparison.json"),
    JSON.stringify({ tolerance: 0.5, passed, results }, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        passed,
        compared: results.filter(
          (result) => !result.missingAfter && !result.missingBefore,
        ).length,
        missingBefore: results
          .filter((result) => result.missingBefore)
          .map((result) => result.file),
        missingAfter: results
          .filter((result) => result.missingAfter)
          .map((result) => result.file),
        changed: results
          .filter((result) => result.differences?.length)
          .map((result) => ({
            file: result.file,
            differences: result.differences.length,
          })),
        report: resolve(root, "comparison.json"),
      },
      null,
      2,
    ),
  );
  process.exitCode = passed ? 0 : 1;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
