// This allowlist is shared by local previews and immutable public rendering.
export function publicAnalyticsBindings(configuration = {}) {
  return {
    POSTHOG_KEY:
      typeof configuration.POSTHOG_KEY === "string"
        ? configuration.POSTHOG_KEY
        : "",
    POSTHOG_HOST:
      typeof configuration.POSTHOG_HOST === "string"
        ? configuration.POSTHOG_HOST
        : "",
    POSTHOG_TEST_MODE:
      configuration.POSTHOG_TEST_MODE === "true" ? "true" : "false",
  };
}
