import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
const { build } = createRequire(new URL("../package.json", import.meta.url))(
  "esbuild",
);
const output = ".test-runtime/business";
await mkdir(output, { recursive: true });
const bundle = await build({
  entryPoints: {
    route: "app/api/business/route.ts",
    workshops: "app/api/workshops/route.ts",
    settings: "app/api/auth-settings/route.ts",
    evidence: "app/api/business/evidence/[id]/route.ts",
    directory: "db/directory.ts",
    cleanup: "lib/auth/delete-account.ts",
  },
  outdir: output,
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  plugins: [
    {
      name: "business-boundaries",
      setup(b) {
        b.onResolve(
          {
            filter: /^(cloudflare:workers|@\/app\/auth|@\/db\/google-places)$/,
          },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          loader: "js",
          contents:
            args.path === "cloudflare:workers"
              ? "export const env=globalThis.fixtureEnv;"
              : args.path === "@/app/auth"
                ? "export async function getAppUser(){return globalThis.fixtureUser;} export async function getAdminUser(){return globalThis.fixtureUser;} export function ownerPair(user){return [user.ownerKeys[0],user.ownerKeys[1]??user.ownerKeys[0]];} export function providerAccountId(url,id){return `supabase:${new URL(url).hostname}:${id}`;}"
                : "export async function confirmedPublicationPlace(...args){return globalThis.fixtureConfirmPlace(...args);}",
        }));
      },
    },
  ],
});
for (const file of bundle.outputFiles)
  await writeFile(file.path.replace(/\.js$/, ".mjs"), file.contents);
const db = new DatabaseSync(":memory:");
for (const file of (await readdir("drizzle"))
  .filter((file) => file.endsWith(".sql"))
  .sort())
  db.exec(await readFile("drizzle/" + file, "utf8"));
let beforeBatch = null,
  beforeRun = null,
  holdBatch = null,
  batchTail = Promise.resolve(),
  failDb = false;
const d1 = {
  prepare(sql) {
    const statement = db.prepare(sql);
    const adapter = (values = []) => ({
      fixtureValues: values,
      bind: (...next) => adapter(next),
      first: async () => {
        if (failDb) throw Error("Fixture storage unavailable");
        return statement.get(...values) ?? null;
      },
      all: async () => ({ results: statement.all(...values) }),
      run: async () => {
        if (beforeRun) beforeRun(sql);
        return { meta: statement.run(...values) };
      },
    });
    return adapter();
  },
  batch(statements) {
    const execute = () => {
      const result = batchTail.then(async () => {
        if (beforeBatch) {
          const fn = beforeBatch;
          beforeBatch = null;
          fn();
        }
        db.exec("BEGIN");
        try {
          const results = [];
          for (const statement of statements)
            results.push(await statement.run());
          db.exec("COMMIT");
          return results;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      });
      batchTail = result.catch(() => {});
      return result;
    };
    return holdBatch ? holdBatch(statements, execute) : execute();
  },
};
const origin = "https://riparim.example.test",
  projectUrl = "https://fixture-project.supabase.co";
const aId = "00000000-0000-4000-8000-000000000001",
  bId = "00000000-0000-4000-8000-000000000002",
  cId = "00000000-0000-4000-8000-000000000003";
const accountId = (id) => `supabase:fixture-project.supabase.co:${id}`;
const user = (id, email, admin = false) => ({
  userId: accountId(id),
  email,
  displayName: "Fixture Member",
  ownerKeys: [accountId(id)],
  isModerator: admin,
  provider: "E-Mail",
});
const actors = {
  a: user(aId, "a@example.test"),
  b: user(bId, "b@example.test"),
  c: user(cId, "c@example.test"),
  admin: user(
    "00000000-0000-4000-8000-000000000009",
    "admin@example.test",
    true,
  ),
};
const objects = new Map();
let uploadHook = null,
  failDelete = false,
  failUpload = false;
const bucket = {
  async put(key, bytes, options) {
    if (bytes !== null && uploadHook) {
      const hook = uploadHook;
      uploadHook = null;
      await hook();
    }
    if (bytes !== null && failUpload) throw Error("Fixture upload failed");
    if (
      options?.onlyIf &&
      objects.get(key)?.etag !== options.onlyIf.etagMatches
    )
      return null;
    const object = {
      bytes: bytes ?? new ArrayBuffer(0),
      etag: crypto.randomUUID(),
      type: options?.httpMetadata?.contentType,
    };
    objects.set(key, object);
    return object;
  },
  async get(key) {
    const object = objects.get(key);
    return object ? { body: object.bytes } : null;
  },
  async head(key) {
    return objects.get(key) ?? null;
  },
  async list({ prefix }) {
    return {
      objects: [...objects.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key })),
      truncated: false,
    };
  },
  async delete(keys) {
    if (failDelete) throw Error("Fixture cleanup failed");
    for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
  },
};
globalThis.fixtureEnv = {
  DB: d1,
  BUCKET: bucket,
  REVIEW_MODERATOR_EMAIL: actors.admin.email,
  SITE_ORIGIN: origin,
};
let googleAvailable = true,
  googleCalls = [];
globalThis.fixtureConfirmPlace = (profile, existing, persist) => {
  googleCalls.push({ profile, existing, persist });
  return googleAvailable ? "ChIJfixture-owner-match-" + profile.id : null;
};
const [route, directory, cleanup, evidenceRoute] = await Promise.all(
  ["route", "directory", "cleanup", "evidence"].map(
    (file) => import(new URL(`../${output}/${file}.mjs`, import.meta.url)),
  ),
);
const workshops = await import(
  new URL(`../${output}/workshops.mjs`, import.meta.url)
);
const settings = await import(
  new URL(`../${output}/settings.mjs`, import.meta.url)
);
const publicProfiles = await directory.listWorkshops(),
  first = publicProfiles[0],
  second = publicProfiles[1],
  third = publicProfiles[2],
  fourth = publicProfiles[3];
const evidence =
  "This fictional registered operator can be independently verified through its company register and official contact.";
