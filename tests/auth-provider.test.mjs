import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
const { build } = createRequire(new URL("../package.json", import.meta.url))(
  "esbuild",
);
const output = ".test-runtime/auth-provider";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    contents:
      "export * from './lib/auth/config'; export * from './lib/auth/admin'; export * from './lib/auth/identities'; export * from './lib/auth/password-proof'; export * from './lib/auth/provider'; export * from './app/auth'; export {POST as authPost} from './app/api/auth/[action]/route'; export {GET as callback} from './app/auth/bestaetigen/route'; export {GET as listUsers,POST as addUser} from './app/api/users/route'; export {PATCH as editUser,DELETE as removeUser} from './app/api/users/[id]/route'; export {POST as saveAuthSettings} from './app/api/auth-settings/route';",
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  packages: "external",
  plugins: [
    {
      name: "auth-protocol-fixture",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(cloudflare:workers|next\/headers|\.\/chatgpt-auth|@\/app\/chatgpt-auth)$/,
          },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          loader: "js",
          contents:
            args.path === "cloudflare:workers"
              ? "export const env=globalThis.fixtureEnv;"
              : args.path === "next/headers"
                ? 'export async function cookies(){return globalThis.fixtureCookies;}export async function headers(){return new Headers({host:"riparim.example.test"});}'
                : "export async function getChatGPTUser(){return null;}",
        }));
      },
    },
  ],
});
await writeFile(output + "/auth.mjs", bundle.outputFiles[0].contents);
const db = new DatabaseSync(":memory:");
for (const file of (await readdir("drizzle"))
  .filter((file) => file.endsWith(".sql"))
  .sort())
  db.exec(await readFile("drizzle/" + file, "utf8"));
const d1 = {
  prepare(sql) {
    const s = db.prepare(sql);
    const adapter = (values = []) => ({
      bind: (...next) => adapter(next),
      first: async () => s.get(...values) ?? null,
      all: async () => ({ results: s.all(...values) }),
      run: async () => ({ meta: s.run(...values) }),
    });
    return adapter();
  },
  async batch(statements) {
    db.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      db.exec("COMMIT");
      return results;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },
};
const alternate = "https://auth.fixture.example:8443",
  alternateNext = "https://auth.fixture.example:9443",
  hosted = "https://fixture-project.supabase.co",
  key = "sb_publishable_fixture_public_key_1234567890";
globalThis.fixtureEnv = {
  DB: d1,
  BUCKET: {
    async list() {
      return { objects: [], truncated: false };
    },
    async delete() {},
  },
  SITE_ORIGIN: "https://riparim.example.test",
  AUTH_TRUSTED_ORIGIN: alternate,
  SUPABASE_SECRET_KEY: "sb_secret_fixture_server_secret",
};
const auth = await import(
  new URL("../" + output + "/auth.mjs", import.meta.url)
);
assert.equal(
  auth.validatePublicConfig(alternate, key).projectUrl,
  alternate,
  "An exact runtime-approved alternative HTTPS origin is supported",
);
for (const url of [
  "https://untrusted.example",
  "http://auth.fixture.example:8443",
  alternate + "/auth/v1",
  alternate + "/?next=evil",
  alternate + "/#evil",
  "https://user:password@auth.fixture.example:8443",
  "https://auth.fixture.example",
  "https://auth.fixture.example:8444",
])
  assert.throws(() => auth.validatePublicConfig(url, key));
assert.equal(
  auth.validatePublicConfig(hosted, key).projectUrl,
  hosted,
  "Existing hosted Supabase configuration remains supported",
);
db.prepare(
  "INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at) VALUES ('main',?,?,1,1,?)",
).run(alternate, key, "2026-10-11");
assert.equal(
  await auth.getAuthAdmin(),
  null,
  "Existing server credentials cannot be sent to a newly approved alternate origin without explicit credential binding",
);
globalThis.fixtureEnv.SUPABASE_SECRET_KEY_ORIGIN = hosted;
assert.equal(
  await auth.getAuthAdmin(),
  null,
  "A server credential bound to the old project cannot target the alternate host",
);
assert.throws(
  () =>
    auth.createAuthAdminClient(
      { provider: "supabase", projectUrl: alternate },
      globalThis.fixtureEnv.SUPABASE_SECRET_KEY,
    ),
  /AUTH_SECRET_ORIGIN_MISMATCH/,
  "Direct adapter construction also enforces credential binding",
);
globalThis.fixtureEnv.SUPABASE_SECRET_KEY_ORIGIN = alternate;
assert.equal(
  (await auth.getAuthAdmin()).projectUrl,
  alternate,
  "Explicit matching runtime credential binding enables alternate administration",
);

