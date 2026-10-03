"use client";
import {useEffect,useState} from "react";
import {MyVisits,VisitForm,type Visit} from "@/app/journeys";
import type {Workshop} from "@/lib/workshops";
import type {AccountIdentity} from "@/components/account-storage-notice";

export function useDirectoryAccountActions({directory,signedIn,account,onRefresh,observePrivateQuery=false}:{directory:Workshop[];signedIn:boolean;account:AccountIdentity|null;onRefresh:()=>void;observePrivateQuery?:boolean}){
 const [myReviews,setMyReviews]=useState(false),[reviewOpen,setReviewOpen]=useState(false),[workshop,setWorkshop]=useState<Workshop|null>(null),[existing,setExisting]=useState<Visit|null>(null);
 function openReview(w:Workshop|null=null,visit:Visit|null=null){setWorkshop(w);setExisting(visit);setReviewOpen(true);}
 function clearPrivateQuery(){const url=new URL(window.location.href);url.searchParams.delete("besuche");url.searchParams.delete("nachweis");window.history.replaceState(null,"",url);}
 useEffect(()=>{if(!observePrivateQuery)return;const sync=()=>{const query=new URLSearchParams(window.location.search);if(query.get("besuche"))setMyReviews(true);if(query.get("nachweis")){setWorkshop(directory.find(w=>w.id===query.get("nachweis"))??null);setExisting(null);setReviewOpen(true);}};sync();window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);},[directory,observePrivateQuery]);
 return {onVisits:()=>setMyReviews(true),onNewVisit:()=>openReview(),dialogs:<><VisitForm open={reviewOpen} onClose={()=>{clearPrivateQuery();setReviewOpen(false);onRefresh();}} onDone={()=>setMyReviews(true)} workshop={workshop} directory={directory} signedIn={signedIn} account={account} existing={existing}/><MyVisits open={myReviews} onClose={()=>{clearPrivateQuery();setMyReviews(false);onRefresh();}} directory={directory} signedIn={signedIn} account={account} onResubmit={visit=>{clearPrivateQuery();setMyReviews(false);openReview(directory.find(w=>w.id===visit.workshop)??null,visit);}}/></>};
}
