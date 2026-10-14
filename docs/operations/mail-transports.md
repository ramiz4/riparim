# Review email delivery

A moderation decision records its email and awaits one send attempt; failed delivery
does not undo moderation. Retries are **manual, one event at a time**: at most five,
after 1/5/15/30/60 minutes. No app cron, timer, batch drain or automatic fallback.

## Configure delivery

| Runtime        | Transport              | Protected configuration                                           |
| -------------- | ---------------------- | ----------------------------------------------------------------- |
| Worker or Node | Resend (default)       | `RESEND_API_KEY`, `TRANSACTIONAL_EMAIL_FROM`, HTTPS `SITE_ORIGIN` |
| Node only      | `EMAIL_TRANSPORT=smtp` | `SMTP_URL`, `SMTP_SECRET_ORIGIN`, sender/origin                   |

Both need bound Auth admin credentials to verify the confirmed recipient. Worker SMTP
blocks new events before network access; put no SMTP credentials in Worker secrets.

```dotenv
EMAIL_TRANSPORT=smtp
SMTP_URL=smtps://fixture-user:replace-with-secret@smtp.example.test:465
SMTP_SECRET_ORIGIN=smtps://smtp.example.test:465
TRANSACTIONAL_EMAIL_FROM=Riparim <no-reply@auth.example.test>
SITE_ORIGIN=https://riparim.example.test
```

Encode URL credentials. Binding must match exact protocol/host/explicit port, without
query, fragment or custom options. `smtps` uses TLS; `smtp` requires STARTTLS. Certificates
are verified (TLS ≥1.2). Only credential-free numeric loopback `127.0.0.1`/`::1` may use
plaintext; `localhost` does not qualify. Configure internal CAs in protected Node trust.
Authorize sender/domain and verify SPF/DKIM/DMARC, quotas and actual receipt separately.

## Retry or switch

1. Choose a [verified release](releases.md) with its additive mail migration; preserve
   historical events. Stop/drain delivery writers under [provider switching](provider-switch.md).
2. Complete/reconcile started events with their original transport/credentials. Only
   new/unstarted events may adopt new settings. Changed contacts or credential scopes
   block retry; changed sender/language cannot rewrite started messages.
3. Verify TLS, credentials, sender and real receipt with isolated accounts. New mail
   uses confirmed DE/SQ/EN preference; historical bytes remain frozen.
4. Disable old timers/crons. Retry a single eligible event with
   `npm run notifications:node -- <event-id>` in source, or the
   [packaged Node command](node.md). Restoring an old provider requires its original scope.

## Handle uncertain acceptance

The [outbox](../../lib/notifications/outbox.ts) preserves original request/MIME bytes,
Message-ID and binding. Started historical events without a transport belong to Resend.

- Resend retries keep identical bytes/key for at most 23 hours (provider window: 24).
- SMTP has no provider idempotency. Only complete AUTH/envelope/DATA rejection proves
  nonacceptance: 4xx backs off; 5xx stays blocked for controlled repair.
- Socket loss, timeout, incomplete replies or process/lease loss become `unknown`.
  Administrative retry cannot resend them. Reconcile Message-ID against relay logs;
  never delete/reset events to force sending.
- Positive acceptance means handoff, not inbox receipt. There is no exactly-once guarantee.

Local tests send no real email. [Auth template activation](auth-email-templates.md) is
separate. Provider references: [SMTP](https://nodemailer.com/smtp) and
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
