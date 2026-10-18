import { guidePagePaths } from "./guide-routes";
import { cityPagePaths } from "./workshop-cities";
import { listWorkshops } from "@/db/directory";
import { siteOrigin } from "@/lib/auth/config";
import { locales } from "@/lib/i18n/locale";
import { publicMetadata } from "@/lib/i18n/public-metadata";

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );

// Live approved records keep discovery current independently of HTML snapshots.
export async function publicSitemapResponse() {
  try {
    const workshops = await listWorkshops();
    const paths = [
      "/",
      "/workshops",
      ...cityPagePaths,
      ...guidePagePaths,
      ...workshops
        .filter(
          (workshop) =>
            workshop.status === "published" &&
            /^[a-z0-9][a-z0-9-]{2,80}$/.test(workshop.id),
        )
        .map((workshop) => `/workshop/${workshop.id}`),
    ];
    const urls = paths.flatMap((path) =>
      locales.map((locale) => {
        const metadata = publicMetadata(locale, path, siteOrigin(), {
          title: "",
          description: "",
        });
        const alternates = metadata.alternates!;
        return `<url><loc>${escapeXml(String(alternates.canonical))}</loc>${Object.entries(
          alternates.languages!,
        )
          .map(
            ([language, href]) =>
              `<xhtml:link rel="alternate" hreflang="${language}" href="${escapeXml(String(href))}"/>`,
          )
          .join("")}</url>`;
      }),
    );
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>\n`,
      {
        headers: {
          ...headers,
          "Content-Type": "application/xml; charset=utf-8",
        },
      },
    );
  } catch (error) {
    console.error(
      "sitemap-read",
      error instanceof Error ? error.name : "unknown",
    );
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers,
    });
  }
}

export function publicRobotsResponse() {
  // Public private-page noindex metadata remains crawlable. Robots is no access control.
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${new URL("/sitemap.xml", siteOrigin()).href}\n`,
    {
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}
