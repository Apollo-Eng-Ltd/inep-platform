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
// database-enforced one. See the delegation note in pipeline/actions.ts for
// the one piece that couldn't be built at all without new schema.
import type { Role } from "./auth";

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
