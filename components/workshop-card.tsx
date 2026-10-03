import Link from "next/link";
import {FileCheck2,MapPin,Phone,Wrench} from "lucide-react";
import {contactHref,type Workshop} from "@/lib/workshops";
import {WorkshopRatings} from "@/components/workshop-ratings";

export function WorkshopCard({workshop:w,selectedBrand="Alle Marken"}:{workshop:Workshop;selectedBrand?:string}){
 const details=w.serviceDetails.filter(detail=>detail.length<=110).slice(0,2);
 const shownBrands=[...w.brands].sort((a,b)=>Number(b===selectedBrand)-Number(a===selectedBrand)).slice(0,2);
 const directoryOnly=w.sources.length>0&&w.sources.every(source=>source.kind==="directory"),officialOnly=w.sources.length>0&&w.sources.every(source=>source.kind==="official");
 return <article className="catalogue-card"><div className="catalogue-card-heading"><span className="catalogue-monogram" aria-hidden="true">{w.initials}<Wrench size={14}/></span><div><h2><Link href={`/werkstatt/${encodeURIComponent(w.id)}`}>{w.name}</Link></h2><p className="catalogue-card-place"><MapPin size={15} aria-hidden="true"/>{w.city}</p></div></div><p className="catalogue-card-address">{w.address}</p>
  <div className="catalogue-card-services">{details.length?details.map(detail=><p key={detail}>{detail}</p>):<p>Leistungen im Profil</p>}</div><div className="catalogue-card-brands">{shownBrands.length?shownBrands.map(brand=><span key={brand}>{brand}</span>):<p>Marken nicht veröffentlicht</p>}</div>
  <WorkshopRatings workshop={w}/>
  <p className="catalogue-card-source"><FileCheck2 size={14} aria-hidden="true"/>{directoryOnly?"Verzeichnisangaben":officialOnly?"Betriebsquelle im Profil":"Quellen im Profil"}</p><div className="catalogue-card-actions"><Link className="primary" href={`/werkstatt/${encodeURIComponent(w.id)}`}>Profil ansehen</Link>{w.phone&&<a className="catalogue-card-phone" href={contactHref(w,"phone")??undefined} aria-label={`Anrufen: ${w.name}. ${w.phoneNote||"Veröffentlichter Kontakt"}`} title={w.phoneNote}><Phone size={16} aria-hidden="true"/>Anrufen</a>}</div>
 </article>;
}
