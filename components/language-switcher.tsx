"use client";
import {useId} from "react";
import {Globe} from "lucide-react";
import {useI18n} from "@/lib/i18n/client";
import {isLocale,locales} from "@/lib/i18n/locale";
import {languageSwitchHref} from "@/lib/i18n/navigation";
import {useNavigationState} from "@/lib/i18n/navigation-guard";
const names={de:"Deutsch",sq:"Shqip",en:"English"};
export function LanguageSwitcher(){
 const {locale,t}=useI18n(),state=useNavigationState(),id=useId();
 return <label className="language-switcher" htmlFor={id}><Globe size={16} aria-hidden="true"/><span className="sr-only">{t("common.languageLabel")}</span><select id={id} value={locale} disabled={state.busy} onChange={event=>{
  const next=event.target.value;if(!isLocale(next)||next===locale||state.busy)return;
  if(state.dirty&&!window.confirm(t("common.discardDraft")))return;
  window.location.assign(languageSwitchHref(`${window.location.pathname}${window.location.search}${window.location.hash}`,next));
 }}>{locales.map(value=><option key={value} value={value} lang={value}>{names[value]}</option>)}</select></label>;
}
