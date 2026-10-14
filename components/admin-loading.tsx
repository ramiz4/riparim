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
      className={`flex items-center gap-2.5 text-center text-[14px] text-muted-foreground ${compact ? "min-h-11 justify-start py-3 text-left" : "min-h-[200px] justify-center px-4 py-6"}`}
      data-ui="admin-loading"
      role="status"
      aria-live="polite"
    >
      <LoaderCircle
        size={20}
        className="inline-block shrink-0 animate-spin text-[var(--theme-accent)] motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span>{children}</span>
    </div>
  );
}
