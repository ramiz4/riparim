"use client";
import { cn } from "@/lib/utils";
import { pageFrameClassName, contentTitleClassName } from "@/lib/presentation";
import { DeferredStatus } from "./deferred-status";
import { useEffect, useState } from "react";
import { usePageQuery } from "./use-page-query";
import { useI18n } from "@/lib/i18n/client";
import { MyVisits } from "@/app/journeys";
import { SiteHeader } from "./site-header";
import { DirectoryFooter } from "./directory-footer";
import { useDeferredSession } from "./use-deferred-session";
import { reviewSubmissionId } from "@/lib/own-reviews";
import type { Workshop } from "@/lib/workshops";

export function DeferredReviews() {
  const { t } = useI18n(),
    query = usePageQuery();
  const { session, error, pending, retry } = useDeferredSession();
  const [directory, setDirectory] = useState<Workshop[]>([]),
    [directoryUnavailable, setDirectoryUnavailable] = useState(false);
  useEffect(() => {
    if (!session?.account) return;
    let active = true;
    void fetch("/api/workshops", { cache: "no-store" })
      .then(async (response) => {
        const value = (await response.json()) as { workshops?: Workshop[] };
        if (!response.ok || !Array.isArray(value.workshops))
          throw Error("Directory unavailable");
        if (active)
          setDirectory(
            value.workshops.filter(
              (workshop) => workshop.status === "published",
            ),
          );
      })
      .catch(() => {
        if (active) setDirectoryUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, [session]);
  const submissionId =
    query.getAll("einreichung").length === 1
      ? reviewSubmissionId(query.get("einreichung"))
      : null;
  return (
    <>
      <SiteHeader
        account={session?.account ?? null}
        isAdmin={session?.isAdmin ?? false}
        publicSnapshot={!session}
      />
      {session ? (
        <MyVisits
          key={`${session.account?.email ?? "guest"}:${submissionId ?? "all"}`}
          directory={directory}
          directoryUnavailable={directoryUnavailable}
          signedIn={!!session.account}
          account={session.account}
          submissionId={submissionId}
        />
      ) : (
        <main
          className={cn(
            pageFrameClassName,
            "min-h-[calc(100svh_-_180px)] pt-[var(--content-page-padding-top)] pb-[var(--content-page-padding-bottom)] [overflow-wrap:anywhere]",
          )}
        >
          <h1 className={contentTitleClassName}>{t("customer.myReviews")}</h1>
          <DeferredStatus
            error={error}
            pending={pending}
            retry={retry}
            loadingText={t("customer.myReviewsLoading")}
          />
        </main>
      )}
      <DirectoryFooter />
    </>
  );
}
