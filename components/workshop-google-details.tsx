"use client";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/i18n/format";
import { LocaleAnchor } from "@/components/locale-anchor";
import { cn } from "@/lib/utils";
import { appButton, helpTextClassName } from "@/lib/presentation";
/* eslint-disable @next/next/no-img-element -- Google photos use fresh provider references; avoid an image optimizer persisting these resources. */
import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  MapPin,
} from "lucide-react";
import {
  googleOpeningPresentation,
  googlePhotoUrl,
  type GooglePhoto,
  type GoogleProfileStatus,
  type LiveGoogleProfile,
  type LiveGooglePhotos,
} from "@/lib/google-workshop-profile";
import { showConfirmedGoogleMap } from "@/lib/google-maps-browser";
import type { GoogleWorkshopIdentity } from "./use-google-workshop-profile";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

const galleryNavigationClassName =
  "absolute top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-[#ffffff42] bg-[rgba(20,38,30,0.52)] p-0 text-white [backdrop-filter:blur(12px)] [-webkit-backdrop-filter:blur(12px)] [box-shadow:0_4px_18px_#071c1a26] transition-colors duration-150 hover:bg-[rgba(20,38,30,0.8)] focus-visible:[outline:3px_solid_#d9f2e3] dark:focus-visible:outline-ring focus-visible:outline-offset-[3px] motion-reduce:transition-none at-most-720:size-11";

