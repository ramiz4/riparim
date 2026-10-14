"use client";
import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { useI18n } from "@/lib/i18n/client";
import { isPagePath, localizeHref } from "@/lib/i18n/locale";

// Route app pages in the current document; APIs, downloads and explicit recovery
// links retain the browser's document navigation.
export function LocaleAnchor({
  href,
  reloadDocument = false,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { reloadDocument?: boolean }) {
  const { locale } = useI18n(),
    localizedHref = href ? localizeHref(href, locale) : href;
  const pageLink =
    localizedHref?.startsWith("/") &&
    !localizedHref.startsWith("//") &&
    isPagePath(new URL(localizedHref, "https://riparim.invalid").pathname);
  if (
    pageLink &&
    !reloadDocument &&
    props.download === undefined &&
    (!props.target || props.target === "_self")
  )
    return <Link {...props} href={localizedHref!} />;
  return <a {...props} href={localizedHref} />;
}
