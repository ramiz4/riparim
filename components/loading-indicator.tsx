import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function LoadingIndicator({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-atomic="true"
      className={cn(
        "inline-flex items-center gap-2 text-muted-foreground",
        className,
      )}
    >
      <Spinner
        aria-hidden="true"
        role={undefined}
        aria-label={undefined}
        className="shrink-0 motion-reduce:animate-none"
      />
      <span>{label}</span>
    </span>
  );
}
