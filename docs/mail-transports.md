# Review messages and provider switching

The existing outbox still handles moderation events, leases, backoff and immediate
individual sends. Retries are exclusively manual, at most five in addition to
the initial send. Waits are 1, 5, 15, 30 and 60 minutes; claim, wait and the total
limit of six attempts are checked together. The moderation decision succeeds
even on delivery errors. The small contract in `lib/notifications/transports.ts`
selects Resend or SMTP; there is no additional queue service or automatic
provider fallback.

## Configuration

Without `EMAIL_TRANSPORT`, Resend remains the default. `EMAIL_TRANSPORT=resend`,
`RESEND_API_KEY` and `TRANSACTIONAL_EMAIL_FROM` work as before.
The Worker uses this HTTP transport. Selecting SMTP in the Worker blocks new
events before network access; SMTP credentials do not belong in its deployment
secrets.

Portable Node operation also supports `EMAIL_TRANSPORT=smtp`:

```dotenv
EMAIL_TRANSPORT=smtp
SMTP_URL=smtps://fixture-user:replace-with-secret@smtp.example.test:465
SMTP_SECRET_ORIGIN=smtps://smtp.example.test:465
TRANSACTIONAL_EMAIL_FROM=Riparim <no-reply@auth.example.test>
SITE_ORIGIN=https://riparim.example.test
```

`SMTP_URL` is a server-side secret. Username and password are URL-encoded when
needed. `SMTP_SECRET_ORIGIN` must specify exactly the protocol, normalized host
and explicit port of the credential-free target. Paths other than `/`, query
parameters, fragments and unbound credentials are invalid.
The SMTP server must allow the sender for the selected domain. SPF, DKIM, DMARC
and provider limits remain the responsibility of domain/mail server configuration.

`smtps://` uses TLS immediately; `smtp://` requires STARTTLS.
Certificates are checked using Node trust anchors and at least TLS 1.2.
TLS cannot be disabled through the URL. Only a relay at the **numeric** loopback
address `127.0.0.1` or `::1` may operate unencrypted without credentials;
this is the local test path. `localhost` is no plaintext exception.
Internal CAs must be configured in protected Node operation through the normal
Node trust store. The TLS probe uses only an isolated fixture CA.

DNS, connection establishment, greeting and socket inactivity are each limited
to eight seconds; a total limit of 20 seconds additionally closes the SMTP
connection. The outbox lease remains 120 seconds. Nodemailer 10.1.0 provides
MIME generation and the documented single SMTPConnection lifecycle;
connection pools and their automatic requeues are not used.
Nodemailer is loaded only in Node builds.

`SUPABASE_SECRET_KEY`, or the bound admin key of the
[compatible Auth host](auth-provider.md), remains required to verify the confirmed
account address. Browser data cannot override sender, recipient or content.
New messages use the confirmed DE/SQ/EN preference.

## Persistence and retries

Apply migration `0017_mail_transports.sql` before the new code. It adds only
nullable `transport`, nullable `wire_payload` and `smtp_in_flight` defaulting
to 0. No data transfer is required. Already started events with `transport=NULL`
always belong to Resend.

Before the first network access, transport, credential configuration hash and
original JSON payload bytes are stored atomically. SMTP additionally freezes
all RFC 5322/MIME bytes, including date, Message-ID, sender, language and encoding.
The hash covers SMTP host, port, TLS mode, local relay exception, username and
password; secrets are not copied into the table. Known retries retain these
bytes even after sender or language preference changes. Changed confirmed
recipients block them.

Resend retries the identical request with the existing event key only within
23 hours; the provider retains idempotency keys for 24 hours.
SMTP has **no** such provider idempotency. The persistent `smtp_in_flight=1`
marker is set before connection establishment:

- Only AUTH/envelope/DATA rejections unambiguously processed by the SMTP client
  (`EAUTH`, `EENVELOPE`, `EMESSAGE` with 4xx/5xx) prove nonacceptance.
  4xx responses get backoff; 5xx remain blocked for controlled repair.
  Only successfully stored nonacceptance clears the marker.
  Connection, socket, timeout and protocol errors remain `unknown`, even with
  `responseCode`: an unterminated or incomplete multiline response proves
  no rejection.
- Connection interruption, timeout, process loss, expired lease and lost
  success/start acknowledgments produce `unknown`. Even an administrative retry
  must not turn that into a new send.
- A positive provider response means handoff, not final delivery.
  After success is stored, private payload and MIME content are removed.

There is no exactly-once delivery guarantee. For `unknown`, an operator must
reconcile the Message-ID against relay/provider logs and, if necessary, record
confirmation separately. This change deliberately offers no action to reopen
such events without verification.

## Switching and verification

1. Prepare the verified main release and migration in the target environment;
   before data/domain cutover, follow the [portable operating path](node-runtime.md)
   and [release rules](releases.md). Do not let old and new outbox processes
   write concurrently against different database copies.
2. Complete historical started Resend events under the previous configuration
   within their safe window, or check them with the previous provider.
   Started events must receive no different transport/host/key.
   Unstarted events may begin with new configuration.
3. Check SMTP host, TLS, domain authorization and authentication in an isolated
   environment. Set credential configuration in protected Node operation.
   The existing protected notification API shows errors without recipients,
   messages or keys.
4. Set up no timer/cron in Node operation. An explicit retry uses
   `npm run notifications:node -- <event-id>` and the same limits.
   No additional queue product is needed. After switching, allow the new provider
   to process only new or still unstarted events.
5. When returning to the old transport, restore its original scope;
   `unknown` remains blocked. Do not delete or copy outbox rows or reset status
   values to force a retry.

The regular test suite checks actual local SMTP, negative RCPT/DATA responses,
unterminated 4xx/5xx and multiline responses, socket loss after DATA, database
acknowledgment loss, concurrency and lease loss, plus TLS authentication with
an isolated CA, rejection of an untrusted certificate and credential target
binding. All test data is fictitious; no actual emails are sent and no live
providers are changed.

Primary contracts: [Nodemailer SMTP](https://nodemailer.com/smtp),
[SMTPConnection](https://nodemailer.com/extras/smtp-connection),
[Nodemailer error contract](https://nodemailer.com/errors) and
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
