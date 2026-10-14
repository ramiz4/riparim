import { env } from "@/lib/runtime/env";

function httpsOrigin(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/"
    )
      return url.origin;
  } catch {}
  return null;
}
export function hostedAuthOrigin(origin: string) {
  const url = new URL(origin);
  return /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) && !url.port;
}
export function trustedAuthOrigin(value: string, provider = "supabase") {
  const origin = httpsOrigin(value);
  if (
    !origin ||
    ((provider !== "supabase" || !hostedAuthOrigin(origin)) &&
      (origin !== httpsOrigin(env.AUTH_TRUSTED_ORIGIN ?? "") ||
        (env.AUTH_TRUSTED_PROVIDER ?? "supabase") !== provider))
  )
    throw Error("UNTRUSTED_AUTH_ORIGIN");
  return origin;
}
export function authSecretMatchesOrigin(origin: string, provider = "supabase") {
  // Existing hosted configurations remain usable. Custom hosts require a separate,
  // explicit credential binding; approving a public endpoint never approves secrets.
  if (env.AUTH_ADMIN_KEY)
    return (
      env.AUTH_ADMIN_KEY_PROVIDER === provider &&
      httpsOrigin(env.AUTH_ADMIN_KEY_ORIGIN ?? "") === origin
    );
  if (provider !== "supabase") return false;
  const binding = env.SUPABASE_SECRET_KEY_ORIGIN;
  return binding ? httpsOrigin(binding) === origin : hostedAuthOrigin(origin);
}

// No credentials or tokens may follow redirects, even from an approved host.
export function providerFetch(
  origin: string,
  timeout = 8000,
  provider = "supabase",
): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (
      url.origin !== origin ||
      !url.pathname.startsWith(
        provider === "pocketbase" ? "/api/collections/" : "/auth/v1/",
      )
    )
      throw Error("UNTRUSTED_AUTH_REQUEST");
    // Workers reject redirect:'error' before a network request.
    const response = await fetch(input, {
      ...init,
      redirect: "manual",
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(timeout)])
        : AbortSignal.timeout(timeout),
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw Error("AUTH_PROVIDER_REDIRECT");
    }
    return response;
  };
}