const profile = (workshop) => ({
  phone: workshop.phone,
  phoneNote: workshop.phoneNote,
  whatsapp: workshop.whatsapp,
  services: workshop.services,
  serviceDetails: workshop.serviceDetails,
  description: workshop.description,
});
const request = (method, body, headers = {}, path = "/api/business") =>
  new Request(origin + path, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json", ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
async function post(actor, body) {
  globalThis.fixtureUser = actors[actor] ?? null;
  return route.POST(request("POST", body));
}
async function state(actor, moderation = false) {
  globalThis.fixtureUser = actors[actor] ?? null;
  return route.GET(
    new Request(origin + "/api/business" + (moderation ? "?moderation=1" : "")),
  );
}
const claim = (actor, workshopId, extra = {}) =>
  Object.keys(extra).length
    ? post(actor, {
        kind: "claim",
        input: {
          workshopId,
          evidence,
          evidenceLinks: ["https://business.example.test/proof"],
          ...extra,
        },
      })
    : upload(actor, workshopId);
const pdf = () =>
  new File(["%PDF-1.7 fictional operator proof"], "fixture-proof.pdf", {
    type: "application/pdf",
  });
async function upload(actor, workshopId, file = pdf(), extra = {}) {
  globalThis.fixtureUser = actors[actor] ?? null;
  const body = new FormData();
  body.set("workshopId", workshopId);
  body.set("evidence", evidence);
  for (const document of Array.isArray(file) ? file : file ? [file] : [])
    body.append("file", document);
  for (const [key, value] of Object.entries(extra)) body.set(key, value);
  const serialized = new Response(body);
  return route.POST(
    new Request(origin + "/api/business", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": serialized.headers.get("Content-Type"),
      },
      body: await serialized.arrayBuffer(),
    }),
  );
}
async function download(actor, id, document) {
  globalThis.fixtureUser = actors[actor] ?? null;
  return evidenceRoute.GET(
    new Request(
      origin +
        "/api/business/evidence/" +
        id +
        (document ? "?document=" + document : ""),
    ),
    { params: Promise.resolve({ id }) },
  );
}
async function decide(
  actor,
  kind,
  id,
  decision = "approved",
  revision = 0,
  note = "The independently checked operator proof is sufficient.",
) {
  globalThis.fixtureUser = actors[actor] ?? null;
  return route.PATCH(request("PATCH", { kind, id, revision, decision, note }));
}
const change = (actor, workshopId, fields) =>
  post(actor, { kind: "change", workshopId, profile: fields });
let passed = 0;
const check = (condition, label) => {
  assert(condition, label);
  passed++;
};
for (const locale of ["de", "sq", "en"]) {
  globalThis.fixtureUser = actors.a;
  const invalid = await route.POST(
    request(
      "POST",
      {
        kind: "claim",
        input: { workshopId: first.id, evidence: "short", evidenceLinks: [] },
      },
      { "Accept-Language": locale },
    ),
  );
  const data = await invalid.json();
  check(
    invalid.status === 400 &&
      data.errorCode === "business_invalid_input" &&
      data.error === "Bitte prüfe deine Eingaben und den Inhabernachweis.",
    "Business input codes and legacy status/text are identical for all UI languages",
  );
  assert.throws(
    () => directory.validateProfile({ ...first, phone: "invalid" }, first.id),
    (error) => error.code === "workshop_invalid_profile",
  );
  passed++;
  globalThis.fixtureUser = actors.admin;
  const profileResponse = await workshops.PATCH(
      request(
        "PATCH",
        { ...first, phone: "invalid" },
        { "Accept-Language": locale },
        "/api/workshops",
      ),
    ),
    profileError = await profileResponse.json();
  check(
    profileResponse.status === 400 &&
      profileError.errorCode === "workshop_invalid_profile",
    "Actual workshop mutation responses carry the source-owned validation code without changing authorization",
  );
  const configResponse = await settings.POST(
      request(
        "POST",
        { projectUrl: "not-a-url", publicKey: "invalid", enabled: false },
        { "Accept-Language": locale },
        "/api/auth-settings",
      ),
    ),
    configError = await configResponse.json();
  check(
    configResponse.status === 400 &&
      configError.errorCode === "auth_project_url",
    "The actual protected configuration API exposes only a stable source-owned URL validation code",
  );
}
check(
  (await state("guest")).status === 401 &&
    (await claim("guest", first.id)).status === 401,
  "Anonymous users cannot read or submit private ownership requests",
);
check(
  (await state("a", true)).status === 403,
  "A customer cannot read other applicants’ evidence",
);
check(
  (await decide("a", "claim", crypto.randomUUID())).status === 403,
  "Customer accounts cannot approve themselves",
);
globalThis.fixtureUser = actors.a;
check(
  (
    await route.POST(
      request(
        "POST",
        {
          kind: "claim",
          input: { workshopId: first.id, evidence, evidenceLinks: [] },
        },
        { Origin: "https://other.example.test" },
      ),
    )
  ).status === 403,
  "Claim submission rejects cross-origin requests",
);
for (const extra of [
  { owner: actors.b.userId },
  { status: "approved" },
  { evidence: "short" },
  { evidenceLinks: ["http://business.example.test/proof"] },
  { evidenceLinks: ["https://password:secret@business.example.test/proof"] },
])
  check(
    (await claim("a", first.id, extra)).status === 400,
    "Claims validate proof and reject authority fields or unsafe links",
  );
check(
  (await claim("a", "missing-profile")).status === 409,
  "Claims require an existing public profile",
);
for (const request of [
  () => upload("a", first.id, null),
  () => post("a", { kind: "claim", input: { workshopId: first.id, evidence } }),
]) {
  const response = await request();
  check(
    response.status === 400 &&
      (await response.json()).errorCode === "business_documents_required",
    "New claims require at least one document in multipart and JSON requests",
  );
}
check(
  (await upload("a", first.id, Array.from({ length: 6 }, pdf))).status === 400,
  "Claims reject more than five documents",
);
const largePdf = () =>
  new File(["%PDF-", new Uint8Array(3.5 * 1024 * 1024)], "large.pdf", {
    type: "application/pdf",
  });
