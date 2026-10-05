import type {Locale} from "./i18n/locale";
import {services} from "./workshops";
// Problem text remains private RAM data. Only German has the existing keyword hint.
export function searchService(locale:Locale,selected:string,problem:string):string{
 if(locale!=="de"||selected!==services[0])return selected;
 const p=problem.toLowerCase();
 if(/brems|fahrwerk|feder|stoßdämpf/.test(p))return services[3];
 if(/motor|getriebe|kupplung/.test(p))return services[4];
 if(/lack|karosserie|delle/.test(p))return services[5];
 if(/reifen|klima/.test(p))return services[6];
 if(/wartung|öl|inspektion/.test(p))return services[1];
 if(/fehler|elektr|diagnos|leuchte/.test(p))return services[2];
 return selected;
}
