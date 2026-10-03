import {WorkshopProfileLink} from "@/components/workshop-profile-link";
import {MapPin} from "lucide-react";
import {WorkshopRatings} from "@/components/workshop-ratings";
import type {Workshop} from "@/lib/workshops";

export function WorkshopCard({workshop:w,selectedBrand="Alle Marken",searchHref}:{workshop:Workshop;selectedBrand?:string;searchHref?:string}){
 const profileHref=`/werkstatt/${encodeURIComponent(w.id)}${searchHref?`?${new URLSearchParams({suche:searchHref})}`:""}`;
 const publishedDetails=w.serviceDetails.filter(detail=>detail.length<=110).slice(0,2);
 const details=publishedDetails.length?publishedDetails:w.services.slice(0,2);
 const shownBrands=[...w.brands].sort((a,b)=>Number(b===selectedBrand)-Number(a===selectedBrand)).slice(0,2);
 return <article className="catalogue-card"><div className="catalogue-card-link">
  <div className="catalogue-card-heading"><h2><WorkshopProfileLink className="catalogue-card-target" href={profileHref} aria-label={`Profil von ${w.name} ansehen`}>{w.name}</WorkshopProfileLink></h2><p className="catalogue-card-place"><MapPin size={16} aria-hidden="true"/>{w.city}</p></div>
  <WorkshopRatings workshop={w} hideUnavailable linkGoogle={false}/>
  {details.length>0&&<div className="catalogue-card-services">{details.map(detail=><p key={detail}>{detail}</p>)}</div>}{shownBrands.length>0&&<div className="catalogue-card-brands">{shownBrands.map(brand=><span key={brand}>{brand}</span>)}</div>}
  {w.address&&<p className="catalogue-card-address">{w.address}</p>}
 </div></article>;
}