const totalLimitResponse = await upload(
  "a",
  first.id,
  Array.from({ length: 3 }, largePdf),
);
check(
  totalLimitResponse.status === 413 &&
    (await totalLimitResponse.json()).errorCode ===
      "business_documents_too_large",
  "Claims reject selections over the aggregate limit even when each file is valid",
);
check(
  objects.size === 0,
  "Missing, excessive and oversized selections write no private objects",
);
let response = await upload("a", first.id, [
    pdf(),
    new File([new Uint8Array([137, 80, 78, 71])], "register.png", {
      type: "image/png",
    }),
  ]),
  body = await response.json(),
  claimA = body.id;
check(
  response.status === 201 && body.status === "pending",
  "A current account can submit a private ownership claim",
);
check(
  db
    .prepare("SELECT owner,evidence,status FROM workshop_claims WHERE id=?")
    .get(claimA).owner === actors.a.userId,
  "Claim ownership derives only from the verified session",
);
check(
  (await claim("a", first.id)).status === 409,
  "The same account cannot create a duplicate pending claim",
);
check(
  !db
    .prepare("SELECT * FROM workshop_owners WHERE workshop_id=?")
    .get(first.id),
  "A pending claim cannot grant profile rights",
);
check(
  (await change("a", first.id, profile(first))).status === 403,
  "Pending applicants cannot edit the workshop",
);
body = await state("b").then((r) => r.json());
check(
  body.claims.length === 0,
  "Foreign applicants cannot read private proof or status",
);
body = await state("a").then((r) => r.json());
check(
  body.claims[0].evidence === evidence && body.claims[0].status === "pending",
  "Applicants can see their own request and status",
);
body = await state("admin", true).then((r) => r.json());
check(
  body.claims.some(
    (claim) => claim.id === claimA && claim.fileName === "fixture-proof.pdf",
  ),
  "The authorized queue includes the private document filename for review",
);
check(
  (await download("guest", claimA)).status === 401 &&
    (await download("b", claimA)).status === 404,
  "Private ownership files reject guests and unrelated accounts",
);
for (const actor of ["a", "admin"]) {
  const document = await download(actor, claimA);
  check(
    document.ok &&
      document.headers.get("Cache-Control") === "private, no-store" &&
      document.headers.get("Content-Disposition").startsWith("attachment;") &&
      (await document.text()).startsWith("%PDF-"),
    "Only the applicant and authorized administration can download the private attachment",
  );
}
check(
  !(await state("a").then((r) => r.json())).claims[0].fileKey,
  "The list exposes the filename but no private object key",
);
check(
  db.prepare("SELECT COUNT(*) AS n FROM evidence_uploads").get().n === 0,
  "Successful uploads leave no unfinished inventory",
);
const documents = (await state("a").then((r) => r.json())).claims[0].documents;
check(
  documents.length === 2 &&
    documents[1].fileName === "register.png" &&
    !JSON.stringify(documents).includes("fileKey"),
  "Private claim lists expose all filenames and opaque IDs without object keys",
);
check(
  (await state("a").then((r) => r.json())).pendingClaims[0].documents.length ===
    2,
  "Pending guidance includes every attachment",
);
for (const document of documents)
  for (const actor of ["a", "admin"])
    check(
      (await download(actor, claimA, document.id)).ok,
      "Every document is individually downloadable by its applicant and administration",
    );
check(
  (await download("b", claimA, documents[1].id)).status === 404 &&
    (await download("a", claimA, crypto.randomUUID())).status === 404,
  "Foreign users and unknown document selectors cannot retrieve evidence",
);
const persisted = JSON.parse(
  db.prepare("SELECT documents FROM workshop_claims WHERE id=?").get(claimA)
    .documents,
);
check(
  persisted.length === 2 &&
    persisted.every((document) => objects.has(document.fileKey)),
  "Successful claims persist all private object references",
);
const legacyId = crypto.randomUUID();
db.prepare(
  "INSERT INTO workshop_claims (id,workshop_id,owner,evidence,file_key,file_name,file_type,created_at,status) VALUES (?,?,?,?,?,?,?,?,?)",
).run(
  legacyId,
  first.id,
  actors.a.userId,
  evidence,
  persisted[0].fileKey,
  persisted[0].fileName,
  persisted[0].fileType,
  "2000-01-01",
  "rejected",
);
check(
  (await download("a", legacyId, legacyId)).ok,
  "Single-file claims from the previous writer remain downloadable after the additive migration",
);
db.prepare("DELETE FROM workshop_claims WHERE id=?").run(legacyId);
const storedCount = objects.size;
for (const file of [
  new File(["not a pdf"], "fake.pdf", { type: "application/pdf" }),
  new File(["%PDF-1.7"], "bad.html", { type: "text/html" }),
  new File([], "empty.pdf", { type: "application/pdf" }),
]) {
  const invalid = await upload("a", second.id, file);
  check(
    invalid.status === 400 &&
      (await invalid.json()).errorCode === "invalid_file",
    "Ownership uploads validate content signatures, MIME types and empty files",
  );
}
check(
  (
    await upload(
      "a",
      second.id,
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "huge.pdf", {
        type: "application/pdf",
      }),
    )
  ).status === 413,
  "Ownership evidence rejects files over 5 MB",
);
check(
  (await upload("a", second.id, pdf(), { owner: actors.b.userId })).status ===
    400,
  "Multipart claims reject client-supplied authority",
);
check(
  (await upload("a", first.id)).status === 409 && objects.size === storedCount,
  "A duplicate claim compensates its unused private upload",
);
check(
  (
    await upload("a", second.id, [
      pdf(),
      new File(["invalid"], "invalid.pdf", { type: "application/pdf" }),
    ])
  ).status === 400 && objects.size === storedCount,
  "All document signatures are validated before the first upload",
);
uploadHook = () => {
  uploadHook = () => {
    throw Error("Fixture second upload failed");
  };
};
check(
  (await upload("a", second.id, [pdf(), pdf()])).status === 503 &&
    objects.size === storedCount &&
    db.prepare("SELECT COUNT(*) AS n FROM evidence_uploads").get().n === 0,
  "A later upload failure compensates every uploaded object and reservation",
);
failUpload = true;
check(
  (await upload("a", second.id)).status === 503,
  "Storage upload failures return an explicit retryable error",
);
failUpload = false;
check(
  objects.size === storedCount &&
    db.prepare("SELECT COUNT(*) AS n FROM evidence_uploads").get().n === 0,
  "Failed uploads remove the reservation and inventory",
);
failDelete = true;
check(
  (await upload("a", first.id)).status === 409,
  "A claim conflict still reports failure when compensating cleanup fails",
);
failDelete = false;
check(
  db.prepare("SELECT COUNT(*) AS n FROM evidence_uploads").get().n === 1,
  "Failed compensation retains inventory for account cleanup",
);
const oversizedBody = new FormData();
oversizedBody.set(
  "file",
  new File([new Uint8Array(11 * 1024 * 1024 + 1)], "huge.pdf", {
    type: "application/pdf",
  }),
);
const serializedOversized = new Response(oversizedBody);
check(
  (
    await route.POST(
      new Request(origin + "/api/business", {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": serializedOversized.headers.get("Content-Type"),
        },
        body: await serializedOversized.arrayBuffer(),
      }),
    )
  ).status === 413,
  "Multipart requests are bounded without a Content-Length header",
);
response = await upload("b", first.id, Array.from({ length: 5 }, pdf));
const claimB = (await response.json()).id;
check(
  response.ok,
  "Another account may submit a competing claim for independent review",
);
check(
  (await decide("admin", "claim", claimA, "approved", 0, "short")).status ===
    400,
  "A moderator must provide a meaningful reason",
);
const firstBefore = db
    .prepare("SELECT * FROM workshops WHERE id=?")
    .get(first.id),
  googleBefore = db
    .prepare("SELECT * FROM workshop_google_places WHERE workshop_id=?")
    .get(first.id);
