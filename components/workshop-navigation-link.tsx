"use client";
import {LocaleAnchor} from "@/components/locale-anchor";
import {useEffect,useRef,type AnchorHTMLAttributes,type MouseEvent} from "react";
import {useRouter} from "next/navigation";
import {useI18n} from "@/lib/i18n/client";
import {localizeHref,stripLocalePrefix} from "@/lib/i18n/locale";
import {navigateToWorkshopPage} from "@/lib/profile-navigation";

export function WorkshopNavigationLink({href,children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{href:string}){
 const {locale}=useI18n(),localizedHref=localizeHref(href,locale);
 const router=useRouter(),cancel=useRef<(()=>void)|null>(null);
 useEffect(()=>()=>cancel.current?.(),[]);
 function open(event:MouseEvent<HTMLAnchorElement>){
  props.onClick?.(event);
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.currentTarget.hasAttribute("download")||(event.currentTarget.target&&event.currentTarget.target!=="_self"))return;
  event.preventDefault();
  cancel.current=navigateToWorkshopPage(localizedHref,{
   readHref:()=>window.location.href,
   isPageReady:target=>{
    const pathname=stripLocalePrefix(new URL(target,window.location.href).pathname);
    if(pathname==="/werkstaetten")return document.querySelector(".catalogue-page")!==null;
    const page=document.querySelector<HTMLElement>(".workshop-page");
    return page?.dataset.workshopId===decodeURIComponent(pathname.slice("/werkstatt/".length));
   },
   navigate:target=>router.push(target),
   hardNavigate:target=>window.location.assign(target),
   schedule:(callback,delay)=>{const timer=window.setTimeout(callback,delay);return()=>window.clearTimeout(timer);},
  });
 }
 return <LocaleAnchor {...props} href={localizedHref} onClick={open}>{children}</LocaleAnchor>;
}
