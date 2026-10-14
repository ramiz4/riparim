"use client";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { WorkshopNavigationLink } from "./workshop-navigation-link";
import { appButton, pageFrameClassName } from "@/lib/presentation";
import { cn } from "@/lib/utils";

export function ReviewInvitation() {
  const { t } = useI18n();
  return (
    <section
      className="overflow-hidden bg-[#edf6f3] text-[#183f36] dark:bg-[#10292c] dark:text-[#eef8f3]"
      data-ui="review-invitation"
      aria-labelledby="review-invitation-title"
    >
      <div
        className={cn(
          pageFrameClassName,
          "grid grid-cols-[1.25fr_1fr] items-center gap-16 py-[72px] at-most-1000:gap-8 at-most-720:grid-cols-[minmax(0,1fr)] at-most-720:gap-7 at-most-720:py-10",
        )}
      >
        <div className="min-w-0">
          <p className="mb-[18px] text-[13px] font-[650] text-[#416d60] dark:text-[#c0d9cf]">
            {t("public.reviewInviteKicker")}
          </p>
          <h2
            id="review-invitation-title"
            className="text-[clamp(32px,3.5vw,48px)] font-bold leading-[1.12] tracking-[-1.5px] [overflow-wrap:anywhere] at-most-720:text-[32px] at-most-720:tracking-[-1px]"
          >
            {t("public.reviewInviteTitle")}
            <span className="block text-[#16785d] dark:text-[#a5e5cd]">
              {t("public.reviewInviteAccent")}
            </span>
          </h2>
          <p className="my-6 max-w-[490px] text-[17px] leading-[1.65] text-[#416457] dark:text-[#c0d9cf] at-most-720:my-5 at-most-720:text-[16px]">
            {t("public.reviewInviteCopy")}
          </p>
          <WorkshopNavigationLink
            className={cn(
              appButton(),
              "min-h-12 max-w-full text-center text-[16px] whitespace-normal at-most-720:w-full",
            )}
            href="/werkstaetten"
          >
            {t("public.reviewInviteAction")}
            <ArrowRight size={18} aria-hidden="true" />
          </WorkshopNavigationLink>
          <p className="mt-5 flex max-w-[460px] items-start gap-[9px] text-[13px] leading-[1.6] text-[#416457] dark:text-[#c0d9cf]">
            <ShieldCheck size={17} aria-hidden="true" className="mt-[2px]" />
            {t("public.reviewInviteNote")}
          </p>
        </div>
        <figure className="m-0 h-[340px] min-w-0 overflow-hidden rounded-[24px] bg-[#d5e3dd] at-most-720:h-60 at-most-720:rounded-[20px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- Preoptimized static WebP variants already provide responsive delivery without a runtime optimizer. */}
          <img
            className="block h-full w-full object-cover object-[60%_center]"
            src="/review-experience-1024.webp"
            srcSet="/review-experience-640.webp 640w, /review-experience-1024.webp 1024w, /review-experience-1280.webp 1280w"
            sizes="(max-width: 720px) calc(100vw - 32px), (max-width: 1280px) 45vw, 550px"
            width={1280}
            height={853}
            loading="lazy"
            decoding="async"
            alt={t("public.reviewInviteImageAlt")}
          />
        </figure>
      </div>
    </section>
  );
}
