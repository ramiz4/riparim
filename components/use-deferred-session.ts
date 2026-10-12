"use client";
import {useEffect,useState} from "react";
import {loadPublicSession,subscribePublicSession,applyPublicSessionChange,type PublicSession,type SessionChange} from "./use-public-session";

export function useDeferredSession(){
 const [session,setSession]=useState<PublicSession|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0),[pending,setPending]=useState(true);
 useEffect(()=>{
  let active=true,sequence=0;
  const refresh=(change:SessionChange={})=>{
   const current=++sequence;setPending(true);setSession(previous=>applyPublicSessionChange(previous,change));
   void loadPublicSession().then(value=>{if(active&&current===sequence){setSession(value);setError(false);}}).catch(()=>{if(active&&current===sequence)setError(true);}).finally(()=>{if(active&&current===sequence)setPending(false);});
  };
  const unsubscribe=subscribePublicSession(refresh);refresh();
  return()=>{active=false;unsubscribe();};
 },[attempt]);
 return {session,error,pending,retry(){setPending(true);setAttempt(value=>value+1);}};
}
