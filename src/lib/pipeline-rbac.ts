// Stage-based approval permissions for the plan pipeline.
//
// Real constraint: the `user_role` enum only has four values (county_officer,
// national_planner, admin, committee_member) — there is no distinct "County
// Executive Committee" or "County Assembly rep" role in the schema, and adding
// one means a migration this environment can't apply. So Committee Review and
// Assembly Approval are both gated to `committee_member`; Executive Approval
// and the final national sign-off are gated to `admin`. What IS real and
// enforced: a committee_member/admin with a `submitter_id` set can only act on
// that one county/organization's plans — an unscoped account (submitter_id
// null) acts platform-wide, matching how national staff work today.
//
// This check runs in the server action before any mutation — not just hidden
// in the UI. It is not a Postgres RLS policy (that needs a migration this
// environment can't apply either), so it's a real gate, just not a
// database-enforced one.
import type { Role } from "./auth";
import type { Delegation } from "./delegations";

export const STAGE_ROLE: Partial<Record<string, Role>> = {
  draft: "county_officer",
  committee_review: "committee_member",
  executive_approval: "admin",
  assembly_approval: "committee_member",
  technical_review: "committee_member",
  approved: "admin",
  validation_review: "committee_member",
};

export interface StageActor {
  role: Role;
  submitterId: string | null;
}

/**
 * Can this profile approve or return a plan currently at `stageKey` and
 * belonging to `planSubmitterId`?
 *
 * `admin` is a platform-wide superuser (scoped to their own org if they
 * happen to have one). Everyone else must hold exactly the role assigned to
 * that stage, and — unless they're unscoped — belong to the same
 * county/organization as the plan.
 */
export function canActOnStage(profile: StageActor, stageKey: string, planSubmitterId: string): boolean {
  const required = STAGE_ROLE[stageKey];
  if (!required) return false; // terminal stages, or a stage nobody is assigned to

  if (profile.role === "admin") {
    return profile.submitterId == null || profile.submitterId === planSubmitterId;
  }
  if (profile.role !== required) return false;
  return profile.submitterId == null || profile.submitterId === planSubmitterId;
}

export interface ActingIdentity extends StageActor {
  /** Set when this identity comes from a delegation, not the viewer's own account. */
  onBehalfOf?: { id: string; name: string };
}

/** The viewer's own identity plus one borrowed identity per active delegation they've received. */
export function resolveActingIdentities(profile: StageActor, received: Delegation[]): ActingIdentity[] {
  return [
    profile,
    ...received.map((d) => ({
      role: d.role,
      submitterId: d.submitterId,
      onBehalfOf: { id: d.delegatorId, name: d.delegatorName },
    })),
  ];
}

/** First identity (own, or a borrowed one) that's actually authorized to act on this stage. */
export function canActOnStageAs(identities: ActingIdentity[], stageKey: string, planSubmitterId: string): ActingIdentity | null {
  return identities.find((id) => canActOnStage(id, stageKey, planSubmitterId)) ?? null;
}

/**
 * Extension point: today Committee Review resolves the instant one
 * authorized delegate approves or returns it — a quorum model was
 * deliberately not built (out of scope for now). To require N members'
 * approval later, this is the one place that changes: return `true` for the
 * stage(s) that need it, and have the caller count approvals-so-far against a
 * quorum before finalizing the move, instead of moving on the first action.
 */
export function requiresQuorum(stageKey: string): boolean {
  void stageKey; // not yet used — every stage is single-approver today
  return false;
}
