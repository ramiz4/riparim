import { assertPublicHead } from "./helpers/public-head.mjs";
import { logNodePhase, prepareNodeTestBuild } from "./helpers/node-build.mjs";
import { catalogueFixtureKey } from "./helpers/catalogue-fixture-key.mjs";
import assert from "node:assert/strict";
import { assertPrivacyOutput } from "./helpers/privacy-output.mjs";
import { localizeHref } from "../scripts/lib/locale.mjs";
import { pocketbaseNodeHttp } from "./helpers/pocketbase-node-http.mjs";
import { providerExitHttp } from "./helpers/provider-exit-http.mjs";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { JSDOM } from "jsdom";
import { setTimeout as delay } from "node:timers/promises";

const run = promisify(execFile),
  directory = await mkdtemp(join(tmpdir(), "riparim-node-http-"));
let server,
  logs = "",
  httpStarted;
const source = join(directory, "source");
async function start(
  environment,
  port,
  hostname = "127.0.0.1",
  fixture = true,
) {
  const started = performance.now();
  server = spawn(
    process.execPath,
    [
      ...(fixture
        ? ["--import", "./tests/fixtures/node-auth-provider.mjs"]
        : []),
      ".node-runtime/server.mjs",
      "--hostname",
      hostname,
      "--port",
      String(port),
    ],
    { cwd: source, env: environment, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (data) => (logs += data));
  server.stderr.on("data", (data) => (logs += data));
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/session`);
      if (response.ok || response.status === 503) {
        logNodePhase("runtime startup", started);
        httpStarted = performance.now();
        return;
      }
    } catch {}
    await delay(100);
  }
  throw new Error("Node server did not start: " + logs);
}
function renderedRscElements(body) {
  const elements = [];
  function visit(value) {
    if (Array.isArray(value)) {
      if (value[0] === "$" && value[3] && typeof value[3] === "object")
        elements.push({ type: value[1], props: value[3] });
      value.forEach(visit);
    } else if (value && typeof value === "object")
      Object.values(value).forEach(visit);
  }
  for (const line of body.split("\n")) {
    const payload = line.match(/^[0-9a-f]+:(.*)$/)?.[1];
    if (!payload) continue;
    let value;
    try {
      value = JSON.parse(payload);
    } catch {
      continue;
    } // Module and other protocol records are not React elements.
    visit(value);
  }
  return elements;
}
async function stop() {
  if (!server) return;
  logNodePhase("runtime HTTP", httpStarted);
  const started = performance.now();
  if (server.exitCode !== null || server.signalCode !== null) {
    server = undefined;
    return;
  }
  const closed = new Promise((resolve) => server.on("close", resolve));
  server.kill("SIGTERM");
  await closed;
  server = undefined;
  logNodePhase("runtime shutdown", started);
}
try {
  await prepareNodeTestBuild({
    root: process.cwd(),
    source,
    environment: { ...process.env, RIPARIM_DATA_DIR: directory },
  });
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`,
    environment = {
      ...process.env,
      RIPARIM_DATA_DIR: directory,
      SITE_ORIGIN: origin,
      REVIEW_MODERATOR_EMAIL: "moderator@fixture.invalid",
      RIPARIM_TRUSTED_PROXIES: "",
      NEXT_TELEMETRY_DISABLED: "1",
    };
  await run(process.execPath, [".node-runtime/command.mjs", "migrate"], {
    cwd: source,
    env: environment,
  });
  // Keep the real catalogue immutable. This isolated DB has only synthetic rows.
  const db = new DatabaseSync(join(directory, "app.sqlite"));
  const marker = await catalogueFixtureKey();
  db.prepare("INSERT INTO catalog_state VALUES (?,?)").run(marker, "fixture");
  for (const [id, name, status] of [
    ["fixture-public", "Synthetic Node Workshop", "published"],
    ["fixture-draft", "Private Draft Workshop", "draft"],
  ])
    db.prepare(
      "INSERT INTO workshops (id,name,city,address,phone,brands,services,specialty,description,sources,checked_at,status,updated_at) VALUES (?,?, 'Prishtina','Synthetic road 1','+38344123456','[]','[\"Inspektion\"]','Synthetic','Fictional workshop for isolated integration','[]','2026-10-01',?,'2026-10-01T00:00:00Z')",
    ).run(id, name, status);
  db.prepare(
    "INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at) VALUES ('main',?,?,1,0,?)",
  ).run(
    "https://node-auth-fixture.supabase.co",
    "sb_publishable_synthetic_fixture_1234567890",
    "2026-10-01T00:00:00Z",
  );
  db.close();
  await start(environment, port);
  const sitemapResponse = await fetch(origin + "/sitemap.xml?q=private-query", {
    headers: { cookie: "untrusted=fixture" },
  });
  assert.equal(
    sitemapResponse.status,
    200,
    "Published URLs have an XML sitemap",
  );
  assert.match(sitemapResponse.headers.get("content-type"), /application\/xml/);
  assert.equal(sitemapResponse.headers.has("set-cookie"), false);
  const sitemapXml = await sitemapResponse.text();
  const sitemap = new JSDOM(sitemapXml, { contentType: "application/xml" });
  assert.equal(sitemap.window.document.documentElement.localName, "urlset");
  assert.deepEqual(
    [...sitemap.window.document.querySelectorAll("loc")]
      .map((node) => node.textContent)
      .sort(),
    [
      "/",
      "/sq",
      "/en",
      "/werkstaetten",
      "/sq/serviset",
      "/en/workshops",
      ...["prishtina", "prizren", "ferizaj", "peja", "gjakova"].flatMap(
        (slug) =>
          ["de", "sq", "en"].map((locale) =>
            localizeHref(`/workshops/${slug}`, locale),
          ),
      ),
      "/ratgeber",
      "/sq/udhezues",
      "/en/guides",
      "/ratgeber/werkstatt-auswaehlen",
      "/sq/udhezues/zgjedhja-e-servisit",
      "/en/guides/choosing-a-workshop",
      "/ratgeber/werkstattbesuch-vorbereiten",
      "/sq/udhezues/pergatitja-e-vizites",
      "/en/guides/preparing-a-visit",
      "/werkstatt/fixture-public",
      "/sq/servis/fixture-public",
      "/en/workshop/fixture-public",
    ]
      .map((path) => origin + path)
      .sort(),
    "Only canonical home, catalogue, five city pages, three guides and published profiles enter the sitemap",
  );
  assert(
    !sitemapXml.includes("fixture-draft") &&
      !sitemapXml.includes("private-query"),
  );
  for (const url of sitemap.window.document.querySelectorAll("url")) {
    const links = [
      ...url.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "link"),
    ];
    assert.deepEqual(
      links.map((link) => link.getAttribute("hreflang")).sort(),
      ["de", "en", "sq", "x-default"],
    );
    assert(
      links.some(
        (link) =>
          link.getAttribute("href") === url.querySelector("loc").textContent,
      ),
      "Alternates include the URL itself",
    );
  }
  const robotsResponse = await fetch(origin + "/robots.txt");
  assert.equal(robotsResponse.status, 200);
  assert.match(
    await robotsResponse.text(),
    new RegExp(`Sitemap: ${origin}/sitemap\\.xml`),
  );
  assert.equal(
    (await fetch(origin + "/sitemap.xml", { method: "HEAD" })).status,
    200,
  );
  assert.equal((await fetch(origin + "/en/sitemap.xml")).status, 404);
  for (const locale of ["de", "sq", "en"])
    for (const init of [
      {},
      { method: "HEAD" },
      { headers: { RSC: "1", Accept: "text/x-component" } },
    ]) {
      const response = await fetch(
        origin +
          localizeHref("/datenschutz", locale) +
          (init.headers ? "?_rsc" : ""),
        init,
      );
      assert.equal(response.status, 200);
      const output = await response.text();
      if (init.method === "HEAD") assert.equal(output, "");
      else {
        assertPrivacyOutput(output, locale, "supabase");
        if (init.headers)
          assert.match(
            response.headers.get("content-type"),
            /text\/x-component/,
          );
      }
    }
  const workshops = await (await fetch(origin + "/api/workshops")).json();
  assert.deepEqual(
    workshops.workshops.map((workshop) => workshop.id),
    ["fixture-public"],
  );
  for (const path of [
    "/werkstaetten",
    "/en/workshops",
    "/sq/servis/fixture-public",
  ]) {
    const response = await fetch(origin + path, { redirect: "manual" });
    assert.equal(response.status, 200, path + logs);
    assert.match(await response.text(), /Synthetic Node Workshop/);
  }
  for (const locale of ["de", "sq", "en"])
    for (const identity of [
      "/guides",
      "/guides/choosing-a-workshop",
      "/guides/preparing-a-visit",
    ]) {
      const path = localizeHref(identity, locale);
      for (const init of [
        {},
        { method: "HEAD" },
        { headers: { RSC: "1", Accept: "text/x-component" } },
      ]) {
        const response = await fetch(
          origin + path + "?token=private-guide-query",
          init,
        );
        assert.equal(response.status, 200, path + logs);
        const body = await response.text();
        assert(!body.includes("Private Draft Workshop"));
        assert.match(
          response.headers.get("cache-control"),
          /private.*no-store/,
        );
        if (init.method === "HEAD") {
          assert.equal(body, "");
          continue;
        }
        let metadataLinks;
        // Next retains the current request query in its private router/Flight
        // envelope. Public article elements, metadata and links must stay clean.
        if (init.headers) {
          assert.match(
            response.headers.get("content-type"),
            /text\/x-component/,
          );
          const elements = renderedRscElements(body);
          assert(
            elements.some(
              ({ type, props }) =>
                type === "main" && props["data-riparim-page"] === "guide",
            ),
          );
          assert(
            elements.every(
              ({ props }) =>
                !JSON.stringify(props).includes("private-guide-query"),
            ),
            "Rendered guide RSC elements never expose ignored query values",
          );
          metadataLinks = elements
            .filter(({ type }) => type === "link")
            .map(({ props }) => props);
        } else {
          const dom = new JSDOM(body);
          try {
            const doc = dom.window.document;
            assert.equal(doc.documentElement.lang, locale);
            assert(doc.querySelector('main[data-riparim-page="guide"]'));
            assert(
              !doc
                .querySelector("main")
                .outerHTML.includes("private-guide-query"),
            );
            assert(
              [...doc.querySelectorAll("head title,head meta,head link")].every(
                (node) => !node.outerHTML.includes("private-guide-query"),
              ),
              "Guide metadata excludes ignored query values",
            );
            assert(
              [...doc.querySelectorAll("a[href]")].every(
                (node) =>
                  !node.getAttribute("href").includes("private-guide-query"),
              ),
              "Public guide links exclude ignored query values",
            );
            metadataLinks = [...doc.querySelectorAll("head link")].map(
              (node) => ({
                rel: node.rel,
                href: node.href,
                hrefLang: node.hreflang,
              }),
            );
            assert(!body.includes("noindex"));
          } finally {
            dom.window.close();
          }
        }
        assert.equal(
          metadataLinks.find((link) => link.rel === "canonical")?.href,
          origin + path,
          "Node guide canonical matches the clean public locale URL",
        );
        assert.deepEqual(
          Object.fromEntries(
            metadataLinks
              .filter((link) => link.rel === "alternate" && link.hrefLang)
              .map((link) => [link.hrefLang, link.href]),
          ),
          Object.fromEntries(
            ["de", "sq", "en", "x-default"].map((language) => [
              language,
              origin +
                localizeHref(
                  identity,
                  language === "x-default" ? "de" : language,
                ),
            ]),
          ),
          "Guide HTML and RSC expose clean reciprocal alternatives",
        );
        const clean = await fetch(origin + path, init);
        assert.equal(clean.status, 200);
        assert(
          !(await clean.text()).includes("private-guide-query"),
          "A following clean request never contains another request's query value",
        );
      }
    }
  for (const path of [
    "/ratgeber/missing",
    "/sq/udhezues/missing",
    "/en/guides/missing",
  ])
    assert.equal(
      (await fetch(origin + path)).status,
      404,
      "Unknown guide is a real Node 404",
    );
  for (const locale of ["de", "sq", "en"])
    for (const init of [
      {},
      { method: "HEAD" },
      { headers: { RSC: "1", Accept: "text/x-component" } },
    ]) {
      const response = await fetch(
        origin + localizeHref("/workshops/prishtina", locale),
        init,
      );
      assert.equal(
        response.status,
        200,
        "City routes use the same Node boundary",
      );
      const body = await response.text();
      assert(!body.includes("Private Draft Workshop"));
      if (init.method !== "HEAD")
        assert(body.includes("Synthetic Node Workshop"));
    }
  const emptyCity = await fetch(origin + "/en/workshops/peja");
  assert.equal(emptyCity.status, 200);
  assert(
    (await emptyCity.text()).includes(
      "No profile is currently published for Peja",
    ),
  );
  for (const path of [
    "/werkstaetten/unknown",
    "/en/workshops/unknown",
    "/sq/serviset/prishtina/extra",
  ])
    for (const init of [
      {},
      { method: "HEAD" },
      { headers: { RSC: "1", Accept: "text/x-component" } },
    ]) {
      const response = await fetch(origin + path, init);
      assert.equal(
        response.status,
        404,
        "Unsupported cities are real 404 in Node",
      );
      await response.text();
    }
  for (const locale of ["de", "sq", "en"])
    for (const identity of [
      "/",
      "/workshops",
      "/workshops/prishtina",
      "/workshop/fixture-public",
      "/privacy",
      "/guides",
      "/guides/choosing-a-workshop",
      "/guides/preparing-a-visit",
    ])
      for (const userAgent of [
        "",
        "Mozilla/5.0",
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Twitterbot/1.0",
      ]) {
        const response = await fetch(
          origin + localizeHref(identity, locale) + "?q=private-head-query",
          { headers: { "User-Agent": userAgent } },
        );
        assert.equal(response.status, 200);
        assertPublicHead(await response.text(), identity, locale, origin);
      }
  for (const [alias, target] of [
    ["/en/werkstaetten?ort=Prizren", "/en/workshops?ort=Prizren"],
    [
      "/sq/werkstatt/fixture-public?suche=%2Fsq%2Fserviset",
      "/sq/servis/fixture-public?suche=%2Fsq%2Fserviset",
    ],
  ]) {
    const response = await fetch(origin + alias, { redirect: "manual" });
    assert.equal(response.status, 308);
    assert.equal(
      new URL(response.headers.get("location"), origin).href,
      origin + target,
      "public aliases preserve their query and use the localized canonical path",
    );
  }
  for (const [prefix, profile] of [
    ["", "/werkstatt/"],
    ["/en", "/workshop/"],
    ["/sq", "/servis/"],
  ])
    for (const id of ["fixture-draft", "unknown-profile", "x"])
      for (const init of [
        {},
        { method: "HEAD" },
        { headers: { RSC: "1", Accept: "text/x-component" } },
      ]) {
        const unavailable = await fetch(origin + prefix + profile + id, init);
        assert.equal(
          unavailable.status,
          404,
          "unavailable profiles retain the shared pre-streaming status",
        );
        const body = await unavailable.text();
        assert(!body.includes("Private Draft Workshop"));
        if (init.method === "HEAD") assert.equal(body, "");
        else if (init.headers)
          assert.match(
            unavailable.headers.get("content-type"),
            /text\/x-component/,
          );
        else assert.match(body, /noindex/);
      }
  assert.equal(
    (await fetch(origin + "/de/werkstaetten", { redirect: "manual" })).status,
    308,
  );
  const forged = {
    "oai-authenticated-user-id": "fixture-native",
    "oai-authenticated-user-email": "moderator@fixture.invalid",
    "oai-authenticated-user-full-name": "Fixture Admin",
  };
  assert.deepEqual(
    await (await fetch(origin + "/api/session", { headers: forged })).json(),
    { account: null, isAdmin: false },
  );
  for (const path of [
    "/api/workshops?admin=1",
    "/api/visits",
    "/api/users",
    "/api/auth-settings",
    "/api/evidence/fixture-private",
    "/api/business/evidence/fixture-private",
  ]) {
    const response = await fetch(origin + path, { headers: forged });
    assert.equal(response.status, 401, path + logs);
  }
  assert.equal(
    (await fetch(origin + "/api/visits", { method: "POST", headers: forged }))
      .status,
    401,
  );
  for (const path of ["/.riparim/files.sqlite", "/evidence/fixture/private"])
    assert.equal((await fetch(origin + path)).status, 404);
  // Rotating untrusted headers cannot create fresh Google IP quotas.
  for (let attempt = 1; attempt <= 121; attempt++) {
    const response = await fetch(origin + "/api/auth/google", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "cf-connecting-ip": `192.0.2.${attempt}`,
        "x-real-ip": `198.51.100.${attempt}`,
        "x-forwarded-for": `203.0.113.${attempt}`,
        "x-riparim-client-ip": `203.0.113.${attempt}`,
      },
      body: JSON.stringify({ locale: "de", returnTo: "/" }),
    });
    assert.equal(
      response.status,
      attempt <= 120 ? 200 : 429,
      `Google attempt ${attempt} must use the real socket peer`,
    );
  }
  const attempts = new DatabaseSync(join(directory, "app.sqlite"));
  assert.equal(
    attempts.prepare("SELECT COUNT(*) AS count FROM auth_attempts").get().count,
    1,
    "untrusted forwarding headers keep one direct-client scope",
  );
  const scope = (ip) =>
    createHash("sha256")
      .update("google:ip:" + ip)
      .digest("hex");
  assert(
    attempts
      .prepare("SELECT key FROM auth_attempts")
      .get()
      .key.startsWith(scope("127.0.0.1") + ":"),
    "the limiter receives the socket address through Next",
  );
  await stop();
  attempts.exec("DELETE FROM auth_attempts");
  // A deliberately configured proxy peer may supply its overwritten X-Real-IP.
  await start(
    { ...environment, RIPARIM_TRUSTED_PROXIES: "::FFFF:7f00:1" },
    port,
    "::ffff:127.0.0.1",
  );
  const statuses = await Promise.all(
    Array.from({ length: 40 }, async (_, index) => {
      const ip = `192.0.2.${10 + (index % 2)}`,
        real = index % 4 < 2 ? ip : "::ffff:" + ip;
      const response = await fetch(origin + "/api/auth/google", {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          "x-real-ip": real,
          "cf-connecting-ip": `203.0.113.${index + 1}`,
        },
        body: JSON.stringify({ locale: "de" }),
      });
      await response.json();
      return response.status;
    }),
  );
  assert(statuses.every((status) => status === 200));
  const rows = attempts.prepare("SELECT key,attempts FROM auth_attempts").all();
  assert.equal(
    rows.length,
    2,
    "concurrent forwarded clients retain separate async scopes",
  );
  for (const ip of ["192.0.2.10", "192.0.2.11"])
    assert.equal(
      rows.find((row) => row.key.startsWith(scope(ip) + ":"))?.attempts,
      20,
      "mapped and plain IP forms share the same client quota",
    );
  const invalid = await fetch(origin + "/api/auth/google", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "x-real-ip": "192.0.2.10, 192.0.2.11",
    },
    body: JSON.stringify({ locale: "de" }),
  });
  assert.equal(invalid.status, 200);
  assert.equal(
    attempts
      .prepare("SELECT attempts FROM auth_attempts WHERE key LIKE ?")
      .get(scope("127.0.0.1") + ":%").attempts,
    1,
    "invalid forwarded IP falls back to the socket peer",
  );
  attempts.close();
  await stop();
  const publishedOrigin = "https://node-fixture.invalid";
  await start({ ...environment, SITE_ORIGIN: publishedOrigin }, port);
  const publicPage = await fetch(origin + "/werkstaetten", {
    headers: {
      Host: "forged-host.invalid",
      "x-forwarded-host": "forged-forward.invalid",
      "x-forwarded-proto": "http",
    },
  });
  assert.equal(publicPage.status, 200);
  assert.match(await publicPage.text(), /Synthetic Node Workshop/);
  const published = await fetch(origin + "/api/auth/google", {
    method: "POST",
    headers: {
      Origin: publishedOrigin,
      Host: "forged-host.invalid",
      "Content-Type": "application/json",
      "x-forwarded-host": "forged-forward.invalid",
      "x-forwarded-proto": "http",
    },
    body: JSON.stringify({ locale: "de" }),
  });
  assert.equal(
    published.status,
    200,
    "trusted public HTTPS origin is independent of socket and forwarding headers",
  );
  assert(
    new URL((await published.json()).url).searchParams
      .get("redirect_to")
      .startsWith(publishedOrigin + "/auth/bestaetigen"),
  );
  assert.equal(
    (
      await fetch(origin + "/api/auth/google", {
        method: "POST",
        headers: {
          Origin: "https://foreign.invalid",
          "Content-Type": "application/json",
          "x-forwarded-host": "foreign.invalid",
          "x-forwarded-proto": "https",
        },
        body: JSON.stringify({ locale: "de" }),
      })
    ).status,
    403,
    "foreign Origin is denied behind the configured HTTPS origin",
  );
  for (const value of [
    "https://node-fixture.invalid/path",
    "https://node-fixture.invalid?query=1",
    "https://fixture:secret@node-fixture.invalid",
    "ftp://node-fixture.invalid",
  ])
    await assert.rejects(
      run(
        process.execPath,
        [".node-runtime/server.mjs", "--port", String(port)],
        {
          cwd: source,
          env: { ...environment, SITE_ORIGIN: value },
          timeout: 10000,
        },
      ),
      /SITE_ORIGIN must be an HTTP/,
    );
  // The executable retry path awaits all work and does not need a Worker context.
  await assert.rejects(
    run(process.execPath, [".node-runtime/command.mjs", "notifications"], {
      cwd: source,
      env: environment,
    }),
    /Provide the notification event ID/,
  );
  await run(
    process.execPath,
    [
      ".node-runtime/command.mjs",
      "notifications",
      "riparim-review-missing-event",
    ],
    { cwd: source, env: environment },
  );
  await stop();
  const maintenance = {
    ...environment,
    MIGRATION_READ_ONLY: "true",
    MIGRATION_SOURCE_COMMIT: "b".repeat(40),
    MIGRATION_EXPORT_TOKEN_SHA256: createHash("sha256")
      .update("a".repeat(64))
      .digest("hex"),
    MIGRATION_EXPORT_EXPIRES_AT: new Date(Date.now() + 3600000).toISOString(),
  };
  await start(maintenance, port);
  assert.equal(
    (await fetch(origin + "/api/session")).status,
    503,
    "Node cutover blocks even GET writers before application authentication",
  );
  assert.equal(
    (await fetch(origin + "/__migration/export?operation=schema")).status,
    404,
  );
  const exportResponse = await fetch(
    origin + "/__migration/export?operation=schema",
    { headers: { Authorization: "Bearer " + "a".repeat(64) } },
  );
  assert.equal(exportResponse.status, 200);
  assert(
    (await exportResponse.json()).schema.some(
      (item) => item.name === "riparim_node_migrations",
    ),
  );
  await stop();
  await providerExitHttp({ directory, port, start, stop, source });
  await pocketbaseNodeHttp({ directory, port, start, stop, source });
  console.log(
    "Actual Node production server: synthetic public pages/APIs, drafts, forged identity, auth refusal, private storage, socket/proxy rate limits, async isolation and outbox command passed",
  );
} catch (error) {
  throw new Error(
    `${error.stack}\n${error.stdout ?? ""}\n${error.cause?.stack ?? ""}\n${logs}`,
  );
} finally {
  await stop();
  await rm(directory, { recursive: true, force: true });
}
