"use client";
import {useEffect,useState} from "react";
import {usePathname,useSearchParams} from "next/navigation";

// Release documents carry no request query. Read the committed browser URL
// after hydration, including when the framework exposes its release-time URL.
export function usePageQuery(){
 const pathname=usePathname(),frameworkSearch=useSearchParams().toString();
 const [search,setSearch]=useState(frameworkSearch);
 useEffect(()=>{const read=()=>setSearch(window.location.search);read();window.addEventListener('popstate',read);return()=>window.removeEventListener('popstate',read);},[pathname,frameworkSearch]);
 return new URLSearchParams(search);
}
