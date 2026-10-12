import type {AuthConfig} from './config';
import type {AuthClient,AuthAdminClient,AuthCookies} from './contract';
import {supabaseClient,supabaseAdmin,supabaseAvailability,validateSupabaseKey,validSupabaseSecret,normalizeSupabaseSubject} from './adapters/supabase';
import {pocketbaseClient,pocketbaseAdmin,pocketbaseAvailability} from './adapters/pocketbase';
import {trustedAuthOrigin,authSecretMatchesOrigin} from './origin';

export {validateSupabaseKey,validSupabaseSecret};
export function createAuthClient(config:AuthConfig,cookies:AuthCookies,secure:boolean):AuthClient{
 return config.provider==='pocketbase'?pocketbaseClient(config,cookies,secure):supabaseClient(config,cookies,secure);
}
export function createPasswordClient(config:AuthConfig):AuthClient{
 return config.provider==='pocketbase'?pocketbaseClient(config,null,true):supabaseClient(config,null,true);
}
export function createAuthAdminClient(config:Pick<AuthConfig,'provider'|'projectUrl'>,key:string):AuthAdminClient{
 const origin=trustedAuthOrigin(config.projectUrl,config.provider);
 if(!authSecretMatchesOrigin(origin,config.provider))throw Error('AUTH_SECRET_ORIGIN_MISMATCH');
 return config.provider==='pocketbase'?pocketbaseAdmin(origin,key):supabaseAdmin(origin,key);
}
export function authAvailability(config:Pick<AuthConfig,'provider'|'projectUrl'|'publicKey'>){return config.provider==='pocketbase'?pocketbaseAvailability(config):supabaseAvailability(config);}

export function normalizeAuthSubject(provider:string,id:string){return provider==='supabase'?normalizeSupabaseSubject(id):provider==='pocketbase'&&/^[a-z0-9]{15}$/.test(id)?id:null;}
