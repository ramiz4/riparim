import { pathToFileURL } from "node:url";

export function assertCIVerification(needs) {
  const required = ["quality", "node", "workers"];
  if (
    !needs ||
    Object.keys(needs).length !== required.length ||
    required.some((name) => needs[name]?.result !== "success")
  ) {
    throw Error(
      "Every required CI branch (quality, node, workers) must succeed.",
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  assertCIVerification(JSON.parse(process.env.NEEDS_JSON ?? "null"));
  console.log("All required verification branches succeeded.");
}
