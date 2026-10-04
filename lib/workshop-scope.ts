import scope from "@/data/workshop-scope.json";

export function workshopScopeExclusion(workshop:{id:string;name:string}):string|null{
 const reviewed=scope.excluded.find(entry=>entry.workshopId===workshop.id);
 if(reviewed)return reviewed.reason;
 if(/\b(trucks?|truckbus|buses|scania|tacho(?:graf|graph)?|tahograf|kamion\w*|lkw)\b/i.test(workshop.name))return "Lkw-, Bus- oder Tachografbetrieb: kein bestätigter Pkw-Werkstatteintrag.";
 return null;
}
