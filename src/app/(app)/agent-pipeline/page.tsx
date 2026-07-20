import { requireProfile } from "@/lib/auth";
import { getAgentGraphFor } from "@/lib/agent-pipeline";
import { PageHeader } from "@/components/page";
import { AgentPipelineCanvas } from "./agent-pipeline-canvas";

const SCOPE_LABEL: Record<string, string> = {
  county_officer: "your county's",
  committee_member: "your review stage's",
  national_planner: "the national",
  admin: "the national",
};

export default async function AgentPipelinePage() {
  const profile = await requireProfile();
  const graph = await getAgentGraphFor(profile);
  const totalPending = graph.nodes.reduce((a, n) => a + n.pending.length, 0);

  return (
    <>
      <PageHeader
        title="Pipeline (Agents)"
        description={`Watching ${SCOPE_LABEL[profile.role] ?? "your"} agent activity live — every count and line here is a real, logged action.${
          totalPending > 0 ? ` ${totalPending} need${totalPending === 1 ? "s" : ""} your decision.` : ""
        }`}
      />
      <AgentPipelineCanvas graph={graph} />
    </>
  );
}
