// Shared page primitives: header, stat tile, section, empty state.
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  unit,
  delta,
  hint,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { value: number; good?: boolean };
  hint?: string;
  accent?: "brand" | "provider" | "private" | "agent" | "warning" | "danger" | "success";
}) {
  const dot = {
    brand: "bg-brand",
    provider: "bg-provider",
    private: "bg-private",
    agent: "bg-agent",
    warning: "bg-warning",
    danger: "bg-danger",
    success: "bg-success",
  }[accent];

  return (
    <Card className="p-5 gap-2">
      <div className="flex items-center gap-2">
        <span className={cn("size-1.5 rounded-full", dot)} />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-medium tabular-nums">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      <div className="flex items-center gap-2 text-xs">
        {delta && (
          <span
            className={cn(
              "font-medium",
              delta.good === false ? "text-danger" : "text-success"
            )}
          >
            {delta.value >= 0 ? "▲" : "▼"} {Math.abs(delta.value)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mt-1">{description}</p>
      )}
    </div>
  );
}
