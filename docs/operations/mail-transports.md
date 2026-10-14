# Review email delivery

Moderation stores an outbox event and awaits its first send attempt; delivery failure
does not undo the decision. Retries are **manual and individual**: one initial attempt
plus at most five retries, after 1/5/15/30/60 minutes. No app cron, timer, batch drain
or automatic provider fallback. [The outbox](../../lib/notifications/outbox.ts) enforces
leases, cooldown and attempt budget together.

## Configuration

| Runtime        | Transport              | Protected values                                                  |
| -------------- | ---------------------- | ----------------------------------------------------------------- |
| Worker or Node | Resend (default)       | `RESEND_API_KEY`, `TRANSACTIONAL_EMAIL_FROM`, HTTPS `SITE_ORIGIN` |
| Node only      | `EMAIL_TRANSPORT=smtp` | `SMTP_URL`, `SMTP_SECRET_ORIGIN`, sender/origin                   |

SMTP selection in Worker blocks new events before network access. Never put SMTP
credentials into Worker deployment secrets. Both paths require bound Auth admin
credentials to verify the account's confirmed recipient.

```dotenv
EMAIL_TRANSPORT=smtp
SMTP_URL=smtps://fixture-user:replace-with-secret@smtp.example.test:465
SMTP_SECRET_ORIGIN=smtps://smtp.example.test:465
TRANSACTIONAL_EMAIL_FROM=Riparim <no-reply@auth.example.test>
SITE_ORIGIN=https://riparim.example.test
```

Encode URL credentials. Their binding must match exact protocol/host/explicit port;
no query, fragment or custom options. `smtps` uses TLS immediately; `smtp` requires
STARTTLS. Certificates are verified, minimum TLS 1.2. Only numeric loopback
`127.0.0.1`/`::1` without credentials may be plaintext; `localhost` is no exception.
Configure internal CAs in Node's protected trust store. Authorize the sender/domain
and verify SPF/DKIM/DMARC and quotas separately. Network stages time out at eight
seconds, the whole connection at 20; no pools or automatic SMTP requeue.

## Retry and unknown acceptance

Before sending, the outbox freezes transport, credential binding and original
request bytes. SMTP also freezes complete MIME bytes/Message-ID. Changed contacts
or credential scopes block retries; changing language/sender never rewrites a started
message. Started historical `transport=NULL` events belong to Resend.

- Resend retries preserve bytes/event key within 23 hours (provider window: 24 hours).
- SMTP has no provider idempotency. `smtp_in_flight` is persisted before connecting.
- Only complete SMTP AUTH/envelope/DATA rejection proves nonacceptance: 4xx backs off,
  5xx remains blocked for controlled repair. An incomplete reply or mere response
  code does not prove rejection.
- Socket loss, timeout, process/lease loss and lost acknowledgment become `unknown`.
  Administrative retry cannot resend them. Reconcile Message-ID with relay logs;
  do not delete events or reset status to force delivery.
- Positive acceptance proves handoff, not inbox delivery. Stored success removes
  private payload/MIME content. There is no exactly-once guarantee.

## Switch or retry

1. Prepare a [verified release](releases.md) and its additive migration
   `0017_mail_transports.sql`; preserve historical events, no backfill required.
2. Stop/drain old delivery writers during [provider switching](provider-switch.md).
   Complete/reconcile started events under their original transport/credentials;
   only new/unstarted events may adopt the new configuration.
3. Verify TLS, credentials, sender and actual receipt with isolated accounts.
   The protected notification API exposes only technical errors.
4. Keep old timers/crons disabled. In a source build, retry one event with
   `npm run notifications:node -- <event-id>`; packaged command is in [Node operations](node.md).
5. Returning to a previous provider restores its original scope; `unknown` stays blocked.

New messages use the confirmed DE/SQ/EN preference and HTML without generated
plaintext. Frozen historical parts remain identical on retries.
Local SMTP/TLS/outbox tests cover rejection, lost acknowledgments and concurrency;
they send no real email. Provider-template activation is separate [Auth email templates](auth-email-templates.md).
Sources: [SMTP](https://nodemailer.com/smtp),
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
