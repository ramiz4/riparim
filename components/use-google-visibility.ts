"use client";
import {useCallback,useEffect,useRef,useState} from "react";

// Provider requests require both viewport visibility and an active browser tab.
export function useGoogleVisibility(){
 const ref=useRef<HTMLDivElement>(null),inView=useRef(false);
 const [visible,setVisible]=useState(false),[activeTab,setActiveTab]=useState(false);
 useEffect(()=>{
  const updateTab=()=>setActiveTab(document.visibilityState!=="hidden");
  updateTab();document.addEventListener("visibilitychange",updateTab);
  const update=(value:boolean)=>{inView.current=value;setVisible(value);};
  if(typeof IntersectionObserver==="undefined"){update(true);return()=>document.removeEventListener("visibilitychange",updateTab);}
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.target===ref.current||entries.length===1)update(entry.isIntersecting);},{rootMargin:"120px"});
  if(ref.current)observer.observe(ref.current);
  return()=>{observer.disconnect();document.removeEventListener("visibilitychange",updateTab);};
 },[]);
 const isVisible=useCallback(()=>inView.current&&document.visibilityState!=="hidden",[]);
 return {ref,canLoad:visible&&activeTab,isVisible};
}
