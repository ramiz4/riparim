import { assertPublicHead } from "./helpers/public-head.mjs";
import { localizeHref, guidePagePaths } from "../scripts/lib/locale.mjs";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { assertPrivacyOutput } from "./helpers/privacy-output.mjs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Miniflare } from "miniflare";
const config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
if (config.name === "riparim") {
  const manifest = JSON.parse(
    await readFile("dist/public-release.json", "utf8"),
  );
  const canonical = JSON.parse(await readFile("data/workshops.json", "utf8"));
  const published = canonical.workshops.filter((w) => w.status === "published");
  assert.equal(
    manifest.pages,
    3 * (published.length + 8 + guidePagePaths.length),
  );
  assert.equal(manifest.privateData, false);
  assert.equal(manifest.privacyVariants, 3);
  const modules = (await readdir("dist/server", { recursive: true }))
    .filter((file) => file.endsWith(".js"))
    .sort((a, b) =>
      a === "index.js" ? -1 : b === "index.js" ? 1 : a.localeCompare(b),
    )
    .map((file) => ({ type: "ESModule", path: resolve("dist/server", file) }));
  for (const locale of ["de", "sq", "en"]) {
    for (const identity of [
      "/",
      "/privacy",
      "/workshops",
      "/workshops/prishtina",
      ...guidePagePaths,
      `/workshop/${published[0].id}`,
    ]) {
      const artifact = identity === "/" ? "home" : identity.slice(1);
      for (const suffix of ["", "-shell"])
        assertPublicHead(
          await readFile(
            `dist/client/__public/${locale}/${artifact}${suffix}.html`,
            "utf8",
          ),
          identity,
          locale,
          "https://riparim.com",
        );
    }
    assertPublicHead(
      await readFile(
        `dist/client/__public/${locale}/privacy-pocketbase.html`,
        "utf8",
      ),
      "/privacy",
      locale,
      "https://riparim.com",
    );
  }
  let providerCalls = 0,
    authenticated = false,
    refreshedSession = null,
    rejectRefresh = false;
  const fixtureUser = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "private-member@example.test",
    email_confirmed_at: "2026-10-11",
    user_metadata: { full_name: "Private Member" },
    app_metadata: { provider: "email" },
  };
  const options = {
    modules,
    modulesRoot: resolve("dist/server"),
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    d1Databases: ["DB"],
    r2Buckets: ["BUCKET"],
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
    outboundService: (request) => {
      providerCalls++;
      if (authenticated) {
        const url = new URL(request.url);
        assert.equal(
          url.origin,
          "https://fixture-project.supabase.co",
          "No live provider",
        );
        if (url.pathname === "/auth/v1/user") return Response.json(fixtureUser);
        if (url.pathname === "/auth/v1/token")
          return rejectRefresh
            ? Response.json(
                { msg: "Rejected", error_code: "refresh_token_not_found" },
                { status: 400 },
              )
            : Response.json(refreshedSession);
        if (url.pathname === "/auth/v1/settings")
          return Response.json({
            external: { email: true, google: true },
            mailer_autoconfirm: false,
            disable_signup: false,
          });
      }
      return new Response("No external access", { status: 502 });
    },
  };
  const runtime = new Miniflare(options);
  try {
    let db = await runtime.getD1Database("DB");
    for (const file of (await readdir("drizzle"))
      .filter((file) => file.endsWith(".sql"))
      .sort())
      for (const sql of (await readFile("drizzle/" + file, "utf8"))
        .split("--> statement-breakpoint")
        .filter((sql) => sql.trim()))
        await db.prepare(sql).run();
    const seed = await runtime.dispatchFetch(
      "https://riparim.com/api/workshops",
    );
    assert.equal(seed.status, 200);
    await seed.text();
    // Read the real renderer's build identity independently from the release
    // fast path. Link-only tests cannot catch a valid click rejected at RSC fetch.
    await runtime.setOptions({
      ...options,
      bindings: { ...options.bindings, PUBLIC_RELEASE_RENDER: "shell" },
    });
    const renderedRsc = await runtime.dispatchFetch(
      "https://riparim.com/en/settings?_rsc",
      { headers: { RSC: "1", Accept: "text/x-component" } },
    );
    const compatibilityId = renderedRsc.headers.get(
      "X-Vinext-RSC-Compatibility-Id",
    );
    assert(
      compatibilityId,
      "The actual Vinext renderer supplies a build identity",
    );
    await renderedRsc.text();
    await runtime.setOptions(options);
    db = await runtime.getD1Database("DB");
    const sitemapResponse = await runtime.dispatchFetch(
      "https://riparim.com/sitemap.xml?private=fixture",
      { headers: { cookie: "untrusted=fixture" } },
    );
    assert.equal(sitemapResponse.status, 200);
    assert.match(
      sitemapResponse.headers.get("Content-Type"),
      /application\/xml/,
    );
    assert.equal(sitemapResponse.headers.has("set-cookie"), false);
    const sitemapXml = await sitemapResponse.text();
    const sitemapDocument = new JSDOM(sitemapXml, {
      contentType: "application/xml",
    }).window.document;
    const sitemapLocations = [...sitemapDocument.querySelectorAll("loc")].map(
      (node) => node.textContent,
    );
    assert.equal(
      sitemapLocations.length,
      3 * (published.length + 7 + guidePagePaths.length),
    );
    assert(sitemapLocations.includes("https://riparim.com/sq/serviset"));
    assert(!sitemapXml.includes("private=fixture"));
    for (const slug of ["prishtina", "prizren", "ferizaj", "peja", "gjakova"])
      for (const locale of ["de", "sq", "en"])
        assert(
          sitemapLocations.includes(
            "https://riparim.com" + localizeHref(`/workshops/${slug}`, locale),
          ),
          "City sitemap URLs match rendered canonical routes",
        );
    for (const identity of guidePagePaths)
      for (const locale of ["de", "sq", "en"])
        assert(
          sitemapLocations.includes(
            "https://riparim.com" + localizeHref(identity, locale),
          ),
          "Worker sitemap advertises every canonical guide locale",
        );
    for (const workshop of published)
      for (const locale of ["de", "sq", "en"])
        assert(
          sitemapLocations.includes(
            "https://riparim.com" +
              localizeHref(`/workshop/${workshop.id}`, locale),
          ),
        );
    for (const init of [{}, { method: "HEAD" }]) {
      const robots = await runtime.dispatchFetch(
        "https://riparim.com/robots.txt",
        init,
      );
      assert.equal(robots.status, 200);
      if (init.method === "HEAD") assert.equal(await robots.text(), "");
      else
        assert.match(
          await robots.text(),
          /Sitemap: https:\/\/riparim\.com\/sitemap\.xml/,
        );
    }
    for (const path of [
      "/en/sitemap.xml",
      "/sq/robots.txt",
      "/sitemap-unknown.xml",
      "/en/workshop/fixture-unknown",
    ])
      assert.equal(
        (await runtime.dispatchFetch("https://riparim.com" + path)).status,
        404,
        path,
      );
    const first = published[0];
    const previewResponse = await runtime.dispatchFetch(
      "https://riparim.com/api/premium-workshops?locale=sq",
    );
    assert.equal(previewResponse.status, 200);
    const preview = await previewResponse.json();
    assert.equal(preview.preview, true);
    assert(
      preview.workshops.every((workshop) => workshop.status === "published"),
    );
    const forgedPromotion = await runtime.dispatchFetch(
      "https://riparim.com/api/premium-workshops",
      {
        method: "PUT",
        headers: {
          Origin: "https://riparim.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workshop: first.id, active: true }),
      },
    );
    assert.equal(forgedPromotion.status, 401);
    await forgedPromotion.text();
    await db
      .prepare(
        "INSERT INTO workshop_premium (workshop_id,active,updated_at) VALUES (?,1,?)",
      )
      .bind(first.id, "fixture")
      .run();
    const paidResponse = await runtime.dispatchFetch(
      "https://riparim.com/api/premium-workshops?locale=en",
    );
    assert.equal(paidResponse.status, 200);
    const paid = await paidResponse.json();
    assert.equal(paid.preview, false);
    assert.deepEqual(
      paid.workshops.map((workshop) => workshop.id),
      [first.id],
    );
    await db
      .prepare("DELETE FROM workshop_premium WHERE workshop_id=?")
      .bind(first.id)
      .run();
    for (const locale of ["de", "sq", "en"])
      for (const path of [
        "/",
        "/datenschutz",
        ...guidePagePaths,
        "/werkstaetten",
        "/workshops/prishtina",
        `/werkstatt/${first.id}`,
      ]) {
        const response = await runtime.dispatchFetch(
          "https://riparim.com" +
            localizeHref(path, locale) +
            "?q=private-secret",
          {
            headers: {
              "oai-authenticated-user-email": "private-user@example.test",
              cookie: "untrusted=fixture",
            },
          },
        );
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("X-Riparim-Public-Snapshot"), "1");
        assert.equal(response.headers.has("set-cookie"), false);
        assert.equal(response.headers.get("Cache-Control"), "no-store");
        const html = await response.text();
        assertPublicHead(html, path, locale, "https://riparim.com");
        assert(html.includes(`<html lang="${locale}"`));
        assert(!html.includes("private-secret"));
        assert(!html.includes("private-user@example.test"));
        if (path === "/werkstaetten") {
          const index = new JSDOM(html).window.document.querySelector(
            "details[data-ui='workshop-index']",
          );
          assert(
            index,
            "Immutable release HTML exposes the entire published catalogue without JavaScript",
          );
          assert.deepEqual(
            [...index.querySelectorAll("a[href]")]
              .map(
                (link) =>
                  new URL(link.getAttribute("href"), "https://riparim.com")
                    .pathname,
              )
              .sort(),
            published
              .map((workshop) =>
                localizeHref(`/workshop/${workshop.id}`, locale),
              )
              .sort(),
          );
          for (const link of index.querySelectorAll("a[href]")) {
            const target = new URL(
              link.getAttribute("href"),
              "https://riparim.com",
            );
            assert.deepEqual([...target.searchParams.keys()], ["suche"]);
            assert.equal(
              target.searchParams.get("suche"),
              localizeHref("/workshops", locale),
              "Release index links retain only a clean public catalogue return target",
            );
          }
        }
        if (path === "/datenschutz")
          assertPrivacyOutput(html, locale, "supabase");
        const navigation = await runtime.dispatchFetch(
          "https://riparim.com" + localizeHref(path, locale) + "?_rsc",
          { headers: { RSC: "1", Accept: "text/x-component" } },
        );
        assert.equal(navigation.status, 200);
        assert.equal(
          navigation.headers.get("X-Vinext-RSC-Compatibility-Id"),
          compatibilityId,
          "Every public locale route preserves the real renderer build identity",
        );
        await navigation.text();
      }
    for (const locale of ["de", "sq", "en"])
      for (const city of [
        "Prishtina",
        "Prizren",
        "Ferizaj",
        "Peja",
        "Gjakova",
      ]) {
        const path = localizeHref(`/workshops/${city.toLowerCase()}`, locale);
        const response = await runtime.dispatchFetch(
          "https://riparim.com" + path,
        );
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("X-Riparim-Public-Snapshot"), "1");
        const body = await response.text();
        assertPublicHead(
          body,
          `/workshops/${city.toLowerCase()}`,
          locale,
          "https://riparim.com",
        );
        assert.deepEqual(
          [...body.matchAll(/data-workshop-id="([^"]+)"/g)]
            .map((match) => match[1])
            .sort(),
          published
            .filter((workshop) => workshop.city === city)
            .map((workshop) => workshop.id)
            .sort(),
          "Actual city snapshot contains every and only matching published profile",
        );
        assert(body.includes(`https://riparim.com${path}`));
        const head = await runtime.dispatchFetch("https://riparim.com" + path, {
          method: "HEAD",
        });
        assert.equal(head.status, 200);
        assert.equal(await head.text(), "");
        const navigation = await runtime.dispatchFetch(
          "https://riparim.com" + path + "?_rsc",
          { headers: { RSC: "1", Accept: "text/x-component" } },
        );
        assert.equal(navigation.status, 200);
        assert(
          !(await navigation.text()).includes("data-workshop-id"),
          "City navigation always loads the latest catalogue through a data-free shell",
        );
      }
    for (const path of [
      "/werkstaetten/unknown",
      "/en/workshops/unknown",
      "/sq/serviset/prishtina/extra",
    ])
      for (const method of ["GET", "HEAD"]) {
        const response = await runtime.dispatchFetch(
          "https://riparim.com" + path,
          { method },
        );
        assert.equal(response.status, 404);
        await response.text();
      }
    const liveProfileId = "issue-210-live-metadata";
    await db
      .prepare(
        "INSERT INTO workshops (id,name,city,address,phone,brands,services,specialty,description,sources,checked_at,status,updated_at) VALUES (?,?,'Prishtina',?,'','[]','[]',?,?,'[]','2026-10-18','published','2026-10-18T00:00:00Z')",
      )
      .bind(
        liveProfileId,
        "(#210) Live metadata fixture",
        "(#210) Fictional road",
        "(#210) Fixture",
        "(#210) Isolated published profile outside the release manifest",
      )
      .run();
    try {
      for (const locale of ["de", "sq", "en"])
        for (const userAgent of [
          undefined,
          "Mozilla/5.0",
          "Googlebot",
          "Twitterbot/1.0",
        ]) {
          const identity = `/workshop/${liveProfileId}`;
          const response = await runtime.dispatchFetch(
            "https://riparim.com" +
              localizeHref(identity, locale) +
              "?q=private-head-query",
            userAgent ? { headers: { "User-Agent": userAgent } } : {},
          );
          assert.equal(response.status, 200);
          assert.equal(
            response.headers.get("X-Riparim-Public-Snapshot"),
            null,
            "A newly published profile uses the actual live rendering fallback",
          );
          assertPublicHead(
            await response.text(),
            identity,
            locale,
            "https://riparim.com",
          );
        }
      const head = await runtime.dispatchFetch(
        "https://riparim.com/werkstatt/" + liveProfileId,
        { method: "HEAD" },
      );
      assert.equal(head.status, 200);
      assert.equal(await head.text(), "");
      assert.equal(head.headers.get("X-Content-Type-Options"), "nosniff");
    } finally {
      await db
        .prepare("DELETE FROM workshops WHERE id=?")
        .bind(liveProfileId)
        .run();
    }
    await db
      .prepare(
        "INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at,provider) VALUES ('main','https://auth.fixture.test','',0,0,'fixture','pocketbase')",
      )
      .run();
    for (const locale of ["de", "sq", "en"]) {
      const privacy = await runtime.dispatchFetch(
          "https://riparim.com" + localizeHref("/datenschutz", locale),
        ),
        html = await privacy.text();
      assert.equal(privacy.status, 200);
      assertPublicHead(html, "/privacy", locale, "https://riparim.com");
      assert.equal(privacy.headers.get("X-Riparim-Public-Snapshot"), "1");
      assert.equal(privacy.headers.has("set-cookie"), false);
      assert(html.includes("https://pocketbase.io/docs/authentication/"));
      assert(
        !html.includes("https://supabase.com/privacy"),
        "Even the prebuilt public document names the selected independent provider",
      );
      assertPrivacyOutput(html, locale, "pocketbase");
    }
    for (const locale of ["de", "sq", "en"]) {
      const head = await runtime.dispatchFetch(
        "https://riparim.com" + localizeHref("/datenschutz", locale),
        { method: "HEAD" },
      );
      assert.equal(head.status, 200);
      assert.equal(head.headers.get("X-Riparim-Public-Snapshot"), "1");
      assert.equal(await head.text(), "");
    }
    await db
      .prepare("UPDATE auth_settings SET provider='supabase' WHERE id='main'")
      .run();
    const rolledBack = await runtime.dispatchFetch(
      "https://riparim.com/en/privacy",
    );
    assertPrivacyOutput(await rolledBack.text(), "en", "supabase");
    await db.prepare("DELETE FROM auth_settings WHERE id='main'").run();
    const admin = await runtime.dispatchFetch(
      "https://riparim.com/api/workshops?admin=1",
    );
    assert.equal(admin.status, 401);
    await admin.text();
    const invalidLocale = await runtime.dispatchFetch(
      "https://riparim.com/api/workshops?locale=fr",
    );
    assert.equal(invalidLocale.status, 400);
    await invalidLocale.text();
    const anonymous = await runtime.dispatchFetch("https://riparim.com/", {
      headers: { cookie: "untrusted=fixture" },
    });
    const landing = await anonymous.text();
    assert(
      !landing.includes(first.description),
      "The landing document does not serialize the workshop catalogue",
    );
    const hidden = await runtime.dispatchFetch(
      "https://riparim.com/__public/de/workshops.html",
    );
    assert.equal(hidden.status, 404);
    await hidden.text();
    for (const [path, target] of [
      ["/en/werkstaetten", "/en/workshops"],
      ["/sq/werkstatt/" + first.id, "/sq/servis/" + first.id],
    ]) {
      const response = await runtime.dispatchFetch(
        "https://riparim.com" + path + "?ort=prizren",
        { redirect: "manual" },
      );
      assert.equal(response.status, 308);
      assert.equal(
        response.headers.get("Location"),
        "https://riparim.com" + target + "?ort=prizren",
      );
    }
    const rsc = await runtime.dispatchFetch(
      "https://riparim.com/en/workshops?_rsc",
      { headers: { RSC: "1", Accept: "text/x-component" } },
    );
    assert.match(rsc.headers.get("Content-Type"), /text\/x-component/);
    assert.equal(
      rsc.headers.get("X-Riparim-Public-Snapshot"),
      "1",
      "Data-free public navigation avoids rendering the framework",
    );
    assert.equal(
      rsc.headers.get("X-Vinext-RSC-Compatibility-Id"),
      compatibilityId,
      "Public RSC must be accepted by the browser from this build instead of triggering a document reload",
    );
    const rscBody = await rsc.text();
    assert(
      !rscBody.includes(first.description),
      "Catalogue navigation fetches live records without serializing the catalogue in RSC",
    );
    assert(
      rscBody.length < 50000,
      "Catalogue RSC remains a compact data-free shell",
    );
    await db
      .prepare("UPDATE workshops SET description=?,updated_at=? WHERE id=?")
      .bind("Newer approved admin text", "2099-01-01T00:00:00.000Z", first.id)
      .run();
    const changedCity = await runtime.dispatchFetch(
      "https://riparim.com/en/workshops/prishtina",
    );
    assert.equal(changedCity.status, 200);
    assert.equal(changedCity.headers.get("X-Riparim-Public-Snapshot"), "1");
    const changedCityHtml = await changedCity.text();
    assertPublicHead(
      changedCityHtml,
      "/workshops/prishtina",
      "en",
      "https://riparim.com",
    );
    assert(
      !changedCityHtml.includes("data-workshop-id="),
      "A changed publication invalidates city data alongside the catalogue",
    );
    const edited = await runtime.dispatchFetch(
      "https://riparim.com/werkstatt/" + first.id,
    );
    assert.equal(edited.status, 200);
    assert.equal(edited.headers.get("X-Riparim-Public-Snapshot"), "1");
    const editedHtml = await edited.text();
    assertPublicHead(
      editedHtml,
      `/workshop/${first.id}`,
      "de",
      "https://riparim.com",
    );
    assert(editedHtml.includes(`data-public-profile-id="${first.id}"`));
    assert(
      !editedHtml.includes(first.description),
      "Changed profile serves a data-free shell",
    );
    await db
      .prepare("UPDATE workshops SET status='draft' WHERE id=?")
      .bind(first.id)
      .run();
    const unpublished = await runtime.dispatchFetch(
      "https://riparim.com/werkstatt/" + first.id,
    );
    assert.equal(unpublished.status, 404);
    assert.equal(unpublished.headers.get("X-Riparim-Public-Snapshot"), null);
    await unpublished.text();
    const directory = await runtime.dispatchFetch(
      "https://riparim.com/werkstaetten",
    );
    assert.equal(directory.headers.get("X-Riparim-Public-Snapshot"), "1");
    const html = await directory.text();
    assertPublicHead(html, "/workshops", "de", "https://riparim.com");
    assert(!html.includes(`data-workshop-id="${first.id}"`));
    assert(
      !html.includes('data-ui="workshop-index"'),
      "Invalidated snapshots never retain stale public profile anchors",
    );
    const removedSitemap = await runtime.dispatchFetch(
      "https://riparim.com/sitemap.xml",
    );
    const removedXml = await removedSitemap.text();
    for (const locale of ["de", "sq", "en"])
      assert(
        !removedXml.includes(localizeHref(`/workshop/${first.id}`, locale)),
        "Unpublishing immediately removes all language variants from the live sitemap",
      );
    await db
      .prepare(
        "INSERT INTO workshops (id,name,city,address,phone,brands,services,specialty,description,sources,checked_at,status,updated_at) VALUES ('fixture-seo-new','Synthetic SEO Workshop','Prishtina','Synthetic road 207','+38344123456','[]','[]','Synthetic','Isolated publication fixture','[]','2026-10-18','published','2099-01-02T00:00:00Z')",
      )
      .run();
    const updatedSitemap = await runtime.dispatchFetch(
      "https://riparim.com/sitemap.xml",
    );
    const updatedXml = await updatedSitemap.text();
    for (const path of [
      "/werkstatt/fixture-seo-new",
      "/sq/servis/fixture-seo-new",
      "/en/workshop/fixture-seo-new",
    ])
      assert(
        updatedXml.includes("https://riparim.com" + path),
        "Newly approved profiles enter discovery without waiting for another snapshot",
      );

    const session = await runtime.dispatchFetch(
      "https://riparim.com/api/session",
      {
        headers: {
          "oai-authenticated-user-email": "private-user@example.test",
        },
      },
    );
    assert.equal(session.status, 200);
    assert.deepEqual(await session.json(), { account: null, isAdmin: false });
    assert.match(session.headers.get("Cache-Control"), /no-store/);
    await db
      .prepare(
        "INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at) VALUES ('main',?,?,1,1,'2026-10-11')",
      )
      .bind(
        "https://fixture-project.supabase.co",
        "sb_publishable_fixture_public_key_1234567890",
      )
      .run();
    authenticated = true;
    const token = [
      { alg: "HS256", typ: "JWT" },
      {
        sub: fixtureUser.id,
        iss: "https://fixture-project.supabase.co/auth/v1",
        session_id: "private-session",
        amr: [{ method: "password" }],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      "fixture",
    ]
      .map((value) =>
        Buffer.from(
          typeof value === "string" ? value : JSON.stringify(value),
        ).toString("base64url"),
      )
      .join(".");
    const privateCookie =
      "sb-fixture-project-auth-token=base64-" +
      Buffer.from(
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user: fixtureUser,
        }),
      ).toString("base64url");
    await db
      .prepare(
        "INSERT INTO auth_sessions (id,account_id,revoked,legacy_access,expires_at,created_at) VALUES ('private-session',?,0,0,?,'fixture')",
      )
      .bind(
        "supabase:fixture-project.supabase.co:" + fixtureUser.id,
        Date.now() + 3600000,
      )
      .run();
    const privatePage = await runtime.dispatchFetch(
        "https://riparim.com/bewertungen",
        { headers: { cookie: privateCookie } },
      ),
      privateHtml = await privatePage.text();
    assert.equal(privatePage.status, 200);
    assert.match(privatePage.headers.get("Cache-Control"), /private.*no-store/);
    assert(
      !privateHtml.includes(fixtureUser.email),
      "Private documents deliver a data-free session shell instead of account snapshots",
    );
    assert(
      !privateHtml.includes(first.description),
      "Private history loads the directory after hydration instead of serializing all workshops",
    );
    for (const locale of ["de", "sq", "en"])
      for (const path of JSON.parse(
        await readFile("data/deferred-pages.json", "utf8"),
      ))
        for (const rsc of [false, true]) {
          const before = providerCalls,
            response = await runtime.dispatchFetch(
              "https://riparim.com" +
                localizeHref(path, locale) +
                "?einreichung=private-target&weiter=%2Feinstellungen",
              {
                headers: {
                  cookie: privateCookie,
                  ...(rsc ? { RSC: "1", Accept: "text/x-component" } : {}),
                },
              },
            ),
            body = await response.text();
          assert.equal(response.status, 200);
          assert.match(
            response.headers.get("Cache-Control"),
            /private.*no-store/,
          );
          assert.equal(response.headers.has("set-cookie"), false);
          assert(
            !body.includes(fixtureUser.email) &&
              !body.includes("private-target"),
            "Private release documents contain no account or target snapshot",
          );
          assert.equal(
            providerCalls,
            before,
            "Private UI shells leave session validation to its authorized API",
          );
          if (rsc) {
            assert.equal(
              response.headers.get("X-Vinext-RSC-Compatibility-Id"),
              compatibilityId,
              "Every private locale shell retains the router build identity",
            );
            assert.match(
              response.headers.get("Content-Type"),
              /text\/x-component/,
            );
            assert.equal(
              decodeURIComponent(
                response.headers.get("X-Vinext-Rendered-Path-And-Search"),
              ),
              localizeHref(path, locale) +
                "?einreichung=private-target&weiter=%2Feinstellungen",
              "RSC navigation keeps its actual localized request URL outside the immutable payload",
            );
          } else
            assert.match(
              body,
              /<meta[^>]*name="robots"[^>]*content="noindex[^">]*nofollow/,
            );
        }
    for (const path of [
      "/__private/de/reviews.html",
      "/__private/en/admin.rsc",
    ]) {
      const internal = await runtime.dispatchFetch(
        "https://riparim.com" + path,
      );
      assert.equal(
        internal.status,
        404,
        "Internal UI artifacts must pass the Worker guard",
      );
      await internal.text();
    }
    let before = providerCalls,
      verified = await runtime.dispatchFetch(
        "https://riparim.com/api/session",
        { headers: { cookie: privateCookie } },
      );
    assert.equal(verified.status, 200);
    assert.deepEqual(await verified.json(), {
      account: {
        email: fixtureUser.email,
        displayName: "Private Member",
        provider: "E-Mail",
      },
      isAdmin: false,
    });
    assert.equal(
      providerCalls - before,
      1,
      "The direct session path verifies user and symmetric proof once",
    );
    assert.match(verified.headers.get("Cache-Control"), /private.*no-store/);
    await db
      .prepare("UPDATE auth_sessions SET revoked=1 WHERE id='private-session'")
      .run();
    verified = await runtime.dispatchFetch("https://riparim.com/api/session", {
      headers: { cookie: privateCookie },
    });
    assert.deepEqual(
      await verified.json(),
      { account: null, isAdmin: false },
      "A fresh request observes app session revocation",
    );
    await db
      .prepare("UPDATE auth_sessions SET revoked=0 WHERE id='private-session'")
      .run();
    await db
      .prepare(
        "INSERT INTO auth_account_roles VALUES (?,'admin','fixture','fixture')",
      )
      .bind("supabase:fixture-project.supabase.co:" + fixtureUser.id)
      .run();
    verified = await runtime.dispatchFetch("https://riparim.com/api/session", {
      headers: { cookie: privateCookie },
    });
    assert.equal(
      (await verified.json()).isAdmin,
      true,
      "The same authoritative role check powers the fast endpoint",
    );
    await db.prepare("DELETE FROM auth_account_roles").run();
    verified = await runtime.dispatchFetch("https://riparim.com/api/session", {
      headers: { cookie: privateCookie },
    });
    assert.equal(
      (await verified.json()).isAdmin,
      false,
      "Role removal never survives an HTTP request",
    );
    await db
      .prepare(
        "INSERT INTO auth_account_status VALUES (?,'inactive','fixture')",
      )
      .bind("supabase:fixture-project.supabase.co:" + fixtureUser.id)
      .run();
    verified = await runtime.dispatchFetch("https://riparim.com/api/session", {
      headers: { cookie: privateCookie },
    });
    assert.deepEqual(
      await verified.json(),
      { account: null, isAdmin: false },
      "Blocked accounts cannot recover access through the fast endpoint",
    );
    await db.prepare("DELETE FROM auth_account_status").run();
    refreshedSession = {
      access_token: token,
      refresh_token: "fixture-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: "bearer",
      user: fixtureUser,
    };
    const expiredCookie =
      "sb-fixture-project-auth-token=base64-" +
      Buffer.from(
        JSON.stringify({ ...refreshedSession, expires_at: 1 }),
      ).toString("base64url");
    verified = await runtime.dispatchFetch("https://riparim.com/api/session", {
      headers: { cookie: expiredCookie },
    });
    assert.equal(
      (await verified.json()).account.email,
      fixtureUser.email,
      "Expired credentials refresh into the same enrolled account",
    );
    const renewal = verified.headers.getSetCookie();
    assert(
      renewal.length > 0 &&
        renewal.some(
          (value) =>
            value.includes("HttpOnly") &&
            value.includes("Secure") &&
            value.includes("SameSite=Lax") &&
            value.includes("Path=/"),
        ),
      "The direct path persists private refreshed cookies",
    );
    rejectRefresh = true;
    verified = await runtime.dispatchFetch("https://riparim.com/api/session", {
      headers: { cookie: expiredCookie },
    });
    assert.deepEqual(await verified.json(), { account: null, isAdmin: false });
    assert(
      verified.headers
        .getSetCookie()
        .some((value) => value.includes("Max-Age=0")),
      "A definitive refresh rejection clears credentials through the direct path",
    );
    rejectRefresh = false;
    verified = await runtime.dispatchFetch("https://riparim.com/api/session", {
      headers: {
        cookie: privateCookie.replace(
          "sb-fixture-project-auth-token=",
          "forged-cookie=",
        ),
        "oai-authenticated-user-email": "owner@example.test",
        "oai-authenticated-user-id": "native-admin",
      },
    });
    assert.deepEqual(
      await verified.json(),
      { account: null, isAdmin: false },
      "Forged cookies and native identity headers cannot establish a Worker session",
    );
    authenticated = false;
    const stale = {
      access_token: "fixture.access.token",
      refresh_token: "fixture-refresh",
      expires_at: 1,
      token_type: "bearer",
      user: { id: "fixture-user" },
    };
    const cookie =
      "sb-fixture-project-auth-token=base64-" +
      Buffer.from(JSON.stringify(stale)).toString("base64url");
    for (const path of [
      "/api/session",
      "/werkstaetten?_rsc",
      "/datenschutz?_rsc",
    ]) {
      const before = providerCalls,
        start = performance.now();
      const response = await runtime.dispatchFetch(
        "https://riparim.com" + path,
        {
          headers: {
            cookie,
            ...(path.includes("_rsc")
              ? { RSC: "1", Accept: "text/x-component" }
              : {}),
          },
        },
      );
      assert.equal(response.status, 200);
      assert(
        !response.headers.get("set-cookie"),
        "Provider outage must not erase session cookies",
      );
      if (path === "/api/session")
        assert.deepEqual(await response.json(), {
          account: null,
          isAdmin: false,
        });
      else await response.text();
      assert.equal(
        providerCalls - before,
        path === "/api/session" ? 1 : 0,
        "Public RSC is data-free; the private session API bounds provider outages",
      );
      assert(
        performance.now() - start < 2000,
        "Built Worker handles expired cookies without SDK backoff",
      );
      console.log(
        JSON.stringify({
          path,
          elapsedMs: Math.round(performance.now() - start),
          providerCalls: providerCalls - before,
        }),
      );
    }
    // Exercise the renderer's data-free privacy shell over the actual built Worker.
    await runtime.setOptions({
      ...options,
      bindings: {
        SITE_ORIGIN: "https://riparim.com",
        PUBLIC_RELEASE_RENDER: "shell",
      },
    });
    for (const locale of ["de", "sq", "en"]) {
      const response = await runtime.dispatchFetch(
        "https://riparim.com" + localizeHref("/datenschutz", locale),
      );
      assert.equal(response.status, 200);
      const html = await response.text();
      assertPublicHead(html, "/privacy", locale, "https://riparim.com");
      assertPrivacyOutput(html, locale, "supabase");
    }
    db = await runtime.getD1Database("DB");
    await db
      .prepare("ALTER TABLE workshops RENAME TO seo_unavailable_fixture")
      .run();
    const unavailableSitemap = await runtime.dispatchFetch(
      "https://riparim.com/sitemap.xml",
    );
    assert.equal(
      unavailableSitemap.status,
      503,
      "Catalogue failure cannot publish a successful partial sitemap",
    );
    assert.equal(
      await unavailableSitemap.text(),
      "Sitemap temporarily unavailable",
    );
    console.log(
      "Public release: all locales, private isolation, privacy providers/shells, RSC, newer admin edits and immediate unpublishing passed",
    );
  } finally {
    await runtime.dispose();
  }
}