export function WorkshopOpeningHours({
  profile,
  status,
  mapsUrl,
}: {
  profile: LiveGoogleProfile | null;
  status: GoogleProfileStatus;
  mapsUrl: string;
}) {
  const { locale, t } = useI18n();
  const hours = googleOpeningPresentation(profile, status, new Date(), locale);
  const showToday = !!hours.today;
  return (
    <div
      className="mt-[18px] max-w-[580px] text-[14px] text-[#576e64] dark:text-muted-foreground at-most-720:mt-[15px]"
      data-ui="google-opening-hours"
    >
      <div className="flex items-start gap-2 leading-[1.5]" role="status">
        <Clock3 size={17} className="mt-[2px] shrink-0" />
        <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-[3px] at-most-720:gap-x-[10px]">
          <strong
            className={cn(
              "font-[650] text-[#385c4d] dark:text-[var(--theme-accent)] at-most-720:basis-full",
              hours.tone === "open" &&
                "text-[#176449] dark:text-[var(--theme-positive)]",
              hours.tone === "closed" &&
                "text-[#795c30] dark:text-[var(--theme-warning)]",
            )}
          >
            {t(hours.label)}
          </strong>
          {hours.detail && (
            <span>
              {t(hours.detail.message, {
                when: t(hours.detail.when),
                time: hours.detail.time,
              })}
            </span>
          )}
          {showToday && (
            <span className="basis-full">
              {t("public.todayHours", { hours: hours.today! })}
            </span>
          )}
        </div>
      </div>
      {hours.rows.length > 0 ? (
        <details className="group mt-[5px] max-w-[430px]">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-[7px] text-[#385f4f] focus-visible:rounded-[4px] focus-visible:[outline:3px_solid_#57a88b] dark:focus-visible:outline-ring focus-visible:outline-offset-[3px] dark:text-[#c0e1d7] [&::-webkit-details-marker]:hidden">
            {t("public.weekHours")}
            <ChevronDown size={15} className="group-open:rotate-180" />
          </summary>
          <ul className="mt-[5px] list-none rounded-[9px] border border-[#dce9e1] bg-[#f2f7f4] px-3 py-[10px] dark:border-border dark:bg-[var(--theme-surface)] dark:text-[#c0e1d7]">
            {hours.rows.map((row) => (
              <li
                key={row.day}
                className={cn(
                  "flex justify-between gap-[14px] py-[5px] leading-[1.55] [overflow-wrap:anywhere]",
                  row.today &&
                    "font-[650] text-[#245e46] dark:text-[var(--theme-accent)]",
                )}
              >
                <span>{row.day}</span>
                <span className="text-right">{row.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] leading-[1.5] text-[#687b72] dark:text-muted-foreground">
            {t("public.localTime")}
            <LocaleAnchor
              className="underline underline-offset-[3px]"
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              translate="no"
            >
              Google Maps
            </LocaleAnchor>
          </p>
          {profile?.rating.attributions.map((a, i) => (
            <p
              className="mt-2 text-[12px] leading-[1.5] text-[#687b72] dark:text-muted-foreground"
              key={i}
            >
              {a.providerURI ? (
                <LocaleAnchor
                  className="underline underline-offset-[3px]"
                  href={a.providerURI}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {a.provider}
                </LocaleAnchor>
              ) : (
                a.provider
              )}
            </p>
          ))}
        </details>
      ) : (
        status !== "loading" && (
          <LocaleAnchor
            className="inline-block min-h-9 pt-[7px] text-[13px] underline underline-offset-[3px]"
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("public.checkMaps")}
          </LocaleAnchor>
        )
      )}
    </div>
  );
}

function PhotoAttribution({
  photo,
  attributions,
  mapsUrl,
}: {
  photo: GooglePhoto;
  attributions: LiveGooglePhotos["attributions"];
  mapsUrl: string;
}) {
  return (
    <span className="text-[12px] leading-[1.6] [overflow-wrap:anywhere]">
      <LocaleAnchor
        className="underline underline-offset-2"
        href={photo.mapsUrl ?? mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        translate="no"
      >
        Google Maps
      </LocaleAnchor>
      {photo.authors.map((author, i) => (
        <span key={i}>
          {" · "}
          {author.url ? (
            <LocaleAnchor
              className="underline underline-offset-2"
              href={author.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {author.name}
            </LocaleAnchor>
          ) : (
            author.name
          )}
        </span>
      ))}
      {attributions.map((source, i) => (
        <span key={i}>
          {" · "}
          {source.providerURI ? (
            <LocaleAnchor
              className="underline underline-offset-2"
              href={source.providerURI}
              target="_blank"
              rel="noopener noreferrer"
            >
              {source.provider}
            </LocaleAnchor>
          ) : (
            source.provider
          )}
        </span>
      ))}
    </span>
  );
}

export function WorkshopPhotos({
  name,
  profile,
  identity,
  status,
}: {
  name: string;
  profile:
    | (Pick<LiveGoogleProfile, "photos"> & {
        attributions?: LiveGooglePhotos["attributions"];
      })
    | null;
  identity: GoogleWorkshopIdentity | null;
  status: GoogleProfileStatus;
}) {
  const { locale, t } = useI18n();
  const [failed, setFailed] = useState<string[]>([]),
    [largeFailed, setLargeFailed] = useState<string[]>([]);
  const [gallery, setGallery] = useState<{
      photos: GooglePhoto[];
      index: number;
    } | null>(null),
    [loaded, setLoaded] = useState<string[]>([]);
  const opener = useRef<HTMLButtonElement | null>(null),
    touch = useRef<{ x: number; y: number } | null>(null),
    galleryId = useId();
  const photos =
    profile?.photos.filter((photo) => !failed.includes(photo.resource)) ?? [];
  const selected = gallery?.photos[gallery.index];
  const mapsUrl = identity
    ? `https://www.google.com/maps/search/?api=1&query=Workshop&query_place_id=${encodeURIComponent(identity.placeId)}`
    : "";
  const attributions = profile?.attributions ?? [];
  function move(direction: number) {
    setGallery((current) =>
      current
        ? {
            ...current,
            index:
              (current.index + direction + current.photos.length) %
              current.photos.length,
          }
        : null,
    );
  }
  if (status === "loading" && !gallery)
    return (
      <div
        className="flex min-h-[58px] items-center gap-[9px] text-[14px] text-[#667d6f] dark:text-muted-foreground at-most-720:min-h-[46px]"
        data-ui="profile-photo-loading"
        aria-label={t("public.photosLoadingAria")}
        role="status"
      >
        <Camera size={20} />
        <span>{t("public.photosLoading")}</span>
      </div>
    );
  if (!identity) return null;
  if (!photos.length && !gallery)
    return profile?.photos.length ? (
      <p className={helpTextClassName} role="status">
        {t("public.photosFailed")}{" "}
        <LocaleAnchor href={mapsUrl} target="_blank" rel="noopener noreferrer">
          {t("public.checkMaps")}
        </LocaleAnchor>
      </p>
    ) : null;
  return (
    <section
      className="mt-[2px] [scroll-margin-top:100px]"
      data-ui="profile-photos"
      id="fotos"
      aria-label={t("public.photosAria", { name })}
    >
      <Dialog
        open={!!gallery}
        onOpenChange={(open) => {
          if (!open) setGallery(null);
        }}
      >
        <div className="grid grid-cols-3 gap-[14px] at-most-720:flex at-most-720:snap-x at-most-720:snap-proximity at-most-720:gap-[11px] at-most-720:overflow-x-auto at-most-720:pb-1">
          {photos.map((photo, i) => (
            <figure
              className="m-0 min-w-0 at-most-720:flex-[0_0_82%] at-most-720:snap-start"
              key={photo.resource}
            >
              <button
                type="button"
                className="block w-full cursor-zoom-in overflow-hidden rounded-[11px] bg-[#edf3ef] p-0 focus-visible:rounded-[4px] focus-visible:[outline:3px_solid_#57a88b] dark:focus-visible:outline-ring focus-visible:outline-offset-[3px] dark:bg-secondary"
                aria-label={t("public.enlargePhoto", { count: i + 1, name })}
                aria-haspopup="dialog"
                aria-controls={gallery ? galleryId : undefined}
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setLargeFailed([]);
                  setLoaded([]);
                  setGallery({ photos: [...photos], index: i });
                }}
              >
                <img
                  className="block h-[195px] w-full object-cover at-most-960:h-[170px] at-most-720:h-[185px]"
                  src={googlePhotoUrl(photo, identity.browserKey)}
                  alt={t("public.photoAlt", { count: i + 1, name })}
                  width={600}
                  height={380}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="strict-origin-when-cross-origin"
                  onError={() =>
                    setFailed((value) =>
                      value.includes(photo.resource)
                        ? value
                        : [...value, photo.resource],
                    )
                  }
                />
              </button>
              <figcaption className="px-[2px] py-[7px] text-muted-foreground">
                <PhotoAttribution
                  photo={photo}
                  attributions={attributions}
                  mapsUrl={mapsUrl}
                />
              </figcaption>
            </figure>
          ))}
        </div>
        <DialogContent
          id={galleryId}
          className="grid h-[min(900px,calc(100dvh_-_64px))] max-h-[calc(100dvh_-_64px)] w-[min(1200px,calc(100vw_-_64px))] max-w-[calc(100vw_-_64px)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-0 overflow-hidden rounded-[22px] border border-[rgba(255,255,255,0.3)] bg-[linear-gradient(135deg,rgba(38,63,51,0.64),rgba(23,43,34,0.4))] p-0 text-white [backdrop-filter:blur(28px)_saturate(140%)] [-webkit-backdrop-filter:blur(28px)_saturate(140%)] [box-shadow:0_30px_100px_#061a1640,inset_0_1px_0_#ffffff24] sm:max-w-[calc(100vw_-_64px)] at-most-720:h-[calc(100dvh_-_28px)] at-most-720:max-h-[calc(100dvh_-_28px)] at-most-720:w-[calc(100vw_-_20px)] at-most-720:max-w-[calc(100vw_-_20px)] at-most-720:rounded-[17px]"
          overlayClassName="bg-[rgba(12,27,22,0.36)] [backdrop-filter:blur(18px)_saturate(125%)] [-webkit-backdrop-filter:blur(18px)_saturate(125%)]"
          closeButtonClassName="top-[13px] right-[14px] grid size-11 place-items-center rounded-full border border-[#ffffff33] bg-[#ffffff14] text-white opacity-100 [backdrop-filter:blur(12px)] [-webkit-backdrop-filter:blur(12px)] hover:bg-[#ffffff2b] focus-visible:[outline:3px_solid_#d9f2e3] dark:focus-visible:outline-ring focus-visible:outline-offset-[3px] at-most-720:top-[10px] at-most-720:right-[10px]"
          data-ui="profile-photo-viewer"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          onKeyDown={(event) => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              move(event.key === "ArrowLeft" ? -1 : 1);
            }
          }}
        >
          {gallery && selected && (
            <>
              <header className="flex min-h-[70px] items-center justify-between gap-[15px] border-b border-[#ffffff1f] py-[15px] pr-[78px] pl-6 at-most-720:min-h-[65px] at-most-720:gap-[9px] at-most-720:py-3 at-most-720:pr-[66px] at-most-720:pl-[15px]">
                <DialogTitle className="m-0 min-w-0 overflow-hidden text-[16px] font-[550] leading-[1.4] tracking-normal text-ellipsis whitespace-nowrap at-most-720:text-[14px]">
                  {name}
                </DialogTitle>
                <span
                  className="min-w-[59px] shrink-0 rounded-[20px] border border-[#ffffff24] bg-[#ffffff0d] px-[11px] py-[5px] text-center text-[14px] leading-[1.5] tabular-nums text-[#f4faf6]"
                  role="status"
                  aria-label={t("public.photoCount", {
                    count: gallery.index + 1,
                    total: gallery.photos.length,
                  })}
                >
                  {formatNumber(locale, gallery.index + 1)} /{" "}
                  {formatNumber(locale, gallery.photos.length)}
                </span>
              </header>
              <div
                className="relative mx-[18px] my-4 grid min-h-0 min-w-0 place-items-center [touch-action:pan-y_pinch-zoom] at-most-720:mx-2 at-most-720:my-[10px]"
                onTouchStart={(event) => {
                  const point = event.touches[0];
                  touch.current =
                    event.touches.length === 1
                      ? { x: point.clientX, y: point.clientY }
                      : null;
                }}
                onTouchCancel={() => {
                  touch.current = null;
                }}
                onTouchEnd={(event) => {
                  const start = touch.current,
                    point = event.changedTouches[0];
                  touch.current = null;
                  if (!start || !point) return;
                  const dx = point.clientX - start.x,
                    dy = point.clientY - start.y;
                  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
                    move(dx < 0 ? 1 : -1);
                }}
              >
                {largeFailed.includes(selected.resource) ? (
                  <p
                    className="m-0 grid h-full w-full place-items-center px-[65px] py-6 text-center text-[16px] leading-[1.6] text-white"
                    role="status"
                  >
                    {t("public.photoFailed")}{" "}
                    {gallery.photos.length > 1
                      ? t("public.chooseAnotherPhoto")
                      : t("public.reopenPhoto")}
                  </p>
                ) : (
                  <>
                    {!loaded.includes(selected.resource) && (
                      <span
                        className="absolute flex items-center gap-[10px] text-[14px] leading-[1.5] text-[#f4faf6]"
                        role="status"
                      >
                        <LoaderCircle
                          size={24}
                          className="inline-block animate-[spin_1s_linear_infinite]"
                        />
                        {t("public.photoLoading")}
                      </span>
                    )}
                    <img
                      key={selected.resource}
                      className={cn(
                        "block h-full min-h-0 w-full rounded-[10px] object-contain opacity-0 select-none transition-opacity duration-[180ms] ease-[ease] motion-reduce:transition-none",
                        loaded.includes(selected.resource) && "opacity-100",
                      )}
                      src={googlePhotoUrl(
                        selected,
                        identity.browserKey,
                        "large",
                      )}
                      alt={t("public.largePhotoAlt", {
                        count: gallery.index + 1,
                        name,
                      })}
                      loading="eager"
                      decoding="async"
                      draggable={false}
                      referrerPolicy="strict-origin-when-cross-origin"
                      onLoad={() =>
                        setLoaded((value) =>
                          value.includes(selected.resource)
                            ? value
                            : [...value, selected.resource],
                        )
                      }
                      onError={() =>
                        setLargeFailed((value) =>
                          value.includes(selected.resource)
                            ? value
                            : [...value, selected.resource],
                        )
                      }
                    />
                  </>
                )}
                {gallery.photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      className={cn(
                        galleryNavigationClassName,
                        "left-3 at-most-720:left-[5px]",
                      )}
                      aria-label={t("public.previousPhoto")}
                      onClick={() => move(-1)}
                    >
                      <ChevronLeft size={25} />
                    </button>
                    <button
                      type="button"
                      className={cn(
                        galleryNavigationClassName,
                        "right-3 at-most-720:right-[5px]",
                      )}
                      aria-label={t("public.nextPhoto")}
                      onClick={() => move(1)}
                    >
                      <ChevronRight size={25} />
                    </button>
                  </>
                )}
              </div>
              <footer className="min-w-0 px-[22px] pt-[6px] pb-3">
                <PhotoAttribution
                  photo={selected}
                  attributions={attributions}
                  mapsUrl={mapsUrl}
                />
              </footer>
              {gallery.photos.length > 1 && (
                <div
                  className="flex max-h-40 flex-wrap justify-center gap-3 overflow-auto border-t border-[#ffffff1f] bg-[#ffffff05] px-5 pt-[14px] pb-[18px] at-most-720:gap-[10px] at-most-720:px-[14px] at-most-720:pt-3 at-most-720:pb-[15px]"
                  aria-label={t("public.photoSelection")}
                >
                  {gallery.photos.map((photo, i) => (
                    <figure
                      className="m-0 min-w-0 max-w-[120px]"
                      key={photo.resource}
                    >
                      <button
                        type="button"
                        className="h-[60px] w-[84px] overflow-hidden rounded-[11px] border-2 border-transparent bg-[#ffffff12] p-[3px] opacity-[0.65] transition-[opacity,border-color] duration-150 hover:opacity-100 aria-pressed:border-white aria-pressed:bg-[#ffffff30] aria-pressed:opacity-100 aria-pressed:[box-shadow:0_0_0_3px_#ffffff0c] focus-visible:[outline:3px_solid_#d9f2e3] dark:focus-visible:outline-ring focus-visible:outline-offset-[3px] motion-reduce:transition-none at-most-720:h-[54px] at-most-720:w-[74px]"
                        aria-label={t("public.showPhoto", { count: i + 1 })}
                        aria-pressed={gallery.index === i}
                        onClick={() =>
                          setGallery((current) =>
                            current ? { ...current, index: i } : null,
                          )
                        }
                      >
                        <img
                          className="block h-full w-full rounded-[6px] object-cover"
                          src={googlePhotoUrl(photo, identity.browserKey)}
                          alt=""
                          width={80}
                          height={56}
                          decoding="async"
                          referrerPolicy="strict-origin-when-cross-origin"
                        />
                      </button>
                      <figcaption className="pt-[5px] text-[11px] leading-[1.4]">
                        <PhotoAttribution
                          photo={photo}
                          attributions={attributions}
                          mapsUrl={mapsUrl}
                        />
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function WorkshopGoogleMap({
  name,
  profile,
  identity,
  status,
  mapsUrl,
}: {
  name: string;
  profile: LiveGoogleProfile | null;
  identity: GoogleWorkshopIdentity | null;
  status: GoogleProfileStatus;
  mapsUrl: string;
}) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const mapTheme = resolvedTheme === "dark" ? "dark" : "light";
  const [open, setOpen] = useState(false),
    [mapStatus, setMapStatus] = useState<"loading" | "ready" | "unavailable">(
      "loading",
    ),
    host = useRef<HTMLDivElement>(null);
  const placeId = profile?.placeId,
    lat = profile?.location?.lat,
    lng = profile?.location?.lng,
    browserKey = identity?.browserKey;
  useEffect(() => {
    if (
      !open ||
      !host.current ||
      !placeId ||
      lat == null ||
      lng == null ||
      !browserKey
    )
      return;
    let active = true,
      dispose: (() => void) | undefined;
    const controller = new AbortController();
    const element = host.current;
    void showConfirmedGoogleMap(
      element,
      { placeId, location: { lat, lng } },
      browserKey,
      name,
      { theme: mapTheme, signal: controller.signal },
    )
      .then((cleanup) => {
        if (!active) {
          cleanup();
          return;
        }
        dispose = cleanup;
        setMapStatus("ready");
      })
      .catch(() => {
        if (active) setMapStatus("unavailable");
      });
    return () => {
      active = false;
      controller.abort();
      dispose?.();
    };
  }, [open, placeId, lat, lng, browserKey, name, mapTheme]);
  const unavailable =
    mapStatus === "unavailable" ||
    status === "unavailable" ||
    (status === "ready" && !profile?.location);
  return (
    <details
      className="group mt-4 border-t border-[#dce9e4] dark:border-border at-most-720:mt-3"
      data-ui="profile-map"
      onToggle={(event) => {
        const expanded = event.currentTarget.open;
        setOpen(expanded);
        if (expanded) setMapStatus("loading");
      }}
    >
      <summary className="flex min-h-[46px] cursor-pointer list-none items-center justify-between gap-3 text-[14px] text-[#52736b] focus-visible:rounded-[5px] focus-visible:[outline:3px_solid_#57a88b] dark:focus-visible:outline-ring focus-visible:outline-offset-[3px] dark:text-[#c0e1d7] [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <MapPin size={16} />
          {t("public.showMap")}
        </span>
        <ChevronDown
          size={17}
          className="transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      {open && (
        <>
          {!unavailable && (
            <div
              ref={host}
              className="mt-1 block h-60 w-full rounded-lg bg-[#e7eeeb] dark:bg-secondary at-most-720:h-[230px]"
              role="region"
              aria-label={t("public.mapAria", { name })}
              data-google-place-id={profile?.placeId}
            />
          )}
          <p className={helpTextClassName} role="status">
            {unavailable
              ? t("public.mapFailed")
              : mapStatus !== "ready"
                ? t("public.mapLoading")
                : null}
          </p>
          {unavailable && (
            <LocaleAnchor
              className={appButton({ variant: "text" })}
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("public.openLocation")}
            </LocaleAnchor>
          )}
        </>
      )}
    </details>
  );
}
