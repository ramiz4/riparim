import type {SearchContext} from "@/app/journeys";

export type SearchSession={service:string;city:string;language:string;sort:string;searched:boolean;context:SearchContext|null};
// Browser memory only: a client-side route change can retain search context.
// A reload clears it; private vehicle/problem data never enters URLs or storage.
let current:SearchSession|null=null;
export function readSearchSession(){return typeof window==="undefined"?null:current;}
export function rememberSearchSession(value:SearchSession){if(typeof window!=="undefined")current=value;}
