export function json(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});}
export function sameOrigin(r:Request){const origin=r.headers.get("origin");return (!origin||origin===new URL(r.url).origin)&&r.headers.get("sec-fetch-site")!=="cross-site";}
export async function readJson(request:Request){const body=await request.json();if(!body||typeof body!=="object"||Array.isArray(body))throw new Error("INVALID_INPUT");return body as Record<string,unknown>;}
export function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
