import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export function AdminLoading({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`admin-loading${compact ? " admin-loading-compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <LoaderCircle size={20} className="spin" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
