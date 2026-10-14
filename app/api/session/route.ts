import { getAppUser, getAdminUser } from "@/app/auth";
import { json } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await getAppUser(),
      admin = await getAdminUser(user);
    return json({
      account: user
        ? {
            email: user.email,
            displayName: user.displayName,
            provider: user.provider,
          }
        : null,
      isAdmin: !!admin?.isModerator,
    });
  } catch (error) {
    console.error(
      "public-session",
      error instanceof Error ? error.name : "unknown",
    );
    return json({ errorCode: "unavailable" }, 503);
  }
}
