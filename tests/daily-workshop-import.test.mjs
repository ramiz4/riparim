import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acquireRun,
  releaseRun,
  checkLive,
} from "../scripts/daily-workshop-import.mjs";

const root = await mkdtemp(join(tmpdir(), "riparim-daily-import-"));
try {
  const lock = join(root, "run.lock");
  const results = await Promise.allSettled([
    acquireRun(lock, "run-a"),
    acquireRun(lock, "run-b"),
  ]);
  assert.equal(
    results.filter((r) => r.status === "fulfilled").length,
    1,
    "Only one overlapping run can acquire the lock",
  );
  const run = results.find((r) => r.status === "fulfilled").value;
  await assert.rejects(releaseRun(lock, "other-token"), /owner does not match/);
  assert.equal(
    JSON.parse(await readFile(join(lock, "run.json"))).token,
    run.token,
  );
  await assert.rejects(
    acquireRun(lock, "retry"),
    { code: "EEXIST" },
    "A persisted crash lock is never silently expired",
  );
  await releaseRun(lock, run.token);
  const next = await acquireRun(lock, "next-run");
  await releaseRun(lock, next.token);
} finally {
  await rm(root, { recursive: true, force: true });
}

const request = async (url) => {
  if (url.endsWith("/api/workshops"))
    return Response.json({
      workshops: [
        {
          id: "verified-profile",
          name: "Verified workshop",
          status: "published",
        },
      ],
    });
  const locale = url.includes("/sq/")
    ? "sq"
    : url.includes("/en/")
      ? "en"
      : "de";
  return new Response(
    `<html lang="${locale}"><h1>Verified workshop</h1><main data-workshop-id="verified-profile"></main></html>`,
  );
};
assert.equal((await checkLive({ request })).healthy, true);
for (const response of [
  new Response("Error 1102: Worker exceeded resource limits", { status: 503 }),
  new Response('<html lang="en"><h1>Truncated stream'),
  new Response('<html lang="en"><p>Error</p></html>'),
  new Response(
    '<html lang="en"><h1>Profile unavailable</h1><main data-public-profile-id="verified-profile"></main></html>',
  ),
]) {
  const broken = await checkLive({
    request: async (url) =>
      url.includes("/en/workshop/") ? response.clone() : request(url),
  });
  assert.equal(
    broken.healthy,
    false,
    "Resource errors and HTTP200 stream failures must block publication",
  );
}
await assert.rejects(
  checkLive({ profileIds: ["absent"], request }),
  /Published profile missing/,
);
await assert.rejects(
  checkLive({
    request: async () =>
      Response.json({
        workshops: [
          { id: "same", status: "published" },
          { id: "same", status: "published" },
        ],
      }),
  }),
  /duplicate IDs/,
);
console.log(
  "Daily import lock contention, safe release and live publication gates passed",
);
