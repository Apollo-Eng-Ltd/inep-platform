"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createDelegation, revokeDelegation, listDelegationsGivenBy } from "@/lib/delegations";

export async function delegateApprovals(formData: FormData) {
  const profile = await getProfile();
  if (!profile) return { error: "Not authorized." };

  const delegateId = String(formData.get("delegateId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  if (!delegateId || !startDate || !endDate) return { error: "Pick a delegate and both dates." };

  const res = await createDelegation({
    delegatorId: profile.id,
    delegateId,
    role: profile.role,
    submitterId: profile.submitter_id,
    startDate,
    endDate,
  });
  if (res.error) return res;

  revalidatePath("/pipeline");
  revalidatePath("/");
  return { ok: true };
}

export async function revokeMyDelegation(formData: FormData) {
  const profile = await getProfile();
  if (!profile) return { error: "Not authorized." };

  const delegationId = String(formData.get("delegationId") ?? "");
  // Only the delegator who granted it may revoke it early.
  const mine = await listDelegationsGivenBy(profile.id);
  if (!mine.some((d) => d.id === delegationId)) return { error: "You can only revoke a delegation you granted." };

  const res = await revokeDelegation(delegationId, profile.id);
  if (res.error) return res;

  revalidatePath("/pipeline");
  revalidatePath("/");
  return { ok: true };
}
