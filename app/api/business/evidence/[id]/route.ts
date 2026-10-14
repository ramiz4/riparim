import { callbackLocale } from "@/lib/auth/locale";
import { createTranslator, getMessages } from "@/lib/i18n/messages";
import { getAppUser, getAdminUser, ownerPair } from "@/app/auth";
import { storedClaimDocuments } from "@/lib/business-contract";
import { storage } from "@/db/storage";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = createTranslator(
    getMessages(
      callbackLocale(new URL(request.url).searchParams.get("locale")),
      ["customer"],
    ),
  );
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const user = (await getAppUser()) ?? (await getAdminUser());
  if (!user)
    return new Response(t("customer.downloadAuth"), { status: 401, headers });
  try {
    const { id } = await params,
      { db, bucket } = storage();
    const claim = await db
      .prepare(
        "SELECT id,owner,file_key,file_name,file_type,documents FROM workshop_claims WHERE id=?",
      )
      .bind(id)
      .first<Record<string, unknown>>();
    if (
      !claim ||
      (!ownerPair(user).includes(String(claim.owner)) &&
        !(await getAdminUser(user))?.isModerator)
    )
      return new Response(t("customer.downloadNotFound"), {
        status: 404,
        headers,
      });
    const selector = new URL(request.url).searchParams.get("document"),
      documents = storedClaimDocuments(claim),
      document = selector
        ? documents.find((document) => document.id === selector)
        : documents[0];
    if (!document)
      return new Response(t("customer.downloadNoDocument"), {
        status: 404,
        headers,
      });
    const file = await bucket.get(document.fileKey);
    if (!file)
      return new Response(t("customer.downloadMissing"), {
        status: 404,
        headers,
      });
    const extension =
      document.fileType === "application/pdf"
        ? "pdf"
        : document.fileType === "image/png"
          ? "png"
          : "jpg";
    return new Response(file.body, {
      headers: {
        ...headers,
        "Content-Type": document.fileType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="inhabernachweis.${extension}"`,
      },
    });
  } catch {
    console.error("claim-evidence-read-failed");
    return new Response(t("customer.downloadUnavailable"), {
      status: 503,
      headers,
    });
  }
}
