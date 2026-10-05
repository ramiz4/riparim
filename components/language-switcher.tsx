"use client";
import {useId,useState} from "react";
import {Globe} from "lucide-react";
import {useI18n} from "@/lib/i18n/client";
import {isLocale,locales} from "@/lib/i18n/locale";
import {preferredLanguageHref} from "@/lib/i18n/preference";
import {useNavigationState} from "@/lib/i18n/navigation-guard";
const names={de:"Deutsch",sq:"Shqip",en:"English"};
export function LanguageSwitcher({verifiedAccount=false}:{verifiedAccount?:boolean}){
 const [saving,setSaving]=useState(false);
 const {locale,t}=useI18n(),state=useNavigationState(),id=useId();
 return <label className="language-switcher" htmlFor={id}><Globe size={16} aria-hidden="true"/><span className="sr-only">{t("common.languageLabel")}</span><select id={id} value={locale} disabled={state.busy||saving} onChange={async event=>{
  const next=event.target.value;if(!isLocale(next)||next===locale||state.busy||saving)return;
  if(state.dirty&&!window.confirm(t("common.discardDraft")))return;
  setSaving(true);
  const destination=await preferredLanguageHref(`${window.location.pathname}${window.location.search}${window.location.hash}`,next,verifiedAccount);
  window.location.assign(destination);
 }}>{locales.map(value=><option key={value} value={value} lang={value}>{names[value]}</option>)}</select></label>;
}
