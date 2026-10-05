import type {Translator,MessageKey} from "@/lib/i18n/messages";
export type ReviewDecision="published"|"needs_more";
export type NotificationState="pending"|"sending"|"sent"|"blocked"|"failed"|"unknown"|"suppressed";
export type NotificationRow={
 id:string;visit_id:string;owner:string;revision:number;decision:ReviewDecision;operation_token:string;
 state:NotificationState;attempts:number;next_attempt_at:number;created_at:string;lease_until:number|null;lease_token:string|null;
 first_attempt_at:number|null;payload:string|null;provider_key_hash:string|null;provider_id:string|null;last_error:string|null;
};
export type NotificationView={id:string;visitId:string;workshopName:string;decision:ReviewDecision;state:NotificationState;attempts:number;nextAttemptAt:number;createdAt:string;error:string|null;retryable:boolean};
const stateKeys={pending:"management.notification_pending",sending:"management.notification_sending",sent:"management.notification_sent",blocked:"management.notification_blocked",failed:"management.notification_failed",unknown:"management.notification_unknown",suppressed:"management.notification_suppressed"} as const satisfies Record<NotificationState,MessageKey>;
const errorKeys={configuration_missing:"management.notification_configuration_missing",auth_configuration_missing:"management.notification_auth_configuration_missing",no_verified_contact:"management.notification_no_verified_contact",account_blocked:"management.notification_account_blocked",superseded:"management.notification_superseded",recipient_changed:"management.notification_recipient_changed",credential_changed:"management.notification_credential_changed",provider_unavailable:"management.notification_provider_unavailable",rate_limited:"management.notification_rate_limited",provider_rejected:"management.notification_provider_rejected",retry_limit:"management.notification_retry_limit",idempotency_window_expired:"management.notification_idempotency_window_expired",invalid_payload:"management.notification_invalid_payload"} as const satisfies Record<string,MessageKey>;
export function notificationStateLabel(t:Translator,value:unknown){return t(typeof value==="string"&&Object.hasOwn(stateKeys,value)?stateKeys[value as NotificationState]:"management.notificationNeedsReview");}
export function notificationErrorLabel(t:Translator,value:unknown){return t(typeof value==="string"&&Object.hasOwn(errorKeys,value)?errorKeys[value as keyof typeof errorKeys]:"management.notificationNeedsReview");}
