import { localizeHref, guidePagePaths } from "../scripts/lib/locale.mjs";
import assert from "node:assert/strict";
import { assertPrivacyOutput } from "./helpers/privacy-output.mjs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Miniflare } from "miniflare";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import {
  withWorkerRuntime,
  settleWorkerRequests,
} from "./helpers/worker-runtime.mjs";
const overlay = JSON.parse(
  await readFile("data/workshop-translations.json", "utf8"),
);
const canonical = JSON.parse(await readFile("data/workshops.json", "utf8"));
const config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
const modules = (await readdir("dist/server", { recursive: true }))
  .filter((file) => file.endsWith(".js"))
  .sort((a, b) =>
    a === "index.js" ? -1 : b === "index.js" ? 1 : a.localeCompare(b),
  )
  .map((file) => ({ type: "ESModule", path: resolve("dist/server", file) }));
await withWorkerRuntime(
  {
    modules,
    modulesRoot: resolve("dist/server"),
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    d1Databases: ["DB"],
    r2Buckets: ["BUCKET"],
    bindings: {
      SITE_ORIGIN: "https://riparim.test",
      PUBLIC_RELEASE_RENDER: "skip-assets",
      AUTH_TRUSTED_ORIGIN: "https://auth.fixture.test",
      AUTH_TRUSTED_PROVIDER: "pocketbase",
    },
    assets: {
      directory: resolve("dist/client"),
      binding: "ASSETS",
      routerConfig: { has_user_worker: true },
    },
    outboundService: () =>
      new Response("Live provider access forbidden", { status: 502 }),
  },
  async (runtime, dispatchFetch) => {
    const db = await runtime.getD1Database("DB");
    for (const file of (await readdir("drizzle"))
      .filter((file) => file.endsWith(".sql"))
      .sort())
      for (const statement of (await readFile("drizzle/" + file, "utf8"))
        .split("--> statement-breakpoint")
        .filter((sql) => sql.trim()))
        await db.prepare(statement).run();
    await (await dispatchFetch("https://riparim.test/api/workshops")).text();
    const sitemapResponse = await dispatchFetch(
      "https://riparim.test/sitemap.xml",
    );
    assert.equal(
      sitemapResponse.status,
      200,
      "Every Worker target serves the shared XML sitemap route",
    );
    assert.match(
      sitemapResponse.headers.get("Content-Type"),
      /application\/xml/,
    );
    const sitemapXml = await sitemapResponse.text();
    const sitemapDocument = new JSDOM(sitemapXml, {
      contentType: "application/xml",
    }).window.document;
    assert.equal(
      sitemapDocument.querySelectorAll("url").length,
      3 *
        (canonical.workshops.filter(
          (workshop) => workshop.status === "published",
        ).length +
          7 +
          guidePagePaths.length),
    );
    const sitemapLocations = [...sitemapDocument.querySelectorAll("loc")].map(
      (node) => node.textContent,
    );
    for (const path of [
      "/ratgeber",
      "/sq/udhezues",
      "/en/guides",
      "/ratgeber/werkstatt-auswaehlen",
      "/sq/udhezues/zgjedhja-e-servisit",
      "/en/guides/choosing-a-workshop",
      "/ratgeber/werkstattbesuch-vorbereiten",
      "/sq/udhezues/pergatitja-e-vizites",
      "/en/guides/preparing-a-visit",
    ])
      assert(
        sitemapLocations.includes("https://riparim.test" + path),
        "Every Worker target advertises the nine real canonical guide URLs: " +
          path,
      );
    assert(sitemapXml.includes("https://riparim.test/sq/serviset"));
    for (const slug of ["prishtina", "prizren", "ferizaj", "peja", "gjakova"])
      for (const locale of ["de", "sq", "en"])
        assert(
          sitemapXml.includes(
            "https://riparim.test" + localizeHref(`/workshops/${slug}`, locale),
          ),
          "All Worker targets publish the same bounded city identities",
        );
    const robotsResponse = await dispatchFetch(
      "https://riparim.test/robots.txt",
    );
    assert.equal(robotsResponse.status, 200);
    assert.match(
      await robotsResponse.text(),
      /Sitemap: https:\/\/riparim\.test\/sitemap\.xml/,
    );
    for (let round = 0; round < 2; round++)
      await settleWorkerRequests(
        [
          ["/", "de", "Werkstätten"],
          ["/sq", "sq", "Servise"],
          ["/en", "en", "Workshops"],
        ].map(async ([path, locale, title]) => {
          const response = await dispatchFetch("https://riparim.test" + path, {
            headers: { "x-riparim-locale": locale === "de" ? "sq" : "de" },
          });
          assert.equal(response.status, 200, path);
          const html = await response.text();
          assert.match(html, new RegExp('<html lang="' + locale + '"'));
          assert.match(html, new RegExp("<title>[^<]*" + title));
          assert.match(
            html,
            new RegExp(
              '<select[^>]*>[\\s\\S]*<option[^>]*value="' +
                locale +
                '"[^>]*selected',
            ),
          );
          const rsc = await dispatchFetch(
            "https://riparim.test" + path + "?ort=prizren&_rsc",
            { headers: { RSC: "1", Accept: "text/x-component" } },
          );
          assert.equal(rsc.status, 200);
          assert.match(rsc.headers.get("Content-Type"), /text\/x-component/);
          assert(
            (await rsc.text()).includes(locale),
            "RSC uses the route locale",
          );
        }),
      );
    const draft = await db
      .prepare("SELECT id FROM workshops WHERE status='published' LIMIT 1")
      .first();
    assert(draft, "isolated catalog has a workshop fixture");
    await db
      .prepare("UPDATE workshops SET status='draft' WHERE id=?")
      .bind(draft.id)
      .run();
    for (const locale of ["de", "sq", "en"]) {
      const prefix = locale === "de" ? "" : `/${locale}`;
      const response = await dispatchFetch(
        `https://riparim.test${localizeHref("/werkstatt/" + draft.id, locale)}`,
      );
      assert.equal(
        response.status,
        404,
        "unpublished profile stays private in " + locale,
      );
      const legacy = await dispatchFetch(
        `https://riparim.test${prefix || "/"}?nachweis=${draft.id}`,
        { redirect: "manual" },
      );
      assert.equal(legacy.status, 307);
      assert.equal(
        legacy.headers.get("Location"),
        `${localizeHref("/werkstaetten", locale)}?bewerten=1`,
        "old links cannot reveal an unpublished workshop",
      );
    }
    await db
      .prepare("UPDATE workshops SET status='published' WHERE id=?")
      .bind(draft.id)
      .run();
    const published = await db
      .prepare("SELECT id FROM workshops WHERE status='published' LIMIT 1")
      .first();
    assert(published);
    for (const locale of ["de", "sq", "en"]) {
      const response = await dispatchFetch(
        `https://riparim.test${localizeHref("/werkstatt/" + published.id, locale)}?suche=${encodeURIComponent(localizeHref("/werkstaetten?ort=prizren&sprache=sq", locale))}`,
      );
      assert.equal(response.status, 200);
      assert(
        (await response.text()).includes(`data-workshop-id="${published.id}"`),
      );
    }
    for (const locale of ["de", "sq", "en"]) {
      const prefix = locale === "de" ? "" : `/${locale}`;
      for (const identity of [
        "/",
        "/werkstaetten",
        "/datenschutz",
        ...guidePagePaths,
        `/werkstatt/${published.id}`,
      ]) {
        const path =
          identity === "/" ? prefix || "/" : localizeHref(identity, locale);
        const response = await dispatchFetch(
          `https://riparim.test${path}?q=private-secret&ort=prizren&token=fixture`,
        );
        assert.equal(response.status, 200);
        const dom = new JSDOM(await response.text());
        try {
          const doc = dom.window.document;
          assert.equal(doc.documentElement.lang, locale);
          assert(doc.title);
          assert.equal(
            doc.querySelector('link[rel="canonical"]').href,
            `https://riparim.test${path}`,
            "canonical contains clean localized page identity",
          );
          const alternatives = Object.fromEntries(
            [...doc.querySelectorAll('link[rel="alternate"][hreflang]')].map(
              (link) => [link.hreflang, link.href],
            ),
          );
          assert.deepEqual(
            alternatives,
            Object.fromEntries(
              ["de", "sq", "en", "x-default"].map((language) => [
                language,
                "https://riparim.test" +
                  localizeHref(
                    identity,
                    language === "x-default" ? "de" : language,
                  ),
              ]),
            ),
            "all locales emit identical reciprocal sets",
          );
          assert(!JSON.stringify(alternatives).includes("private-secret"));
        } finally {
          dom.window.close();
        }
      }
      const rsc = await dispatchFetch(
        "https://riparim.test" +
          localizeHref("/werkstaetten", locale) +
          "?_rsc",
        { headers: { RSC: "1", Accept: "text/x-component" } },
      );
      assert.equal(rsc.status, 200);
      assert.match(rsc.headers.get("Content-Type"), /text\/x-component/);
      assert(
        (await rsc.text()).includes(locale),
        "Translated page RSC retains its request locale",
      );
    }
    // Both built targets render the real privacy page for each selected auth protocol.
    for (const provider of ["supabase", "pocketbase"]) {
      await db
        .prepare(
          "INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at,provider) VALUES ('main',?,?,0,0,'fixture',?)",
        )
        .bind(
          provider === "pocketbase"
            ? "https://auth.fixture.test"
            : "https://fixture-project.supabase.co",
          provider === "pocketbase"
            ? ""
            : "sb_publishable_fixture_public_key_1234567890",
          provider,
        )
        .run();
      for (const locale of ["de", "sq", "en"])
        for (const init of [
          {},
          { method: "HEAD" },
          { headers: { RSC: "1", Accept: "text/x-component" } },
        ]) {
          const response = await dispatchFetch(
            "https://riparim.test" +
              localizeHref("/datenschutz", locale) +
              (init.headers ? "?_rsc" : ""),
            init,
          );
          assert.equal(response.status, 200);
          const output = await response.text();
          if (init.method === "HEAD") assert.equal(output, "");
          else {
            assertPrivacyOutput(output, locale, provider);
            if (init.headers)
              assert.match(
                response.headers.get("Content-Type"),
                /text\/x-component/,
              );
          }
        }
      await db.prepare("DELETE FROM auth_settings WHERE id='main'").run();
    }
    // Actual native D1, API and document SSR use the same current source revision.
    const translatedSource = canonical.workshops.find(
        (w) => w.id === published.id,
      ),
      translatedEntry = overlay.workshops.find((w) => w.id === published.id);
    assert(translatedEntry);
    for (const locale of ["de", "sq", "en"]) {
      const payload = await (
        await dispatchFetch(
          `https://riparim.test/api/workshops?locale=${locale}`,
        )
      ).json();
      assert(payload.workshops.every((w) => w.status === "published"));
      assert.deepEqual(
        Object.keys(payload.displayById).sort(),
        payload.workshops.map((w) => w.id).sort(),
      );
      const canonicalRow = payload.workshops.find((w) => w.id === published.id);
      assert.equal(
        canonicalRow.description,
        translatedSource.description,
        "public canonical record never becomes translated data",
      );
      const display = payload.displayById[published.id];
      assert.equal(
        display.description,
        locale === "de"
          ? translatedSource.description
          : translatedEntry[locale].description,
      );
      assert.equal(display.fallback, undefined);
      const profileResponse = await dispatchFetch(
          `https://riparim.test${localizeHref("/werkstatt/" + published.id, locale)}`,
        ),
        profileDom = new JSDOM(await profileResponse.text());
      try {
        const doc = profileDom.window.document;
        assert.equal(
          doc.querySelector("#leistungen > p").textContent,
          display.description,
          "native SSR and API share active display revision",
        );
        assert.deepEqual(
          [...doc.querySelectorAll("#quellen ul > li strong")]
            .slice(0, translatedSource.sources.length)
            .map((el) => el.textContent),
          display.sourceTitles,
        );
        assert.equal(
          doc.querySelector(
            "main[data-riparim-page='workshop'] > p:first-of-type,article[data-ui~='workshop-card'] > div > p:last-child,article[data-ui~='partner-card'] > p:last-child",
          ),
          null,
        );
      } finally {
        profileDom.window.close();
      }
    }
    const liveDescription =
        "Fresh operator text <img src=x onerror=alert(1)> ëç",
      livePhoneNote = "Fresh contact availability warning";
    await db
      .prepare("UPDATE workshops SET description=?,phone_note=? WHERE id=?")
      .bind(liveDescription, livePhoneNote, published.id)
      .run();
    for (const locale of ["sq", "en"]) {
      const payload = await (
          await dispatchFetch(
            `https://riparim.test/api/workshops?locale=${locale}`,
          )
        ).json(),
        display = payload.displayById[published.id];
      assert.equal(display.description, liveDescription);
      assert.equal(display.phoneNote, livePhoneNote);
      assert.equal(display.fallback, "stale");
      assert.equal(display.originalLanguage, undefined);
      const response = await dispatchFetch(
          "https://riparim.test" +
            localizeHref("/werkstatt/" + published.id, locale),
        ),
        liveDom = new JSDOM(await response.text());
      try {
        const doc = liveDom.window.document;
        assert.equal(
          doc.querySelector("#leistungen > p").textContent,
          liveDescription,
        );
        assert.equal(
          doc.querySelector("#leistungen > p").getAttribute("lang"),
          "",
        );
        assert(
          doc.querySelector(
            "main[data-riparim-page='workshop'] > p:first-of-type,article[data-ui~='workshop-card'] > div > p:last-child,article[data-ui~='partner-card'] > p:last-child",
          ),
        );
        assert.equal(
          doc.querySelector("#leistungen > p img"),
          null,
          "React escapes original and translated strings",
        );
        assert(
          !doc
            .querySelector("#leistungen > p")
            .textContent.includes(translatedEntry[locale].description),
        );
      } finally {
        liveDom.window.close();
      }
    }
    await db
      .prepare("UPDATE workshops SET description=?,phone_note=? WHERE id=?")
      .bind(
        translatedSource.description,
        translatedSource.phoneNote,
        published.id,
      )
      .run();
    assert.equal(
      (await dispatchFetch("https://riparim.test/api/workshops?locale=fr"))
        .status,
      400,
    );
    const clientAssets = (
      await readdir("dist/client", { recursive: true })
    ).filter((file) => file.endsWith(".js"));
    const clientCode = (
      await Promise.all(
        clientAssets.map((file) => readFile("dist/client/" + file, "utf8")),
      )
    ).join("\n");
    for (const entry of overlay.workshops)
      assert(
        !clientCode.includes(entry.sourceHash),
        "static translation collection and revision hashes stay server-side",
      );
    const albanianX = await dispatchFetch(
        "https://riparim.test/sq/serviset?q=Auto%20Servis%20X",
      ),
      albanianXDom = new JSDOM(await albanianX.text());
    try {
      assert.deepEqual(
        [
          ...albanianXDom.window.document.querySelectorAll(
            "[data-ui~='catalogue-card'] h2",
          ),
        ]
          .map((node) => node.textContent)
          .filter((name) =>
            ["Auto servis XONI", "Auto Servis Xhelali"].includes(name),
          ),
        ["Auto servis XONI", "Auto Servis Xhelali"],
        "actual built SQ SSR catalogue keeps the full-ICU X before Xh ordering",
      );
    } finally {
      albanianXDom.window.close();
    }
    for (const locale of ["de", "sq", "en"]) {
      const returnTarget = `${localizeHref("/werkstaetten", locale)}?q=Auto+Mita`,
        response = await dispatchFetch(
          `https://riparim.test${localizeHref("/werkstatt/auto-mita", locale)}?${new URLSearchParams({ suche: returnTarget })}`,
        ),
        dom = new JSDOM(await response.text());
      try {
        assert.equal(response.status, 200);
        assert.equal(
          dom.window.document
            .querySelector(
              "main[data-riparim-page='workshop'] > a:first-of-type",
            )
            .getAttribute("href"),
          returnTarget,
          "native actual full document response preserves name-search return in " +
            locale,
        );
      } finally {
        dom.window.close();
      }
      for (const source of [
        "https://outside.test/werkstaetten?q=private",
        "//outside.test/werkstaetten",
        "/anmelden?weiter=private",
        `${localizeHref("/werkstaetten", locale)}?q=Auto+Mita&model=private&problem=private&access_token=secret`,
      ]) {
        const safeResponse = await dispatchFetch(
            `https://riparim.test${localizeHref("/werkstatt/auto-mita", locale)}?${new URLSearchParams({ suche: source })}`,
          ),
          safeDom = new JSDOM(await safeResponse.text());
        try {
          assert.equal(safeResponse.status, 200);
          assert.equal(
            safeDom.window.document
              .querySelector(
                "main[data-riparim-page='workshop'] > a:first-of-type",
              )
              .getAttribute("href"),
            source.includes("model=private")
              ? returnTarget
              : `${localizeHref("/werkstaetten", locale)}`,
            "native document return rejects unsafe/private fields",
          );
        } finally {
          safeDom.window.close();
        }
      }
    }
    for (const locale of ["de", "sq", "en"]) {
      const prefix = locale === "de" ? "" : `/${locale}`;
      for (const [value, target] of [
        [
          published.id,
          `${localizeHref("/werkstatt/" + published.id, locale)}#bewerten`,
        ],
        ["neu", `${localizeHref("/werkstaetten", locale)}?bewerten=1`],
        [
          "unknown-workshop",
          `${localizeHref("/werkstaetten", locale)}?bewerten=1`,
        ],
        [
          "//outside.test",
          `${localizeHref("/werkstaetten", locale)}?bewerten=1`,
        ],
      ]) {
        const response = await dispatchFetch(
          `https://riparim.test${prefix || "/"}?${new URLSearchParams({ nachweis: value })}`,
          { redirect: "manual" },
        );
        assert.equal(
          response.status,
          307,
          "actual worker redirects old review entry in " + locale,
        );
        assert.equal(response.headers.get("Location"), target);
      }
      const finder = await dispatchFetch(
          `https://riparim.test${localizeHref("/werkstaetten", locale)}?bewerten=1`,
        ),
        finderDom = new JSDOM(await finder.text());
      try {
        assert.equal(finder.status, 200);
        assert(
          finderDom.window.document
            .querySelector(
              "main[data-riparim-page='catalogue'] > p[role='status']",
            )
            .textContent.includes(
              {
                de: "Öffne das Profil der Werkstatt",
                sq: "Hap profilin e servisit",
                en: "Open the profile of the workshop",
              }[locale],
            ),
          "actual document caller retains localized review-entry context",
        );
        assert.equal(
          finderDom.window.document.querySelector('[role="dialog"]'),
          null,
        );
      } finally {
        finderDom.window.close();
      }
    }
    const www = await dispatchFetch(
      "http://www.riparim.com/en/workshops?ort=prizren&sprache=sq",
      { redirect: "manual" },
    );
    assert.equal(www.status, 308);
    assert.equal(
      www.headers.get("Location"),
      "https://riparim.com/en/workshops?ort=prizren&sprache=sq",
    );
    for (const [path, target] of [
      ["/de", "/"],
      ["/de/werkstaetten?ort=prizren", "/werkstaetten?ort=prizren"],
    ]) {
      const response = await dispatchFetch("https://riparim.test" + path, {
        redirect: "manual",
      });
      assert.equal(response.status, 308);
      assert.equal(
        new URL(response.headers.get("Location"), "https://riparim.test").href,
        "https://riparim.test" + target,
      );
    }
    for (const [path, target] of [
      ["/en/werkstaetten", "/en/workshops"],
      ["/sq/werkstaetten", "/sq/serviset"],
      ["/en/anmelden", "/en/login"],
      ["/sq/betriebe/beanspruchen", "/sq/biznesi/kerko-pronesine"],
    ]) {
      const response = await dispatchFetch(
        "https://riparim.test" + path + "?werkstatt=fixture-id",
        { redirect: "manual" },
      );
      assert.equal(response.status, 308);
      assert.equal(
        new URL(response.headers.get("Location"), "https://riparim.test").href,
        "https://riparim.test" + target + "?werkstatt=fixture-id",
      );
    }
    for (const path of [
      "/ratgeber/missing",
      "/sq/udhezues/missing",
      "/en/guides/missing",
      "/fr",
      "/sq/missing",
      "/en/missing",
      "/werkstatt/unknown-profile",
      "/en/workshop/unknown-profile",
      "/sq/servis/x",
      "/sq/missing.html",
      "/en/missing.txt",
      "/sq/missing.svg",
      "/en/missing.png",
      "/fr/missing.png",
      "/missing.html",
      "/missing.png",
    ]) {
      const response = await dispatchFetch("https://riparim.test" + path);
      assert.equal(response.status, 404, path);
    }
    for (const path of ["/api/workshops", "/api/google-places"]) {
      const response = await dispatchFetch("https://riparim.test" + path);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("Content-Type"), /application\/json/);
    }
    for (const [locale, login, settings, ownReviews] of [
      ["de", "Anmelden", "Einstellungen", "Meine Bewertungen"],
      ["sq", "Hyr", "Cilësimet", "Vlerësimet e mia"],
      ["en", "Log in", "Settings", "My reviews"],
    ]) {
      const prefix = locale === "de" ? "" : "/" + locale;
      for (const [path, label] of [
        ["/anmelden", login],
        ["/einstellungen", settings],
        ["/bewertungen", ownReviews],
      ]) {
        const response = await dispatchFetch(
          "https://riparim.test" + localizeHref(path, locale),
        );
        assert.equal(response.status, 200);
        const html = await response.text();
        assert(
          html.includes(label),
          "Built private page has active customer copy",
        );
        assert.match(
          html,
          /<meta[^>]*name="robots"[^>]*content="noindex[^">]*nofollow/,
        );
        assert(
          !html.includes("hreflang="),
          "Private customer page has no public alternate",
        );
      }
      const notice = await dispatchFetch(
        "https://riparim.test" +
          localizeHref("/anmelden?localeNotice=preference_not_saved", locale),
      );
      const noticeHtml = await notice.text();
      assert(
        noticeHtml.includes(
          {
            de: "Deine Sprachpräferenz konnte nicht gespeichert werden.",
            sq: "Preferenca jote e gjuhës nuk mund të ruhej.",
            en: "Your language preference could not be saved.",
          }[locale],
        ),
        "Preference failure notice is localized on an actual fresh document",
      );
      const submission = "11111111-1111-4111-8111-111111111111";
      for (const [query, target] of [
        ["besuche=1", localizeHref("/bewertungen", locale)],
        [
          "einreichung=" + submission,
          localizeHref("/bewertungen?einreichung=", locale) + submission,
        ],
        [
          "besuche=1&einreichung=" + submission,
          localizeHref("/bewertungen?einreichung=", locale) + submission,
        ],
      ]) {
        const response = await dispatchFetch(
          "https://riparim.test" + prefix + "?" + query,
          { redirect: "manual" },
        );
        assert.equal(
          response.status,
          307,
          "Built legacy own-history link redirects to a regular page",
        );
        assert.equal(
          new URL(response.headers.get("Location"), "https://riparim.test")
            .pathname,
          new URL(target, "https://riparim.test").pathname,
        );
        assert.equal(
          new URL(response.headers.get("Location"), "https://riparim.test")
            .search,
          new URL(target, "https://riparim.test").search,
        );
      }
      const own = await dispatchFetch(
          "https://riparim.test" +
            localizeHref("/bewertungen?einreichung=", locale) +
            submission,
        ),
        ownHtml = await own.text();
      assert.equal(own.status, 200);
      const ownDom = new JSDOM(ownHtml);
      try {
        assert.equal(
          ownDom.window.document.querySelector("main h1")?.textContent,
          { de: "Meine Bewertungen", sq: "Vlerësimet e mia", en: "My reviews" }[
            locale
          ],
          "The private review response identifies its localized page independently of styling",
        );
      } finally {
        ownDom.window.close();
      }
      assert.match(
        ownHtml,
        /<meta[^>]*name="robots"[^>]*content="noindex[^">]*nofollow/,
      );
      assert(
        !ownHtml.includes("hreflang="),
        "Targeted own-review documents have no private alternates",
      );
      assert(
        ownHtml.includes(
          encodeURIComponent(
            localizeHref("/bewertungen?einreichung=", locale) + submission,
          ),
        ),
        "The built guest page preserves the exact localized page return through sign-in",
      );
      assert(
        !ownHtml.includes('data-slot="dialog-overlay"'),
        "The independently addressable page has no modal overlay",
      );
    }
    const callback = await dispatchFetch(
      "https://riparim.test/auth/bestaetigen?token_hash=fixture",
      { redirect: "manual" },
    );
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("Referrer-Policy"), "no-referrer");
    for (const locale of ["de", "sq", "en"])
      for (const path of [
        "/betriebe",
        "/antraege",
        "/betriebe/beanspruchen",
        "/verwaltung",
        "/verwaltung/bewertungen",
        "/verwaltung/benutzer",
        "/verwaltung/betriebe",
        "/verwaltung/anmeldung",
      ]) {
        const response = await dispatchFetch(
          "https://riparim.test" + localizeHref(path, locale),
        );
        assert.equal(
          response.status,
          200,
          "Actual management guest page stays reachable",
        );
        const html = await response.text();
        assert.match(html, new RegExp('<html lang="' + locale + '"'));
        assert.match(
          html,
          /<meta[^>]*name="robots"[^>]*content="noindex[^">]*nofollow/,
        );
        assert(
          !html.includes("hreflang="),
          "Actual business/administration documents advertise no private alternates",
        );
      }
    for (const locale of ["de", "sq", "en"]) {
      const claimId = "ahp-volkswagen-prizren";
      const overview = await dispatchFetch(
        "https://riparim.test" +
          localizeHref("/betriebe?werkstatt=", locale) +
          claimId,
        { redirect: "manual" },
      );
      assert.equal(
        overview.status,
        200,
        "Unsupported workshop parameters do not redirect the overview",
      );
      assert.equal(overview.headers.get("Location"), null);
      assert(
        (await overview.text()).includes(
          encodeURIComponent(localizeHref("/betriebe", locale)),
        ),
        "Guest overview login returns to the overview",
      );
      const claim = await dispatchFetch(
          "https://riparim.test" +
            localizeHref("/betriebe/beanspruchen?werkstatt=", locale) +
            claimId,
        ),
        html = await claim.text();
      assert.equal(claim.status, 200);
      assert(
        html.includes(
          encodeURIComponent(
            localizeHref("/betriebe/beanspruchen?werkstatt=", locale) + claimId,
          ),
        ),
        "Built guest claim preserves workshop and locale through sign-in",
      );
    }
    for (const file of (await readdir("public")).filter((file) =>
      /\.(?:png|jpg|webp|svg)$/.test(file),
    )) {
      const response = await dispatchFetch("https://riparim.test/" + file, {
        redirect: "manual",
      });
      assert.equal(
        response.status,
        200,
        "physical unprefixed asset " + file + " stays reachable",
      );
    }
    // Run Intl in native workerd as well, using the same public formatter/translator.
    const fixture = await build({
      stdin: {
        contents: `import {getMessages,createTranslator} from './lib/i18n/messages';import {formatDate,formatNumber} from './lib/i18n/format';export default {fetch(){const t=createTranslator(getMessages('sq',['common']));return Response.json({counts:[0,1,2].map(count=>t('common.reviewCount',{count})),number:formatNumber('sq',1234.5),rounded:formatNumber('sq',9999.9999),date:formatDate('sq','2026-03-29',{dateOnly:true}),timestamp:formatDate('en','2026-10-05T23:30:00Z')});}};`,
        resolveDir: process.cwd(),
        loader: "ts",
      },
      bundle: true,
      write: false,
      format: "esm",
      platform: "neutral",
    });
    const intl = new Miniflare({
      modules: true,
      script: fixture.outputFiles[0].text,
      compatibilityDate: config.compatibility_date,
    });
    try {
      const value = await (
        await intl.dispatchFetch("https://fixture.test")
      ).json();
      assert.deepEqual(value.counts, [
        "0 vlerësime",
        "1 vlerësim",
        "2 vlerësime",
      ]);
      assert.equal(value.date, "29.03.2026");
      assert.equal(value.timestamp, "06/10/2026");
      assert.equal(value.number, "1234,5");
      assert.equal(value.rounded, "10\u00a0000");
    } finally {
      await intl.dispose();
    }
    console.log(
      "Built " +
        config.name +
        " Worker: native locale SSR/RSC, simultaneous requests, normalization, 404, APIs/callback/assets and native sq Intl passed",
    );
  },
);
