import {WorkshopProfileLink} from "@/components/workshop-profile-link";
import {MapPin} from "lucide-react";
import {WorkshopRatings} from "@/components/workshop-ratings";
import type {Workshop} from "@/lib/workshops";
import type {LiveGoogleRating} from "@/lib/google-maps-browser";

const serviceLabels:Record<string,string>={"Inspektion & Wartung":"Wartung","Diagnose & Elektronik":"Diagnose & Elektronik","Bremsen & Fahrwerk":"Bremsen & Fahrwerk","Motor & Getriebe":"Motor & Getriebe","Karosserie & Lack":"Karosserie & Lack","Reifen & Klima":"Reifen & Klima"};

export function WorkshopCard({workshop:w,selectedBrand="Alle Marken",selectedService="Alle Leistungen",searchHref,distanceKm,distanceOrigin,liveGoogleRating,onGoogleRating}:{workshop:Workshop;selectedBrand?:string;selectedService?:string;searchHref?:string;distanceKm?:number|null;distanceOrigin?:string;liveGoogleRating?:LiveGoogleRating;onGoogleRating?:(id:string,rating:LiveGoogleRating)=>void}){
 const profileHref=`/werkstatt/${encodeURIComponent(w.id)}${searchHref?`?${new URLSearchParams({suche:searchHref})}`:""}`;
 const details=w.services.length?[...w.services].sort((a,b)=>Number(b===selectedService)-Number(a===selectedService)).slice(0,3):w.serviceDetails.filter(detail=>detail.length<=50).slice(0,3);
 const shownBrands=[...w.brands].sort((a,b)=>Number(b===selectedBrand)-Number(a===selectedBrand)).slice(0,2);
 return <article className="catalogue-card"><div className="catalogue-card-link">
  <div className="catalogue-card-heading"><h2><WorkshopProfileLink className="catalogue-card-target" href={profileHref} aria-label={`Profil von ${w.name} ansehen`}>{w.name}</WorkshopProfileLink></h2><p className="catalogue-card-place"><MapPin size={16} aria-hidden="true"/>{w.city}{distanceKm!=null&&<span className="catalogue-card-distance" title={`Luftlinie zum Ortszentrum von ${distanceOrigin}`}>· ca. {distanceKm.toLocaleString("de-DE")} km</span>}</p></div>
  <WorkshopRatings workshop={w} hideUnavailable linkGoogle={false} liveGoogleRating={liveGoogleRating} onGoogleRating={onGoogleRating}/>
  {details.length>0&&<div className="catalogue-card-services">{details.map(detail=><span className={detail===selectedService?"selected-service":undefined} key={detail}>{serviceLabels[detail]??detail}</span>)}</div>}{shownBrands.length>0&&<div className="catalogue-card-brands">{shownBrands.map(brand=><span key={brand}>{brand}</span>)}</div>}
 </div></article>;
}
