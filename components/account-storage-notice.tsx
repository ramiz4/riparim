"use client";
import {useI18n} from "@/lib/i18n/client";
import {Cloud} from "lucide-react";
export type AccountIdentity={email:string;displayName:string;provider?:string};
export function AccountStorageNotice(){const {t}=useI18n();return <aside className="account-storage-notice storage-notice" aria-label={t("customer.privateStorage")}><Cloud size={18}/><p>{t("customer.storageNote")}</p></aside>;}
