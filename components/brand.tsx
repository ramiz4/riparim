"use client";
import {useI18n} from "@/lib/i18n/client";
import {LocaleAnchor} from "@/components/locale-anchor";
import styles from "./brand.module.css";
// Home remains reachable even if a client-side route transition stalls.
export function Brand(){const {t}=useI18n();return <LocaleAnchor className="brand" href="/" aria-label={t("common.homeLabel")}><img className={styles.logo} src="/riparim-logo-display.png" width={512} height={195} alt="riparim"/></LocaleAnchor>;}
