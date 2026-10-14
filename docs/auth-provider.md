# Auth providers and switching

Riparim owns the auth contract in `lib/auth/contract.ts`: verified users
with `provider`, exact `issuer`, and `subject`, session proofs, the required
login flows, available capabilities, and normalized errors. Domain
roles, blocks, ownership rights, and internal account IDs live in the app database.
There are exactly two adapters: Supabase Auth and PocketBase. A different address
must match the selected protocol; an arbitrary OIDC URL is not an adapter.

`lib/auth/provider.ts` selects the two concrete implementations.
Supabase SDKs, GoTrue claims, UUIDs, public key formats, and SSR/PKCE cookies
stay in `lib/auth/adapters/supabase.ts`; historical account keys,
session identifiers, and tombstones stay in `lib/auth/legacy-supabase.ts`.
`lib/auth/adapters/pocketbase.ts` speaks its REST protocol directly, without
an additional SDK. Domain routes use camelCase data and know no
provider claims. Google is also verified through Google's server-side `userinfo`.
Profile data, identical email addresses, and editable role fields
grant no rights.

The public privacy page names the selected profile even while it is
disabled. The Worker selects between two documents generated in isolation during the release
using private auth settings; the Node server renders the same
text contract. This requires neither accounts nor provider networking.

Existing automated [auth backups](auth-backups.md) and the
auth configuration portion of [platform backups](platform-backups.md) continue to back up
the existing Supabase installation. They do not back up
PocketBase accounts, password hashes, or configuration. For a cutover,
the operator must verify their own provider-side backup and recovery for
PocketBase; app data stays in the existing transfer/restore contract.

## Existing Supabase installation

Migration `0018_auth_providers.sql` adds `auth_settings.provider` and
provider binding for private deletion grants with default `supabase`. Existing
settings, account keys, and hosted SSR cookies continue to work.
Old and new sessions are checked against the exact identity. New
app session keys also separate identical provider SIDs from different issuers;
existing Supabase SIDs have explicitly limited read compatibility.
Missing or unknown Supabase AMR remains marked as an unknown method
and cannot confirm an existing Google grant; a proven session ID
can still be safely revoked. Applied migrations were not changed. The old scheduled
Supabase activation value cannot enable a PocketBase profile.

Hosted Supabase at a portless `*.supabase.co` origin remains the default.
For an alternative compatible instance:

```dotenv
AUTH_TRUSTED_PROVIDER=supabase
AUTH_TRUSTED_ORIGIN=https://auth.example.test
SUPABASE_SECRET_KEY_ORIGIN=https://auth.example.test
SUPABASE_SECRET_KEY=<server-only-key-issued-by-that-instance>
```

A missing `AUTH_TRUSTED_PROVIDER` means `supabase` for compatibility.
For new installations, the admin key can alternatively be stored under
`AUTH_ADMIN_KEY` with **both** explicit bindings `AUTH_ADMIN_KEY_PROVIDER`
and `AUTH_ADMIN_KEY_ORIGIN`. This key takes precedence; an incorrect
binding does not fall back to the old key. Hosted installations
retain existing credential compatibility unless an explicit
origin binding is present. An approved public origin never exposes
administration secrets.

Supabase requires the public publishable/anon key in administration.
Email confirmation, signup, recovery, PKCE, admin endpoints, and the separate
server-side Google proof retain their existing contracts. Existing
Supabase email templates and instructions apply only to this adapter.

The transport uses `redirect: "manual"` and rejects every 3xx response
before contacting another destination. `redirect: "error"` throws an exception
in the Workers runtime in use before making the network request. When
session renewal was pending, SDK retries therefore caused a 25.4-second wait
per auth check, and 50.8 or 76.2 seconds with repeated checks.
The native Worker check therefore protects both successful provider calls
and redirect blocking.

Cookie-based Supabase auth clients share a time budget of
1.5 seconds within an HTTP request, starting with the first provider call and including the response body.
Network errors, 5xx, redirects, and invalid responses end verification without
SDK retries; additional clients in the same request inherit this failure.
No session cookies are deleted or overwritten. A later
request can verify again. An unambiguous rejection of expired credentials,
however, remains effective. Provider and app checks are still prerequisites
for private rights; failure state is never shared between requests.
Explicit login and account-change operations start a new auth phase
so that local database/file work before a mutation does not consume its budget.
Password clients without a stored session and admin clients retain their
existing transport timeout.

