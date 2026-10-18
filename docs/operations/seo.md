# Search discovery

After a [verified main release](releases.md), check these public URLs:

```sh
curl --fail https://riparim.com/robots.txt
curl --fail https://riparim.com/sitemap.xml
```

The sitemap lists canonical home, catalogue, five city pages, the three guide pages and currently published workshop URLs
in DE/SQ/EN, with reciprocal language alternatives from the same metadata helper
used by pages. It excludes drafts, unknown profiles, account/admin routes and query
parameters. It reads approved live records and returns 503 if that read fails;
it never publishes a successful partial sitemap. No invented modification dates,
priorities or update frequencies are sent.

The city pages cover Prishtina, Prizren, Ferizaj, Peja and Gjakova. Their bounded
identities come from [`lib/workshop-cities.ts`](../../lib/workshop-cities.ts), shared
by routing, metadata, navigation, sitemap and release rendering. German city URLs
use `/werkstaetten/<city>`; Albanian uses `/sq/serviset/<city>` and English uses
`/en/workshops/<city>`. Each page includes every currently published profile with
that exact catalogue city, localized preparation guidance and service filter links
derived from those profiles. No proximity, coverage or quality claim is inferred.
Unsupported cities return 404; arbitrary city/filter combinations have no separate
indexable landing page. Query variants canonicalize to the clean city URL.

Cloudflare releases include city HTML and RSC artifacts. Any publication revision
change invalidates city HTML alongside the catalogue; data-free shells load approved
live records through the public API until the next release. Client navigation also
uses these shells. The Node runtime renders through the same published-only contract.

The guide index and two articles use exact route identities from
[`lib/guide-routes.ts`](../../lib/guide-routes.ts), shared by locale routing,
metadata, sitemap and immutable release assets. All nine localized guide URLs
are discoverable without query parameters. Unknown guides return 404. The guide
pages contain static editorial content and contextual links to the live catalogue
and city pages; they never snapshot account or catalogue records.

The catalogue's expandable alphabetical profile index contains ordinary HTML links
to every published workshop without requiring JavaScript. The first twelve cards,
filters, incremental browsing and saved search behavior stay unchanged. Index links use
the existing client navigation and validated public search return target; canonical
and sitemap URLs remain free of navigation query parameters. Cloudflare
serves this index inside its immutable public release snapshot. Approval changes
invalidate stale catalogue HTML to a data-free shell until the next verified release;
the live sitemap updates immediately. Adopt approved operator changes into the
canonical catalogue before releasing, following [workshop data](../data/workshops.md).
An unpublished profile disappears from the live sitemap and returns 404 immediately.

The app's robots.txt allows crawling and advertises the absolute sitemap URL.
Cloudflare may prepend its independently managed crawler/content-signal policy;
verify the served response and preserve that configuration. Robots rules are not
access control. Private-page `noindex,nofollow` metadata and server authorization
remain authoritative; blocking those pages in robots.txt would prevent crawlers
from reading their noindex directive.

## Submit and inspect

1. Open [Search Console](https://search.google.com/search-console), select the
   existing URL-prefix property `https://riparim.com/`, and confirm account access.
   Do not create a replacement property just because the domain property is absent.
2. After verifying the served release and sitemap, submit `sitemap.xml` under
   **Sitemaps**. Record the actual submission time and displayed result; a served
   sitemap alone does not prove submission or successful processing.
3. Inspect a home, catalogue, city, guide and workshop URL with **URL inspection**. Check the
   indexed URL and Google's selected canonical separately from the live test.
   Sample DE/SQ/EN and a recently published profile; check that private/draft URLs
   are excluded. Request indexing only for relevant published pages when warranted.
4. Review sitemap processing, page indexing and search performance over time.
   Record confirmed evidence and the observation date. Submission, successful live
   fetch, crawling and confirmed indexing are separate states; no step guarantees
   ranking, visitors or immediate indexing.

Google's primary guidance: [sitemap construction and submission](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
[crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable),
and [robots.txt](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec).
