# Share a published workshop profile

The profile sidebar offers native device sharing, a direct copy-link action and
a printable card. A cancelled share stays quiet. Missing or failed native sharing
falls back to copying; if clipboard permission is unavailable, a labeled field
shows the clean link for manual copying. Contact and review navigation are independent.

The payload contains only the published business name and localized canonical URL
from the configured site origin. Search filters, return destinations, query strings,
hashes, account details and visit evidence never enter the share payload or card.
Unpublished, invalid and unknown profiles expose no sharing tools. Production uses
HTTPS; loopback HTTP is permitted for isolated local development only.

Expand **Profile card with QR code** and choose **Print profile card**. Printing
uses a separate document with only the business name, canonical URL, localized
prompt and QR. The QR keeps a four-module quiet zone, medium error correction and
a 50 mm print size on a white background in every theme. The print dialog can save
the card as PDF where the operating system supports it.

## Local QR generation

`qrcode.react` 4.2.0 is pinned in the manifest and lockfile. Its ISC-licensed React
SVG renderer requires no runtime dependencies, network request, paid API or remote
QR service. Keeping a tested maintained encoder avoids a custom QR implementation.
The upstream [API documentation](https://github.com/zpao/qrcode.react) describes
SVG rendering and `marginSize`. Tests independently decode rendered module pixels
with dev-only `jsqr` 1.4.0 (Apache-2.0); no decoder enters application bundles.
Native API handling follows the [Web Share specification](https://w3c.github.io/web-share/)
and [Clipboard specification](https://w3c.github.io/clipboard-apis/).

## Manual pilot handoff

These tools prepare a pilot; they do not contact a workshop or publish social posts.
After a verified main release, a human pilot owner can choose ten willing published
workshops, verify their public name/profile language, demonstrate the link/card and
record consent and subsequent feedback in the approved operating system. Keep
contact lists and personal data out of this repository. Recheck that a printed QR
opens the intended published profile before distribution.

No outreach, participation, distribution or traffic result is established by this
implementation. Native iPhone/Safari sharing, physical printing and real scans
need separate device acceptance; component/isolated browser fixtures establish only
their recorded scope. No migration or production data transfer is required.
