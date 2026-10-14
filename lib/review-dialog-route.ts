export function reviewDialogRequested(href: string) {
  const url = new URL(href, "https://riparim.invalid");
  return url.searchParams.get("bewerten") === "1" || url.hash === "#bewerten";
}
export function reviewDialogHref(href: string, open: boolean) {
  const url = new URL(href, "https://riparim.invalid");
  if (open) url.searchParams.set("bewerten", "1");
  else url.searchParams.delete("bewerten");
  if (url.hash === "#bewerten") url.hash = "";
  return url.pathname + url.search + url.hash;
}
