import {env} from "cloudflare:workers";
// Only the isolated build renderer sets this binding. Production has no override.
export function publicReleaseRender(){return ["true","shell"].includes(String(Reflect.get(env,"PUBLIC_RELEASE_RENDER")));}

export function publicReleaseShell(){return Reflect.get(env,"PUBLIC_RELEASE_RENDER")==="shell";}
