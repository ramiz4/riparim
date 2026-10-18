import { CityNavigation } from "@/components/city-navigation";
import type { Locale } from "@/lib/i18n/locale";
import {
  guideIds,
  guideMessages,
  type GuideId,
} from "@/lib/i18n/guide-messages";
import Link from "@/components/locale-link";
import { cn } from "@/lib/utils";
import {
  appButton,
  contentPageClassName,
  contentTitleClassName,
  eyebrowClassName,
  pageFrameClassName,
} from "@/lib/presentation";

const mainClassName = cn(
  pageFrameClassName,
  contentPageClassName,
  "max-w-[820px] [overflow-wrap:anywhere] [&_a:focus-visible]:rounded [&_a:focus-visible]:outline-3 [&_a:focus-visible]:outline-ring [&_a:focus-visible]:outline-offset-4",
);
const copyClassName = "text-[16px] leading-[1.8] text-muted-foreground";
const headingClassName =
  "mb-3 text-[22px] font-semibold leading-[1.35] tracking-[-0.3px]";
const linkClassName =
  "font-semibold text-[var(--theme-accent)] underline underline-offset-4";

function CatalogueNextStep({ locale }: { locale: Locale }) {
  const text = guideMessages[locale];
  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-6 at-most-540:p-5">
      <h2 className={headingClassName}>{text.nextTitle}</h2>
      <p className={cn(copyClassName, "mb-5")}>{text.nextDescription}</p>
      <Link
        href="/workshops"
        className={cn(appButton(), "max-w-full text-center")}
      >
        {text.findWorkshops}
      </Link>
      <div className="mt-6 border-t border-border pt-5">
        <CityNavigation />
      </div>
    </section>
  );
}
export function GuideIndexContent({ locale }: { locale: Locale }) {
  const text = guideMessages[locale];
  return (
    <main className={mainClassName} data-riparim-page="guide">
      <p className={cn(eyebrowClassName, "mb-3")}>{text.kicker}</p>
      <h1 className={contentTitleClassName}>{text.indexTitle}</h1>
      <p className={cn(copyClassName, "mt-5 max-w-[680px]")}>
        {text.indexDescription}
      </p>
      <div className="mt-8 grid gap-5">
        {guideIds.map((id) => (
          <article
            key={id}
            className="rounded-2xl border border-border bg-card p-6 at-most-540:p-5"
          >
            <h2 className={headingClassName}>
              <Link
                href={`/guides/${id}`}
                className="hover:text-[var(--theme-accent)]"
              >
                {text.articles[id].title}
              </Link>
            </h2>
            <p className={cn(copyClassName, "mb-4")}>
              {text.articles[id].description}
            </p>
            <Link
              href={`/guides/${id}`}
              className={linkClassName}
              aria-label={`${text.read}: ${text.articles[id].title}`}
            >
              {text.read}
            </Link>
          </article>
        ))}
      </div>
      <CatalogueNextStep locale={locale} />
    </main>
  );
}
export function GuideArticleContent({
  locale,
  id,
}: {
  locale: Locale;
  id: GuideId;
}) {
  const text = guideMessages[locale],
    article = text.articles[id],
    related = guideIds.find((value) => value !== id)!;
  return (
    <main className={mainClassName} data-riparim-page="guide">
      <Link
        href="/guides"
        className={cn(linkClassName, "mb-7 inline-flex min-h-11 items-center")}
      >
        {text.back}
      </Link>
      <article data-guide-id={id}>
        <header>
          <p className={cn(eyebrowClassName, "mb-3")}>{text.kicker}</p>
          <h1 className={contentTitleClassName}>{article.title}</h1>
          <p className={cn(copyClassName, "mt-5 text-[18px]")}>
            {article.intro}
          </p>
        </header>
        {article.sections.map((section) => (
          <section key={section.title} className="mt-8">
            <h2 className={headingClassName}>{section.title}</h2>
            <p className={copyClassName}>{section.text}</p>
            {section.items && (
              <ul
                className={cn(copyClassName, "mt-3 list-disc space-y-2 pl-6")}
              >
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <section
          className="mt-8 rounded-2xl bg-accent p-6 at-most-540:p-5"
          data-ui="guide-checklist"
        >
          <h2 className={headingClassName}>{text.checklistTitle}</h2>
          <ul className="list-disc space-y-3 pl-6 text-[16px] leading-[1.7]">
            {article.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="mt-8 border-t border-border pt-6">
          <h2 className={headingClassName}>{text.sourcesTitle}</h2>
          <p className={cn(copyClassName, "text-[14px]")}>{text.sourcesNote}</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <a
                href="https://www.aaa.com/autorepair/articles/questions-to-ask-when-picking-an-auto-repair-shop"
                className={linkClassName}
                lang="en"
              >
                AAA: Questions to Ask When Picking an Auto Repair Shop
              </a>
            </li>
            <li>
              <a
                href="https://www.adac.de/rund-ums-fahrzeug/reparatur-pflege-wartung/werkstatt-tipps/autowerkstatt-auftrag-kosten-termine/"
                className={linkClassName}
                lang="de"
              >
                ADAC: Werkstatt: Tipps zu Reparaturauftrag, Kostenvoranschlag
                und Termin
              </a>
            </li>
          </ul>
        </section>
      </article>
      <CatalogueNextStep locale={locale} />
      <nav className="mt-8" aria-label={text.relatedTitle}>
        <h2 className={headingClassName}>{text.relatedTitle}</h2>
        <Link href={`/guides/${related}`} className={linkClassName}>
          {text.articles[related].title}
        </Link>
      </nav>
    </main>
  );
}
