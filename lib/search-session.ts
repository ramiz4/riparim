export type SearchSession={catalogueHref:string;visibleCount:number;scrollY:number};
// Retain catalogue paging and scroll during client navigation; reloads clear it.
let current:SearchSession|null=null;
export function readSearchSession(){return typeof window==="undefined"?null:current;}
export function rememberSearchSession(value:SearchSession){if(typeof window!=="undefined")current=value;}
