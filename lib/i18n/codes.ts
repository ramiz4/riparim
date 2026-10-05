import type {MessageKey,Translator} from "./messages";

const errorKeys={
 auth_project_url:"common.invalidRequest",auth_public_key:"common.invalidRequest",auth_provider_connection:"common.unavailable",auth_email_confirmation:"common.invalidRequest",auth_provider_required:"common.invalidRequest",
 invalid_locale:"customer.invalidLocale",
 auth_unavailable:"customer.authUnavailable",
 email_unavailable:"customer.emailUnavailable",
 google_unavailable:"customer.googleUnavailable",
 rate_limited:"customer.rateLimited",
 deletion_protected:"customer.deletionProtected",
 recovery_required:"customer.recoveryRequired",
 invalid_email:"customer.invalidEmail",
 invalid_password:"customer.invalidPassword",
 invalid_name:"customer.invalidName",
 login_failed:"customer.loginFailed",
 account_blocked:"customer.accountBlocked",
 registration_failed:"customer.registrationFailed",
 confirmation_unavailable:"customer.confirmationUnavailable",
 recovery_failed:"customer.recoveryFailed",
 password_update_failed:"customer.passwordUpdateFailed",
 account_unavailable:"customer.accountUnavailable",
 invalid_account_patch:"customer.invalidAccountPatch",
 current_password_required:"customer.currentPasswordRequired",
 password_proof_failed:"customer.passwordProofFailed",
 deletion_confirmation_required:"customer.deletionConfirmationRequired",
 reauthentication_required:"customer.reauthRequired",
 deletion_incomplete:"customer.deletionIncomplete",
 review_unavailable:"customer.reviewUnavailable",
 invalid_review:"customer.invalidReview",
 consent_required:"customer.consentRequired",
 invalid_visit:"customer.invalidVisit",
 file_too_large:"customer.fileTooLarge",
 invalid_file:"customer.invalidFile",
 evidence_required:"customer.evidenceRequired",
 evidence_missing:"customer.evidenceMissing",
 review_conflict:"customer.reviewConflict",
 reviews_unavailable:"customer.reviewsUnavailable",
 account_status_invalid:"common.invalidRequest",
 account_role_invalid:"common.invalidRequest",
 account_fields_separate:"common.invalidRequest",
 evidence_not_found:"customer.downloadNotFound",
 evidence_no_document:"customer.downloadNoDocument",
 evidence_unavailable:"customer.downloadUnavailable",

 authentication_required:"common.authenticationRequired",forbidden:"common.forbidden",invalid_request:"common.invalidRequest",
 not_found:"common.notFound",conflict:"common.conflict",unavailable:"common.unavailable",unknown:"common.errorGeneric"
} as const satisfies Record<string,MessageKey>;
const messageKeys={confirm_email:"customer.confirmEmailMessage",recovery_sent:"customer.recoveryMessage",password_changed:"customer.passwordChangedMessage",saved:"common.saved",preference_not_saved:"common.preferenceNotSaved",completed:"common.messageGeneric"} as const satisfies Record<string,MessageKey>;
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

export class LocalizedError extends Error{}
export function responseError(t:Translator,data:CodedResponse){return new LocalizedError(errorCodeMessage(t,data.errorCode));}
