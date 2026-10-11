import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import type {AuthConfig} from './config';
import type {AuthClient,AuthAdminClient,AuthCookies} from './contract';
import {trustedAuthOrigin,authSecretMatchesOrigin,providerFetch,hostedAuthOrigin} from './origin';

export function createAuthClient(config:AuthConfig,cookies:AuthCookies,secure:boolean):AuthClient{
 const origin=trustedAuthOrigin(config.projectUrl);
 const client=createServerClient(origin,config.publicKey,{
  // Hosted cookie names remain compatible. Custom instances include the complete
  // origin: SDK defaults only use the first hostname label and collide on ports.
  cookieOptions:{...(!hostedAuthOrigin(origin)?{name:'riparim-auth-'+encodeURIComponent(origin)}:{}),httpOnly:true,secure,sameSite:'lax',path:'/'},cookies,
  global:{fetch:providerFetch(origin)}
 });
 return {auth:client.auth};
}
export function createPasswordClient(config:AuthConfig):AuthClient{
 const origin=trustedAuthOrigin(config.projectUrl);
 const client=createClient(origin,config.publicKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:providerFetch(origin)}
 });
 return {auth:client.auth};
}
export function createAuthAdminClient(projectUrl:string,key:string):AuthAdminClient{
 const origin=trustedAuthOrigin(projectUrl);
 if(!authSecretMatchesOrigin(origin))throw Error('AUTH_SECRET_ORIGIN_MISMATCH');
 const client=createClient(origin,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:providerFetch(origin)}
 });
 return {auth:{admin:client.auth.admin}};
}