const id = "00000000-0000-4000-8000-000000000001",
  newId = "00000000-0000-4000-8000-000000000002",
  origin = globalThis.fixtureEnv.SITE_ORIGIN;
const cookieMap = new Map(),
  cookieOptions = new Map();
globalThis.fixtureCookies = {
  getAll: () => [...cookieMap].map(([name, value]) => ({ name, value })),
  get: (name) =>
    cookieMap.has(name) ? { value: cookieMap.get(name) } : undefined,
  set(name, value, options) {
    cookieOptions.set(name, options);
    if (options?.maxAge === 0) cookieMap.delete(name);
    else cookieMap.set(name, value);
  },
};
const member = {
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "member@example.test",
  email_confirmed_at: "2026-10-11T00:00:00Z",
  created_at: "2026-10-11T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Fixture Member", role: "admin", is_admin: true },
  identities: [],
};
const members = new Map([[id, member]]),
  tokens = new Map(),
  requests = [];
let nextSession = 0,
  redirectAdmin = false,
  redirectRecovery = false,
  failUser = false,
  claimsSubject = null,
  providerBlocked = false,
  googleProof = false,
  wrongAdminSubject = false,
  sessionOverride = null,
  amrOverride = undefined,
  wrongWriteSubject = false,
  wrongDeleteSubject = false;
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
function session(method = "password") {
  const header = encode({ alg: "HS256", typ: "JWT" }),
    payload = encode({
      sub: claimsSubject ?? id,
      iss: alternate + "/auth/v1",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      session_id: sessionOverride ?? "sdk-session-" + ++nextSession,
      ...(amrOverride === null ? {} : { amr: amrOverride ?? [{ method }] }),
    });
  const signature = createHmac("sha256", "isolated-fixture-key")
      .update(header + "." + payload)
      .digest("base64url"),
    access_token = header + "." + payload + "." + signature;
  tokens.set(access_token, id);
  return {
    access_token,
    refresh_token: "fixture-refresh-" + nextSession,
    token_type: "bearer",
    expires_in: 3600,
    user: members.get(id),
    ...(method === "oauth" ? { provider_token: "fixture-google-proof" } : {}),
  };
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://fixture"),
    chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = chunks.length
    ? JSON.parse(Buffer.concat(chunks).toString())
    : null;
  requests.push({
    path: url.pathname,
    query: url.searchParams,
    method: request.method,
    headers: request.headers,
    body,
  });
  const json = (value, status = 200) => {
    response.writeHead(status, {
      "content-type": "application/json",
      "x-supabase-api-version": "2024-01-01",
    });
    response.end(JSON.stringify(value));
  };
  const deny = () =>
    json({ msg: "Fixture authorization denied", error_code: "bad_jwt" }, 401);
  if (url.pathname === "/auth/v1/settings")
    return json({
      external: { email: true, google: true },
      mailer_autoconfirm: false,
      disable_signup: false,
    });
  if (url.pathname.startsWith("/auth/v1/admin/")) {
    if (request.headers.apikey !== globalThis.fixtureEnv.SUPABASE_SECRET_KEY)
      return deny();
    if (redirectAdmin) {
      response.writeHead(307, {
        location: "https://untrusted.example/auth/v1/admin/users",
      });
      return response.end();
    }
    const subject = url.pathname.split("/").at(-1);
    if (url.pathname === "/auth/v1/admin/users") {
      if (request.method === "GET")
        return json({ users: [...members.values()], total: members.size });
      const created = {
        ...member,
        ...body,
        id: newId,
        email_confirmed_at: "2026-10-11T00:00:00Z",
      };
      members.set(newId, created);
      return json(created);
    }
    const found = members.get(subject);
    if (!found)
      return json(
        { msg: "Fixture missing", error_code: "user_not_found" },
        404,
      );
    if (request.method === "PUT") {
      Object.assign(found, body);
      return json(wrongWriteSubject ? { ...found, id: id } : found);
    }
    if (request.method === "DELETE") {
      members.delete(subject);
      return json(wrongDeleteSubject ? { ...found, id: id } : found);
    }
    return json(
      wrongAdminSubject
        ? { ...found, id: newId, email: "foreign@example.test" }
        : found,
    );
  }
  if (url.pathname === "/auth/v1/token") {
    if (
      url.searchParams.get("grant_type") === "password" &&
      body.password !== "fixture-password-123"
    )
      return json(
        {
          msg: "Fixture invalid credentials",
          error_code: "invalid_credentials",
        },
        400,
      );
    if (url.searchParams.get("grant_type") === "pkce")
      return json(session("oauth"));
    return json(session());
  }
  if (url.pathname === "/auth/v1/signup")
    return json({
      ...member,
      email: body.email,
      email_confirmed_at: null,
      user_metadata: body.data,
    });
  if (url.pathname === "/auth/v1/recover") {
    if (redirectRecovery) {
      response.writeHead(307, {
        location: "https://untrusted.example/auth/v1/recover",
      });
      return response.end();
    }
    return json({});
  }
  if (url.pathname === "/auth/v1/verify")
    return json(session(body.type === "recovery" ? "recovery" : "password"));
  if (url.pathname === "/auth/v1/user") {
    if (
      failUser ||
      !tokens.has(request.headers.authorization?.replace(/^Bearer /, ""))
    )
      return deny();
    const verified = {
      ...members.get(id),
      ...(providerBlocked ? { banned_until: "2999-01-01T00:00:00Z" } : {}),
    };
    if (request.method === "PUT") Object.assign(members.get(id), body);
    return json(verified);
  }
  if (url.pathname === "/auth/v1/logout") {
    tokens.delete(request.headers.authorization?.replace(/^Bearer /, ""));
    response.writeHead(204);
    return response.end();
  }
  return json({ msg: "Unimplemented fixture endpoint" }, 404);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const transportOrigin = "http://127.0.0.1:" + server.address().port,
  originalFetch = globalThis.fetch;
let googleRequests = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === "https://openidconnect.googleapis.com") {
    assert(googleProof);
    assert.equal(init.headers.Authorization, "Bearer fixture-google-proof");
    googleRequests++;
    return Response.json({
      sub: "fixture-google-member",
      email: member.email,
      email_verified: true,
    });
  }
  assert(
    [alternate, alternateNext].includes(url.origin),
    "All SDK calls target a fixture HTTPS auth origin",
  );
  assert.equal(
    init.redirect,
    "manual",
    "Native HTTP transport must inspect redirects without sending credentials elsewhere",
  );
  return originalFetch(
    new URL(url.pathname + url.search, transportOrigin),
    init,
  );
};
const post = (action, body = {}) =>
  auth.authPost(
    new Request(origin + "/api/auth/" + action, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ action }) },
  );
