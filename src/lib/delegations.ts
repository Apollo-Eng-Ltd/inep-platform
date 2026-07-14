// Delegated approval authority — "temporarily let someone else act on my
// pending approvals." There is no dedicated `delegations` table: this
// environment can't apply schema migrations, only read/write existing rows.
// So a delegation grant/revoke is stored as a real row in `audit_log`
// (entity_type = "delegation"), which already has exactly the columns this
// needs — actor_id, a jsonb detail bag, created_at — and is a genuine,
// queryable, permanent record, not a client-side fake. All reads/writes here
// go through the service-role client because `audit_log` SELECT is
// restricted to national roles (see migration RLS), but a county_officer
// must be able to see and act on their own delegation grants too.
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/auth";

const ENTITY_TYPE = "delegation";
const ACTION_CREATE = "delegation_created";
const ACTION_REVOKE = "delegation_revoked";

export interface Delegation {
  id: string; // = audit_log.entity_id, shared between the create row and any revoke row
  delegatorId: string;
  delegatorName: string;
  delegateId: string;
  delegateName: string;
  role: Role;
  submitterId: string | null;
  startDate: string; // ISO date, yyyy-mm-dd
  endDate: string; // ISO date, yyyy-mm-dd
  createdAt: string;
  revoked: boolean;
}

type DetailRow = {
  id: string;
  action: string;
  actor_id: string | null;
  created_at: string;
  detail: Record<string, unknown>;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isActive(d: Delegation): boolean {
  const today = todayIso();
  return !d.revoked && d.startDate <= today && today <= d.endDate;
}

// Every delegation-entity row (grants and revokes together) — fetched
// unfiltered-by-user and filtered in JS below. A per-user SQL filter here
// would miss revoke rows: a revoke row's actor_id is whoever clicked revoke
// (usually the delegator) and it has no delegate_id in its detail, so
// filtering by "involves this user" at the SQL level would silently hide a
// revoke from the delegate's own view and leave them looking still-active.
async function loadAllRows(): Promise<DetailRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("audit_log")
    .select("id, action, actor_id, created_at, detail")
    .eq("entity_type", ENTITY_TYPE)
    .order("created_at", { ascending: true });
  return (data ?? []) as DetailRow[];
}

function assemble(rows: DetailRow[], names: Map<string, string>): Delegation[] {
  const revokedIds = new Set(rows.filter((r) => r.action === ACTION_REVOKE).map((r) => String(r.detail.delegation_id)));
  return rows
    .filter((r) => r.action === ACTION_CREATE)
    .map((r) => {
      const d = r.detail as Record<string, string>;
      return {
        id: r.id,
        delegatorId: r.actor_id ?? "",
        delegatorName: names.get(r.actor_id ?? "") ?? "—",
        delegateId: d.delegate_id,
        delegateName: names.get(d.delegate_id) ?? "—",
        role: d.role as Role,
        submitterId: d.submitter_id || null,
        startDate: d.start_date,
        endDate: d.end_date,
        createdAt: r.created_at,
        revoked: revokedIds.has(r.id),
      };
    });
}

async function withNames(delegatorIds: string[], delegateIds: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const ids = [...new Set([...delegatorIds, ...delegateIds])];
  if (!ids.length) return new Map();
  const { data } = await admin.from("users").select("id, full_name").in("id", ids);
  return new Map((data ?? []).map((u) => [u.id, u.full_name]));
}

async function loadAssembled(): Promise<Delegation[]> {
  const rows = await loadAllRows();
  const names = await withNames(
    rows.map((r) => r.actor_id ?? ""),
    rows.map((r) => String((r.detail as Record<string, string>).delegate_id ?? "")).filter(Boolean)
  );
  return assemble(rows, names);
}

/** Active delegations where `userId` is the RECEIVING delegate — used to grant borrowed authority. */
export async function listActiveDelegationsReceivedBy(userId: string): Promise<Delegation[]> {
  const all = await loadAssembled();
  return all.filter((d) => d.delegateId === userId).filter(isActive);
}

/** Every delegation `userId` has granted (given), active or not — for the "manage my delegations" list. */
export async function listDelegationsGivenBy(userId: string): Promise<Delegation[]> {
  const all = await loadAssembled();
  return all
    .filter((d) => d.delegatorId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Other users who share this role + scope — the only people eligible to receive a delegation. */
export async function listEligibleDelegates(role: Role, submitterId: string | null, excludeUserId: string) {
  const admin = createAdminClient();
  let query = admin.from("users").select("id, full_name").eq("role", role).neq("id", excludeUserId);
  query = submitterId ? query.eq("submitter_id", submitterId) : query.is("submitter_id", null);
  const { data } = await query;
  return data ?? [];
}

export async function createDelegation(params: {
  delegatorId: string;
  delegateId: string;
  role: Role;
  submitterId: string | null;
  startDate: string;
  endDate: string;
}): Promise<{ error?: string }> {
  if (params.delegateId === params.delegatorId) return { error: "You can't delegate to yourself." };
  if (params.endDate < params.startDate) return { error: "End date must be on or after the start date." };
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_id: params.delegatorId,
    action: ACTION_CREATE,
    entity_type: ENTITY_TYPE,
    entity_id: null,
    detail: {
      delegate_id: params.delegateId,
      role: params.role,
      submitter_id: params.submitterId,
      start_date: params.startDate,
      end_date: params.endDate,
    },
  });
  if (error) return { error: error.message };
  return {};
}

export async function revokeDelegation(delegationId: string, revokedBy: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_id: revokedBy,
    action: ACTION_REVOKE,
    entity_type: ENTITY_TYPE,
    entity_id: null,
    detail: { delegation_id: delegationId },
  });
  if (error) return { error: error.message };
  return {};
}
