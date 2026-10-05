"use client";
import type {AnchorHTMLAttributes} from "react";
import {useI18n} from "@/lib/i18n/client";
import {localizeHref} from "@/lib/i18n/locale";
// Explicit document links retain browser navigation and existing escape paths.
export function LocaleAnchor({href,...props}:AnchorHTMLAttributes<HTMLAnchorElement>){const {locale}=useI18n();return <a {...props} href={href?localizeHref(href,locale):href}/>;}
