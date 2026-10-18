# Public traffic and conversion analytics

Cloudflare Web Analytics remains available for aggregate traffic. PostHog's
[Riparim EU project](https://eu.posthog.com/project/310228) measures the optional,
consented journey from workshop discovery to contact. Analytics events measure
browser activity; a contact click does not prove a completed call, email or visit.

## Read the reports

Open the [Riparim Traffic and Contact dashboard](https://eu.posthog.com/project/310228/dashboard/1033040)
and use the same time range for related charts. Business reports require the
production host and `is_verification=false`.

- Traffic: `$pageview`, unique anonymous browsers and sessions over time.
- Popular pages: `$pageview` broken down by `page_path`.
- Contact actions: `workshop_contact_clicked` broken down by `contact_channel`.
- Discovery funnel: `workshop_search_viewed` → `workshop_profile_viewed` →
  `workshop_contact_clicked`, in order within one session and one hour.
- Profile conversion: `workshop_profile_viewed` → `workshop_contact_clicked`.
  This uses the same session/hour boundary and also includes visitors who arrive
  directly on a workshop profile.
- Exits: **Last measured page of completed sessions** ranks the final observed
  public page in each completed session.
- Bounce proxy: **Single-page sessions (%)** reports the share of completed
  sessions containing exactly one measured page view.

The five native traffic, page, contact and funnel charts follow the dashboard's
date selection. The two custom SQL charts for completed-session exits and
single-page rate always use the trailing 30 days; dashboard date filters do not
change their range. Both wait until a session's last measured event is more than
30 minutes old before counting it as completed.

Funnel drop-off means that the next measured step was absent inside the selected
conversion window. A search funnel excludes direct profile landings. Rejected
consent, blockers and incomplete delivery reduce the measured sample. Unique
browsers are random consented browser identifiers, not a count of real people.

Single-page sessions are a useful bounce proxy. Keep that explicitly named when
displaying it; do not assume a native bounce metric represents every visitor or
that it proves dissatisfaction. A visitor can find a phone number on one page.
`$pageleave` supplies best-effort exit and duration data, but closing a browser,
losing connectivity or revoking consent can prevent its delivery.

## Event contract

[`lib/analytics.ts`](../../lib/analytics.ts) owns route eligibility, consent,
event properties and deduplication.
[`lib/analytics-provider.ts`](../../lib/analytics-provider.ts) sends the small
capture-only payload to the EU ingestion host. No PostHog browser SDK is loaded.

| Event                      | Trigger                                                              | Additional properties                                                                    |
| -------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `$pageview`                | Initial eligible public page after acceptance, or a new public route | `$pageview_id`                                                                           |
| `$pageleave`               | A measured page is left or the browser reports page exit             | `$pageview_id`, `$prev_pageview_pathname`, `$prev_pageview_duration`, `duration_seconds` |
| `workshop_search_viewed`   | Workshop directory page view                                         | None                                                                                     |
| `workshop_profile_viewed`  | Published workshop profile page view                                 | `workshop_id`                                                                            |
| `workshop_contact_clicked` | Telephone, WhatsApp, directions or email clicked on that profile     | `workshop_id`, `contact_channel` (`phone`, `whatsapp`, `directions`, `email`)            |

All events carry `page_path`, `page_type` (`home`, `search`, `profile`, `privacy`),
`locale`, `is_verification`, a random `distinct_id` and `$session_id`.
`$current_url`, `$pathname` and `$host` contain only a canonical public route and
the production domain. `$process_person_profile: false` disables person profile
creation; `$geoip_disable: true` disables IP geolocation enrichment.
The browser still connects to PostHog's EU service, which receives the network
request. No application account identity is supplied.

Only the home page, privacy page, directory and a confirmed published profile
are eligible. Account, authentication, administration, visit evidence and review
submission flows are excluded. Query strings, fragments, form values, search
terms, contact destinations, account IDs, email addresses, referrers and page
titles are never included. Email actions record only the channel name, never an
email address. Existing website links are not a supported contact action.

Client route, locale and history changes share the same controller. A repeated
render or a query-only change does not create another page event. Returning to a
previous public page after another page creates a new page view. Capture errors
are contained so they cannot block navigation or contact actions.

## Consent and privacy

The translated analytics controls offer accept, reject and later revocation.
No analytics requests or anonymous identifiers are created before acceptance.
The choice lasts 180 days; an expired or malformed choice requires a new decision.
Revocation stops further sends, cancels pending sends and clears analytics browser
and session identifiers. It cannot withdraw events already delivered to PostHog.
The privacy page is also available for changing the choice.

Consent is stored in `localStorage` as `riparim.analytics.consent.v1`.
After acceptance, `riparim.analytics.browser.v1` stores a random browser ID;
`sessionStorage` holds `riparim.analytics.session.v1`, renewed after 30 minutes of
inactivity or a maximum age of 24 hours. Its timestamped UUIDv7 follows
[PostHog's session contract](https://posthog.com/docs/data/sessions); invalid,
future-dated or expired stored sessions are replaced. A different tab may start
a different session. No account login is linked to either identifier. Cross-tab
consent changes are synchronized.
Autocapture, session replay, heatmaps, person profiles, automatic identity linking
and form tracking are absent from this integration.

A restored browser back-forward cache page rechecks consent, the URL and the
published page identity, then records one new page view with a fresh duration.
Repeated restore, focus and history signals do not duplicate that view. A late
page exit is dropped if its original session is already 24 hours old.

## Configuration and release

| Variable            | Purpose                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `POSTHOG_KEY`       | Public project ingestion key (`phc_…`); an empty or invalid key disables analytics              |
| `POSTHOG_HOST`      | Exact EU host `https://eu.i.posthog.com`                                                        |
| `POSTHOG_TEST_MODE` | Exact `true` permits isolated local verification and labels all its events; defaults to `false` |

Production uses intentionally public, release-bound values in
[`wrangler.jsonc`](../../wrangler.jsonc). These are not administrative API keys.
The public release renderer copies only these analytics fields into the isolated
HTML renderer and retains them across privacy-provider and public-shell variants.
Runtime credentials, authentication bindings and evidence are never copied into
that public configuration. Changing the production project requires a reviewed PR
and a verified main GitHub Release so static documents and the Worker agree.
Do not activate a feature branch or open PR on production.

Local development and portable Node use the names in
[`.env.example`](../../.env.example). Local defaults are disabled. For isolated
verification, supply the public key, EU host and `POSTHOG_TEST_MODE=true` in the
task checkout's ignored `.env`, then restart the server. Never put a PostHog
personal/admin API key or payment details in application configuration.

The configured free plan has capped usage, one project, one year of retention
and one million Product Analytics events per month. No credit card was added.
Review the current [pricing](https://posthog.com/pricing) and project billing/usage
before changing plans or limits. Page views, page leaves and funnel events each
consume events. No payment details or paid add-ons are required for this setup.
Keep the project on its free plan and monitor usage rather than treating the
allowance as unlimited.

## Verify a release

1. Confirm the canonical release, deployment and actually served commit according
   to [release operations](releases.md).
2. Use an isolated verification tab in the required Riparim owner browser
   profile. Before accepting, set
   `sessionStorage.setItem("riparim.analytics.verification", "true")` for the tab.
   This labels verification events without sending the value in the URL.
3. On a clean public page, confirm no PostHog request before acceptance. Reject
   and navigate; confirm there is still no request. Accept, open the directory,
   then a published profile and a supported contact action.
4. In PostHog's activity view, confirm the expected event order,
   `is_verification=true`, canonical route properties and absent private values.
   Check initial load, history and locale navigation for duplicate events.
5. Revoke consent and confirm navigation/contact actions still work without
   further PostHog requests. Check the same result on account/private routes.
6. Keep verification excluded from business reports. Remove the tab marker when
   finished; do not delete or relabel other visitors' production events.

Use isolated test data and preserve local evidence as described in
[customer-flow QA](../development/customer-flow-qa.md). Tests that intercept the
transport prove browser behavior, while successful live ingestion must be verified
separately in the owner project's activity view.
