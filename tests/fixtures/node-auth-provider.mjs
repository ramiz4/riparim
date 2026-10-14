// Only this isolated Node process intercepts the synthetic Auth project.
const original = globalThis.fetch,
  now = Date.now();
Date.now = () => now;
globalThis.fetch = async (input, options) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (url.hostname === "node-auth-fixture.supabase.co") {
    if (url.pathname === "/auth/v1/settings")
      return Response.json({
        external: { google: true, email: false },
        mailer_autoconfirm: false,
      });
    throw new Error("Unexpected synthetic Auth operation");
  }
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("Live provider requests are forbidden in the Node fixture");
  return original(input, options);
};