const simultaneous = await Promise.all([
  decide("admin", "claim", claimA),
  decide("admin", "claim", claimB),
]);
check(
  simultaneous.filter((r) => r.ok).length === 1,
  "Concurrent approvals cannot grant the same profile to two accounts",
);
check(
  db
    .prepare("SELECT account_id FROM workshop_owners WHERE workshop_id=?")
    .get(first.id).account_id === actors.a.userId,
  "The accepted proof grants only the requested existing profile",
);
check(
  db.prepare("SELECT status FROM workshop_claims WHERE id=?").get(claimB)
    .status === "rejected",
  "Competing pending claims receive an explicit decision once ownership is confirmed",
);
assert.deepEqual(
  db.prepare("SELECT * FROM workshops WHERE id=?").get(first.id),
  firstBefore,
);
passed++;
assert.deepEqual(
  db
    .prepare("SELECT * FROM workshop_google_places WHERE workshop_id=?")
    .get(first.id),
  googleBefore,
);
passed++;
check(
  (await claim("c", first.id)).status === 409,
  "Already assigned profiles cannot be claimed again",
);
check(
  (await change("b", first.id, profile(first))).status === 403,
  "Another authenticated account cannot submit changes for the owner’s profile",
);
for (const extra of [
  { status: "published" },
  { sources: [] },
  { name: "Other Identity" },
  { address: "Other Location" },
  { role: "admin" },
])
  check(
    (await change("a", first.id, { ...profile(first), ...extra })).status ===
      400,
    "Owner drafts cannot alter identity, sources, publication or roles directly",
  );
