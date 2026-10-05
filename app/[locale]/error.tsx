"use client";
import {useI18n} from "@/lib/i18n/client";
export default function PageError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 const {t}=useI18n();
 return <main className="access-page"><p className="error" role="alert">{t("common.unavailable")}</p><button className="primary" onClick={reset}>{t("common.retry")}</button></main>;
}
