"use client";
import {useEffect,useState} from "react";
import {VisitForm} from "@/app/journeys";
import type {Workshop} from "@/lib/workshops";
import type {AccountIdentity} from "@/components/account-storage-notice";

export function useDirectoryAccountActions({directory,signedIn,account,onRefresh,observePrivateQuery=false}:{directory:Workshop[];signedIn:boolean;account:AccountIdentity|null;onRefresh:()=>void;observePrivateQuery?:boolean}){
 const [reviewOpen,setReviewOpen]=useState(false),[workshop,setWorkshop]=useState<Workshop|null>(null);
 function openReview(w:Workshop|null=null){setWorkshop(w);setReviewOpen(true);}
 function clearPrivateQuery(){const url=new URL(window.location.href);url.searchParams.delete("nachweis");window.history.replaceState(null,"",url);}
 useEffect(()=>{if(!observePrivateQuery)return;const sync=()=>{const query=new URLSearchParams(window.location.search);if(query.get("nachweis")){setWorkshop(directory.find(w=>w.id===query.get("nachweis"))??null);setReviewOpen(true);}};sync();window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);},[directory,observePrivateQuery]);
 return {onNewVisit:()=>openReview(),dialogs:<VisitForm open={reviewOpen} onClose={()=>{clearPrivateQuery();setReviewOpen(false);onRefresh();}} workshop={workshop} directory={directory} signedIn={signedIn} account={account} existing={null}/>};
}
