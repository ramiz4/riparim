import { env } from "@/lib/runtime/env";
// Only the isolated build renderer sets this binding. Production has no override.
export function publicReleaseRender() {
  return ["true", "shell"].includes(
    String(Reflect.get(env, "PUBLIC_RELEASE_RENDER")),
  );
}

export function publicReleaseShell() {
  return Reflect.get(env, "PUBLIC_RELEASE_RENDER") === "shell";
}

// Build-only selection for the two public privacy snapshots; no provider call.
export function publicReleaseAuthProvider() {
  return Reflect.get(env, "PUBLIC_RELEASE_AUTH_PROVIDER") === "pocketbase"
    ? "pocketbase"
    : "supabase";
}
