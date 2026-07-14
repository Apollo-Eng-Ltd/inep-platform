import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { daysSince } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClipboardCheck, UserCog } from "lucide-react";
import type { PendingApproval } from "@/lib/pending-approvals";

export function PendingApprovalsCard({ approvals }: { approvals: PendingApproval[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Your pending approvals</CardTitle>
        {approvals.length > 0 && (
          <span className="rounded-full bg-brand-soft text-brand px-2 py-0.5 text-xs font-medium">{approvals.length}</span>
        )}
      </CardHeader>
      <CardContent className="space-y-1">
        {approvals.length === 0 ? (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground py-4">
            <ClipboardCheck className="size-4" /> Nothing waiting on you right now.
          </div>
        ) : (
          approvals.map((a) => {
            const days = daysSince(a.enteredStageAt) ?? 0;
            const lingering = days >= 3;
            return (
              <Link
                key={a.submissionId}
                href={`/pipeline?type=${a.submitterType}&open=${a.submissionId}`}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.submitterName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.title} · {a.stageName}
                    {a.onBehalfOf && (
                      <span className="inline-flex items-center gap-1 ml-1.5 text-agent">
                        <UserCog className="size-3" /> on behalf of {a.onBehalfOf}
                      </span>
                    )}
                  </p>
                </div>
                <span className={cn("text-[11px] font-medium shrink-0", lingering ? "text-warning" : "text-muted-foreground")}>
                  {days <= 0 ? "Entered today" : `${days} day${days === 1 ? "" : "s"} waiting`}
                </span>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
