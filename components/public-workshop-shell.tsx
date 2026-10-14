"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import type { Workshop } from "@/lib/workshops";
import type { WorkshopDisplayById } from "@/lib/workshop-profile-content";
import WorkshopProfile from "@/app/[locale]/workshop/[id]/profile";
import { SiteHeader } from "./site-header";
export default function PublicWorkshopShell({ id }: { id: string }) {
  const { locale, t } = useI18n();
  const [data, setData] = useState<{
      workshop: Workshop;
      directory: Workshop[];
      displayById: WorkshopDisplayById;
    } | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch(`/api/workshops?locale=${locale}`, { cache: "no-store" })
      .then(async (response) => {
        const value = (await response.json()) as {
          workshops?: Workshop[];
          displayById?: WorkshopDisplayById;
        };
        if (!response.ok || !Array.isArray(value.workshops))
          throw Error("Directory unavailable");
        const workshop = value.workshops.find(
          (w) => w.id === id && w.status === "published",
        );
        if (!workshop) throw Error("Profile unavailable");
        if (active)
          setData({
            workshop,
            directory: value.workshops,
            displayById: value.displayById ?? {},
          });
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [id, locale]);
  if (data)
    return (
      <WorkshopProfile
        publicSnapshot
        workshop={data.workshop}
        directory={data.directory}
        display={data.displayById[id]}
        reviews={[]}
        reviewError=""
        signedIn={false}
        account={null}
        isAdmin={false}
      />
    );
  return (
    <>
      <SiteHeader account={null} publicSnapshot />
      <main className="workshop-page wrap" data-public-profile-id={id}>
        <h1>
          {error ? t("common.profileNotAvailable") : t("common.loadingProfile")}
        </h1>
        {error ? (
          <button className="primary" onClick={() => window.location.reload()}>
            {t("common.retry")}
          </button>
        ) : (
          <p role="status">{t("public.loading")}</p>
        )}
      </main>
    </>
  );
}
