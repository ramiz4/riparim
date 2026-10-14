import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Miniflare } from "miniflare";

const config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
if (config.name === "riparim") {
  const modules = (await readdir("dist/server", { recursive: true }))
    .filter((file) => file.endsWith(".js"))
    .sort((a, b) =>
      a === "index.js" ? -1 : b === "index.js" ? 1 : a.localeCompare(b),
    )
    .map((file) => ({ type: "ESModule", path: resolve("dist/server", file) }));
  const base = {
    modules,
    modulesRoot: resolve("dist/server"),
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    bindings: { SITE_ORIGIN: "https://riparim.com" },
    assets: {
      directory: resolve("dist/client"),
      binding: "ASSETS",
      routerConfig: {
        has_user_worker: true,
        static_routing: { user_worker: config.assets.run_worker_first },
      },
      assetConfig: { html_handling: config.assets.html_handling },
    },
    outboundService() {
      throw Error("Private reads must use isolated provider fixtures");
    },
  };
  const unavailable = new Miniflare(base);
  try {
    for (const path of ["/api/business", "/api/visits", "/api/account"]) {
      const response = await unavailable.dispatchFetch(
        "https://riparim.com" + path,
        {
          headers: {
            "oai-authenticated-user-id": "forged-owner",
            "oai-authenticated-user-email": "owner@example.test",
          },
        },
      );
      assert.equal(
        response.status,
        path === "/api/account" ? 200 : 401,
        path + ": credential-free guests do not need auth storage",
      );
      assert.match(response.headers.get("Cache-Control"), /private.*no-store/);
      const value = await response.json();
      if (path === "/api/account")
        assert.deepEqual(value, {
          account: null,
          deletionReady: false,
          deletionStarted: false,
        });
      else assert.equal(value.errorCode, "authentication_required");
    }
  } finally {
    await unavailable.dispose();
  }
  const origin = "https://fixture-project.supabase.co",
    subject = "00000000-0000-4000-8000-000000000001",
    sessionId = "00000000-0000-4000-8000-000000000002",
    account = "supabase:fixture-project.supabase.co:" + subject;
  const fixtureUser = {
    id: subject,
    email: "private-member@example.test",
    email_confirmed_at: "2026-10-11",
    user_metadata: { full_name: "Private Member" },
    app_metadata: { provider: "email" },
    identities: [],
  };
  const expiry = Math.floor(Date.now() / 1000) + 3600,
    token = [
      { alg: "HS256", typ: "JWT" },
      {
        sub: subject,
        aud: "authenticated",
        iss: origin + "/auth/v1",
        session_id: sessionId,
        amr: [{ method: "password" }],
        exp: expiry,
      },
      "fixture-signature",
    ]
      .map((value) =>
        Buffer.from(
          typeof value === "string" ? value : JSON.stringify(value),
        ).toString("base64url"),
      )
      .join(".");
  const session = {
    access_token: token,
    refresh_token: "fixture-refresh",
    expires_at: expiry,
    expires_in: 3600,
    token_type: "bearer",
    user: fixtureUser,
  };
  const cookie = (value) =>
    "sb-fixture-project-auth-token=base64-" +
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const validCookie = cookie(session),
    expiredCookie = cookie({ ...session, expires_at: 1 });
  let mode = "healthy",
    providerCalls = 0;
  const runtime = new Miniflare({
    ...base,
    d1Databases: ["DB"],
    r2Buckets: ["BUCKET"],
    bindings: {
      SITE_ORIGIN: "https://riparim.com",
      REVIEW_MODERATOR_EMAIL: "owner@example.test",
    },
    outboundService(request) {
      const url = new URL(request.url);
      assert.equal(url.origin, origin, "No live provider");
      providerCalls++;
      if (mode === "outage")
        return Response.json({ msg: "Isolated outage" }, { status: 503 });
      if (url.pathname === "/auth/v1/token")
        return mode === "refresh-rejected"
          ? Response.json(
              {
                msg: "Rejected refresh",
                error_code: "refresh_token_not_found",
              },
              { status: 400 },
            )
          : Response.json(session);
      if (url.pathname === "/auth/v1/user")
        return mode === "user-rejected"
          ? Response.json(
              { msg: "Rejected user", error_code: "bad_jwt" },
              { status: 401 },
            )
          : Response.json(fixtureUser);
      throw Error("Unsupported private provider fixture");
    },
  });
  try {
    const db = await runtime.getD1Database("DB");
    for (const file of (await readdir("drizzle"))
      .filter((file) => file.endsWith(".sql"))
      .sort())
      for (const sql of (await readFile("drizzle/" + file, "utf8"))
        .split("--> statement-breakpoint")
        .filter((sql) => sql.trim()))
        await db.prepare(sql).run();
    const catalogue = JSON.parse(
      await readFile("dist/catalogue-import.json", "utf8"),
    );
    for (let offset = 0; offset < catalogue.statements.length; offset += 50)
      await db.batch(
        catalogue.statements
          .slice(offset, offset + 50)
          .map(({ sql, params }) => db.prepare(sql).bind(...params)),
      );
    await db
      .prepare(catalogue.completionSql)
      .bind(catalogue.key, "fixture")
      .run();
    await db
      .prepare(
        "INSERT INTO auth_settings(id,project_url,public_key,enabled,email_delivery_confirmed,updated_at) VALUES ('main',?,?,1,1,'fixture')",
      )
      .bind(origin, "sb_publishable_fixture_public_key_1234567890")
      .run();
    await db
      .prepare(
        "INSERT INTO auth_identities(provider,issuer,subject,account_id,created_at) VALUES ('supabase',?,?,?,'fixture')",
      )
      .bind(origin, subject, account)
      .run();
    await db
      .prepare(
        "INSERT INTO auth_sessions(id,account_id,legacy_access,expires_at,created_at,provider,identity_provider,identity_issuer,identity_subject) VALUES (?,?,1,?,'fixture','password','supabase',?,?)",
      )
      .bind(
        JSON.stringify(["supabase", origin, sessionId]),
        account,
        Date.now() + 3600000,
        origin,
        subject,
      )
      .run();
    await db
      .prepare(
        "INSERT INTO auth_links(account_id,legacy_owner,owner_admin,created_at,password_access) VALUES (?,'fixture-legacy',0,'fixture',1)",
      )
      .bind(account)
      .run();
    const workshop = await db
      .prepare(
        "SELECT * FROM workshops WHERE status='published' ORDER BY id LIMIT 1",
      )
      .first();
    const id = (index) =>
      "00000000-0000-4000-8000-" + String(index).padStart(12, "0");
    for (let index = 0; index < 52; index++) {
      const owner =
        index < 50
          ? account
          : index === 50
            ? "fixture-legacy"
            : "fixture-foreign";
      await db
        .prepare(
          "INSERT INTO visits(id,owner,workshop,date,vehicle,service,evidence_type,evidence_note,status,created_at) VALUES (?,?,?,'2026-10-11','Private vehicle','Repair','Anderer Nachweis','Private evidence remains owner scoped.','pending','2026-10-11')",
        )
        .bind(id(index + 10), owner, workshop.id)
        .run();
      const documents =
        index === 0
          ? JSON.stringify([
              {
                id: id(1000),
                fileKey: "evidence/private-claim/fixture.pdf",
                fileName: "Private proof.pdf",
                fileType: "application/pdf",
              },
            ])
          : "[]";
      await db
        .prepare(
          "INSERT INTO workshop_claims(id,owner,workshop_id,evidence,documents,created_at) VALUES (?,?,?,?,?,'2026-10-11')",
        )
        .bind(
          id(index + 100),
          owner,
          workshop.id,
          "Private ownership evidence ".repeat(3),
          documents,
        )
        .run();
    }
    await db
      .prepare(
        "INSERT INTO workshop_owners(workshop_id,account_id,claim_id,confirmed_at,confirmed_by) VALUES (?,?,?,'fixture','fixture-admin')",
      )
      .bind(workshop.id, account, id(100))
      .run();
    const profile = {
      phone: workshop.phone,
      phoneNote: workshop.phone_note,
      whatsapp: workshop.whatsapp,
      services: JSON.parse(workshop.services),
      serviceDetails: JSON.parse(workshop.service_details),
      description: workshop.description,
    };
    await db
      .prepare(
        "INSERT INTO workshop_changes(id,owner,workshop_id,profile,base_updated_at,created_at) VALUES (?,?,?,?,?,'fixture')",
      )
      .bind(
        id(200),
        account,
        workshop.id,
        JSON.stringify(profile),
        workshop.updated_at,
      )
      .run();
    const read = async (path, credential = validCookie) => {
      const response = await runtime.dispatchFetch(
        "https://riparim.com" + path,
        { headers: { cookie: credential } },
      );
      assert.match(response.headers.get("Cache-Control"), /private.*no-store/);
      assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
      assert.equal(
        response.headers.get("Referrer-Policy"),
        "strict-origin-when-cross-origin",
      );
      return response;
    };
    let before = providerCalls,
      response = await read("/api/visits"),
      data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(providerCalls - before, 1);
    assert.equal(data.visits.length, 50);
    assert(data.nextCursor);
    assert.equal(data.moderator, false);
    assert.equal(data.account.email, fixtureUser.email);
    response = await read(
      "/api/visits?cursor=" + encodeURIComponent(data.nextCursor),
    );
    const secondVisits = await response.json();
    assert.equal(secondVisits.visits.length, 1);
    assert.equal(secondVisits.nextCursor, null);
    assert.equal(
      new Set([...data.visits, ...secondVisits.visits].map((value) => value.id))
        .size,
      51,
    );
    assert(
      ![...data.visits, ...secondVisits.visits].some(
        (value) => value.id === id(61),
      ),
      "Foreign private visits remain excluded",
    );
    assert.equal((await read("/api/visits?id=" + id(61))).status, 404);
    assert.equal((await read("/api/visits?id=" + id(60))).status, 200);
    assert.equal((await read("/api/visits?cursor=invalid")).status, 400);
    assert.equal((await read("/api/visits?id=invalid")).status, 400);
    before = providerCalls;
    response = await read("/api/business");
    data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(providerCalls - before, 1);
    assert.equal(data.claims.length, 50);
    assert.equal(data.pendingClaims.length, 51);
    assert.deepEqual(data.pendingChangeRequestIds, [id(200)]);
    assert.deepEqual(data.pendingChangeWorkshopIds, [workshop.id]);
    assert.equal(data.workshops[0].id, workshop.id);
    assert(
      !JSON.stringify(data).includes("evidence/private-claim"),
      "Read DTOs expose download IDs and filenames, never private object keys",
    );
    const secondClaims = await (
      await read(
        "/api/business?claimCursor=" + encodeURIComponent(data.nextClaimCursor),
      )
    ).json();
    assert.equal(secondClaims.claims.length, 1);
    assert.equal(
      secondClaims.claims[0].documents[0].fileName,
      "Private proof.pdf",
    );
    assert.equal(
      new Set([...data.claims, ...secondClaims.claims].map((value) => value.id))
        .size,
      51,
    );
    assert(
      ![...data.claims, ...secondClaims.claims].some(
        (value) => value.id === id(151),
      ),
    );
    assert.equal((await read("/api/business?claimCursor=invalid")).status, 400);
    for (const path of [
      "/api/business?moderation=1",
      "/api/visits?moderation=1",
    ])
      assert.equal((await read(path)).status, 403);
    before = providerCalls;
    data = await (await read("/api/account")).json();
    assert.equal(providerCalls - before, 1);
    assert.deepEqual(data, {
      account: {
        email: fixtureUser.email,
        name: "Private Member",
        provider: "E-Mail",
        protected: false,
      },
      deletionReady: false,
      deletionStarted: false,
    });
    await db.prepare("UPDATE auth_sessions SET legacy_access=0").run();
    assert.equal(
      (await read("/api/visits?id=" + id(60))).status,
      404,
      "An old session cannot inherit a later legacy link",
    );
    await db.prepare("UPDATE auth_sessions SET legacy_access=1").run();
    await db.prepare("UPDATE auth_links SET password_access=0").run();
    assert.equal(
      (await read("/api/visits?id=" + id(60))).status,
      404,
      "Password ownership still requires its explicit linkage",
    );
    await db.prepare("UPDATE auth_links SET password_access=1").run();
    await db.prepare("UPDATE auth_sessions SET revoked=1").run();
    for (const path of ["/api/business", "/api/visits"])
      assert.equal((await read(path)).status, 401);
    assert.equal((await (await read("/api/account")).json()).account, null);
    await db.prepare("UPDATE auth_sessions SET revoked=0").run();
    await db
      .prepare(
        "INSERT INTO auth_account_roles VALUES (?,'admin','fixture','fixture')",
      )
      .bind(account)
      .run();
    assert.equal((await read("/api/business?moderation=1")).status, 200);
    data = await (await read("/api/visits?moderation=1")).json();
    assert.equal(data.moderator, true);
    assert.equal(data.pendingCount, 52);
    assert.equal(
      (await (await read("/api/account")).json()).account.protected,
      true,
    );
    await db.prepare("DELETE FROM auth_account_roles").run();
    assert.equal(
      (await read("/api/visits?moderation=1")).status,
      403,
      "A fresh request observes role removal",
    );
    await db.prepare("UPDATE auth_links SET owner_admin=1").run();
    assert.equal(
      (await (await read("/api/account")).json()).account.protected,
      true,
    );
    await db.prepare("UPDATE auth_links SET owner_admin=0").run();
    const grantToken = "01234567-0123-4123-8123-012345678901".repeat(2),
      grantHash = Buffer.from(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(grantToken),
        ),
      ).toString("hex"),
      grantCookie = validCookie + "; riparim-account-deletion=" + grantToken;
    await db
      .prepare(
        "INSERT INTO auth_account_deletions(account_id,user_id,token_hash,expires_at,started,identity_issuer,identity_provider) VALUES (?,?,?,?,0,?,'supabase')",
      )
      .bind(account, subject, grantHash, Date.now() + 3600000, origin)
      .run();
    assert.equal(
      (await (await read("/api/account", grantCookie)).json()).deletionReady,
      true,
    );
    await db
      .prepare("UPDATE auth_account_deletions SET identity_issuer=NULL")
      .run();
    assert.equal(
      (await (await read("/api/account", grantCookie)).json()).deletionReady,
      true,
      "Original legacy deletion grants retain their issuer boundary",
    );
    await db
      .prepare(
        "UPDATE auth_account_deletions SET identity_issuer='https://foreign-project.supabase.co'",
      )
      .run();
    assert.equal(
      (await (await read("/api/account", grantCookie)).json()).deletionReady,
      false,
      "Foreign issuer grants cannot authorize this account",
    );
    await db
      .prepare("UPDATE auth_account_deletions SET identity_issuer=?")
      .bind(origin)
      .run();
    await db
      .prepare("INSERT INTO auth_account_status VALUES (?,'deleted','fixture')")
      .bind(account)
      .run();
    await db.prepare("UPDATE auth_account_deletions SET started=1").run();
    assert.deepEqual(
      await (await read("/api/account", grantCookie)).json(),
      { account: null, deletionReady: false, deletionStarted: true },
      "Blocked accounts retain their scoped deletion retry UI",
    );
    assert.deepEqual(
      await (
        await read("/api/account", "riparim-account-deletion=" + grantToken)
      ).json(),
      { account: null, deletionReady: false, deletionStarted: true },
      "A deletion-only credential works without a normal session",
    );
    for (const path of ["/api/business", "/api/visits"])
      assert.equal((await read(path)).status, 401);
    await db.prepare("DELETE FROM auth_account_status").run();
    await db.prepare("DELETE FROM auth_account_deletions").run();
    for (const path of ["/api/business", "/api/visits", "/api/account"]) {
      response = await read(path, expiredCookie);
      assert.equal(response.status, 200);
      const renewal = response.headers.getSetCookie();
      assert(
        renewal.some(
          (value) =>
            value.includes("HttpOnly") &&
            value.includes("Secure") &&
            value.includes("SameSite=Lax") &&
            value.includes("Path=/"),
        ),
        path + ": refreshed credentials reach the private API response",
      );
      await response.text();
      mode = "refresh-rejected";
      response = await read(path, expiredCookie);
      assert.equal(response.status, path === "/api/account" ? 200 : 401);
      assert(
        response.headers
          .getSetCookie()
          .some((value) => value.includes("Max-Age=0")),
        path + ": definitive rejection clears expired credentials",
      );
      await response.text();
      mode = "outage";
      before = providerCalls;
      response = await read(path, expiredCookie);
      assert.equal(response.status, path === "/api/account" ? 200 : 401);
      assert.equal(response.headers.has("Set-Cookie"), false);
      assert.equal(
        providerCalls - before,
        1,
        path + ": an outage has one bounded provider attempt",
      );
      await response.text();
      mode = "healthy";
    }
    mode = "user-rejected";
    assert.equal((await read("/api/business")).status, 401);
    assert.equal((await read("/api/visits")).status, 401);
    assert.equal(
      (await (await read("/api/account")).json()).account,
      null,
      "A subsequent request observes provider rejection",
    );
    mode = "healthy";
    await db.prepare("DROP TABLE auth_settings").run();
    for (const [path, code] of [
      ["/api/business", "business_unavailable"],
      ["/api/visits", "review_unavailable"],
      ["/api/account", "account_unavailable"],
    ]) {
      response = await read(path);
      assert.equal(response.status, 503);
      assert.equal(
        (await response.json()).errorCode,
        code,
        "Auth storage failures retain the endpoint error contract",
      );
    }
  } finally {
    await runtime.dispose();
  }
  console.log(
    "Private Worker GETs: populated ownership and legacy links, pagination, roles/revocation, deletion retry scope, refresh/rejection/outage cookies and coded storage failures passed",
  );
}
