# Auth providers and account identities

Supabase is the default; PocketBase is the second adapter. Arbitrary OIDC URLs are
unsupported. App roles, blocks, ownership and account IDs stay in the app database.
See the [provider contract](../../lib/auth/contract.ts) and [adapters](../../lib/auth/provider.ts).

## Configure login

Public profile values use protected `auth_settings` administration. Secrets/trust
bindings belong in Worker secrets or Node `shared/runtime.env`; expose no secrets to browsers.
Hosted portless `*.supabase.co` retains compatibility. Another approved Supabase needs
`AUTH_TRUSTED_PROVIDER=supabase`, exact HTTPS `AUTH_TRUSTED_ORIGIN`,
`SUPABASE_SECRET_KEY_ORIGIN` and its server key; only the public publishable/anon key
belongs in the profile. PocketBase needs:

```dotenv
AUTH_TRUSTED_PROVIDER=pocketbase
AUTH_TRUSTED_ORIGIN=https://auth.example.test
AUTH_ADMIN_KEY_PROVIDER=pocketbase
AUTH_ADMIN_KEY_ORIGIN=https://auth.example.test
AUTH_ADMIN_KEY=<private-superuser-token>
```

Bind keys to the exact provider/origin and plan expiry/renewal. An invalid admin-key
binding never falls back to Supabase. Origins permit no credentials/path/query/fragment;
redirects/unknown providers are rejected. Unproven methods grant no Google authorization.
Check PocketBase API rules privately: guests cannot set `verified`, and public updates
must expose neither email identity nor provider links. Use the default `users` collection
and the [PocketBase adapter’s fields](../../lib/auth/adapters/pocketbase.ts). The checked
configuration is PocketBase 0.40.5 without MFA.

Configure SMTP and confirmation/recovery links at the provider using
`https://riparim.com/auth/bestaetigen?type=signup&token_hash={TOKEN}` and
`https://riparim.com/auth/bestaetigen?type=recovery&token_hash={TOKEN}`.
Google callback is `https://riparim.com/auth/bestaetigen?anbieter=google` with verified
state/PKCE and independent Google identity proof. Tests use their isolated origin.
Confirmation requires new login; recovery grants only reset capability until token
acceptance. Password sessions inherit no Google rights. PocketBase logout revokes the
app grant; upstream tokens expire separately. Provider failure grants no private access.

## Map existing accounts

Link exact **provider + normalized HTTPS issuer + subject** to the existing internal
account ID. Keep full issuer paths/ports, historical Supabase keys and private-file
paths. Email matches or editable metadata prove no identity or rights.

Use server/offline `linkAccountIdentity(source, target, verify)` only after independently
proving both exact identities against an approved mapping; check its returned account ID.
It never merges/reassigns accounts and revokes app sessions. Map every blocked/deleting
account before target login; preserve roles, ownership, blocks and deletion tombstones.
Mappings/tombstones remain after deletion to reject surviving tokens. Continue started
deletion at its original issuer or through verified administrative mapping. Retire old
provider accounts separately.

## Cut over or recover operator access

Follow [provider switching](provider-switch.md) for authorization, paused writers,
backups, identity acceptance and return. Back up provider data separately: the existing
Supabase backups do not cover PocketBase. Admin lists export no hashes; without proven
version/hash-import compatibility, use controlled password resets.

Disable the old profile, verify a draft target, then enable it deliberately. Changing an
enabled provider/origin together is denied. Disabled login also removes web-admin access
on Node/owned Worker; there is no public bootstrap. An authorized operator must use a
protected offline procedure with the service stopped, preserve both SQLite/WAL/SHM
files, and accept SMTP/Google/callbacks separately.

This recipe enables an **already mapped and verified** PocketBase target. Replace public
placeholders/path; keep secrets in `runtime.env`. Its completeness guard is not identity proof.

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

For D1, use an equivalent reviewed configuration/grant transaction with writers blocked
and verified backups. Restart the verified release, reject old cookies and require new
login. Check admin/ownership/blocks/private access/deletion; keep old mail timers disabled.
Preserve mappings/data on failure; rollback needs an identity-aware version. Never change
applied migrations. Isolated tests do not prove real Google, inbox receipt or hash migration.
