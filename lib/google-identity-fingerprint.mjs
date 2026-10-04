/**
 * @param {{name:string,phone:string,city:string,address:string,lat:number|null,lng:number|null,googleRating?:{mapsUrl:string}|null,google?:{snapshot?:{mapsUrl:string}|null}}} workshop
 * @param {boolean} legacy
 */
export function workshopIdentityInput(workshop, legacy = false) {
  const profile = [workshop.name, workshop.phone, workshop.city, workshop.address, workshop.lat, workshop.lng];
  const mapsUrl = workshop.googleRating?.mapsUrl ?? workshop.google?.snapshot?.mapsUrl ?? null;
  return JSON.stringify(legacy ? profile : ["maps-link-v6", ...profile, mapsUrl]);
}
