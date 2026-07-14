"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { fmtDate } from "@/lib/format";
import { delegateApprovals, revokeMyDelegation } from "./delegation-actions";
import { UserCog, X } from "lucide-react";

export interface EligibleDelegate {
  id: string;
  full_name: string;
}

export interface MyDelegation {
  id: string;
  delegateName: string;
  startDate: string;
  endDate: string;
  revoked: boolean;
}

export function DelegateDialogTrigger({
  eligibleDelegates,
  myDelegations,
  scopeLabel,
}: {
  eligibleDelegates: EligibleDelegate[];
  myDelegations: MyDelegation[];
  scopeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [delegateId, setDelegateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const activeToday = myDelegations.filter((d) => !d.revoked && d.startDate <= today && today <= d.endDate);

  const submit = () => {
    if (!delegateId || !startDate || !endDate) {
      toast.error("Pick a delegate and both dates.");
      return;
    }
    const fd = new FormData();
    fd.set("delegateId", delegateId);
    fd.set("startDate", startDate);
    fd.set("endDate", endDate);
    startTransition(async () => {
      const res = await delegateApprovals(fd);
      if ("error" in res && res.error) toast.error(res.error);
      else {
        toast.success("Approvals delegated.");
        setDelegateId("");
        setStartDate("");
        setEndDate("");
        setOpen(false);
      }
    });
  };

  const revoke = (id: string) => {
    const fd = new FormData();
    fd.set("delegationId", id);
    startTransition(async () => {
      const res = await revokeMyDelegation(fd);
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success("Delegation revoked.");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UserCog className="size-3.5" /> Delegate my approvals
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delegate my approvals</DialogTitle>
          <DialogDescription>
            Temporarily let another {scopeLabel} reviewer act on your pending approvals. They&apos;ll act exactly as you would, and every action they take is logged as on your behalf.
          </DialogDescription>
        </DialogHeader>

        {activeToday.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active now</p>
            {activeToday.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                <span>
                  {d.delegateName} · {fmtDate(d.startDate)}–{fmtDate(d.endDate)}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => revoke(d.id)}
                  className="text-muted-foreground hover:text-danger"
                  aria-label="Revoke delegation"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Delegate to</Label>
            {eligibleDelegates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one else shares your role and scope yet.</p>
            ) : (
              <Select value={delegateId} onValueChange={(v) => setDelegateId(String(v))} items={eligibleDelegates.map((d) => ({ value: d.id, label: d.full_name }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleDelegates.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate || undefined} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button disabled={pending || !eligibleDelegates.length} onClick={submit}>
            Delegate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
