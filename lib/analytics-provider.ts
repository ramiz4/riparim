import type { AnalyticsTransport } from "./analytics";

// The capture-only HTTP API has no SDK hooks, remote config, autocapture or replay.
export const send: AnalyticsTransport["send"] = async (
  config,
  event,
  signal,
) => {
  const response = await fetch(`${config.host}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    referrerPolicy: "no-referrer",
    keepalive: true,
    signal,
    body: JSON.stringify({ token: config.key, ...event }),
  });
  if (!response.ok) throw Error("Analytics capture unavailable");
};
