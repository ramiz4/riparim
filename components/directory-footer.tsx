"use client";
import {useI18n} from "@/lib/i18n/client";
import {LocaleAnchor} from "@/components/locale-anchor";
import {useState} from "react";
import Link from "@/components/locale-link";
import {ChevronRight,FileCheck2,LockKeyhole,Settings} from "lucide-react";
import {Brand} from "@/components/brand";
import {Dialog,DialogTrigger} from "@/components/ui/dialog";
import {ModalContent} from "@/components/modal-shell";

export function DirectoryFooter({open,onOpenChange}:{open?:boolean;onOpenChange?:(value:boolean)=>void}={}){const {t}=useI18n();const [localInfo,setLocalInfo]=useState(false);const info=open??localInfo,setInfo=onOpenChange??setLocalInfo;return <Dialog open={info} onOpenChange={setInfo}><div className="footer-band"><footer className="footer directory-footer wrap">
 <div className="footer-branding"><Brand/><p className="footer-tagline">{t("public.tagline")}</p></div>
 <nav className="footer-navigation" aria-label={t("public.footerNavigation")}>
  <Link className="footer-action footer-settings" href="/einstellungen"><Settings className="footer-action-icon" size={20} aria-hidden="true"/><span>{t("common.settings")}</span><ChevronRight className="footer-action-arrow" size={18} aria-hidden="true"/></Link>
  <DialogTrigger asChild><button className="footer-action" type="button"><FileCheck2 className="footer-action-icon" size={20} aria-hidden="true"/><span>{t("public.sourcesProof")}</span></button></DialogTrigger>
  <Link className="footer-action" href="/datenschutz"><LockKeyhole className="footer-action-icon" size={20} aria-hidden="true"/><span>{t("public.privacy")}</span></Link>
 </nav>
 <span className="footer-copyright">© 2026 Riparim</span>
 </footer></div><ModalContent className="info-modal" title={t("public.sourcesProof")} description={t("public.proofDescription")}><section><h3>{t("public.businessInfo")}</h3><p>{t("public.businessInfoHelp")}</p></section><section><h3>{t("public.reviews")}</h3><p>{t("public.proofHelp")}</p></section><section><h3>{t("public.directContact")}</h3><p>{t("public.directContactHelp")}</p></section><section><h3>{t("public.yourData")}</h3><p>{t("public.yourDataHelp")}</p></section><p className="help">{t("public.cityCentres")}<LocaleAnchor href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</LocaleAnchor>.</p></ModalContent></Dialog>;
}