const apiRequest = (path, method, body) =>
  new Request(origin + path, {
    method,
    headers: { origin, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const context = (subject) => ({ params: Promise.resolve({ id: subject }) });
try {
  // A reviewed migration maps exact identities; equal email or metadata never links accounts.
  const source = auth.supabaseIdentity(hosted, id),
    target = auth.supabaseIdentity(alternate, id),
    stable = await auth.resolveAccount(source);
  assert.equal(
    await auth.linkAccountIdentity(
      source,
      target,
      async (identity) =>
        [hosted, alternate].includes(identity.issuer) &&
        identity.subject === id,
    ),
    stable,
  );
  assert.equal(
    (
      await post("login", {
        email: member.email,
        password: "fixture-password-123",
        returnTo: "https://untrusted.example",
      })
    ).status,
    200,
  );
  let current = await auth.getAppUser();
  assert.equal(current.userId, stable);
  assert.equal(
    current.isModerator,
    false,
    "Editable role metadata cannot grant admin access",
  );
  let enrollment = db
    .prepare("SELECT * FROM auth_sessions ORDER BY created_at DESC")
    .get();
  assert.equal(enrollment.identity_issuer, alternate);
  assert.equal(enrollment.identity_subject, id);
  assert.equal(enrollment.account_id, stable);
  assert(
    requests.filter((request) => request.path === "/auth/v1/user").length >= 2,
    "Real SDK obtains server-verified user and validates claims",
  );
  assert(
    [...cookieOptions.values()].some(
      (options) =>
        options.httpOnly && options.secure && options.sameSite === "lax",
    ),
    "SDK session cookies stay private and secure",
  );
  assert.equal(
    (await post("login", { email: member.email, password: "wrong-password" }))
      .status,
    401,
  );
  assert.equal(
    await auth.verifyPassword(
      await auth.getAuthConfig(),
      id,
      member.email,
      "fixture-password-123",
    ),
    true,
  );
  assert.equal(
    await auth.verifyPassword(
      await auth.getAuthConfig(),
      newId,
      member.email,
      "fixture-password-123",
    ),
    false,
    "Reauth cannot authorize a different identity",
  );
  assert.equal(
    (await auth.getAppUser()).userId,
    stable,
    "Isolated proof sessions never replace enrolled browser session",
  );
  claimsSubject = newId;
  assert.equal(
    (
      await post("login", {
        email: member.email,
        password: "fixture-password-123",
      })
    ).status,
    503,
  );
  assert(
    !db
      .prepare("SELECT id FROM auth_sessions WHERE id=?")
      .get("sdk-session-" + nextSession),
    "Mismatched signed subject cannot enroll an app session",
  );
  claimsSubject = null;
  providerBlocked = true;
  assert.equal(await auth.getAppUser(), null);
  providerBlocked = false;
  failUser = true;
  assert.equal(
    await auth.getAppUser(),
    null,
    "Server verification failure denies a structurally valid JWT",
  );
  failUser = false;
  assert.equal(
    (await post("recovery", { email: " RECOVERY@example.test " })).status,
    200,
  );
  let recovery = requests.findLast(
    (request) => request.path === "/auth/v1/recover",
  );
  assert.equal(recovery.body.email, "recovery@example.test");
  assert(recovery.body.code_challenge);
  assert.equal(recovery.body.code_challenge_method, "s256");
  assert.equal(new URL(recovery.query.get("redirect_to")).origin, origin);
  let result = await auth.callback(
    new Request(
      origin +
        "/auth/bestaetigen?token_hash=fixture-recovery&type=recovery&weiter=%2Fpasswort-neu",
    ),
  );
  assert.equal(result.status, 303);
  assert.equal(
    new URL(result.headers.get("Location")).pathname,
    "/passwort-neu",
  );
  assert.equal(
    requests.findLast((request) => request.path === "/auth/v1/verify").body
      .token_hash,
    "fixture-recovery",
  );
  assert.equal(
    (await post("reset", { password: "fixture-new-password-123" })).status,
    200,
  );
  assert.equal(
    requests.findLast(
      (request) => request.path === "/auth/v1/user" && request.method === "PUT",
    ).body.password,
    "fixture-new-password-123",
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM auth_sessions WHERE revoked=0").get().n,
    0,
  );
  assert.equal(await auth.getAppUser(), null);
  assert.equal(
    (
      await post("register", {
        name: "Fixture Signup",
        email: "signup@example.test",
        password: "fixture-password-123",
      })
    ).status,
    200,
  );
  const signup = requests.findLast(
    (request) => request.path === "/auth/v1/signup",
  );
  assert.equal(signup.body.data.full_name, "Fixture Signup");
  assert.equal(new URL(signup.query.get("redirect_to")).origin, origin);
  result = await auth.callback(
    new Request(
      origin + "/auth/bestaetigen?token_hash=fixture-signup&type=signup",
    ),
  );
  assert.equal(new URL(result.headers.get("Location")).pathname, "/anmelden");
  // Actual SDK generates PKCE verifier cookie and consumes it at code exchange.
  result = await post("google", { returnTo: "//untrusted.example" });
  assert.equal(result.status, 200);
  const authorization = new URL((await result.json()).url);
  assert.equal(authorization.origin, alternate);
  assert.equal(authorization.pathname, "/auth/v1/authorize");
  assert(authorization.searchParams.get("code_challenge"));
  assert([...cookieMap.keys()].some((name) => name.includes("code-verifier")));
  globalThis.fixtureEnv.REVIEW_MODERATOR_EMAIL = member.email;
  member.identities = [
    {
      provider: "google",
      identity_data: {
        sub: "fixture-google-member",
        email: member.email,
        email_verified: true,
      },
    },
  ];
  googleProof = true;
  const callback = new URL(authorization.searchParams.get("redirect_to"));
  callback.searchParams.set("code", "fixture-code");
  result = await auth.callback(new Request(callback));
  assert.equal(result.status, 303);
  assert.equal(googleRequests, 1);
  const exchange = requests.findLast(
    (request) =>
      request.path === "/auth/v1/token" &&
      request.query.get("grant_type") === "pkce",
  );
  assert(exchange.body.code_verifier);
  assert.equal(exchange.body.auth_code, "fixture-code");
  assert.equal((await auth.getAppUser()).provider, "Google");
  assert.equal(
    (await auth.getAppUser()).isModerator,
    true,
    "Independent Google proof established a real bootstrap moderation grant before testing AMR regressions",
  );
  assert(
    ![...cookieMap.values()].some((value) =>
      (value.startsWith("base64-")
        ? Buffer.from(value.slice(7), "base64url").toString()
        : value
      ).includes("fixture-google-proof"),
    ),
    "Provider token is removed from persistent session cookies",
  );
  const realNow = Date.now;
  let shifted = 0;
  const oauthSid = "sdk-session-" + nextSession;
  sessionOverride = oauthSid;
  try {
    amrOverride = null;
    shifted = 3601000;
    Date.now = () => realNow() + shifted;
    assert.equal(
      await auth.getAppUser(),
      null,
      "A previously enrolled Supabase Google grant cannot survive missing OAuth AMR",
    );
    amrOverride = [{ method: "password" }];
    shifted += 3601000;
    assert.equal(
      await auth.getAppUser(),
      null,
      "A password proof cannot claim an existing Google grant",
    );
    amrOverride = [{ method: "unrecognized-provider-method" }];
    shifted += 3601000;
    assert.equal(
      await auth.getAppUser(),
      null,
      "Unknown Supabase AMR is distinct from a privately nonce-bound PocketBase session",
    );
    assert.equal(
      (await post("logout")).status,
      200,
      "A verified session ID can still be revoked despite unknown authentication method",
    );
  } finally {
    Date.now = realNow;
    sessionOverride = null;
    amrOverride = undefined;
  }
  assert.equal(await auth.getAppUser(), null);
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM auth_sessions WHERE provider='google' AND revoked=0",
      )
      .get().n,
    0,
  );
  // Administrative routes use the actual separate privileged SDK and internal account role.
  db.prepare(
    "INSERT INTO auth_account_roles VALUES (?,'admin','2026-10-11','fixture-bootstrap')",
  ).run(stable);
  await post("login", {
    email: member.email,
    password: "fixture-password-123",
  });
  assert((await auth.getAppUser()).isModerator);
  result = await auth.listUsers(apiRequest("/api/users", "GET"));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).users[0].protected, true);
  result = await auth.addUser(
    apiRequest("/api/users", "POST", {
      name: "Managed Fixture",
      email: "managed@example.test",
      password: "fixture-password-123",
    }),
  );
  assert.equal(result.status, 201);
  result = await auth.editUser(
    apiRequest("/api/users/" + newId, "PATCH", { name: "Edited Fixture" }),
    context(newId),
  );
  assert.equal(result.status, 200);
  assert.equal(members.get(newId).user_metadata.full_name, "Edited Fixture");
  const privileged = (await auth.getAuthAdmin()).client;
  wrongWriteSubject = true;
  assert.equal(
    (await privileged.updateUserById(newId, { name: "Binding Probe" })).error
      .code,
    "invalid_response",
    "A successful HTTP write cannot report another requested identity as its result",
  );
  wrongWriteSubject = false;
  const restoredManaged = { ...members.get(newId) };
  wrongDeleteSubject = true;
  assert.equal(
    (await privileged.deleteUser(newId)).error.code,
    "invalid_response",
    "Delete userdata is checked against the requested subject",
  );
  wrongDeleteSubject = false;
  members.set(newId, restoredManaged);
  result = await auth.removeUser(
    apiRequest("/api/users/" + newId, "DELETE"),
    context(newId),
  );
  assert.equal(result.status, 200);
  assert(!members.has(newId));
  wrongAdminSubject = true;
  const beforeWrong = requests.length;
  result = await auth.removeUser(
    apiRequest("/api/users/" + id, "DELETE"),
    context(id),
  );
  assert.equal(
    result.status,
    503,
    "A valid but different provider subject cannot bypass own-account deletion protection",
  );
  assert(
    !requests.slice(beforeWrong).some((value) => value.method === "DELETE"),
    "A mismatched lookup cannot produce a deletion request",
  );
  wrongAdminSubject = false;
  const adminRequests = requests.filter((request) =>
    request.path.startsWith("/auth/v1/admin/"),
  );
  assert(adminRequests.length >= 5);
  assert(
    adminRequests.every(
      (request) =>
        request.headers.apikey === globalThis.fixtureEnv.SUPABASE_SECRET_KEY &&
        request.headers.authorization ===
          "Bearer " + globalThis.fixtureEnv.SUPABASE_SECRET_KEY,
    ),
  );
  assert(
    requests
      .filter((request) => !request.path.startsWith("/auth/v1/admin/"))
      .every((request) => request.headers.apikey === key),
    "Ordinary requests never receive the privileged credential",
  );
  redirectAdmin = true;
  assert.equal(
    (await auth.listUsers(apiRequest("/api/users", "GET"))).status,
    503,
  );
  redirectAdmin = false;
  redirectRecovery = true;
  assert.equal(
    (await post("recovery", { email: "outage@example.test" })).status,
    503,
  );
  redirectRecovery = false;
  // Custom origins sharing a hostname must not send one another's session cookies.
  assert(
    (await auth.getAppUser()).isModerator,
    "An enrolled SDK session exists before checking origin isolation",
  );
  const beforeOtherOrigin = requests.length;
  globalThis.fixtureEnv.AUTH_TRUSTED_ORIGIN = alternateNext;
  const other = auth.createAuthClient(
    {
      projectUrl: alternateNext,
      publicKey: key,
      enabled: true,
      emailDeliveryConfirmed: true,
      updatedAt: "2026-10-11",
    },
    {
      getAll: globalThis.fixtureCookies.getAll,
      setAll: (values) =>
        values.forEach(({ name, value, options }) =>
          globalThis.fixtureCookies.set(name, value, options),
        ),
    },
    true,
  );
  assert.equal(
    (await other.getUser()).data.user,
    null,
    "A different custom HTTPS origin starts without the old enrolled SDK session",
  );
  assert.equal(
    requests.length,
    beforeOtherOrigin,
    "Old tokens never reach an alternate origin sharing its hostname",
  );
  globalThis.fixtureEnv.AUTH_TRUSTED_ORIGIN = alternate;
  // Revoking runtime trust blocks saved custom settings before any provider request.
  const before = requests.length;
  result = await auth.saveAuthSettings(
    apiRequest("/api/auth-settings", "POST", {
      projectUrl: "https://untrusted.example",
      publicKey: key,
      enabled: true,
      AUTH_TRUSTED_ORIGIN: "https://untrusted.example",
      SUPABASE_SECRET_KEY_ORIGIN: "https://untrusted.example",
    }),
  );
  assert.equal(result.status, 400);
  assert.equal(globalThis.fixtureEnv.AUTH_TRUSTED_ORIGIN, alternate);
  assert(
    requests.slice(before).every((request) => request.path === "/auth/v1/user"),
    "Browser fields cannot approve an origin or send credentials to it",
  );
  result = await auth.saveAuthSettings(
    apiRequest("/api/auth-settings", "POST", {
      projectUrl: hosted,
      publicKey: key,
      enabled: true,
    }),
  );
  assert.equal(result.status, 400);
  assert.equal((await result.json()).errorCode, "auth_project_change");
  const afterSettings = requests.length;
  globalThis.fixtureEnv.AUTH_TRUSTED_ORIGIN = "https://different.example";
  assert.equal(await auth.getAuthConfig(), null);
  assert.equal(await auth.getAuthAdmin(), null);
  assert.equal(
    (
      await post("login", {
        email: member.email,
        password: "fixture-password-123",
      })
    ).status,
    503,
  );
  assert.equal(requests.length, afterSettings);
  globalThis.fixtureEnv.AUTH_TRUSTED_ORIGIN = alternate;
  globalThis.fixtureEnv.SUPABASE_SECRET_KEY_ORIGIN = hosted;
  assert.equal(await auth.getAuthAdmin(), null);
  assert.equal(requests.length, afterSettings);
} finally {
  globalThis.fetch = originalFetch;
  await new Promise((resolve) => server.close(resolve));
  db.close();
}
console.log(
  JSON.stringify({
    authTrustChecksPassed: 12,
    actualSdkHttpProtocolChecksPassed: true,
    liveProviderCalls: false,
    realEmailsSent: false,
  }),
);
