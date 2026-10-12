import {env} from '@/lib/runtime/env';

function httpsOrigin(value:string){
 try{
  const url=new URL(value);
  if(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/')return url.origin;
 }catch{}
 return null;
}
export function hostedAuthOrigin(origin:string){const url=new URL(origin);return /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)&&!url.port;}
export function trustedAuthOrigin(value:string){
 const origin=httpsOrigin(value);
 if(!origin||!hostedAuthOrigin(origin)&&origin!==httpsOrigin(env.AUTH_TRUSTED_ORIGIN??''))throw Error('UNTRUSTED_AUTH_ORIGIN');
 return origin;
}
export function authSecretMatchesOrigin(origin:string){
 // Existing hosted configurations remain usable. Custom hosts require a separate,
 // explicit credential binding; approving a public endpoint never approves secrets.
 const binding=env.SUPABASE_SECRET_KEY_ORIGIN;
 return binding?httpsOrigin(binding)===origin:hostedAuthOrigin(origin);
}

// No credentials or tokens may follow redirects, even from an approved host.
export function providerFetch(origin:string,timeout=8000):typeof fetch{
 return async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  if(url.origin!==origin||!url.pathname.startsWith('/auth/v1/'))throw Error('UNTRUSTED_AUTH_REQUEST');
  // Workers reject redirect:'error' before sending a request. Manual mode is
  // portable and lets us reject redirects without forwarding any credentials.
  const response=await fetch(input,{...init,redirect:'manual',signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout)});
  if(response.status>=300&&response.status<400){await response.body?.cancel();throw Error('AUTH_PROVIDER_REDIRECT');}
  return response;
 };
}
