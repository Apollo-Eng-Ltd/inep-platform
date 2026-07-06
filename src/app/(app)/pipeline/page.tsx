import Link from "next/link";
import { requireProfile, isNational } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page";
import { PipelineCard, type PipelineCardData } from "@/components/pipeline-card";
import { one } from "@/lib/rel";
import { cn } from "@/lib/utils";

const TYPES = [
  { key: "county", label: "Counties" },
  { key: "national_provider", label: "Providers" },
  { key: "private_sector", label: "Private / PBO" },
] as const;

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const profile = await requireProfile();
  const canManage = isNational(profile.role);
  const { type: typeParam } = await searchParams;
  const type = TYPES.some((t) => t.key === typeParam) ? typeParam! : "county";

  const supabase = await createClient();

  const { data: stages } = await supabase
    .from("workflow_stages")
    .select("id, name, sort_order, is_terminal")
    .eq("submitter_type", type)
    .order("sort_order");
  const stageList = stages ?? [];
  const maxOrder = Math.max(...stageList.map((s) => s.sort_order), 0);

  const { data: subs } = await supabase
    .from("submissions")
    .select("id, title, current_stage_id, submitter:submitters!inner(name, type)")
    .eq("submitter.type", type)
    .eq("period_year", 2025)
    .limit(200);

  // open flags per submission
  const { data: flags } = await supabase
    .from("validation_results")
    .select("submission_id")
    .eq("status", "open");
  const flagCount = new Map<string, number>();
  for (const f of flags ?? []) flagCount.set(f.submission_id, (flagCount.get(f.submission_id) ?? 0) + 1);

  const stageOrderById = new Map(stageList.map((s) => [s.id, s.sort_order]));
  const cardsByStage = new Map<string, PipelineCardData[]>();
  for (const s of subs ?? []) {
    const submitter = one<{ name: string; type: string }>(s.submitter);
    const order = s.current_stage_id ? stageOrderById.get(s.current_stage_id) ?? 0 : 0;
    const card: PipelineCardData = {
      id: s.id,
      title: s.title,
      submitterName: submitter?.name ?? "—",
      submitterType: submitter?.type ?? type,
      flags: flagCount.get(s.id) ?? 0,
      canAdvance: order < maxOrder,
      canReturn: order > 0,
    };
    const key = s.current_stage_id ?? stageList[0]?.id ?? "";
    const arr = cardsByStage.get(key) ?? [];
    arr.push(card);
    cardsByStage.set(key, arr);
  }

  return (
    <>
      <PageHeader
        title="Plan pipeline board"
        description="Every plan as a card moving through its real approval stages. Cards can move backward with a comment, just like a real committee sending work back."
      />

      {/* Type filter */}
      <div className="inline-flex rounded-xl bg-muted p-1 mb-6">
        {TYPES.map((t) => (
          <Link
            key={t.key}
            href={`/pipeline?type=${t.key}`}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-sm transition-all duration-150",
              type === t.key
                ? "bg-card text-foreground font-medium shadow-sm ring-1 ring-foreground/[0.06]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stageList.map((stage) => {
          const cards = cardsByStage.get(stage.id) ?? [];
          return (
            <div key={stage.id} className="w-64 shrink-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      stage.is_terminal ? "bg-success" : "bg-muted-foreground/40"
                    )}
                  />
                  <h3 className="text-sm font-medium">{stage.name}</h3>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{cards.length}</span>
              </div>
              <div className="space-y-2.5">
                {cards.map((c) => (
                  <PipelineCard key={c.id} card={c} canManage={canManage} />
                ))}
                {cards.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
