import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
const { build } = createRequire(new URL("../package.json", import.meta.url))(
  "esbuild",
);
const output = ".test-runtime/pocketbase-auth";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    contents:
      "export * from './lib/auth/config'; export * from './lib/auth/admin'; export * from './lib/auth/identities'; export * from './lib/auth/password-proof'; export * from './lib/auth/provider'; export * from './app/auth'; export {workerSessionResponse} from './lib/worker-session'; export {POST as authPost} from './app/api/auth/[action]/route'; export {GET as callback} from './app/auth/bestaetigen/route'; export {GET as listUsers,POST as addUser} from './app/api/users/route'; export {PATCH as editUser,DELETE as removeUser} from './app/api/users/[id]/route'; export {GET as accountGet,PATCH as accountPatch,POST as accountReauth,DELETE as accountDelete} from './app/api/account/route'; export {GET as ownReviews} from './app/api/visits/route'; export {GET as evidenceGet} from './app/api/evidence/[id]/route'; export {POST as saveAuthSettings} from './app/api/auth-settings/route';",
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
const providerOrigin = "https://pocketbase.fixture.example:8443",
  origin = "https://riparim.example.test",
  id = "memberrecord001",
  createdId = "managedrecord01";
const privateFiles = new Map();
globalThis.fixtureEnv = {
  DB: d1,
  BUCKET: {
    async get(key) {
      return privateFiles.has(key) ? { body: privateFiles.get(key) } : null;
    },
    async list({ prefix }) {
      return {
        objects: [...privateFiles.keys()]
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ key })),
        truncated: false,
      };
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys])
        privateFiles.delete(key);
    },
  },
  SITE_ORIGIN: origin,
  AUTH_TRUSTED_ORIGIN: providerOrigin,
  AUTH_TRUSTED_PROVIDER: "pocketbase",
  AUTH_ADMIN_KEY: "synthetic-admin-token",
  AUTH_ADMIN_KEY_ORIGIN: providerOrigin,
  AUTH_ADMIN_KEY_PROVIDER: "pocketbase",
};
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
const auth = await import(
  new URL("../" + output + "/auth.mjs", import.meta.url)
);
assert.equal(
  auth.validatePublicConfig(providerOrigin, "", "pocketbase").provider,
  "pocketbase",
  "A concrete independent protocol can be selected without Supabase public keys",
);
db.prepare(
  "INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at,provider) VALUES ('main',?,'',1,1,'2026-10-12','pocketbase')",
).run(providerOrigin);
const member = {
  id,
  collectionId: "_pb_users_auth_",
  collectionName: "users",
  email: "member@example.test",
  verified: true,
  name: "PocketBase Member",
  preferredLocale: "en",
  created: "2026-10-12 00:00:00Z",
  role: "admin",
  isAdmin: true,
};
const members = new Map([[id, member]]),
  tokens = new Map(),
  requests = [];
let sequence = 0,
  failRefresh = false,
  fixedToken = null,
  googleEnabled = true,
  googleSubject = "google-pocketbase-member",
  googleProof = true,
  failDelete = false,
  redirectAdmin = false,
  redirectGoogle = false,
  wrongAdminSubject = false,
  wrongWriteSubject = false,
  wrongDeleteSubject = false,
  droppedProfile = null;
const googleState = "fixture-pb-state",
  googleVerifier = "fixture-pb-verifier-123456789012345678901234567890";
const resetToken =
  Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url") +
  "." +
  Buffer.from(
    JSON.stringify({
      id,
      collectionId: "_pb_users_auth_",
      type: "passwordReset",
      exp: Math.floor(Date.now() / 1000) + 600,
    }),
  ).toString("base64url") +
  ".fixture-signature";
