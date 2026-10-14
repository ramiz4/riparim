import { ValidationError } from "@/lib/validation-error";

export const evidenceFileLimit = 5 * 1024 * 1024;
export async function validateEvidenceFile(file: File) {
  if (file.size > evidenceFileLimit)
    throw new ValidationError(
      "file_too_large",
      "Die Datei ist zu groß. Maximal 5 MB.",
    );
  const bytes = await file.arrayBuffer(),
    b = new Uint8Array(bytes);
  const valid =
    (file.type === "application/pdf" &&
      String.fromCharCode(...b.slice(0, 5)) === "%PDF-") ||
    (file.type === "image/jpeg" &&
      b[0] === 255 &&
      b[1] === 216 &&
      b[2] === 255) ||
    (file.type === "image/png" &&
      b[0] === 137 &&
      b[1] === 80 &&
      b[2] === 78 &&
      b[3] === 71);
  if (!valid)
    throw new ValidationError(
      "invalid_file",
      "Bitte lade eine gültige PDF-, JPG- oder PNG-Datei hoch.",
    );
  return {
    bytes,
    fileName: file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120),
    fileType: file.type,
  };
}
