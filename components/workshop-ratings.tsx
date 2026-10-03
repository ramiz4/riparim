import {MessageCircle,ShieldCheck,Star} from "lucide-react";
import type {Workshop} from "@/lib/workshops";

const decimal=(value:number)=>value.toLocaleString("de-DE",{minimumFractionDigits:1,maximumFractionDigits:1});
const date=(value:string)=>new Date(value.length===10?value+"T12:00:00":value).toLocaleDateString("de-DE");

export function WorkshopRatings({workshop:w,details=false}:{workshop:Workshop;details?:boolean}){
 const google=w.googleRating;
 const mapsUrl=google?.mapsUrl??`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${w.name} ${w.address} Kosovo`)}`;
 const riparimRated=w.rating!==null&&w.count>0;
 return <div className={`workshop-ratings${details?" workshop-ratings-detailed":""}`} aria-label="Bewertungen nach Quelle">
  <div className="workshop-rating-row riparim-rating"><span className="rating-provider"><ShieldCheck size={15} aria-hidden="true"/>Riparim</span>{riparimRated?<span className="rating-value"><Star size={14} fill="currentColor" aria-hidden="true"/><strong>{decimal(w.rating!)}</strong><span>({w.count})</span></span>:<span className="rating-unavailable"><MessageCircle size={14} aria-hidden="true"/>Noch keine Bewertungen</span>}</div>
  <div className="workshop-rating-row google-rating"><a className="rating-provider" href={mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Google Maps: ${w.name}`}>Google</a>{google?.rating!==null&&google?.rating!==undefined?<span className="rating-value"><Star size={14} fill="currentColor" aria-hidden="true"/><strong>{decimal(google.rating)}</strong>{google.count!==null&&<span>({google.count})</span>}</span>:<span className="rating-unavailable">Nicht verifiziert{google?.count!==null&&google?.count!==undefined?` · ${google.count} Bewertungen`:""}</span>}</div>
  {details&&<><p className="rating-explanation">Riparim: freigegebene Bewertungen mit geprüftem Besuchsnachweis. Google: separat erfasste öffentliche Angaben.</p>{google?.sourceUrl&&<p className="rating-source"><a href={google.sourceUrl} target="_blank" rel="noopener noreferrer">{google.sourceLabel??"Quelle der Google-Angaben"}</a>{google.sourceUpdatedAt?` · Quellenstand ${date(google.sourceUpdatedAt)}`:""} · Abgerufen {date(google.checkedAt)}{google.rating!==null&&google.count===null?" · Anzahl nicht veröffentlicht":""}</p>}{(!google||google.rating===null)&&<p className="rating-explanation">Der Google-Sternewert konnte nicht zuverlässig belegt werden. Aktuelle Angaben direkt auf Google Maps prüfen.</p>}</>}
 </div>;
}
