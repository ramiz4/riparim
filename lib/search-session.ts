import type {SearchContext} from "@/app/journeys";

export type SearchSession={service:string;city:string;brand:string;language:string;sort:"name"|"rating";searched:boolean;context:SearchContext|null;privateMatchingActive:boolean;catalogueHref:string;visibleCount:number;scrollY:number};
// Browser memory only: a client-side route change can retain search context.
// A reload clears it; private vehicle/problem data never enters URLs or storage.
let current:SearchSession|null=null;
export function readSearchSession(){return typeof window==="undefined"?null:current;}
export function rememberSearchSession(value:SearchSession){if(typeof window!=="undefined")current=value;}
export function deactivatePrivateMatching(){if(typeof window!=="undefined"&&current)current={...current,privateMatchingActive:false};}
