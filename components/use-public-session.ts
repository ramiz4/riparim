"use client";
import { useEffect, useState } from "react";
import type { AccountIdentity } from "./account-storage-notice";
export type PublicSession = {
  account: AccountIdentity | null;
  isAdmin: boolean;
};
export type SessionChange = {
  displayName?: string;
  signedOut?: boolean;
  signedIn?: boolean;
};
let pending: Promise<PublicSession> | undefined;
let preview: PublicSession | null = null;
let validUntil = 0;
const sessionLifetime = 5 * 60_000;
const sessionChannelName = "riparim-session-v1";
type SessionSignal = "refresh" | "signed-in" | "signed-out";
let channel: BroadcastChannel | undefined,
  channelReady = false,
  announced = false;
// UI state only: protected data APIs authorize every request independently.
// Never retain an identity in the server renderer or browser storage.
function sessionPreview() {
  return typeof window === "undefined" ? null : preview;
}
const listeners = new Set<(change: SessionChange) => void>();
function receiveSessionSignal(signal: unknown) {
  if (signal !== "refresh" && signal !== "signed-in" && signal !== "signed-out")
    return;
  invalidateSession(
    signal === "signed-out"
      ? { signedOut: true }
      : signal === "signed-in"
        ? { signedIn: true }
        : {},
  );
}
function connectSessionChannel() {
  if (typeof window === "undefined" || channelReady) return;
  channelReady = true;
  try {
    if (window.BroadcastChannel) {
      channel = new window.BroadcastChannel(sessionChannelName);
      channel.onmessage = (event) => receiveSessionSignal(event.data);
      return;
    }
  } catch {
    /* Storage events and focus revalidation remain available. */
  }
  window.addEventListener("storage", (event) => {
    if (event.key === sessionChannelName && event.newValue) {
      try {
        receiveSessionSignal(JSON.parse(event.newValue).signal);
      } catch {
        /* Ignore unrelated or malformed messages. */
      }
    }
  });
}
function broadcastSessionSignal(signal: SessionSignal) {
  if (typeof window === "undefined") return;
  connectSessionChannel();
  // Only an invalidation signal crosses tabs; identities and tokens stay private.
  try {
    if (channel) channel.postMessage(signal);
    else {
      window.localStorage.setItem(
        sessionChannelName,
        JSON.stringify({ signal, nonce: crypto.randomUUID() }),
      );
      window.localStorage.removeItem(sessionChannelName);
    }
  } catch {
    /* Restricted browser storage must not break login/logout. */
  }
}
export function loadPublicSession({ force = false }: { force?: boolean } = {}) {
  if (pending) return pending;
  const cached = sessionPreview();
  if (!force && cached && Date.now() < validUntil)
    return Promise.resolve(cached);
  const request = fetch("/api/session", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw Error("Session unavailable");
      const value = await response.json();
      if (
        !value ||
        typeof value !== "object" ||
        !("isAdmin" in value) ||
        !("account" in value)
      )
        throw Error("Invalid session response");
      if (
        typeof value.isAdmin !== "boolean" ||
        (value.account !== null &&
          (!value.account ||
            ["email", "displayName", "provider"].some(
              (key) =>
                typeof (value.account as Record<string, unknown>)[key] !==
                "string",
            )))
      )
        throw Error("Invalid session response");
      const session = value as PublicSession;
      if (typeof window !== "undefined" && pending === request) {
        preview = session;
        validUntil = Date.now() + sessionLifetime;
        // Redirect-based OAuth/mail login and logout return in a new document.
        if (!announced) {
          announced = true;
          broadcastSessionSignal("refresh");
        }
      }
      return session;
    })
    .finally(() => {
      if (pending === request) pending = undefined;
    });
  pending = request;
  return request;
}
function revalidateOnReturn() {
  if (document.visibilityState !== "visible" || pending) return;
  validUntil = 0;
  for (const listener of listeners) listener({});
}
function restored(event: PageTransitionEvent) {
  if (event.persisted) revalidateOnReturn();
}
export function subscribePublicSession(
  listener: (change: SessionChange) => void,
) {
  if (!listeners.size && typeof window !== "undefined") {
    connectSessionChannel();
    window.addEventListener("focus", revalidateOnReturn);
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", revalidateOnReturn);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && typeof window !== "undefined") {
      window.removeEventListener("focus", revalidateOnReturn);
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", revalidateOnReturn);
    }
  };
}
function invalidateSession(change: SessionChange) {
  // A response started before the mutation must not be shared with its reload.
  pending = undefined;
  validUntil = 0;
  if (typeof window !== "undefined")
    preview = applyPublicSessionChange(preview, change);
  for (const listener of listeners) listener(change);
}
export function invalidatePublicSession(change: SessionChange = {}) {
  invalidateSession(change);
  broadcastSessionSignal(
    change.signedOut ? "signed-out" : change.signedIn ? "signed-in" : "refresh",
  );
}
export function applyPublicSessionChange(
  session: PublicSession | null,
  change: SessionChange,
): PublicSession | null {
  if (change.signedOut) return { account: null, isAdmin: false };
  if (change.signedIn) return null;
  return change.displayName && session?.account
    ? {
        ...session,
        account: { ...session.account, displayName: change.displayName },
      }
    : session;
}
export function usePublicSession(
  initial: PublicSession,
  publicSnapshot = false,
) {
  const [session, setSession] = useState<PublicSession | null>(() =>
      publicSnapshot ? sessionPreview() : initial,
    ),
    [error, setError] = useState(false);
  const [snapshotMode, setSnapshotMode] = useState(publicSnapshot);
  // A retained private header may enter public mode after another tab signs in.
  // Reset during render so an old guest/account is never committed in that mode.
  if (snapshotMode !== publicSnapshot) {
    setSnapshotMode(publicSnapshot);
    setSession(publicSnapshot ? sessionPreview() : initial);
  }
  useEffect(() => {
    if (!publicSnapshot) return;
    let active = true,
      sequence = 0;
    const refresh = (change: SessionChange = {}) => {
      const current = ++sequence;
      setSession((previous) => applyPublicSessionChange(previous, change));
      void loadPublicSession()
        .then((value) => {
          if (active && current === sequence) {
            setSession(value);
            setError(false);
          }
        })
        .catch(() => {
          if (active && current === sequence) setError(true);
        });
    };
    const unsubscribe = subscribePublicSession(refresh);
    refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [publicSnapshot]);
  return {
    ...(publicSnapshot ? (session ?? initial) : initial),
    pending: publicSnapshot && session === null,
    error,
  };
}
