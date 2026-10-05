import removals from "@/data/workshop-removals.json";

const removedIds=new Set(removals.workshopIds);

export function workshopRetired(id:string):boolean{return removedIds.has(id);}
export function retiredWorkshopIds():string[]{return [...removedIds];}
export const workshopRetirementDate=removals.removedAt;
