import type {MessageKey,Translator} from "./messages";

const errorKeys={
 authentication_required:"common.authenticationRequired",forbidden:"common.forbidden",invalid_request:"common.invalidRequest",
 not_found:"common.notFound",conflict:"common.conflict",unavailable:"common.unavailable",unknown:"common.errorGeneric"
} as const satisfies Record<string,MessageKey>;
const messageKeys={saved:"common.saved",preference_not_saved:"common.preferenceNotSaved",completed:"common.messageGeneric"} as const satisfies Record<string,MessageKey>;
export type ErrorCode=keyof typeof errorKeys;
export type MessageCode=keyof typeof messageKeys;
// API migrations add codes while retaining legacy text fields and HTTP status.
export type CodedResponse={errorCode?:ErrorCode;messageCode?:MessageCode;error?:string;message?:string};
export const localeNoticeCode="preference_not_saved" satisfies MessageCode;

export function isErrorCode(value:unknown):value is ErrorCode{return typeof value==="string"&&Object.hasOwn(errorKeys,value);}
export function isMessageCode(value:unknown):value is MessageCode{return typeof value==="string"&&Object.hasOwn(messageKeys,value);}
export function errorCodeMessage(t:Translator,code:unknown):string{
 return t(isErrorCode(code)?errorKeys[code]:"common.errorGeneric");
}
export function messageCodeMessage(t:Translator,code:unknown):string{
 return t(isMessageCode(code)?messageKeys[code]:"common.messageGeneric");
}
