import type { ReactNode } from "react";
import { LocaleAnchor } from "@/components/locale-anchor";
import {
  privacyContactAddress,
  type PrivacyMessageCatalog,
} from "@/lib/i18n/privacy-messages";
function rich(text: string, slots: Record<string, ReactNode>): ReactNode {
  return text
    .split(/(\{[a-zA-Z]+\})/)
    .map((part, index) =>
      part.startsWith("{") ? (
        <span key={index}>{slots[part.slice(1, -1)]}</span>
      ) : (
        part
      ),
    );
}
const sections = [
  ["account", 3],
  ["cookies", 3],
  ["locale", 1],
  ["reviews", 3],
  ["notifications", 3],
  ["business", 2],
  ["storage", 1],
  ["google", 3],
  ["deletion", 5],
] as const;
export function PrivacyContent({
  text,
  authProvider = "supabase",
}: {
  text: PrivacyMessageCatalog;
  authProvider?: "supabase" | "pocketbase";
}) {
  const contact = (
    <LocaleAnchor
      className="text-[var(--theme-accent)] underline underline-offset-[3px] [overflow-wrap:anywhere]"
      href={`mailto:${privacyContactAddress}`}
    >
      {privacyContactAddress}
    </LocaleAnchor>
  );
  const slots = {
    contact,
    openid: <code className="text-[0.95em]">openid</code>,
    email: <code className="text-[0.95em]">email</code>,
    profile: <code className="text-[0.95em]">profile</code>,
    publishedFields: <strong>{text.reviewsPublicFields}</strong>,
    google: (
      <LocaleAnchor
        className="text-[var(--theme-accent)] underline underline-offset-[3px] [overflow-wrap:anywhere]"
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
      >
        Google
      </LocaleAnchor>
    ),
    authProvider: (
      <LocaleAnchor
        className="text-[var(--theme-accent)] underline underline-offset-[3px] [overflow-wrap:anywhere]"
        href={
          authProvider === "pocketbase"
            ? "https://pocketbase.io/docs/authentication/"
            : "https://supabase.com/privacy"
        }
        target="_blank"
        rel="noopener noreferrer"
      >
        {authProvider === "pocketbase" ? "PocketBase" : "Supabase"}
      </LocaleAnchor>
    ),
  };
  return (
    <main
      className="mx-auto mt-[42px] mb-[72px] w-[min(760px,calc(100%_-_40px))] text-[16px] leading-[1.75] at-most-720:mt-7"
      data-ui="privacy-page"
    >
      <h1 className="mb-3 text-[clamp(30px,5vw,42px)] leading-[1.2] tracking-[-0.8px]">
        {text.title}
      </h1>
      <p className="mb-6 text-[14px] text-muted-foreground">{text.date}</p>
      <p>{rich(text.contact, slots)}</p>
      {sections.map(([name, count]) => (
        <section
          className="mt-[34px]"
          key={name}
          aria-labelledby={`privacy-${name}`}
        >
          <h2
            className="mb-3.5 text-[22px] leading-[1.35] at-most-720:text-[20px]"
            id={`privacy-${name}`}
          >
            {text[`${name}Heading`]}
          </h2>
          {Array.from({ length: count }, (_, i) => (
            <p className={i > 0 ? "mt-3.5" : undefined} key={i}>
              {rich(
                text[`${name}${i + 1}` as keyof PrivacyMessageCatalog],
                slots,
              )}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
