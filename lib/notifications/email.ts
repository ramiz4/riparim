import { z } from "zod";
import { siteOrigin } from "@/lib/auth/config";
import { emailCopy, emailHtml } from "@/lib/email-content";
import { localizeHref, type Locale } from "@/lib/i18n/locale";
import { ownReviewsHref, reviewSubmissionId } from "@/lib/own-reviews";
import type { ReviewDecision } from "./contract";

// New messages opt out of Resend's generated plaintext with text: "".
// Valid historical frozen requests may still
// contain text; accepting it preserves their exact idempotent retry bytes.
export function validSender(from: string) {
  return (
    from.length <= 320 &&
    !/[\r\n]/.test(from) &&
    /^[^<>]*<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$|^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(
      from,
    )
  );
}
export const deliveryPayloadSchema = z
  .object({
    from: z.string().max(320).refine(validSender),
    to: z.array(z.string().email()).length(1),
    subject: z.string().max(200),
    html: z.string().max(12000),
    text: z.string().max(6000).optional(),
  })
  .strict();
export type DeliveryPayload = z.infer<typeof deliveryPayloadSchema>;
export function notificationLink(id: string, locale: Locale = "de") {
  if (!reviewSubmissionId(id)) throw Error("INVALID_VISIT_ID");
  const origin = new URL(siteOrigin());
  if (origin.protocol !== "https:" || origin.username || origin.password)
    throw Error("INVALID_SITE_ORIGIN");
  const link = new URL(localizeHref("/anmelden", locale), origin.origin);
  link.searchParams.set("weiter", localizeHref(ownReviewsHref(id), locale));
  return link.href;
}
export function reviewEmail(
  decision: ReviewDecision,
  id: string,
  from: string,
  to: string,
  locale: Locale,
): DeliveryPayload {
  const copy = emailCopy[locale][decision],
    url = notificationLink(id, locale);
  return deliveryPayloadSchema.parse({
    from,
    to: [to],
    subject: copy.title,
    html: emailHtml(locale, copy, url),
    text: "",
  });
}
export class DeliveryError extends Error {
  constructor(
    public code: string,
    public retryable: boolean,
    public uncertain = false,
  ) {
    super(code);
  }
}
export async function sendReviewEmail(body: string, key: string, id: string) {
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": id,
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new DeliveryError("provider_unavailable", true);
  }
  if (!response.ok) {
    if (response.status === 429) throw new DeliveryError("rate_limited", true);
    if (response.status >= 500)
      throw new DeliveryError("provider_unavailable", true);
    if (response.status === 409) {
      let error;
      try {
        error = (await response.json()) as { name?: unknown };
      } catch {}
      if (error?.name === "concurrent_idempotent_requests")
        throw new DeliveryError("provider_unavailable", true);
    }
    throw new DeliveryError("provider_rejected", false);
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new DeliveryError("provider_unavailable", true);
  }
  const data = z.object({ id: z.string().min(1).max(100) }).safeParse(result);
  if (!data.success) throw new DeliveryError("provider_unavailable", true);
  return data.data.id;
}
