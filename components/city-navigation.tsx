"use client";
import Link from "./locale-link";
import { useI18n } from "@/lib/i18n/client";
import { workshopCities } from "@/lib/workshop-cities";

export function CityNavigation({ current }: { current?: string }) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("public.exploreCities")}
      className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2"
    >
      <span className="w-full text-sm font-semibold">
        {t("public.exploreCities")}
      </span>
      {workshopCities.map((city) => (
        <Link
          key={city.slug}
          href={`/workshops/${city.slug}`}
          aria-current={current === city.slug ? "page" : undefined}
          className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {city.name}
        </Link>
      ))}
    </nav>
  );
}
