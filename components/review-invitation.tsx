"use client";
import {ArrowRight,ShieldCheck} from "lucide-react";
import {useI18n} from "@/lib/i18n/client";
import {WorkshopNavigationLink} from "./workshop-navigation-link";

export function ReviewInvitation(){
 const {t}=useI18n();
 return <section className="review-invitation" aria-labelledby="review-invitation-title"><div className="review-invitation-content wrap">
  <div className="review-invitation-copy"><p className="review-invitation-kicker">{t("public.reviewInviteKicker")}</p><h2 id="review-invitation-title">{t("public.reviewInviteTitle")}<span>{t("public.reviewInviteAccent")}</span></h2><p className="review-invitation-description">{t("public.reviewInviteCopy")}</p><WorkshopNavigationLink className="primary" href="/werkstaetten">{t("public.reviewInviteAction")}<ArrowRight size={18} aria-hidden="true"/></WorkshopNavigationLink><p className="review-invitation-note"><ShieldCheck size={17} aria-hidden="true"/>{t("public.reviewInviteNote")}</p></div>
  <figure className="review-invitation-visual"><img src="/review-experience-1024.webp" srcSet="/review-experience-640.webp 640w, /review-experience-1024.webp 1024w, /review-experience-1280.webp 1280w" sizes="(max-width: 720px) calc(100vw - 32px), (max-width: 1280px) 45vw, 550px" width={1280} height={853} loading="lazy" decoding="async" alt={t("public.reviewInviteImageAlt")}/></figure>
 </div></section>;
}
