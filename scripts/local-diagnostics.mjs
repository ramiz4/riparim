// Every local preparation error sink uses the same environment redaction.
export function redactLocalDiagnostic(value) {
  let text = String(value).replace(/\u001b\[[\d;]*m/g, "");
  for (const [name, secret] of Object.entries(process.env))
    if (
      /TOKEN|SECRET|PASSWORD|PRIVATE|CREDENTIAL|KEY/i.test(name) &&
      secret?.length >= 3
    )
      text = text.replaceAll(secret, "[redacted]");
  return text;
}

export function localErrorCause(error) {
  if (error instanceof SyntaxError)
    return "Invalid JSON in the checked-in local source data.";
  // Structured validators may include untrusted field names and values in
  // their messages. Report the source contract without dumping those issues.
  if (error?.name === "ZodError")
    return "Opening-hours source validation failed (ZodError). Check data/opening-hours-import.json against its schema.";
  return redactLocalDiagnostic(
    `${error.code ? error.code + ": " : ""}${error.message}`,
  );
}
