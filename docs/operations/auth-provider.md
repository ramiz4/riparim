# Auth providers and account identities

Supabase is the default; PocketBase is the second concrete adapter.
An arbitrary OIDC URL is unsupported. [The app contract](../../lib/auth/contract.ts)
keeps provider payloads behind [adapters](../../lib/auth/provider.ts).
Roles, ownership, blocks and internal account IDs stay in the app database.

## Configure a provider

Public profile fields live in protected `auth_settings` administration; credentials
and trust bindings live only in Worker secrets or Node `shared/runtime.env`.
Hosted portless `*.supabase.co` retains existing compatibility. For another approved
Supabase instance, set `AUTH_TRUSTED_PROVIDER=supabase`, exact HTTPS
`AUTH_TRUSTED_ORIGIN`, `SUPABASE_SECRET_KEY_ORIGIN` and its server-only key.
The public publishable/anon key belongs in the profile.

PocketBase uses these private runtime bindings:

```dotenv
AUTH_TRUSTED_PROVIDER=pocketbase
AUTH_TRUSTED_ORIGIN=https://auth.example.test
AUTH_ADMIN_KEY_PROVIDER=pocketbase
AUTH_ADMIN_KEY_ORIGIN=https://auth.example.test
AUTH_ADMIN_KEY=<private-superuser-token>
```

`AUTH_ADMIN_KEY` requires both bindings and takes precedence; a bad binding never
falls back to the old Supabase key. Origins have no credentials/path/query/fragment;
requests reject redirects. Unknown providers are rejected; unproven methods grant
no Google authorization.

The PocketBase adapter was checked against **0.40.5**: default `users` collection
`_pb_users_auth_`, `_externalAuths` relationships, password identity `email`, no MFA,
and text fields `name`/`preferredLocale` (`de`, `sq`, `en`). Reject guest writes to
`verified` (for example `createRule: @request.body.verified:isset = false`); public
updates must expose neither email identity nor provider links. Check API rules
privately. Plan superuser-token expiry/renewal; never use it as a browser key.

Configure SMTP and `{TOKEN}` email links at the provider:
`https://riparim.com/auth/bestaetigen?type=signup&token_hash={TOKEN}` and
`https://riparim.com/auth/bestaetigen?type=recovery&token_hash={TOKEN}`.
Google uses the exact app callback `https://riparim.com/auth/bestaetigen?anbieter=google`
with server-verified state/PKCE and independent Google identity proof.
Use the isolated site's origin for tests. Confirmation requires a new login.
Recovery grants only a reset capability until the provider accepts the signed token.
PocketBase logout revokes the app grant; upstream tokens expire under provider rules.
Each login has a private nonce; password sessions inherit no Google authorization.
Supabase cookie verification shares a 1.5-second request budget without SDK retries;
provider failures preserve cookies and grant no private access.

## Stable identity mapping

`auth_identities` maps exact **provider + normalized HTTPS issuer + subject** to an
opaque internal account ID. Preserve complete issuer paths/ports; adapters use origins.
Historical Supabase keys and private file paths remain unchanged.
Matching email or editable metadata proves neither identity nor rights.

Use server/offline `linkAccountIdentity(source, target, verify)` only after independently
verifying both exact identities against an approved mapping. Confirm its returned
internal ID. The function never reassigns/merges accounts; adding a mapping revokes
app sessions. Preserve roles, blocks, deletion tombstones and all ownership.
Complete every mapping, including blocked/deleting accounts, before target login.
After deletion, mappings/tombstones remain so surviving tokens cannot regain rights.
Started deletion grants stay issuer-bound; continue them at their original provider
or through verified administrative mapping. Retire old provider accounts separately.

## Safe cutover and private operator recovery

First disable the existing profile, verify a draft target, then deliberately enable
it. Changing an enabled provider/origin in one request is denied.
Before any mapping, stop both writers and back up [app files and provider data](backups.md).
Admin lists do not export hashes; without proven hash import/version compatibility,
plan password resets. Existing backups cover Supabase, not PocketBase.

There is no public bootstrap route. Disabling login on Node/owned Worker also removes
web-admin configuration access. An authorized operator uses a protected/offline
procedure with the service stopped: independently verify/map accounts, preserve both
SQLite files/WAL/SHM, configure target runtime bindings and separately accept SMTP,
Google and callbacks. The following example enables an **already mapped and verified**
PocketBase target; replace public placeholders/path. Secrets remain in `runtime.env`.
The completeness guard does not replace independent identity proof.

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

For D1, apply the equivalent reviewed configuration/grant transaction with writers
blocked and verified backups. Restart the verified release, reject old cookie jars
and require new login; check admin, ownership, blocks, private files and deletion.
Keep old email timers disabled. On failure, preserve data/mappings and use
[provider switching](provider-switch.md); after cutover, rollback requires an
identity-aware version. Applied migrations `0016`/`0018` stay unchanged.
Tests: account-identity, Auth-provider, PocketBase and Node suites use isolated
accounts; they do not prove real Google, inbox delivery or production hash migration.
Sources: [PocketBase Auth](https://pocketbase.io/docs/authentication/),
[Supabase restore](https://supabase.com/docs/guides/self-hosting/restore-from-platform).
