import {WorkshopProfileLink} from "@/components/workshop-profile-link";
import {MapPin,Phone} from "lucide-react";
import {WorkshopRatings} from "@/components/workshop-ratings";
import {contactHref,type Workshop} from "@/lib/workshops";

export function WorkshopCard({workshop:w,selectedBrand="Alle Marken",searchHref}:{workshop:Workshop;selectedBrand?:string;searchHref?:string}){
 const profileHref=`/werkstatt/${encodeURIComponent(w.id)}${searchHref?`?${new URLSearchParams({suche:searchHref})}`:""}`;
 const details=w.serviceDetails.filter(detail=>detail.length<=110).slice(0,2);
 const shownBrands=[...w.brands].sort((a,b)=>Number(b===selectedBrand)-Number(a===selectedBrand)).slice(0,2);
 return <article className="catalogue-card"><div className="catalogue-card-heading"><div><h2><WorkshopProfileLink href={profileHref}>{w.name}</WorkshopProfileLink></h2><p className="catalogue-card-place"><MapPin size={15} aria-hidden="true"/>{w.city}</p>{w.address&&<p className="catalogue-card-address">{w.address}</p>}</div></div>
  {details.length>0&&<div className="catalogue-card-services">{details.map(detail=><p key={detail}>{detail}</p>)}</div>}{shownBrands.length>0&&<div className="catalogue-card-brands">{shownBrands.map(brand=><span key={brand}>{brand}</span>)}</div>}
  <WorkshopRatings workshop={w} hideUnavailable/>
  <div className="catalogue-card-actions"><WorkshopProfileLink className="primary" href={profileHref}>Profil ansehen</WorkshopProfileLink>{w.phone&&<a className="catalogue-card-phone" href={contactHref(w,"phone")??undefined} aria-label={`Anrufen: ${w.name}. ${w.phoneNote||"Veröffentlichter Kontakt"}`} title={w.phoneNote}><Phone size={16} aria-hidden="true"/>Anrufen</a>}</div>
 </article>;
}
