import removals from "@/data/workshop-removals.json";
import finalRemovals from "@/data/workshop-final-removals.json";

const removedIds=new Set([...removals.workshopIds,...finalRemovals.workshopIds]);

export function workshopRetired(id:string):boolean{return removedIds.has(id);}
export function retiredWorkshopIds():string[]{return [...removedIds];}
export const workshopRetirementDate=finalRemovals.removedAt;
