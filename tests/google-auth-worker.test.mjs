import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile, readdir } from "node:fs/promises";
import { generateKeyPairSync, sign } from "node:crypto";
import { Miniflare } from "miniflare";

// Real callback, SSR SDK, asymmetric JWT verification, D1 and Workers fetch.
// Only Next's request cookie access and the external HTTP services are fixtures.
const origin = "https://riparim.example.test",
  provider = "https://worker-google.supabase.co";
const id = "00000000-0000-4000-8000-000000000183";
const member = {
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "member@example.test",
  email_confirmed_at: "2026-10-14T00:00:00Z",
  user_metadata: { full_name: "Fixture Member" },
  app_metadata: { provider: "google", providers: ["google"] },
  identities: [
    {
      provider: "google",
      identity_data: {
        sub: "fixture-google-subject",
        email: "member@example.test",
        email_verified: true,
      },
    },
  ],
};
const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "fixture-key",
  alg: "ES256",
  use: "sig",
};
let sequence = 0,
  googleMode = "success",
  exchangeMode = "success";
const requests = [],
  encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function session() {
  const sessionId = "worker-google-session-" + ++sequence,
    now = Math.floor(Date.now() / 1000);
  const input =
    encode({ alg: "ES256", typ: "JWT", kid: jwk.kid }) +
    "." +
    encode({
      sub: id,
      iss: provider + "/auth/v1",
      aud: "authenticated",
      exp: now + 3600,
      iat: now,
      session_id: sessionId,
      amr: [{ method: "oauth" }],
    });
  const access_token =
    input +
    "." +
    sign("sha256", Buffer.from(input), {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    }).toString("base64url");
  return {
    access_token,
    refresh_token: "fixture-refresh-" + sequence,
    provider_token: "fixture-google-proof",
    expires_in: 3600,
    token_type: "bearer",
    user: member,
  };
}
const bundle = await build({
  stdin: {
    contents: `import {POST} from './app/api/auth/[action]/route';import {GET} from './app/auth/confirm/route';import {getAppUser} from './app/auth';import {withAuthRequest} from './lib/auth/request-context';export default {async fetch(request){return withAuthRequest(async()=>{globalThis.fixtureRequest=request;const values=new Map((request.headers.get('cookie')??'').split(';').filter(Boolean).map(v=>{const i=v.indexOf('=');return [v.slice(0,i).trim(),v.slice(i+1)];}));const writes=[];globalThis.fixtureCookies={getAll:()=>[...values].map(([name,value])=>({name,value})),get:name=>values.has(name)?{value:values.get(name)}:undefined,set(name,value,options){if(options?.maxAge===0)values.delete(name);else values.set(name,value);writes.push({name,value,options});}};const path=new URL(request.url).pathname;const result=path==='/api/auth/google'?await POST(request,{params:Promise.resolve({action:'google'})}):path==='/api/session'?Response.json({user:await getAppUser()}):await GET(request);const headers=new Headers(result.headers);for(const {name,value,options} of writes)headers.append('set-cookie',name+'='+value+'; Path='+options.path+'; Max-Age='+options.maxAge+(options.httpOnly?'; HttpOnly':'')+(options.secure?'; Secure':'')+'; SameSite=Lax');return new Response(result.body,{status:result.status,headers});});}};`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  external: ["cloudflare:workers"],
  plugins: [
    {
      name: "request-fixtures",
      setup(b) {
        b.onResolve(
          { filter: /^(next\/headers|\.\/chatgpt-auth|@\/app\/chatgpt-auth)$/ },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          loader: "js",
          contents:
            args.path === "next/headers"
              ? "export async function cookies(){return globalThis.fixtureCookies;}export async function headers(){return globalThis.fixtureRequest.headers;}"
              : "export async function getChatGPTUser(){return null;}",
        }));
      },
    },
  ],
});
const runtime = new Miniflare({
  modules: true,
  script: bundle.outputFiles[0].text,
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  r2Buckets: ["BUCKET"],
  bindings: {
    SITE_ORIGIN: origin,
    REVIEW_MODERATOR_EMAIL: "owner@example.test",
  },
  outboundService: (request) => {
    const url = new URL(request.url);
    requests.push({
      url,
      method: request.method,
      authorization: request.headers.get("authorization"),
    });
    if (url.origin === "https://openidconnect.googleapis.com") {
      assert.equal(url.pathname, "/v1/userinfo");
      assert.equal(
        request.headers.get("authorization"),
        "Bearer fixture-google-proof",
      );
      if (googleMode === "redirect")
        return new Response(null, {
          status: 307,
          headers: { location: "https://untrusted.example/token-sink" },
        });
      if (googleMode === "failure")
        return Response.json({ error: "fixture unavailable" }, { status: 503 });
      return Response.json({
        sub:
          googleMode === "mismatch"
            ? "wrong-subject"
            : "fixture-google-subject",
        email: member.email,
        email_verified: true,
      });
    }
    assert.equal(
      url.origin,
      provider,
      "Provider credentials never reach a redirect sink",
    );
    if (url.pathname === "/auth/v1/settings")
      return Response.json({
        external: { google: true, email: true },
        mailer_autoconfirm: false,
      });
    if (url.pathname === "/auth/v1/token")
      return exchangeMode === "failure"
        ? Response.json(
            { error_code: "flow_state_not_found", msg: "Fixture expired code" },
            { status: 400 },
          )
        : Response.json(session());
    if (url.pathname === "/auth/v1/user") return Response.json(member);
    if (url.pathname === "/auth/v1/.well-known/jwks.json")
      return Response.json({ keys: [jwk] });
    if (url.pathname === "/auth/v1/logout")
      return new Response(null, { status: 204 });
    throw Error("Unimplemented fixture request: " + url.pathname);
  },
});
const jar = new Map();
async function call(path, body) {
  const response = await runtime.dispatchFetch(new URL(path, origin), {
    redirect: "manual",
    method: body ? "POST" : "GET",
    headers: {
      host: "riparim.example.test",
      cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
      ...(body ? { origin, "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0],
      i = pair.indexOf("="),
      name = pair.slice(0, i);
    if (/Max-Age=0(?:;|$)/i.test(cookie)) jar.delete(name);
    else jar.set(name, pair.slice(i + 1));
  }
  return response;
}
async function begin(locale = "de", returnTo = "/?besuche=1") {
  const response = await call("/api/auth/google", { locale, returnTo });
  assert.equal(response.status, 200);
  const authorization = new URL((await response.json()).url);
  assert(authorization.searchParams.get("code_challenge"));
  assert([...jar.keys()].some((name) => name.includes("code-verifier")));
  const callback = new URL(authorization.searchParams.get("redirect_to"));
  callback.searchParams.set("code", "fixture-code");
  return callback;
}
try {
  const db = await runtime.getD1Database("DB");
  for (const file of (await readdir("drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    for (const sql of (await readFile("drizzle/" + file, "utf8"))
      .split("--> statement-breakpoint")
      .map((sql) => sql.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  await db
    .prepare(
      "INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at) VALUES ('main',?,'sb_publishable_fixture_public_key_1234567890',1,0,'2026-10-14')",
    )
    .bind(provider)
    .run();
  let callback = await begin(),
    response = await call(callback.href);
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    origin + "/?besuche=1",
    "Successful Google callback must avoid the reported /anmelden?fehler=google and preserve private destination",
  );
  assert.equal(
    (await (await call("/api/session")).json()).user.provider,
    "Google",
    "Native callback enrolls the regular authenticated app session",
  );
  assert(
    ![...jar.values()].some((value) =>
      (value.startsWith("base64-")
        ? Buffer.from(value.slice(7), "base64url").toString()
        : value
      ).includes("fixture-google-proof"),
    ),
    "Provider proof never persists in session cookies",
  );
  for (const [locale, target] of [
    ["sq", "/sq/vleresimet"],
    ["en", "/en/reviews"],
  ]) {
    callback = await begin(locale, target);
    response = await call(callback.href);
    assert.equal(response.headers.get("location"), origin + target);
  }
  callback = await begin("en", "https://untrusted.example/escape");
  response = await call(callback.href);
  assert.equal(
    response.headers.get("location"),
    origin + "/en?besuche=1",
    "External return target is replaced by a safe localized destination",
  );
  for (const mode of ["redirect", "failure", "mismatch"]) {
    googleMode = mode;
    callback = await begin("sq", "/sq/vleresimet");
    response = await call(callback.href);
    const location = new URL(response.headers.get("location"));
    assert.equal(location.pathname, "/sq/hyr");
    assert.equal(location.searchParams.get("fehler"), "google");
    assert.equal(
      (await (await call("/api/session")).json()).user,
      null,
      "Invalid independent proof never grants access",
    );
  }
  assert(
    !requests.some(
      (request) => request.url.origin === "https://untrusted.example",
    ),
    "Google bearer token never follows a redirect",
  );
  googleMode = "success";
  for (const mode of ["cancel", "flow", "code"]) {
    callback = await begin();
    const before = requests.length;
    if (mode === "cancel") {
      callback.searchParams.delete("code");
      callback.searchParams.set("error", "access_denied");
    }
    if (mode === "flow") callback.searchParams.set("fluss", "wrong-flow");
    if (mode === "code") exchangeMode = "failure";
    response = await call(callback.href);
    assert.equal(
      new URL(response.headers.get("location")).searchParams.get("fehler"),
      "google",
    );
    assert.equal((await (await call("/api/session")).json()).user, null);
    if (mode !== "code")
      assert(
        !requests
          .slice(before)
          .some((request) => request.url.pathname === "/auth/v1/token"),
        "Cancellation and invalid intent cannot exchange a code",
      );
  }
  assert(
    requests.some(
      (request) => request.url.pathname === "/auth/v1/.well-known/jwks.json",
    ),
    "Actual asymmetric JWT signature was verified",
  );
  console.log(
    "Native Worker Google callback: PKCE, asymmetric JWT, session, locales, safe return, provider errors and redirect fencing passed",
  );
} finally {
  await runtime.dispose();
}
