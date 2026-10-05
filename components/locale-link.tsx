"use client";
import Link from "next/link";
import type {ComponentProps} from "react";
import {useI18n} from "@/lib/i18n/client";
import {localizeHref} from "@/lib/i18n/locale";
export default function LocaleLink({href,...props}:ComponentProps<typeof Link>){const {locale}=useI18n();return <Link {...props} href={typeof href==="string"?localizeHref(href,locale):href}/>;}