const session = () => {
  const token = fixedToken ?? "independent-token-" + ++sequence;
  tokens.set(token, id);
  return { token, record: members.get(id) };
};
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
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(value));
  };
  if (url.pathname === "/google/userinfo") {
    assert.equal(request.headers.authorization, "Bearer fixture-google-proof");
    if (redirectGoogle) {
      response.writeHead(307, {
        location: transport + "/google/redirect-sink",
      });
      return response.end();
    }
    return json({
      sub: googleSubject,
      email: member.email,
      email_verified: true,
    });
  }
  if (url.pathname === "/google/redirect-sink")
    return json({
      sub: googleSubject,
      email: member.email,
      email_verified: true,
    });
  if (url.pathname === "/api/collections/users/auth-methods")
    return json({
      password: { enabled: true, identityFields: ["email"] },
      oauth2: {
        enabled: googleEnabled,
        providers: googleEnabled
          ? [
              {
                name: "google",
                state: googleState,
                codeVerifier: googleVerifier,
                codeChallenge: "fixture-s256-challenge",
                codeChallengeMethod: "S256",
                authURL:
                  "https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture-google-client&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&code_challenge=fixture-s256-challenge&code_challenge_method=S256&state=" +
                  googleState +
                  "&redirect_uri=",
              },
            ]
          : [],
      },
      mfa: { enabled: false },
      otp: { enabled: false },
    });
  if (url.pathname === "/api/collections/users/auth-with-password") {
    if (
      body.identity !== member.email ||
      body.password !== "fixture-password-123"
    )
      return json(
        { status: 400, message: "Invalid credentials", data: {} },
        400,
      );
    return json(session());
  }
  if (url.pathname === "/api/collections/users/auth-refresh") {
    if (failRefresh || !tokens.has(request.headers.authorization))
      return json({ status: 401, message: "Invalid token", data: {} }, 401);
    return json({
      token: "refreshed-token",
      record: members.get(tokens.get(request.headers.authorization)),
    });
  }
  if (url.pathname === "/api/collections/_externalAuths/records") {
    if (!tokens.has(request.headers.authorization))
      return json({ status: 401, data: {} }, 401);
    return json({
      items: googleSubject
        ? [
            {
              id: "externalrecord1",
              collectionId: "_pb_externalAuths_",
              collectionName: "_externalAuths",
              collectionRef: "_pb_users_auth_",
              recordRef: id,
              provider: "google",
              providerId: googleSubject,
            },
          ]
        : [],
      totalItems: googleSubject ? 1 : 0,
    });
  }
  if (url.pathname === "/api/collections/users/auth-with-oauth2") {
    assert.equal(body.provider, "google");
    assert.equal(body.codeVerifier, googleVerifier);
    assert.equal(
      body.redirectUrl,
      origin + "/auth/bestaetigen?anbieter=google",
    );
    return json({
      ...session(),
      meta: {
        accessToken: "fixture-google-proof",
        rawUser: {
          sub: googleSubject,
          email: member.email,
          email_verified: true,
        },
      },
    });
  }
  if (url.pathname === "/api/collections/users/records") {
    if (request.method === "POST") {
      const record = {
        ...member,
        ...body,
        id: createdId,
        verified:
          request.headers.authorization ===
            globalThis.fixtureEnv.AUTH_ADMIN_KEY && body.verified === true,
      };
      if (droppedProfile) delete record[droppedProfile];
      members.set(createdId, record);
      return json(record);
    }
    if (request.headers.authorization !== globalThis.fixtureEnv.AUTH_ADMIN_KEY)
      return json({ status: 403, data: {} }, 403);
    if (redirectAdmin) {
      response.writeHead(307, {
        location: "https://untrusted.example/api/collections/users/records",
      });
      return response.end();
    }
    return json({ items: [...members.values()], totalItems: members.size });
  }
  if (url.pathname.startsWith("/api/collections/users/records/")) {
    if (request.headers.authorization !== globalThis.fixtureEnv.AUTH_ADMIN_KEY)
      return json({ status: 403, data: {} }, 403);
    const subject = url.pathname.split("/").at(-1),
      found = members.get(subject);
    if (!found) return json({ status: 404, data: {} }, 404);
    if (request.method === "PATCH") {
      Object.assign(found, body);
      return json(wrongWriteSubject ? { ...found, id } : found);
    }
    if (request.method === "DELETE") {
      if (failDelete) return json({ status: 503, data: {} }, 503);
      members.delete(subject);
      return wrongDeleteSubject ? json({ ...found, id }) : json(null, 204);
    }
    return json(
      wrongAdminSubject
        ? { ...found, id: createdId, email: "foreign@example.test" }
        : found,
    );
  }
  if (url.pathname === "/api/collections/users/request-verification")
    return json(null, 204);
  if (url.pathname === "/api/collections/users/confirm-verification") {
    if (body.token !== "fixture-confirmation")
      return json({ status: 400, data: {} }, 400);
    members.get(createdId).verified = true;
    return json(null, 204);
  }
  if (url.pathname === "/api/collections/users/request-password-reset")
    return json(null, 204);
  if (url.pathname === "/api/collections/users/confirm-password-reset") {
    if (body.token !== resetToken)
      return json(
        { status: 400, message: "Invalid recovery token", data: {} },
        400,
      );
    assert.equal(body.password, body.passwordConfirm);
    tokens.clear();
    return json(null, 204);
  }
  return json({ status: 404, message: "Missing fixture", data: {} }, 404);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const transport = "http://127.0.0.1:" + server.address().port,
  originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === "https://openidconnect.googleapis.com") {
    assert(googleProof);
    assert.equal(init.headers.Authorization, "Bearer fixture-google-proof");
    return originalFetch(new URL("/google/userinfo", transport), init);
  }
  assert.equal(url.origin, providerOrigin);
  assert.equal(init.redirect, "manual");
  return originalFetch(new URL(url.pathname + url.search, transport), init);
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
try {
  const source = auth.supabaseIdentity(
      "https://previous-fixture.supabase.co",
      "00000000-0000-4000-8000-000000000099",
    ),
    destination = {
      provider: "pocketbase",
      issuer: providerOrigin,
      subject: id,
    };
  const oldAccount = await auth.resolveAccount(source),
    proofs = [];
  assert.equal(
    await auth.linkAccountIdentity(source, destination, async (identity) => {
      proofs.push(identity);
      if (identity.provider === "pocketbase")
        return (
          (
            await (
              await auth.getAuthAdmin()
            ).client.getUserById(identity.subject)
          ).data.user.identity.subject === id
        );
      return (
        identity.issuer === source.issuer && identity.subject === source.subject
      );
    }),
    oldAccount,
  );
  assert.deepEqual(proofs, [source, destination]);
  const visit = "00000000-0000-4000-8000-000000000100",
    fileKey = "evidence/" + oldAccount + "/" + visit + "/fixture.pdf";
  db.prepare(
    "INSERT INTO visits (id,owner,workshop,date,vehicle,service,evidence_type,file_key,file_type,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    visit,
    oldAccount,
    "fixture-workshop",
    "2026-10-12",
    "Fixture Car",
    "Repair",
    "document",
    fileKey,
    "application/pdf",
    "published",
    "2026-10-12",
  );
  privateFiles.set(fileKey, "%PDF-private synthetic source evidence");
  assert.equal(
    (
      await post("login", {
        email: member.email,
        password: "fixture-password-123",
      })
    ).status,
    200,
    "The actual application authenticates a non-GoTrue record through independent REST",
  );
  const current = await auth.getAppUser();
  assert.equal(
    current.userId,
    oldAccount,
    "A mapped non-UUID target login retains the prior stable source account",
  );
  assert.equal(current.displayName, "PocketBase Member");
  assert.equal(current.isModerator, false);
  assert.equal(
    (await auth.ownReviews(new Request(origin + "/api/visits"))).status,
    200,
  );
  assert.equal(
    await (
      await auth.evidenceGet(new Request(origin + "/api/evidence/" + visit), {
        params: Promise.resolve({ id: visit }),
      })
    ).text(),
    "%PDF-private synthetic source evidence",
    "Private file paths and ownership remain unchanged across the independent protocol switch",
  );
  assert.equal(
    (await auth.getAppUser()).userId,
    current.userId,
    "Server refresh preserves enrolled session identity",
  );
  const workerSession = await auth.workerSessionResponse(
    new Request(origin + "/api/session", {
      headers: {
        cookie: [...cookieMap]
          .map(([name, value]) => name + "=" + encodeURIComponent(value))
          .join("; "),
      },
    }),
  );
  assert.equal(workerSession.status, 200);
  assert.deepEqual(
    await workerSession.json(),
    {
      account: {
        email: member.email,
        displayName: "PocketBase Member",
        provider: "E-Mail",
      },
      isAdmin: false,
    },
    "The framework-free Worker session preserves scoped PocketBase cookies and server enrollment",
  );
  assert.match(workerSession.headers.get("Cache-Control"), /private.*no-store/);

  const oldCookies = new Map(cookieMap);
  failRefresh = true;
  assert.equal(
    await auth.getAppUser(),
    null,
    "Server-side revocation denies the old token",
  );
  assert.equal(
    (await post("logout")).status,
    503,
    "Logout must report a refresh/proof outage instead of success without revoking its local grant",
  );
  failRefresh = false;
  assert.equal((await post("logout")).status, 200);
  cookieMap.clear();
  for (const [name, value] of oldCookies) cookieMap.set(name, value);
  assert.equal(
    await auth.getAppUser(),
    null,
    "A copied cookie remains denied after a successful retry logout",
  );
  cookieMap.clear();
  assert.equal(
    (await post("logout")).status,
    200,
    "An anonymous logout with no proof remains harmless",
  );
  assert.equal(
    (
      await post("login", {
        email: member.email,
        password: "fixture-password-123",
      })
    ).status,
    200,
  );
  assert.equal(
    (await post("login", { email: member.email, password: "wrong-password" }))
      .status,
    401,
  );
  assert.equal((await post("recovery", { email: member.email })).status, 200);
  let result = await auth.callback(
    new Request(
      origin +
        "/auth/bestaetigen?" +
        new URLSearchParams({
          type: "recovery",
          token_hash: resetToken,
          weiter: "/passwort-neu",
        }),
    ),
  );
  assert.equal(
    new URL(result.headers.get("Location")).pathname,
    "/passwort-neu",
    "PocketBase recovery reaches a restricted password-reset form",
  );
  assert.equal(
    await auth.getAppUser(),
    null,
    "A recovery capability never provides an authenticated app session",
  );
  assert.equal(
    (
      await auth.accountReauth(
        new Request(origin + "/api/account", {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify({ password: "fixture-password-123" }),
        }),
      )
    ).status,
    401,
  );
  assert.equal(
    (await post("reset", { password: "fixture-new-password-123" })).status,
    200,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM auth_sessions WHERE revoked=0").get().n,
    0,
    "Successful provider-confirmed recovery revokes all app sessions of the proved subject",
  );
  assert.equal(
    (await post("reset", { password: "fixture-new-password-123" })).status,
    401,
    "Consumed recovery cannot be replayed",
  );
  fixedToken = "same-upstream-token";
  const firstJar = new Map(),
    secondJar = new Map(),
    jar = (map) => ({
      getAll: () => [...map].map(([name, value]) => ({ name, value })),
      setAll: (values) =>
        values.forEach(({ name, value, options }) =>
          options.maxAge === 0 ? map.delete(name) : map.set(name, value),
        ),
    });
  const first = auth.createAuthClient(
      await auth.getAuthConfig(),
      jar(firstJar),
      true,
    ),
    second = auth.createAuthClient(
      await auth.getAuthConfig(),
      jar(secondJar),
      true,
    );
  const one = await first.signInWithPassword({
      email: member.email,
      password: "fixture-password-123",
    }),
    two = await second.signInWithPassword({
      email: member.email,
      password: "fixture-password-123",
    });
  await auth.recordPasswordSession(one.data.user, first);
  await auth.recordPasswordSession(two.data.user, second);
  assert.notEqual(
    (await first.getSessionProof()).data.proof.id,
    (await second.getSessionProof()).data.proof.id,
    "Independent browser logins get independent app grants even when PocketBase emits exactly the same upstream token",
  );
  fixedToken = null;
  let google = await post("google", {
    locale: "en",
    returnTo: "/en/bewertungen",
  });
  assert.equal(
    google.status,
    200,
    "Google starts through the independent provider challenge",
  );
  const authorization = new URL((await google.json()).url);
  assert.equal(authorization.origin, "https://accounts.google.com");
  assert.equal(authorization.searchParams.get("state"), googleState);
  assert.equal(
    authorization.searchParams.get("scope"),
    "openid email profile",
    "The real PocketBase default scopes are upgraded for the independent OpenID identity proof",
  );
  assert.equal(
    authorization.searchParams.get("redirect_uri"),
    origin + "/auth/bestaetigen?anbieter=google",
    "Google receives the exact registered callback, independent of locale and private app flow",
  );
  const callback = new URL(authorization.searchParams.get("redirect_uri"));
  callback.searchParams.set("code", "fixture-google-code");
  callback.searchParams.set("state", "forged-state");
  result = await auth.callback(new Request(callback));
  assert.equal(
    new URL(result.headers.get("Location")).searchParams.get("fehler"),
    "google",
  );
  assert(
    !requests.some((request) => request.path.endsWith("/auth-with-oauth2")),
    "Mismatched Google state cannot exchange an authorization code",
  );
  redirectGoogle = true;
  google = await post("google", { locale: "en", returnTo: "/en/bewertungen" });
  const rejected = new URL(
    new URL((await google.json()).url).searchParams.get("redirect_uri"),
  );
  rejected.searchParams.set("code", "fixture-redirect-code");
  rejected.searchParams.set("state", googleState);
  result = await auth.callback(new Request(rejected));
  assert.equal(
    new URL(result.headers.get("Location")).searchParams.get("fehler"),
    "google",
  );
  assert(
    !requests.some((value) => value.path === "/google/redirect-sink"),
    "Google proof tokens never follow even a same-host redirect to a different endpoint",
  );
  redirectGoogle = false;
  for (const mutation of ["missing", "origin", "flow", "expired"]) {
    google = await post("google", { locale: "sq", returnTo: "/sq/vleresimet" });
    const authorized = new URL(
      new URL((await google.json()).url).searchParams.get("redirect_uri"),
    );
    authorized.searchParams.set("code", "fixture-private-intent-code");
    authorized.searchParams.set("state", googleState);
    const intentName = [...cookieMap.keys()].find(
        (name) => name.startsWith("riparim-pb-") && name.endsWith("-google"),
      ),
      intent = JSON.parse(cookieMap.get(intentName));
    if (mutation === "missing") cookieMap.delete(intentName);
    else {
      if (mutation === "origin")
        intent.appCallback =
          "https://untrusted.example/auth/bestaetigen?anbieter=google&fluss=" +
          cookieMap.get("riparim-google-flow");
      if (mutation === "flow")
        intent.appCallback = intent.appCallback.replace(
          cookieMap.get("riparim-google-flow"),
          "wrong-private-flow",
        );
      if (mutation === "expired") intent.expiresAt = Date.now() - 1;
      cookieMap.set(intentName, JSON.stringify(intent));
    }
    const before = requests.length;
    result = await auth.callback(new Request(authorized));
    assert.equal(
      new URL(result.headers.get("Location")).searchParams.get("fehler"),
      "google",
      mutation + " private Google intent is refused",
    );
    assert(
      !requests
        .slice(before)
        .some((value) => value.path.endsWith("/auth-with-oauth2")),
      "Invalid intent never exchanges the OAuth code",
    );
  }
  google = await post("google", { locale: "en", returnTo: "/en/bewertungen" });
  const target = new URL(
    new URL((await google.json()).url).searchParams.get("redirect_uri"),
  );
  target.searchParams.set("code", "fixture-google-code");
  target.searchParams.set("state", googleState);
  result = await auth.callback(new Request(target));
  assert.equal(new URL(result.headers.get("Location")).pathname, "/en/reviews");
  assert.equal((await auth.getAppUser()).provider, "Google");
  assert(
    ![...cookieMap.values()].some((value) =>
      value.includes("fixture-google-proof"),
    ),
    "Google proof never persists in the browser session",
  );
  google = await post("google", {
    locale: "sq",
    returnTo: "https://untrusted.example",
    reauthenticate: true,
  });
  assert.equal(google.status, 200);
  const reauthTarget = new URL(
    new URL((await google.json()).url).searchParams.get("redirect_uri"),
  );
  assert.equal(
    reauthTarget.href,
    origin + "/auth/bestaetigen?anbieter=google",
    "Reauthentication uses the same exactly registered URI",
  );
  reauthTarget.searchParams.set("code", "fixture-reauth-code");
  reauthTarget.searchParams.set("state", googleState);
  result = await auth.callback(new Request(reauthTarget));
  assert.equal(
    new URL(result.headers.get("Location")).pathname,
    "/sq/cilesimet",
  );
  assert.equal(
    (await (await auth.accountGet()).json()).deletionReady,
    true,
    "Private Google reauthentication preserves the account grant and initiating locale",
  );

  googleSubject = null;
  assert.equal(
    await auth.getAppUser(),
    null,
    "Removal of the provider-managed Google link removes Google access",
  );
  googleSubject = "google-pocketbase-member";
  assert.equal((await post("logout")).status, 200);
  assert.equal(await auth.getAppUser(), null);
  const apiRequest = (method, body) =>
    new Request(origin + "/api/account", {
      method,
      headers: { origin, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  await post("login", {
    email: member.email,
    password: "fixture-password-123",
  });
  const stable = (await auth.getAppUser()).userId;
  let renamed = await auth.accountPatch(
    apiRequest("PATCH", { name: "Renamed PB Member" }),
  );
  assert.equal(renamed.status, 200);
  assert.equal(member.name, "Renamed PB Member");
  assert.equal(
    (await auth.accountPatch(apiRequest("PATCH", { preferredLocale: "sq" })))
      .status,
    200,
  );
  assert.equal(member.preferredLocale, "sq");
  assert.equal(
    (
      await auth.accountReauth(
        apiRequest("POST", { password: "wrong-password" }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await auth.accountReauth(
        apiRequest("POST", { password: "fixture-password-123" }),
      )
    ).status,
    200,
  );
  failDelete = true;
  assert.equal(
    (
      await auth.accountDelete(
        apiRequest("DELETE", { confirmation: "KONTO LÖSCHEN" }),
      )
    ).status,
    503,
  );
  assert.equal(
    await auth.getAppUser(),
    null,
    "Started deletion keeps the stable account blocked during provider outage",
  );
  assert.equal(
    db
      .prepare(
        "SELECT identity_provider FROM auth_account_deletions WHERE started=1",
      )
      .get().identity_provider,
    "pocketbase",
  );
  failDelete = false;
  assert.equal(
    (
      await auth.accountDelete(
        apiRequest("DELETE", { confirmation: "KONTO LÖSCHEN" }),
      )
    ).status,
    200,
    "Started deletion retries through the neutral not-found contract and same private grant",
  );
  assert(!members.has(id));
  members.set(id, member);
  db.prepare("DELETE FROM auth_account_status WHERE account_id=?").run(stable);
  db.prepare(
    "INSERT INTO auth_account_roles VALUES (?,'admin','2026-10-12','fixture-bootstrap')",
  ).run(stable);
  await post("login", {
    email: member.email,
    password: "fixture-password-123",
  });
  assert((await auth.getAppUser()).isModerator);
  assert.equal((await auth.listUsers(apiRequest("GET"))).status, 200);
  globalThis.fixtureEnv.AUTH_ADMIN_KEY_PROVIDER = "supabase";
  assert.equal(
    await auth.getAuthAdmin(),
    null,
    "A key bound to another protocol cannot exercise administration on the approved endpoint",
  );
  globalThis.fixtureEnv.AUTH_ADMIN_KEY_PROVIDER = "pocketbase";
  wrongAdminSubject = true;
  const beforeWrong = requests.length;
  assert.equal(
    (
      await auth.removeUser(apiRequest("DELETE"), {
        params: Promise.resolve({ id }),
      })
    ).status,
    503,
    "A different valid response subject cannot bypass protected-account deletion",
  );
  assert(
    !requests.slice(beforeWrong).some((value) => value.method === "DELETE"),
  );
  wrongAdminSubject = false;
  redirectAdmin = true;
  assert.equal((await auth.listUsers(apiRequest("GET"))).status, 503);
  redirectAdmin = false;
  const profileAdmin = (await auth.getAuthAdmin()).client;
  droppedProfile = "name";
  const missingName = await auth.addUser(
    apiRequest("POST", {
      name: "PB Managed Member",
      email: "managed@example.test",
      password: "fixture-password-123",
    }),
  );
  assert.equal(
    missingName.status,
    503,
    "App creation cannot report 201 when the provider silently drops the requested name",
  );
  assert.equal((await missingName.json()).errorCode, "users_unavailable");
  assert(
    members.has(createdId),
    "Invalid readback does not promise a provider-side rollback",
  );
  await profileAdmin.deleteUser(createdId);
  droppedProfile = "preferredLocale";
  assert.equal(
    (
      await profileAdmin.createUser({
        email: "managed@example.test",
        password: "fixture-password-123",
        name: "PB Managed Member",
        preferredLocale: "sq",
        emailVerified: true,
      })
    ).error.code,
    "invalid_response",
    "A requested locale must also survive the provider create response",
  );
  await profileAdmin.deleteUser(createdId);
  droppedProfile = null;
  assert.equal(
    (
      await auth.addUser(
        apiRequest("POST", {
          name: "PB Managed Member",
          email: "managed@example.test",
          password: "fixture-password-123",
        }),
      )
    ).status,
    201,
  );
  const context = { params: Promise.resolve({ id: createdId }) };
  assert.equal(
    (
      await auth.editUser(
        apiRequest("PATCH", { name: "PB Edited Member" }),
        context,
      )
    ).status,
    200,
  );
  assert.equal(members.get(createdId).name, "PB Edited Member");
  assert.equal(
    (await auth.editUser(apiRequest("PATCH", { active: false }), context))
      .status,
    200,
  );
  assert.equal(
    db
      .prepare(
        "SELECT status FROM auth_account_status WHERE account_id=(SELECT account_id FROM auth_identities WHERE provider='pocketbase' AND subject=?)",
      )
      .get(createdId).status,
    "inactive",
  );
  const privileged = (await auth.getAuthAdmin()).client;
  wrongWriteSubject = true;
  assert.equal(
    (await privileged.updateUserById(createdId, { name: "Binding Probe" }))
      .error.code,
    "invalid_response",
  );
  wrongWriteSubject = false;
  const restoredManaged = { ...members.get(createdId) };
  wrongDeleteSubject = true;
  assert.equal(
    (await privileged.deleteUser(createdId)).error.code,
    "invalid_response",
  );
  wrongDeleteSubject = false;
  members.set(createdId, restoredManaged);
  assert.equal(
    (await auth.removeUser(apiRequest("DELETE"), context)).status,
    200,
  );
  assert(!members.has(createdId));
  assert.equal(
    (
      await post("register", {
        locale: "sq",
        name: "PB Signup",
        email: "signup@example.test",
        password: "fixture-password-123",
        returnTo: "/sq/vleresimet",
      })
    ).status,
    200,
  );
  result = await auth.callback(
    new Request(
      origin + "/auth/bestaetigen?type=signup&token_hash=fixture-confirmation",
    ),
  );
  assert.equal(
    new URL(result.headers.get("Location")).pathname,
    "/sq/hyr",
    "PocketBase confirmation restores the initiating browser locale and review return path",
  );
  db.prepare("DELETE FROM auth_account_roles WHERE account_id=?").run(stable);
  globalThis.fixtureEnv.REVIEW_MODERATOR_EMAIL = member.email;
  fixedToken = "identical-password-and-google-provider-token";
  const privateCookies = globalThis.fixtureCookies,
    googleJar = new Map(),
    passwordJar = new Map(),
    browserCookies = (map) => ({
      getAll: () => [...map].map(([name, value]) => ({ name, value })),
      get: (name) => (map.has(name) ? { value: map.get(name) } : undefined),
      set(name, value, options) {
        if (options?.maxAge === 0) map.delete(name);
        else map.set(name, value);
      },
    });
  globalThis.fixtureCookies = browserCookies(googleJar);
  google = await post("google");
  const googleTarget = new URL(
    new URL((await google.json()).url).searchParams.get("redirect_uri"),
  );
  googleTarget.searchParams.set("code", "fixture-same-token-code");
  googleTarget.searchParams.set("state", googleState);
  await auth.callback(new Request(googleTarget));
  assert(
    (await auth.getAppUser()).isModerator,
    "Independent Google proof grants bootstrap moderation in its own browser",
  );
  globalThis.fixtureCookies = browserCookies(passwordJar);
  assert.equal(
    (
      await post("login", {
        email: member.email,
        password: "fixture-password-123",
      })
    ).status,
    200,
  );
  const passwordUser = await auth.getAppUser();
  assert.equal(passwordUser.provider, "E-Mail");
  assert.equal(
    passwordUser.isModerator,
    false,
    "Identical PocketBase JWT bytes do not let an independently authenticated password browser inherit Google moderation",
  );
  assert.equal((await post("logout")).status, 200);
  globalThis.fixtureCookies = browserCookies(googleJar);
  assert(
    (await auth.getAppUser()).isModerator,
    "Password browser logout cannot revoke the independent Google grant",
  );
  const cookieName = [...googleJar.keys()].find((name) =>
      name.endsWith("-session"),
    ),
    original = googleJar.get(cookieName);
  googleJar.set(
    cookieName,
    JSON.stringify({ ...JSON.parse(original), nonce: crypto.randomUUID() }),
  );
  assert.equal(
    await auth.getAppUser(),
    null,
    "A tampered nonce never acquires an enrolled grant",
  );
  googleJar.set(cookieName, original);
  globalThis.fixtureCookies = privateCookies;
  fixedToken = null;
  delete globalThis.fixtureEnv.REVIEW_MODERATOR_EMAIL;
  const forgedReset = resetToken.split(".");
  forgedReset[1] = Buffer.from(
    JSON.stringify({
      id: createdId,
      collectionId: "_pb_users_auth_",
      type: "passwordReset",
      exp: Math.floor(Date.now() / 1000) + 600,
    }),
  ).toString("base64url");
  const sessionsBefore = db
    .prepare("SELECT COUNT(*) n FROM auth_sessions")
    .get().n;
  await auth.callback(
    new Request(
      origin +
        "/auth/bestaetigen?" +
        new URLSearchParams({
          type: "recovery",
          token_hash: forgedReset.join("."),
        }),
    ),
  );
  assert.equal(await auth.getAppUser(), null);
  assert.equal((await auth.listUsers(apiRequest("GET"))).status, 401);
  assert.equal(
    (await post("reset", { password: "fixture-new-password-123" })).status,
    400,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM auth_sessions").get().n,
    sessionsBefore,
    "An unverified recovery payload cannot create a grant or revoke another identity",
  );
  globalThis.fixtureEnv.EMAIL_LOGIN_ACTIVATION_TIME = "2026-10-11T00:00:00Z";
  globalThis.fixtureEnv.EMAIL_LOGIN_ACTIVATION_PROJECT = providerOrigin;
  db.prepare(
    "UPDATE auth_settings SET enabled=0,updated_at='2026-10-01' WHERE id='main'",
  ).run();
  assert.equal(
    (await auth.getAuthConfig()).enabled,
    false,
    "Old Supabase activation requests never activate a PocketBase configuration on the same endpoint",
  );
  db.prepare(
    "UPDATE auth_settings SET enabled=1,updated_at='2026-10-12' WHERE id='main'",
  ).run();
  const legacyToken = crypto.randomUUID() + crypto.randomUUID(),
    legacyHash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(legacyToken),
        ),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
  db.prepare(
    "INSERT INTO auth_account_deletions (account_id,user_id,token_hash,expires_at,started,identity_provider,identity_issuer) VALUES (?,?,?,?,1,'supabase',?)",
  ).run(
    stable,
    source.subject,
    legacyHash,
    Date.now() + 600000,
    providerOrigin,
  );
  cookieMap.set("riparim-account-deletion", legacyToken);
  assert.equal(
    (
      await auth.accountDelete(
        apiRequest("DELETE", { confirmation: "KONTO LÖSCHEN" }),
      )
    ).status,
    401,
    "A started grant from another protocol on the exact same issuer cannot gain target-provider rights",
  );
  console.log(
    "PocketBase password, recovery, isolated browsers, Google, admin, account and mapped ownership contracts passed",
  );
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  db.close();
}
