// Small, meaning-bearing status tags. Colors map to the design system: category
// colors for who, status colors for state. Kept muted until they matter.
import { cn } from "@/lib/utils";

function Tag({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

const ROLE_LABEL: Record<string, string> = {
  county_officer: "County officer",
  national_planner: "National planner",
  admin: "Administrator",
  committee_member: "Committee member",
};

export function RoleBadge({ role }: { role: string }) {
  return <Tag className="bg-muted text-muted-foreground">{ROLE_LABEL[role] ?? role}</Tag>;
}

export function SubmitterTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    county: { label: "County", cls: "bg-county-soft text-county" },
    national_provider: { label: "Provider", cls: "bg-provider-soft text-provider" },
    private_sector: { label: "Private / PBO", cls: "bg-private-soft text-private" },
  };
  const m = map[type] ?? { label: type, cls: "bg-muted text-muted-foreground" };
  return <Tag className={m.cls}>{m.label}</Tag>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-provider-soft text-provider",
    in_review: "bg-warning-soft text-warning",
    returned: "bg-danger-soft text-danger",
    approved: "bg-success-soft text-success",
    published: "bg-success-soft text-success",
  };
  const label = status.replace("_", " ");
  return <Tag className={cn(map[status] ?? "bg-muted text-muted-foreground", "capitalize")}>{label}</Tag>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    error: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
    info: "bg-provider-soft text-provider",
  };
  return (
    <Tag className={cn(map[severity] ?? "bg-muted text-muted-foreground", "capitalize")}>
      {severity}
    </Tag>
  );
}

export function AgentTag({ children }: { children: React.ReactNode }) {
  return <Tag className="bg-agent-soft text-agent">{children}</Tag>;
}