for (const field of [{ phone: "abcdefgh" }, { whatsapp: "invalid-value" }]) {
  const invalid = await change("a", first.id, { ...profile(first), ...field });
  check(
    invalid.status === 400 &&
      !(await invalid.json()).error.includes("nicht verfügbar"),
    "Malformed contact data returns a useful input error without replacing public details",
  );
}
response = await change("a", first.id, {
  ...profile(first),
  description:
    "A verified fictional operator describes documented passenger-car repair work.",
});
let changeA = (await response.json()).id;
check(
  response.status === 201,
  "Confirmed owners can submit a validated contact/service/description draft",
);
check(
  (await change("a", first.id, profile(first))).status === 409,
  "A workshop has at most one pending change draft",
);
check(
  db.prepare("SELECT description FROM workshops WHERE id=?").get(first.id)
    .description === first.description,
  "Pending owner changes never replace public details",
);
check(
  (await decide("a", "change", changeA)).status === 403,
  "Owners cannot directly publish their drafts",
);
response = await decide("admin", "change", changeA);
check(response.ok, "A moderator can approve a current validated draft");
check(
  googleCalls.at(-1).persist === false,
  "Draft identity checks cannot overwrite the live Google cache before the transaction",
);
const approved = db.prepare("SELECT * FROM workshops WHERE id=?").get(first.id);
check(
  approved.description.includes("fictional operator") &&
    approved.status === firstBefore.status &&
    approved.sources === firstBefore.sources &&
    approved.name === firstBefore.name &&
    approved.address === firstBefore.address,
  "Approval changes only permitted fields and preserves provenance, identity and publication status",
);
check(
  db.prepare("SELECT status FROM workshop_changes WHERE id=?").get(changeA)
    .status === "approved",
  "Owners see the successful approval decision",
);
check(
  (await decide("admin", "change", changeA)).status === 409,
  "A stale repeated decision cannot publish twice",
);
const ownerHours = {
  week: Array.from({ length: 7 }, () => ({
    mode: "open",
    intervals: [
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ],
  })),
  exceptions: [{ date: "2026-12-25", day: { mode: "closed" } }],
};
const largeHours = {
  week: ownerHours.week.map((day) => ({
    mode: "open",
    intervals: [
      { start: "08:00", end: "10:00" },
      { start: "10:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ],
  })),
  exceptions: Array.from({ length: 60 }, (_, i) => ({
    date: new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10),
    day: {
      mode: "open",
      intervals: [
        { start: "08:00", end: "10:00" },
        { start: "10:00", end: "12:00" },
        { start: "13:00", end: "18:00" },
      ],
    },
  })),
};
const largeProfile = {
  ...profile(first),
  description: "Ж".repeat(2000),
  serviceDetails: Array(30).fill("Ж".repeat(200)),
  openingHours: largeHours,
};
check(
  new TextEncoder().encode(JSON.stringify(largeProfile)).length > 16000,
  "Maximum valid hours and profile exceed the old body limit",
);
const largeChange = await change("a", first.id, largeProfile);
check(
  largeChange.status === 201,
  "A bounded complete profile with 60 exceptions is accepted",
);
check(
  (await decide("admin", "change", (await largeChange.json()).id, "rejected"))
    .ok,
  "The maximum-size fixture draft can be rejected without publication",
);
for (const openingHours of [
  { week: [], exceptions: [] },
  {
    ...ownerHours,
    week: [
      { mode: "open", intervals: [{ start: "18:00", end: "08:00" }] },
      ...ownerHours.week.slice(1),
    ],
  },
  {
    ...ownerHours,
    exceptions: [ownerHours.exceptions[0], ownerHours.exceptions[0]],
  },
])
  check(
    (await change("a", first.id, { ...profile(first), openingHours }))
      .status === 400,
    "Invalid owner hours are rejected at the server boundary",
  );
check(
  (await change("b", first.id, { ...profile(first), openingHours: ownerHours }))
    .status === 403,
  "Hours follow verified ownership",
);
let hoursResponse = await change("a", first.id, {
  ...profile((await directory.listWorkshops()).find((w) => w.id === first.id)),
  openingHours: ownerHours,
});
const hoursChange = (await hoursResponse.json()).id;
check(hoursResponse.status === 201, "Owner can submit opening hours");
check(
  (await directory.listWorkshops()).find((w) => w.id === first.id)
    .openingHours === null,
  "Pending hours stay private",
);
check(
  (await decide("admin", "change", hoursChange)).ok,
  "Moderator can approve hours",
);
const hoursPublished = (await directory.listWorkshops()).find(
  (w) => w.id === first.id,
);
assert.deepEqual(hoursPublished.openingHours, ownerHours);
check(
  !!hoursPublished.openingHoursConfirmedAt,
  "Published hours have a server-controlled confirmation date",
);
const legacyResponse = await change("a", first.id, profile(hoursPublished));
check(legacyResponse.status === 201, "Legacy drafts may omit hours");
check(
  (await decide("admin", "change", (await legacyResponse.json()).id)).ok,
  "Legacy draft approval preserves existing hours",
);
assert.deepEqual(
  (await directory.listWorkshops()).find((w) => w.id === first.id).openingHours,
  ownerHours,
);
db.prepare(
  "INSERT INTO workshop_opening_hours_imports(workshop_id,opening_hours) VALUES(?,?)",
).run(first.id, JSON.stringify(ownerHours));
let clearing = await change("a", first.id, {
  ...profile((await directory.listWorkshops()).find((w) => w.id === first.id)),
  openingHours: null,
});
check(
  (await decide("admin", "change", (await clearing.json()).id)).ok,
  "Explicit removal approved",
);
const removedHours = (await directory.listWorkshops()).find(
  (w) => w.id === first.id,
);
assert.equal(removedHours.openingHours, null);
assert.equal(removedHours.importedOpeningHours, null);
assert.equal(
  db
    .prepare(
      "SELECT suppressed FROM workshop_opening_hours_imports WHERE workshop_id=?",
    )
    .get(first.id).suppressed,
  1,
);
let latest = (await directory.listWorkshops()).find((w) => w.id === first.id);
response = await change("a", first.id, {
  ...profile(latest),
  phone: "+383441234567",
});
changeA = (await response.json()).id;
googleAvailable = false;
const cachedBeforeFailure = db
  .prepare("SELECT * FROM workshop_google_places WHERE workshop_id=?")
  .get(first.id);
check(
  (await decide("admin", "change", changeA)).status === 422,
  "Changed telephone identity needs a new confirmed Google match",
);
check(
  db.prepare("SELECT phone FROM workshops WHERE id=?").get(first.id).phone ===
    latest.phone,
  "Failed identity checks preserve the approved public contact",
);
assert.deepEqual(
  db
    .prepare("SELECT * FROM workshop_google_places WHERE workshop_id=?")
    .get(first.id),
  cachedBeforeFailure,
);
passed++;
googleAvailable = true;
response = await decide("admin", "change", changeA, "rejected");
check(
  response.ok,
  "A failed identity draft can be rejected with an explanation",
);
body = await state("a").then((r) => r.json());
check(
  body.changes.find((change) => change.id === changeA).status === "rejected" &&
    body.changes.find((change) => change.id === changeA).moderatorNote,
  "The operator receives rejection status and reason",
);
latest = (await directory.listWorkshops()).find((w) => w.id === first.id);
response = await change("a", first.id, profile(latest));
changeA = (await response.json()).id;
db.prepare("UPDATE workshops SET updated_at=? WHERE id=?").run(
  "2099-01-01T00:00:00Z",
  first.id,
);
check(
  (await decide("admin", "change", changeA)).status === 409,
  "Approval never overwrites a more recent administrative revision",
);
await decide("admin", "change", changeA, "rejected");
db.prepare("UPDATE workshops SET updated_at=? WHERE id=?").run(
  latest.updatedAt,
  first.id,
);
// A confirmed legacy assignment is accessible only through the session’s owner keys.
response = await claim("a", second.id);
const secondClaim = (await response.json()).id;
await decide("admin", "claim", secondClaim);
db.prepare("UPDATE workshop_owners SET account_id=? WHERE workshop_id=?").run(
  "legacy-a",
  second.id,
);
db.prepare(
  "INSERT INTO auth_links (account_id,legacy_owner,created_at) VALUES (?,'legacy-a','2026-10-04')",
).run(actors.a.userId);
actors.a = { ...actors.a, ownerKeys: [actors.a.userId, "legacy-a"] };
response = await change("a", second.id, profile(second));
const legacyChange = (await response.json()).id;
check(
  response.ok && (await decide("admin", "change", legacyChange)).ok,
  "A verified legacy owner key authorizes drafts and their moderation without reassigning account identity",
);
actors.a = { ...actors.a, ownerKeys: [actors.a.userId] };
check(
  (await change("a", second.id, profile(second))).status === 403,
  "A session without legacy access cannot use a historical link to edit the profile",
);
response = await claim("b", third.id);
const blockedClaim = (await response.json()).id;
db.prepare(
  "INSERT INTO auth_account_status VALUES (?,'inactive','2026-10-04')",
).run(actors.b.userId);
check(
  (await decide("admin", "claim", blockedClaim)).status === 409 &&
    !db
      .prepare("SELECT workshop_id FROM workshop_owners WHERE workshop_id=?")
      .get(third.id),
  "A blocked applicant cannot receive confirmed ownership",
);
db.prepare("DELETE FROM auth_account_status WHERE account_id=?").run(
  actors.b.userId,
);
// Concurrent duplicate submission is protected in the INSERT, not just in the UI.
const duplicates = await Promise.all([
  claim("c", fourth.id),
  claim("c", fourth.id),
]);
check(
  duplicates.filter((r) => r.ok).length === 1,
  "Concurrent identical claims produce only one pending record",
);
const delegated = { ...actors.admin, email: "delegated@example.test" };
actors.delegated = delegated;
db.prepare(
  "INSERT INTO auth_account_roles VALUES (?,'admin','2026-10-04','fixture-owner')",
).run(delegated.userId);
const duplicateClaim = db
  .prepare(
    "SELECT id FROM workshop_claims WHERE workshop_id=? AND status='pending'",
  )
  .get(fourth.id).id;
beforeBatch = () =>
  db
    .prepare("DELETE FROM auth_account_roles WHERE account_id=?")
    .run(delegated.userId);
check(
  (await decide("delegated", "claim", duplicateClaim)).status === 409 &&
    !db
      .prepare("SELECT workshop_id FROM workshop_owners WHERE workshop_id=?")
      .get(fourth.id),
  "Authority removed between read and commit cannot confirm ownership",
);
// Async identity hashing can reorder transaction arrival. Both Google results
// may legitimately win; a late loser must preserve the actual winner's data.
for (const winningValidation of [1, 2]) {
  latest = (await directory.listWorkshops()).find((w) => w.id === first.id);
  response = await change("a", first.id, {
    ...profile(latest),
    description: latest.description + " Concurrent operator approval fixture.",
  });
  const concurrentChange = (await response.json()).id;
  let validationSequence = 0,
    ready;
  const bothBatches = new Promise((resolve) => {
      ready = resolve;
    }),
    batches = [];
  globalThis.fixtureConfirmPlace = async () =>
    `ChIJConcurrentOperatorResult${++validationSequence}`;
  holdBatch = (statements, execute) =>
    new Promise((resolve, reject) => {
      batches.push({
        values: statements.flatMap((statement) => statement.fixtureValues),
        execute: () => execute().then(resolve, reject),
      });
      if (batches.length === 2) ready();
    });
  const originalNow = Date.now,
    fixedTime = Date.parse(latest.updatedAt) + 1;
  Date.now = () => fixedTime;
  try {
    const notes = [
      "Concurrent decision from request A.",
      "Concurrent decision from request B.",
    ];
    const attempts = notes.map((note) =>
      decide("admin", "change", concurrentChange, "approved", 0, note),
    );
    await bothBatches;
    const placeId = `ChIJConcurrentOperatorResult${winningValidation}`,
      winner = batches.find((batch) => batch.values.includes(placeId)),
      loser = batches.find((batch) => batch !== winner);
    assert(
      winner && loser,
      "Both real SQLite transactions must reach the controlled admission point",
    );
    check(
      batches.every((batch) =>
        batch.values.includes(new Date(fixedTime).toISOString()),
      ),
      "Both prepared decisions share the exact publication timestamp",
    );
    const winnerNote = notes.find((note) => winner.values.includes(note));
    await winner.execute();
    const winnerResponse = await attempts[notes.indexOf(winnerNote)];
    check(
      winnerResponse.status === 200,
      "The deliberately admitted transaction wins moderation",
    );
    const readWinner = () => ({
      change: db
        .prepare("SELECT * FROM workshop_changes WHERE id=?")
        .get(concurrentChange),
      profile: db.prepare("SELECT * FROM workshops WHERE id=?").get(first.id),
      place: db
        .prepare("SELECT * FROM workshop_google_places WHERE workshop_id=?")
        .get(first.id),
      rating: db
        .prepare("SELECT * FROM workshop_google_ratings WHERE workshop_id=?")
        .get(first.id),
    });
    const committed = readWinner();
    check(
      committed.change.moderator_note === winnerNote &&
        committed.change.revision === 1 &&
        typeof committed.change.decision_token === "string",
      "The actual winner owns the decision revision and operation token",
    );
    check(
      committed.profile.updated_at === new Date(fixedTime).toISOString(),
      "Both candidates use the same publication timestamp",
    );
    check(
      committed.place.place_id === placeId &&
        new URL(committed.rating.maps_url).searchParams.get(
          "query_place_id",
        ) === placeId,
      "Google identity and Maps URL come from the winning transaction",
    );
    await loser.execute();
    const concurrentDecisions = await Promise.all(attempts);
    check(
      concurrentDecisions.filter((response) => response.status === 200)
        .length === 1 &&
        concurrentDecisions.filter((response) => response.status === 409)
          .length === 1,
      "Concurrent moderation approves exactly one candidate and rejects its stale competitor",
    );
    assert.deepEqual(
      readWinner(),
      committed,
      "A losing optimistic decision cannot overwrite the winner’s profile, audit data or Google identity",
    );
    passed++;
  } finally {
    Date.now = originalNow;
    holdBatch = null;
  }
}
// Per-address verification stays moderated and fenced by the profile revision.
latest = (await directory.listWorkshops()).find((w) => w.id === first.id);
const emailEntries = [
  { address: "prishtina@example.test", active: true, verified: true },
  { address: "ferizaj@example.test", active: true, verified: true },
  { address: "old@example.test", active: false, verified: false },
];
for (const invalid of [
  [{ address: "invalid", active: true, verified: false }],
  Array.from({ length: 11 }, (_, i) => ({
    address: `mail${i}@example.test`,
    active: true,
    verified: false,
  })),
  [
    { address: "same@example.test", active: true, verified: false },
    { address: "SAME@example.test", active: false, verified: true },
  ],
])
  check(
    (await change("a", first.id, { ...profile(latest), emailEntries: invalid }))
      .status === 400,
    "Email contracts reject malformed, excessive and case-insensitive duplicate addresses",
  );
check(
  (await change("b", first.id, { ...profile(latest), emailEntries })).status ===
    403,
  "Foreign owners cannot replace or verify contacts",
);
response = await change("a", first.id, { ...profile(latest), emailEntries });
const emailChange = (await response.json()).id;
check(
  response.status === 201 &&
    db
      .prepare("SELECT editorial_emails FROM workshops WHERE id=?")
      .get(first.id).editorial_emails === null,
  "Pending email verification cannot publish contacts",
);
check(
  (await decide("admin", "change", emailChange)).status === 200,
  "The existing moderation decision publishes the per-address list",
);
latest = (await directory.listWorkshops()).find((w) => w.id === first.id);
assert.deepEqual(
  latest.emails,
  emailEntries.filter((e) => e.active).map((e) => e.address),
);
check(
  latest.emailContacts.length === 2 &&
    latest.emailContacts.every((e) => e.verified) &&
    !Object.hasOwn(latest, "editableEmailContacts"),
  "Public responses expose both verified active addresses and hide inactive contacts",
);
const ownedEmail = (await state("a").then((r) => r.json())).workshops.find(
  (w) => w.id === first.id,
);
assert.deepEqual(
  ownedEmail.editableEmailContacts,
  emailEntries,
  "The owner can edit and reactivate inactive addresses",
);
passed++;
response = await change("a", first.id, { ...profile(latest), emailEntries });
const unchangedEmails = (await response.json()).id;
check(
  !Object.hasOwn(
    JSON.parse(
      db
        .prepare("SELECT profile FROM workshop_changes WHERE id=?")
        .get(unchangedEmails).profile,
    ),
    "emailEntries",
  ),
  "Unchanged contact lists are omitted server-side",
);
await decide("admin", "change", unchangedEmails, "rejected");
globalThis.fixtureUser = actors.admin;
response = await workshops.PATCH(
  request(
    "PATCH",
    { ...latest, previousUpdatedAt: latest.updatedAt, emailEntries: [] },
    {},
    "/api/workshops",
  ),
);
check(
  response.status === 200 &&
    db
      .prepare("SELECT editorial_emails FROM workshops WHERE id=?")
      .get(first.id).editorial_emails === "[]",
  "Administration can explicitly remove all contacts",
);
latest = (await directory.listWorkshops()).find((w) => w.id === first.id);
const importedBefore = db
  .prepare(
    "SELECT count(*) AS n FROM workshop_email_addresses WHERE workshop_id=?",
  )
  .get(first.id).n;
db.prepare(
  "INSERT INTO workshop_email_addresses VALUES (?,?,?,?,?,?,?,?,?,?)",
).run(
  first.id,
  "new-research@example.test",
  "new-research@example.test",
  '["https://workshop.example.test/contact"]',
  "2026-10-13",
  0,
  latest.name,
  latest.phone,
  latest.city,
  "fixture-email-import",
);
check(
  (await directory.listWorkshops()).find((w) => w.id === first.id).emails
    .length === 0,
  "Later research cannot resurrect explicitly removed email contacts",
);
response = await workshops.PATCH(
  request(
    "PATCH",
    { ...latest, previousUpdatedAt: latest.updatedAt, emailEntries },
    {},
    "/api/workshops",
  ),
);
check(
  response.status === 200,
  "Administration can verify several contacts in one revision",
);
check(
  (
    await workshops.PATCH(
      request(
        "PATCH",
        { ...latest, previousUpdatedAt: latest.updatedAt, emailEntries: [] },
        {},
        "/api/workshops",
      ),
    )
  ).status === 409,
  "A stale administration save cannot clear a newer verified list",
);
latest = (await directory.listWorkshops()).find((w) => w.id === first.id);
response = await change("a", first.id, {
  ...profile(latest),
  emailEntries: [],
});
const racedEmailChange = (await response.json()).id;
beforeBatch = () =>
  db
    .prepare(
      "UPDATE workshops SET updated_at='2099-01-01',editorial_emails=? WHERE id=?",
    )
    .run(JSON.stringify(emailEntries), first.id);
check(
  (await decide("admin", "change", racedEmailChange)).status === 409,
  "A concurrent profile revision fences the email moderation transaction",
);
assert.deepEqual(
  JSON.parse(
    db
      .prepare("SELECT editorial_emails FROM workshops WHERE id=?")
      .get(first.id).editorial_emails,
  ),
  emailEntries,
);
passed++;
check(
  db
    .prepare(
      "SELECT count(*) AS n FROM workshop_email_addresses WHERE workshop_id=?",
    )
    .get(first.id).n ===
    importedBefore + 1,
  "Editorial actions preserve private research evidence",
);
const deleteAuth = {
  projectUrl,
  provider: "supabase",
  client: { deleteUser: async () => ({ error: null }) },
};
await cleanup.deleteAccount(deleteAuth, aId);
check(
  ![...objects.keys()].some((key) =>
    key.startsWith("evidence/" + actors.a.userId + "/"),
  ) &&
    db
      .prepare("SELECT COUNT(*) AS n FROM evidence_uploads WHERE owner=?")
      .get(actors.a.userId).n === 0,
  "Account deletion removes claim documents and failed-upload inventory",
);
check(
  db
    .prepare("SELECT COUNT(*) AS n FROM workshop_claims WHERE owner=?")
    .get(actors.a.userId).n === 0 &&
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM workshop_changes WHERE owner IN (?,?)",
      )
      .get(actors.a.userId, "legacy-a").n === 0,
  "Account deletion removes private ownership evidence and drafts, including linked legacy records",
);
check(
  !db
    .prepare(
      "SELECT workshop_id FROM workshop_owners WHERE account_id IN (?,?)",
    )
    .get(actors.a.userId, "legacy-a"),
  "Deleted accounts retain no confirmed workshop rights",
);
check(
  db.prepare("SELECT id FROM workshops WHERE id=?").get(first.id),
  "Account deletion preserves independently maintained public workshop catalogue records",
);
// Complete moderation/history queues use stable keyset pagination.
db.prepare("DELETE FROM workshop_claims").run();
for (let index = 0; index < 101; index++)
  db.prepare(
    "INSERT INTO workshop_claims (id,workshop_id,owner,evidence,created_at,status) VALUES (?,?,?,?,?,?)",
  ).run(
    `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    first.id,
    actors.c.userId,
    evidence,
    "2026-10-04T12:00:00Z",
    "pending",
  );
globalThis.fixtureUser = actors.admin;
let seen = [];
let cursor = null;
do {
  const url = new URL(origin + "/api/business");
  url.searchParams.set("moderation", "1");
  if (cursor) url.searchParams.set("claimCursor", cursor);
  const page = await route
    .GET(new Request(url))
    .then((response) => response.json());
  seen.push(...page.claims.map((claim) => claim.id));
  cursor = page.nextClaimCursor;
} while (cursor);
check(
  seen.length === 101 &&
    new Set(seen).size === 101 &&
    seen.includes("00000000-0000-4000-8000-000000000000"),
  "Every pending claim remains reachable beyond the first hundred, including equal timestamps",
);
db.prepare(
  "UPDATE workshop_claims SET status='approved' WHERE id<>'00000000-0000-4000-8000-000000000000'",
).run();
globalThis.fixtureUser = actors.c;
seen = [];
cursor = null;
do {
  const url = new URL(origin + "/api/business");
  if (cursor) url.searchParams.set("claimCursor", cursor);
  const page = await route
    .GET(new Request(url))
    .then((response) => response.json());
  seen.push(...page.claims);
  cursor = page.nextClaimCursor;
} while (cursor);
check(
  seen.length === 101 &&
    seen.find((claim) => claim.id === "00000000-0000-4000-8000-000000000000")
      .status === "pending",
  "An applicant can still reach an older pending request beneath more than one hundred history entries",
);
body = await state("c").then((response) => response.json());
check(
  body.claims.length === 50 &&
    !body.claims.some((claim) => claim.status === "pending") &&
    body.pendingClaims?.some(
      (claim) =>
        claim.id === "00000000-0000-4000-8000-000000000000" &&
        claim.workshopName === first.name,
    ),
  "Current pending claims are authoritative even beneath more than one hundred history records",
);
response = await claim("c", second.id);
const currentClaim = (await response.json()).id;
await decide("admin", "claim", currentClaim);
const ownedSecond = (await directory.listWorkshops()).find(
  (workshop) => workshop.id === second.id,
);
response = await change("c", second.id, profile(ownedSecond));
const hiddenChange = (await response.json()).id;
for (let index = 0; index < 100; index++)
  db.prepare(
    "INSERT INTO workshop_changes (id,workshop_id,owner,profile,base_updated_at,created_at,status) VALUES (?,?,?,?,?,?,?)",
  ).run(
    `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    second.id,
    actors.c.userId,
    JSON.stringify(profile(ownedSecond)),
    ownedSecond.updatedAt,
    "2099-01-01T00:00:00Z",
    "approved",
  );