## PocketBase profile

The concrete adapter was verified against PocketBase **0.40.5**. It uses
`/api/collections/users/` and the current `_externalAuths` system collection,
whose provider-managed relationships contain `recordRef`/`collectionRef`.
It assumes the default `users` auth collection with ID `_pb_users_auth_`.
No public Supabase key is used.

```dotenv
AUTH_TRUSTED_PROVIDER=pocketbase
AUTH_TRUSTED_ORIGIN=https://auth.example.test
AUTH_ADMIN_KEY_PROVIDER=pocketbase
AUTH_ADMIN_KEY_ORIGIN=https://auth.example.test
AUTH_ADMIN_KEY=<private-superuser-auth-token-issued-by-pocketbase>
```

The operator configures this specific instance:

- Auth collection `users`: password auth with identity field `email`, no MFA
  for the flows supported here. Text field `name` and an additional text field
  `preferredLocale` for `de`, `sq`, `en`. Ordinary Riparim limits for
  names and passwords still apply. Missing profile fields when read back are
  treated as errors, not successful persistence.
- Allow registration without letting guests set `verified`, for example
  `createRule: @request.body.verified:isset = false`. Public write rights
  must expose neither `verified`, email identity, nor provider links.
  Profile changes in Riparim use the separately bound admin client.
  Verify API rules and current permissions in an isolated instance.
- Configure SMTP and email templates. Verified delivery status in
  Riparim is set only after actual verification. The adapter calls
  `request-verification` or `request-password-reset`; these APIs receive
  no request-specific redirect address.
- Confirmation link in the PocketBase template:
  `https://riparim.com/auth/bestaetigen?type=signup&token_hash={TOKEN}`.
  Recovery link:
  `https://riparim.com/auth/bestaetigen?type=recovery&token_hash={TOKEN}`.
  `{TOKEN}` is the PocketBase template placeholder. Use the instance's own
  site origin for testing. Locale/return destination are preserved in the same browser through
  a private short-lived intent cookie; another device uses
  the safe default return destination. Confirmation then requires a new login.
