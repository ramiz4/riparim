import {getAuthConfig,providerAvailability} from "./auth/config";
import {json} from "./http";

export async function authOptionsResponse(){
 try{const config=await getAuthConfig();return json({...await providerAvailability(config),enabled:!!config?.enabled});}
 catch{console.error('auth-options-unavailable');return json({errorCode:'unavailable'},503);}
}
