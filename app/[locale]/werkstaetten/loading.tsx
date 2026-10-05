"use client";
import {useI18n} from "@/lib/i18n/client";
export default function CatalogueLoading(){const {t}=useI18n();return <main className="catalogue-page wrap"><h1 className="catalogue-loading-heading">{t("common.workshops")}</h1><p role="status">{t("common.loadingWorkshops")}</p><div className="catalogue-placeholder-grid" aria-hidden="true">{[1,2,3].map(value=><div className="catalogue-placeholder" key={value}/>)}</div></main>;}
