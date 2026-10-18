import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile, access } from "node:fs/promises";

const bundle = await build({
  stdin: {
    contents: `export {servePublicRelease} from './lib/public-release-routing';export {serveDeferredPage} from './lib/deferred-page-routing';export {localizeHref} from './lib/i18n/locale';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  define: {
    __RIPARIM_PUBLIC_REVISIONS__:
      '[{"id":"fixture-profile","updatedAt":"fixture-revision"}]',
  },
});
const { servePublicRelease, serveDeferredPage, localizeHref } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].contents).toString("base64")
);
let requested;
const env = {
  DB: {
    prepare(sql) {
      return {
        bind() {
          return this;
        },
        async first() {
          if (sql.includes("status,updated_at"))
            return { status: "published", updated_at: "fixture-revision" };
          if (sql.includes("group_concat"))
            return { revisions: "fixture-profile@fixture-revision" };
          return null;
        },
      };
    },
  },
  ASSETS: {
    async fetch(request) {
      requested = request;
      return new Response("isolated-release-artifact");
    },
  },
};
for (const [path, locale, artifact] of [
  ["/ratgeber", "de", "guides"],
  ["/sq/udhezues/zgjedhja-e-servisit", "sq", "guides/choosing-a-workshop"],
  ["/en/guides/preparing-a-visit", "en", "guides/preparing-a-visit"],
  ["/werkstaetten", "de", "workshops"],
  ["/sq/serviset", "sq", "workshops"],
  ["/en/workshops", "en", "workshops"],
  ["/werkstatt/fixture-profile", "de", "workshop/fixture-profile"],
  ["/sq/servis/fixture-profile", "sq", "workshop/fixture-profile"],
  ["/en/workshop/fixture-profile", "en", "workshop/fixture-profile"],
]) {
  for (const method of ["GET", "HEAD"])
    for (const rsc of [false, true]) {
      const response = await servePublicRelease(
        new Request(
          "https://riparim.test" + path + "?ort=prizren&_rsc=fixture",
          {
            method,
            headers: rsc ? { RSC: "1" } : {},
          },
        ),
        env,
      );
      assert.equal(response.status, 200);
      assert.equal(
        new URL(requested.url).pathname,
        `/__public/${locale}/${artifact}${rsc && artifact === "workshops" ? "-shell" : ""}.${rsc ? "rsc" : "html"}`,
        "Public release consumers use the English producer artifact identity",
      );
      assert.equal(requested.method, method);
      assert.equal(response.headers.has("set-cookie"), false);
      if (rsc)
        assert.equal(
          decodeURIComponent(
            response.headers.get("X-Vinext-Rendered-Path-And-Search"),
          ),
          path + "?ort=prizren",
        );
      await response.text();
    }
}
for (const path of [
  "/ratgeber",
  "/sq/udhezues/zgjedhja-e-servisit",
  "/en/guides/preparing-a-visit",
]) {
  const response = await servePublicRelease(
    new Request("https://riparim.test" + path),
    {
      ...env,
      DB: {
        prepare() {
          throw Error(
            "Immutable guidance must not read account or catalogue data",
          );
        },
      },
    },
  );
  assert.equal(response.status, 200);
  await response.text();
}
const privatePaths = JSON.parse(
  await readFile("data/deferred-pages.json", "utf8"),
);
for (const identity of privatePaths) {
  await access(`app/[locale]${identity}/page.tsx`);
  for (const locale of ["de", "sq", "en"])
    for (const rsc of [false, true]) {
      const path = localizeHref(identity, locale);
      const response = await serveDeferredPage(
        new Request(
          "https://riparim.test" + path + "?weiter=%2Fsq&_rsc=fixture",
          { headers: rsc ? { RSC: "1" } : {} },
        ),
        env,
      );
      assert.equal(response.status, 200);
      assert.equal(
        new URL(requested.url).pathname,
        `/__private/${locale}${identity}.${rsc ? "rsc" : "html"}`,
        "Deferred manifest, English page source and release consumer agree",
      );
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      assert.equal(response.headers.has("set-cookie"), false);
      await response.text();
    }
}
for (const [path, serve] of [
  ["/sq/workshops", servePublicRelease],
  ["/sq/workshop/fixture-profile", servePublicRelease],
  ["/sq/login", serveDeferredPage],
  ["/sq/admin/users", serveDeferredPage],
])
  assert.equal(
    await serve(new Request("https://riparim.test" + path), env),
    null,
    "Mixed-locale source paths remain unknown public URLs for the native 404 guard",
  );
for (const path of [
  "/__public/de/workshops.html",
  "/__private/de/login.html",
]) {
  const serve = path.startsWith("/__public/")
    ? servePublicRelease
    : serveDeferredPage;
  assert.equal(
    (await serve(new Request("https://riparim.test" + path), env)).status,
    404,
    "Private release artifacts cannot be fetched directly",
  );
}
console.log(
  "Release routing: preserved multilingual URLs select English public/private artifacts for HTML, HEAD and RSC",
);
