import { providerBlocked } from "@/lib/auth/account-status";
import { createPasswordClient } from "@/lib/auth/provider";
import type { AuthConfig } from "@/lib/auth/config";

// Reauthentication must not replace the browser's enrolled session or create a
// legacy ownership link. Its isolated provider session is signed out afterwards.
export async function verifyPassword(
  config: AuthConfig,
  id: string,
  email: string,
  password: string,
) {
  const client = createPasswordClient(config);
  try {
    const { data, error } = await client.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user?.emailVerified || data.user.identity.subject !== id)
      return false;
    const verified = await client.getUser();
    return (
      !verified.error &&
      verified.data.user?.identity.subject === id &&
      !!verified.data.user.emailVerified &&
      !providerBlocked(verified.data.user)
    );
  } finally {
    const { error } = await client.signOut({ scope: "local" });
    if (error) throw Error("PASSWORD_PROOF_SIGNOUT_FAILED");
  }
}
