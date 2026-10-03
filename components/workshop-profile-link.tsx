"use client";
import {useEffect,useRef,type AnchorHTMLAttributes,type MouseEvent} from "react";
import {useRouter} from "next/navigation";
import {navigateToProfile} from "@/lib/profile-navigation";

export function WorkshopProfileLink({href,children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{href:string}){
 const router=useRouter(),cancel=useRef<(()=>void)|null>(null);
 useEffect(()=>()=>cancel.current?.(),[]);
 function open(event:MouseEvent<HTMLAnchorElement>){
  props.onClick?.(event);
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.currentTarget.hasAttribute("download")||(event.currentTarget.target&&event.currentTarget.target!=="_self"))return;
  event.preventDefault();
  cancel.current=navigateToProfile(href,{
   readHref:()=>window.location.href,
   navigate:target=>router.push(target),
   hardNavigate:target=>window.location.assign(target),
   schedule:(callback,delay)=>{const timer=window.setTimeout(callback,delay);return()=>window.clearTimeout(timer);},
  });
 }
 return <a {...props} href={href} onClick={open}>{children}</a>;
}
