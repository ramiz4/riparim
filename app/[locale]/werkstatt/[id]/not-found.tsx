"use client";
import {useI18n} from "@/lib/i18n/client";
import Link from "@/components/locale-link";
export default function WorkshopNotFound(){const {t}=useI18n();return <main className="access-page"><h1>{t("common.profileNotAvailable")}</h1><p>{t("common.profileNotAvailableHelp")}</p><Link className="primary" href="/">{t("common.findWorkshops")}</Link></main>;}