- Configure Google OAuth at the provider and register exactly
  `https://riparim.com/auth/bestaetigen?anbieter=google` as the return address
  in the Google client (use the instance's own site origin for tests). This address remains the same
  when locale, return destination, or reauth intent changes; their app intent stays private in the
  short-lived browser cookie. The adapter gets state and the PKCE verifier from
  `auth-methods`, allows only Google's HTTPS authorization address, and sets
  `openid email profile` for independent identity proof. Server-side
  provider links and independent Google proof must yield the same
  Google identity and verified email. Missing, expired, or
  foreign intent data rejects the callback before code exchange.
- Issue a private PocketBase superuser auth token on the operator side,
  store it securely, and plan its expiry and renewal. It is never used as
  a browser token or public key. Missing, expired, or incorrectly
  bound credentials deny administrative operations.

PocketBase has neither GoTrue AMR nor an individual session ID. It can
mint the same token for two login methods of the same account in the same second.
Riparim therefore generates a random private app nonce **for every successful login**
and binds the grant to nonce, token, provider, and issuer.
An independent password browser inherits no Google rights. Cookies contain
no claimed auth method; roles come from the enrolled app grant.

Each request checks the stored bearer token server-side with
`auth-refresh`, but continues to use the originally enrolled token.
Returned token rotation does not replace the grant. After the
original provider token expires, a new login is required; the local
grant lifetime remains at most 30 days. PocketBase has no individual
server-side logout endpoint: Riparim revokes the current app grant and
removes browser credentials. A copied cookie can therefore obtain no
Riparim rights; the upstream token itself expires under provider rules.

PocketBase validates a recovery token only at `confirm-password-reset`.
The link therefore opens only a time-limited reset capability;
even a syntactically correct JWT grants **no** app session,
moderation, account identity, or deletion permission beforehand. Only after the provider
has accepted this particular signed token is its subject bound to the
internal mapping and its app grants revoked. PocketBase also invalidates
previous provider tokens on a successful reset. The
capability is then consumed; use this control procedure for ordinary password changes.

Sources: [PocketBase Auth](https://pocketbase.io/docs/authentication/),
[Records API](https://pocketbase.io/docs/api-records/),
[0.40.5 token contract](https://github.com/pocketbase/pocketbase/blob/v0.40.5/core/record_tokens.go),
[0.40.5 ExternalAuth permissions](https://github.com/pocketbase/pocketbase/blob/v0.40.5/apis/record_crud_external_auth_test.go).

## Configuration and safe cutover

All secrets and trust bindings live exclusively in protected
runtime configuration: Node `runtime.env`, Worker secrets, or the
Sites runtime secret JSON. The Node installer and Cloudflare/Sites secret allowlist
recognize the new names. The browser form and API return only provider, exact
HTTPS address, public key when applicable, and operational flags. Endpoints have
no credentials, paths, query, or fragment; ports belong to the origin.
Requests are time-limited and follow no redirects. Google proof tokens
go only to Google's fixed HTTPS userinfo endpoint.

Switching provider/origin for an enabled login configuration is denied server-side,
even if `enabled=false` is set in the same request. First
disable the existing profile, then verify the new configuration as a draft
and deliberately enable it. Protected native bootstrap access remains
separate; Node operation requires the documented operator/data migration,
not a public bootstrap endpoint.

Beforehand:

1. Back up source and target versions and stop both writers for migration.
   Verify target accounts, confirmation status, and provider links in isolation.
   Auth admin lists do not export complete password hashes.
2. **Passwords:** Hash migration depends on proven import capabilities,
   formats, and versions of both concrete systems. This adapter
   implements no hash import. Without separately proven import compatibility,
   plan a controlled password reset. Secrets/exports do not belong
   in source, browsers, logs, or ordinary argv.
3. **Identities:** Independently prove exact source and target identity and
   bind them to the same internal account according to
   [account-identities.md](account-identities.md). Mapping uses the provider
   **and the entire exact HTTPS issuer**, including a possible realm path. The two
   current adapters use origins. Identical subjects from different
   providers/issuers or identical email addresses are never automatically
   linked. Roles, blocks, deletion tombstones, ownership rights, and private
   file paths continue to belong to the unchanged internal account.
4. **Sessions:** Mapping revokes old app grants. Active browser logins,
   OAuth/PKCE flows, and started deletion grants are bound to their source identity
   and obtain no rights at the target. Retire old provider access separately;
   transfer no refresh, bearer, or recovery tokens.
5. Verify SMTP, Google client, complete callback addresses, data inventories, and
   customer flows with isolated accounts. Only then deliberately enable the target.

The return path preserves source and target mappings and unchanged
application data. Disable target login, restore the original verified
provider inventory, configuration, and credential bindings, and require a new
login. Do not return to an app version predating the additive
identity/provider schema rollout; perform no automatic database downgrade
or linking by email. Snapshot/transfer tools preserve
provider selection and private deletion-grant bindings. A domain delta run must
not change the provider protocol, even with an identical origin.

## Another adapter

For a specifically commissioned provider, add a small implementation of
`AuthClient`/`AuthAdminClient` and its verified capabilities,
validate provider data at this boundary, and extend explicit selection in
provider/config/setup. Session proof and OAuth identities must come from
server-verified sources; if its recovery protocol proves no session,
it remains a separate capability as with PocketBase. SDKs and
protocol shapes stay in the adapter. Domain routes, roles, account mapping,
evidence paths, and deletion administration need no provider SDK migration.

## Acceptance and limits

`tests/auth-provider.test.mjs` uses the actually installed
Supabase SDKs to communicate with an isolated GoTrue HTTP instance.
`tests/pocketbase-auth.test.mjs` uses an independent REST instance with
a different payload and non-UUID subjects, executing the actual adapters
and app routes. Only transport for the synthetic approved
HTTPS origin is routed to loopback; SDKs, adapters, and domain routes are
not replaced by internal mocks. Checks cover login, signup/confirmation,
recovery/reset, Google/state/PKCE, reauth, logout, admin CRUD/deletion retry,
identity mapping, private ownership rights, and relevant negative contracts.

The additional real local PocketBase 0.40.5 probe confirmed login,
server-side refresh, reauth, current private ExternalAuth relationships,
admin CRUD, logout, and provider deletion with synthetic accounts. It used no real
Google OAuth client, production email delivery, or import of real password hashes.
Existing native/Google/account/customer and provider-switch tests remain registered.
This issue provisions no live auth instance and changes no production provider or account inventory.

## Private operator procedure without native administration

Node and the owned Worker have no Sites native access. After
`auth_settings.enabled` is disabled, the previous web admin also loses
configuration access there. The form alone then cannot re-enable it.
This access restriction is preserved; there is no
public bootstrap route.

The concrete Node operator procedure is:

1. Disable the old profile; stop the app service and other writers. Stop old
   email timers or crons and disable them permanently.
   Secure a verified backup of **both** SQLite databases, including required
   WAL/SHM files, and verify recovery beforehand. The service
   stays stopped throughout the following steps.
2. Privately verify target accounts and complete source/target mappings,
   prepare them with the existing `linkAccountIdentity` operation on a protected
   administration machine, and compare their unchanged account IDs,
   roles, blocks, deletion states, and private files. Then securely
   adopt the verified SQLite files with writers stopped.
   [account-identities.md](account-identities.md) describes the contracts;
   merely querying a list or matching email is not proof of identity.
3. Store the target origin/provider and **target** admin key with its bindings
   in protected `shared/runtime.env`. Verify target settings, SMTP,
   Google, and callback separately. Run the existing
   Node 24/SQLite command below on the host as an authorized service operator.
   It requires neither a source checkout nor a build and contains only
   public profile details; secrets stay in `runtime.env`.
4. Restart the service with the verified release. Old cookie jars must be
   rejected; sign in again with verified target accounts and check admin access,
   ownership rights, blocks, and private evidence. Old email timers or
   crons stay disabled. Retry only one stored event according to the
   [manual delivery contract](node-runtime.md#background-delivery).
   On failure, stay stopped and use the documented return path
   that preserves data.

Example of deliberately enabling an **already fully mapped and
verified** PocketBase target. Replace placeholders and the path with verified values;
`email_delivery_confirmed=0` does not grant untested delivery approval:

```sh
node --input-type=module <<'NODE'
import {DatabaseSync} from 'node:sqlite';
const previous={provider:'supabase',issuer:'https://source.example.test'};
const next={provider:'pocketbase',issuer:'https://target.example.test',publicKey:''};
const database=new DatabaseSync('/opt/riparim/shared/data/app.sqlite');
database.exec('BEGIN IMMEDIATE');
try{
 const saved=database.prepare("SELECT provider,project_url,enabled FROM auth_settings WHERE id='main'").get();
 if(!saved||saved.enabled!==0||saved.provider!==previous.provider||saved.project_url!==previous.issuer)throw Error('Unexpected source profile or running auth configuration');
 const missing=database.prepare("SELECT COUNT(*) n FROM auth_identities s WHERE s.provider=? AND s.issuer=? AND NOT EXISTS (SELECT 1 FROM auth_identities t WHERE t.account_id=s.account_id AND t.provider=? AND t.issuer=?)").get(previous.provider,previous.issuer,next.provider,next.issuer);
 const known=database.prepare("SELECT COUNT(*) n FROM auth_identities WHERE provider=? AND issuer=?").get(previous.provider,previous.issuer);
 if(!known.n||missing.n)throw Error('Complete reviewed identity mapping is required');
 database.prepare('UPDATE auth_sessions SET revoked=1').run();
 database.prepare("UPDATE auth_settings SET provider=?,project_url=?,public_key=?,enabled=1,email_delivery_confirmed=0,updated_at=? WHERE id='main'").run(next.provider,next.issuer,next.publicKey,new Date().toISOString());
 database.exec('COMMIT');
}catch(error){database.exec('ROLLBACK');throw error;}
finally{database.close();}
NODE
```

The completeness check does not replace independent identity verification or
provider acceptance beforehand; it merely rejects missing mappings. For the
owned Worker, perform the equivalent private configuration/grant change
through authorized D1 operations tools with writers blocked and a verified
backup. Do not guess an unfamiliar provider or account inventory in the web form.
The return path performs the same controlled steps with the preserved,
verified source profile and requires a new login.
