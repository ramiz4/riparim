"use client";
import {useId,useRef} from "react";
import {useI18n} from "@/lib/i18n/client";
import {workshopEmailLimit,type WorkshopEmailEdit} from "@/lib/workshop-emails";

export function WorkshopEmailsEditor({emails,onChange}:{emails:WorkshopEmailEdit[];onChange:(emails:WorkshopEmailEdit[])=>void}){
 const {t}=useI18n(),id=useId(),inputs=useRef<(HTMLInputElement|null)[]>([]),add=useRef<HTMLButtonElement|null>(null);
 function remove(index:number){onChange(emails.filter((_,i)=>i!==index));requestAnimationFrame(()=>{(inputs.current[Math.min(index,emails.length-2)]??add.current)?.focus();});}
 return <fieldset className="workshop-email-editor"><legend>{t("common.workshopEmails")}</legend><p className="help">{t("common.workshopEmailsHelp")}</p>
  {emails.map((entry,index)=><div className="workshop-email-row" key={index}><label htmlFor={`${id}-${index}`}>{t("common.workshopEmailNumber",{number:index+1})}<input ref={node=>{inputs.current[index]=node;}} id={`${id}-${index}`} type="email" autoComplete="off" maxLength={254} value={entry.address} onChange={event=>onChange(emails.map((value,i)=>i===index?{...value,address:event.target.value,verified:false}:value))}/></label><button className="outline small" type="button" aria-label={t("common.workshopEmailRemove",{number:index+1})} onClick={()=>remove(index)}>{t("common.hoursRemove")}</button><div className="workshop-email-flags"><label><input type="checkbox" checked={entry.active} aria-label={`${t("common.workshopEmailEnable")} ${index+1}`} onChange={event=>onChange(emails.map((value,i)=>i===index?{...value,active:event.target.checked}:value))}/>{t("common.workshopEmailEnable")}</label><label><input type="checkbox" checked={entry.verified} aria-label={`${t("common.workshopEmailVerify")} ${index+1}`} onChange={event=>onChange(emails.map((value,i)=>i===index?{...value,verified:event.target.checked}:value))}/>{t("common.workshopEmailVerify")}</label></div></div>)}
  <button ref={add} className="outline small" type="button" disabled={emails.length>=workshopEmailLimit} onClick={()=>{onChange([...emails,{address:"",active:true,verified:false}]);requestAnimationFrame(()=>inputs.current[emails.length]?.focus());}}>{t("common.workshopEmailAdd")}</button>
 </fieldset>;
}
