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
 return (input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  if(url.origin!==origin||!url.pathname.startsWith('/auth/v1/'))throw Error('UNTRUSTED_AUTH_REQUEST');
  return fetch(input,{...init,redirect:'error',signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout)});
 };
}
