"use client";
import { useI18n } from "@/lib/i18n/client";
import { useEffect, useMemo, useState } from "react";
import {
  googlePlacesClientConfig,
  workshopGoogleIdentity,
} from "@/lib/google-maps-browser";
import type { GoogleProfileStatus } from "@/lib/google-workshop-profile";

export type GoogleWorkshopIdentity = { placeId: string; browserKey: string };
export type RequestGoogleIdentity = (isVisible: () => boolean) => () => void;
function identityRequest(
  id: string,
  sourceMapsUrl: string | null | undefined,
  identityRevision: string,
  onResult: (identity: GoogleWorkshopIdentity | null) => void,
) {
  let active = true,
    started = false;
  const sources = new Set<() => boolean>();
  const visible = () =>
    document.visibilityState !== "hidden" &&
    [...sources].some((source) => source());
  const requestIdentity: RequestGoogleIdentity = (isVisible) => {
    sources.add(isVisible);
    if (!started && visible()) {
      started = true;
      void (async () => {
        try {
          await googlePlacesClientConfig();
          if (!active) return;
          // The first panel may disappear while configuration loads; another visible panel can take over.
          if (!visible()) {
            started = false;
            return;
          }
          const identity = await workshopGoogleIdentity(
            id,
            sourceMapsUrl,
            identityRevision,
          );
          if (active) onResult(identity);
        } catch {
          if (active) onResult(null);
        }
      })();
    }
    return () => {
      sources.delete(isVisible);
    };
  };
  return {
    requestIdentity,
    activate: () => {
      active = true;
    },
    deactivate: () => {
      active = false;
      sources.clear();
    },
  };
}
export function useGoogleWorkshopProfile(
  id: string,
  sourceMapsUrl?: string | null,
  identityRevision = "",
) {
  const { locale } = useI18n(),
    requestKey = `${id}:${locale}:${sourceMapsUrl ?? ""}:${identityRevision}`;
  const [result, setResult] = useState<{
    key: string;
    identity: GoogleWorkshopIdentity | null;
    status: GoogleProfileStatus;
  }>({ key: requestKey, identity: null, status: "loading" });
  const request = useMemo(
    () =>
      identityRequest(id, sourceMapsUrl, identityRevision, (identity) =>
        setResult({
          key: requestKey,
          identity,
          status: identity ? "ready" : "unavailable",
        }),
      ),
    [id, requestKey, sourceMapsUrl, identityRevision],
  );
  useEffect(() => {
    request.activate();
    return () => request.deactivate();
  }, [request]);
  return {
    ...(result.key === requestKey
      ? { identity: result.identity, status: result.status }
      : { identity: null, status: "loading" as GoogleProfileStatus }),
    requestIdentity: request.requestIdentity,
  };
}
