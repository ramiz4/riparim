import {I18nMessages} from "./i18n/client";
import {getMessages} from "./i18n/messages";
import type {Locale} from "./i18n/locale";
import {DeferredManagement,type DeferredManagementKind} from "@/components/deferred-management";

export function deferredManagementPage(kind:DeferredManagementKind,locale:Locale){return <I18nMessages messages={getMessages(locale,['management','customer','public'])}><DeferredManagement kind={kind}/></I18nMessages>;}
