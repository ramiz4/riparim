import type {Translator} from "./messages";
import {errorCodeMessage} from "./codes";
const unavailableKeys={directory:"public.directoryUnavailable",reviews:"public.reviewUnavailable",refresh:"public.refreshFailed"} as const;
// Preserve one stable API code contract; only the unavailable source context varies.
export function publicDataError(t:Translator,code:unknown,context:keyof typeof unavailableKeys):string{return code==="unavailable"?t(unavailableKeys[context]):errorCodeMessage(t,code);}
