import { readFile, readdir, mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { Miniflare } from "miniflare";
import { execFileSync } from "node:child_process";
import { localizeHref } from "./lib/locale.mjs";
import { catalogueReleasePlan } from "./catalogue-release-plan.mjs";
import { releaseBuildTarget } from "./release-policy.mjs";
import { publicAnalyticsBindings } from "./lib/public-analytics.mjs";

if (releaseBuildTarget(process.env.BUILD_TARGET) === "cloudflare") {
  let phaseStarted = performance.now();
  function finishPhase(phase) {
    const ended = performance.now();
    console.log(
      "[ci-phase] " +
        JSON.stringify({
          phase: "renderer." + phase,
          durationMs: Math.round(ended - phaseStarted),
        }),
    );
    phaseStarted = ended;
  }
  const config = JSON.parse(
    await readFile("dist/server/wrangler.json", "utf8"),
  );
  const catalogue = JSON.parse(await readFile("data/workshops.json", "utf8"));
  await writeFile(
    "dist/catalogue-import.json",
    JSON.stringify(
      await catalogueReleasePlan(
        catalogue,
        execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      ),
    ) + "\n",
  );
  const modules = (await readdir("dist/server", { recursive: true }))
    .filter((file) => file.endsWith(".js"))
    .sort((a, b) =>
      a === "index.js" ? -1 : b === "index.js" ? 1 : a.localeCompare(b),
    )
    .map((file) => ({ type: "ESModule", path: resolve("dist/server", file) }));
  const options = {
    modules,
    modulesRoot: resolve("dist/server"),
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    d1Databases: ["DB"],
    r2Buckets: ["BUCKET"],
    bindings: {
      ...publicAnalyticsBindings(config.vars),
      SITE_ORIGIN: "https://riparim.com",
      PUBLIC_RELEASE_RENDER: "true",
    },
    assets: {
      directory: resolve("dist/client"),
      binding: "ASSETS",
      routerConfig: {
        has_user_worker: true,
        static_routing: { user_worker: config.assets.run_worker_first },
      },
      assetConfig: { html_handling: config.assets.html_handling },
    },
    outboundService: () =>
      new Response("Release renderer has no provider access", { status: 502 }),
  };
  const runtime = new Miniflare(options);
  try {
    const db = await runtime.getD1Database("DB");
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
    if (seed.status !== 200)
      throw Error(
        "Isolated release catalogue could not be initialized: " +
          seed.status +
          " " +
          (await seed.text()).slice(0, 500),
      );
    const directory = await seed.json();
    const published = catalogue.workshops.filter(
      (w) => w.status === "published",
    );
    if (directory.workshops.length !== published.length)
      throw Error(
        "Isolated release catalogue differs from canonical published count",
      );
    finishPhase("seed");
    await rm("dist/client/__public", { recursive: true, force: true });
    let pages = 0;
    for (const locale of ["de", "sq", "en"]) {
      const prefix = locale === "de" ? "" : "/" + locale;
      for (const id of [
        "home",
        "privacy",
        null,
        ...published.map((w) => w.id),
      ]) {
        const path =
          id === "privacy"
            ? "/privacy"
            : id === "home"
              ? "/"
              : id
                ? `/workshop/${id}`
                : "/workshops";
        const response = await runtime.dispatchFetch(
          "https://riparim.com" + localizeHref(path, locale),
        );
        const html = await response.text();
        if (
          response.status !== 200 ||
          response.headers.has("set-cookie") ||
          !html.includes(`<html lang="${locale}"`) ||
          !/<\/html>\s*$/.test(html) ||
          !/<h1(?:\s|>)/.test(html) ||
          /Worker exceeded resource limits/.test(html) ||
          html.includes('data-slot="dropdown-menu-label"')
        )
          throw Error(`Public release rendering failed: ${prefix + path}`);
        if (
          id &&
          !["home", "privacy"].includes(id) &&
          !html.includes(`data-workshop-id="${id}"`)
        )
          throw Error("Public release profile identity differs");
        const file = resolve(
          "dist/client/__public",
          locale,
          (["home", "privacy"].includes(id) ? id : path.slice(1)) + ".html",
        );
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, html);
        pages++;
        const rsc = await runtime.dispatchFetch(
          "https://riparim.com" + localizeHref(path, locale) + "?_rsc",
          { headers: { RSC: "1", Accept: "text/x-component" } },
        );
        if (rsc.status !== 200 || rsc.headers.has("set-cookie"))
          throw Error("Public RSC failed: " + path);
        await writeFile(file.replace(/\.html$/, ".rsc"), await rsc.text());
      }
    }
    finishPhase("public");
    await rm("dist/client/__private", { recursive: true, force: true });
    const privatePaths = JSON.parse(
      await readFile("data/deferred-pages.json", "utf8"),
    );
    for (const locale of ["de", "sq", "en"])
      for (const path of privatePaths)
        for (const rsc of [false, true]) {
          const response = await runtime.dispatchFetch(
              "https://riparim.com" +
                localizeHref(path, locale) +
                (rsc ? "?_rsc" : ""),
              rsc ? { headers: { RSC: "1", Accept: "text/x-component" } } : {},
            ),
            body = await response.text();
          if (
            response.status !== 200 ||
            response.headers.has("set-cookie") ||
            (!rsc &&
              !/<meta[^>]*name="robots"[^>]*content="noindex[^">]*nofollow/.test(
                body,
              ))
          )
            throw Error("Private shell failed: " + path);
          const file = resolve(
            "dist/client/__private",
            locale,
            path.slice(1) + (rsc ? ".rsc" : ".html"),
          );
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, body);
        }
    finishPhase("private");
    await runtime.setOptions({
      ...options,
      bindings: {
        ...options.bindings,
        PUBLIC_RELEASE_AUTH_PROVIDER: "pocketbase",
      },
    });
    for (const locale of ["de", "sq", "en"]) {
      const response = await runtime.dispatchFetch(
          "https://riparim.com" + localizeHref("/privacy", locale),
        ),
        html = await response.text();
      if (
        response.status !== 200 ||
        response.headers.has("set-cookie") ||
        !html.includes(`<html lang="${locale}"`) ||
        !/<\/html>\s*$/.test(html) ||
        !html.includes("https://pocketbase.io/docs/authentication/") ||
        html.includes("https://supabase.com/privacy")
      )
        throw Error("PocketBase privacy rendering failed: " + locale);
      await writeFile(
        resolve("dist/client/__public", locale, "privacy-pocketbase.html"),
        html,
      );
      const rsc = await runtime.dispatchFetch(
        "https://riparim.com" + localizeHref("/privacy", locale) + "?_rsc",
        { headers: { RSC: "1", Accept: "text/x-component" } },
      );
      if (rsc.status !== 200) throw Error("PocketBase privacy RSC failed");
      await writeFile(
        resolve("dist/client/__public", locale, "privacy-pocketbase.rsc"),
        await rsc.text(),
      );
    }
    finishPhase("provider");
    await runtime.setOptions({
      ...options,
      bindings: {
        ...options.bindings,
        PUBLIC_RELEASE_RENDER: "shell",
      },
    });
    for (const locale of ["de", "sq", "en"])
      for (const id of [
        "home",
        "privacy",
        null,
        ...published.map((w) => w.id),
      ]) {
        const path =
          id === "privacy"
            ? "/privacy"
            : id === "home"
              ? "/"
              : id
                ? `/workshop/${id}`
                : "/workshops";
        const response = await runtime.dispatchFetch(
            "https://riparim.com" + localizeHref(path, locale),
          ),
          html = await response.text();
        if (
          response.status !== 200 ||
          response.headers.has("set-cookie") ||
          !html.includes(`<html lang="${locale}"`) ||
          !/<\/html>\s*$/.test(html) ||
          html.includes("data-workshop-id=")
        )
          throw Error("Public shell rendering failed: " + path);
        const file = resolve(
          "dist/client/__public",
          locale,
          (["home", "privacy"].includes(id) ? id : path.slice(1)) +
            "-shell.html",
        );
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, html);
        const rsc = await runtime.dispatchFetch(
          "https://riparim.com" + localizeHref(path, locale) + "?_rsc",
          { headers: { RSC: "1", Accept: "text/x-component" } },
        );
        if (rsc.status !== 200) throw Error("Public RSC shell failed: " + path);
        await writeFile(file.replace(/\.html$/, ".rsc"), await rsc.text());
      }
    finishPhase("shells");
    await writeFile(
      "dist/public-release.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          commit: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          pages,
          shells: pages,
          privacyVariants: 3,
          published: published.length,
          locales: ["de", "sq", "en"],
          source: "isolated-canonical-catalogue",
          privateData: false,
          privateShells: privatePaths.length * 3,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Rendered ${pages} public release documents from isolated canonical data; no production or provider access`,
    );
  } finally {
    phaseStarted = performance.now();
    await runtime.dispose();
    finishPhase("dispose");
  }
}
