import type {Workshop} from "./workshops";

function mapsLink(value:string|null|undefined){
 try{const url=new URL(value??"");if(url.protocol!=="https:"||url.username||url.password||!["www.google.com","google.com","maps.google.com","maps.app.goo.gl","g.page"].includes(url.hostname))return null;return url;}catch{return null;}
}
export function googlePlaceIdFromMapsUrl(value:string|null|undefined):string|null{
 const url=mapsLink(value);if(!url)return null;
 let path:string;try{path=decodeURIComponent(url.pathname);}catch{return null;}
 const id=url.searchParams.get("query_place_id")??url.searchParams.get("place_id")??url.searchParams.get("q")?.match(/^place_id:([A-Za-z0-9_-]+)$/)?.[1]??path.match(/!1s(ChIJ[A-Za-z0-9_-]+)/)?.[1];
 return id&&/^[A-Za-z0-9_-]{10,255}$/.test(id)?id:null;
}
export function googleMapsCid(value:string|null|undefined):string|null{
 const url=mapsLink(value);if(!url)return null;const cid=url.searchParams.get("cid")??url.searchParams.get("ludocid");return cid&&/^\d{1,20}$/.test(cid)?cid:null;
}
export function googleMapsSearchQuery(value:string|null|undefined):string|null{
 const url=mapsLink(value);if(!url||googlePlaceIdFromMapsUrl(value))return null;
 const query=url.searchParams.get("query")??url.searchParams.get("q");return query&&query.length<=500?query:null;
}
export function googleMapsPlaceUrl(placeId:string,query:string){return `https://www.google.com/maps/search/?${new URLSearchParams({api:"1",query,query_place_id:placeId})}`;}
export function workshopMapsUrl(workshop:Pick<Workshop,"name"|"address"|"googleRating">,placeId?:string|null){
 const source=workshop.googleRating?.mapsUrl,id=placeId??googlePlaceIdFromMapsUrl(source);
 return id?googleMapsPlaceUrl(id,`${workshop.name} ${workshop.address}`):mapsLink(source)?.href??`https://www.google.com/maps/search/?${new URLSearchParams({api:"1",query:`${workshop.name} ${workshop.address} Kosovo`})}`;
}