body = await state("c").then((response) => response.json());
check(
  body.changes.length === 50 &&
    !body.changes.some((change) => change.id === hiddenChange) &&
    body.pendingChangeWorkshopIds?.includes(second.id) &&
    body.pendingChangeRequestIds?.includes(hiddenChange),
  "Owned profiles retain their current pending change lock independently from change history pagination",
);
await decide("admin", "change", hiddenChange, "rejected");
body = await state("c").then((response) => response.json());
check(
  !body.pendingChangeRequestIds.includes(hiddenChange) &&
    !body.pendingChangeWorkshopIds.includes(second.id),
  "Current change identifiers remove a decided request and its edit lock",
);
response = await change("c", second.id, profile(ownedSecond));
const replacementChange = (await response.json()).id;
body = await state("c").then((response) => response.json());
check(
  body.pendingChangeRequestIds.includes(replacementChange) &&
    !body.pendingChangeRequestIds.includes(hiddenChange) &&
    body.pendingChangeWorkshopIds.includes(second.id),
  "A pending replacement has its own current request identity even on the same workshop",
);
body = await state("b").then((response) => response.json());
check(
  body.pendingClaims?.length === 0 &&
    body.pendingChangeWorkshopIds?.length === 0 &&
    body.pendingChangeRequestIds?.length === 0,
  "Current request summaries cannot expose another account’s claims or owned profile changes",
);
check(
  (await route.GET(new Request(origin + "/api/business?claimCursor=invalid")))
    .status === 400,
  "Malformed pagination is an input error",
);
failDb = true;
check(
  (await state("admin", true)).status === 503,
  "Storage failure does not expose an incomplete private review queue",
);
failDb = false;
const uploadWorkshop = publicProfiles[5];
for (const [type, bytes] of [
  ["image/png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
  ["image/jpeg", new Uint8Array([255, 216, 255, 0])],
]) {
  const uploaded = await upload(
    "c",
    uploadWorkshop.id,
    new File([bytes], "fixture-image", { type }),
  );
  check(
    uploaded.status === 201,
    "PNG and JPEG documents use the same private upload contract",
  );
  const id = (await uploaded.json()).id;
  await decide("admin", "claim", id, "rejected");
}
// Deletion overtakes an in-flight payload; its removed reservation cannot be recreated.
const foreignKeys = [...objects.keys()].filter(
  (key) => !key.startsWith("evidence/" + actors.c.userId + "/"),
);
uploadHook = () => {
  uploadHook = () => cleanup.deleteAccount(deleteAuth, cId);
};
const late = await upload("c", uploadWorkshop.id, [pdf(), pdf()]);
check(
  late.status === 409 &&
    objects.size === foreignKeys.length &&
    foreignKeys.every((key) => objects.has(key)),
  "Concurrent account deletion fences a delayed claim payload and removes all private objects",
);
check(
  db
    .prepare("SELECT COUNT(*) AS n FROM workshop_claims WHERE owner=?")
    .get(actors.c.userId).n === 0,
  "Deleted applicants cannot persist a claim after the upload completes",
);
console.log(
  JSON.stringify({
    businessContractChecksPassed: passed,
    liveProviderCalls: false,
    productionTouched: false,
  }),
);
