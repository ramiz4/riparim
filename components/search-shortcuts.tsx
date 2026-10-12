"use client";
import {MapPin,Wrench,ArrowRight} from "lucide-react";
import {useI18n} from "@/lib/i18n/client";
import {valueLabel} from "@/lib/i18n/values";
import {catalogueHref,defaultCatalogueFilters} from "@/lib/catalogue-filters";
import {cities,services} from "@/lib/workshops";
import {WorkshopNavigationLink} from "./workshop-navigation-link";

export function SearchShortcuts(){
 const {locale,t}=useI18n();
 return <section className="shortcuts-section wrap" aria-labelledby="shortcuts-title"><h2 id="shortcuts-title">{t("public.shortcutsTitle")}</h2><div className="shortcuts-groups">
  <nav className="shortcuts-group" aria-labelledby="shortcuts-city-title"><h3 id="shortcuts-city-title"><MapPin size={20} aria-hidden="true"/>{t("public.shortcutsCities")}</h3><ul>{cities.slice(1,7).map(city=><li key={city}><WorkshopNavigationLink href={catalogueHref({...defaultCatalogueFilters,city},locale)}>{city}<ArrowRight size={16} aria-hidden="true"/></WorkshopNavigationLink></li>)}</ul></nav>
  <nav className="shortcuts-group" aria-labelledby="shortcuts-service-title"><h3 id="shortcuts-service-title"><Wrench size={20} aria-hidden="true"/>{t("public.shortcutsServices")}</h3><ul>{services.slice(1).map(service=><li key={service}><WorkshopNavigationLink href={catalogueHref({...defaultCatalogueFilters,service},locale)}>{valueLabel(locale,"service",service)}<ArrowRight size={16} aria-hidden="true"/></WorkshopNavigationLink></li>)}</ul></nav>
 </div></section>;
}
