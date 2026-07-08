// Builds the rows behind the Excel(-shaped) template: one row per indicator,
// grouped by sector, with the county's own last-reported value where we have
// it. Shared by the CSV download route and the in-app preview dialog so both
// always show the same columns.
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";

export interface TemplateRow {
  sector: string;
  indicator: string;
  unit: string;
  lastYear: number | null;
}

export async function getTemplateRows(submitterId: string | null | undefined): Promise<TemplateRow[]> {
  const supabase = await createClient();

  const { data: indicators } = await supabase
    .from("indicators")
    .select("id, name, unit, sort_order, sector:sectors(name, sort_order)")
    .order("sort_order");

  const lastYearByIndicatorId = new Map<string, number>();
  if (submitterId) {
    const { data: prevReport } = await supabase
      .from("submissions")
      .select("id")
      .eq("submitter_id", submitterId)
      .eq("submission_type", "annual_report")
      .order("period_year", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevReport) {
      const { data: values } = await supabase
        .from("submission_values")
        .select("indicator_id, value")
        .eq("submission_id", prevReport.id);
      (values ?? []).forEach((v) => {
        if (v.value != null) lastYearByIndicatorId.set(v.indicator_id, v.value as number);
      });
    }
  }

  return (indicators ?? [])
    .map((i) => {
      const sector = one<{ name: string; sort_order: number }>(i.sector);
      return {
        sector: sector?.name ?? "",
        sectorOrder: sector?.sort_order ?? 0,
        indicatorOrder: i.sort_order,
        indicator: i.name,
        unit: i.unit,
        lastYear: lastYearByIndicatorId.get(i.id) ?? null,
      };
    })
    .sort((a, b) => a.sectorOrder - b.sectorOrder || a.indicatorOrder - b.indicatorOrder)
    .map(({ sector, indicator, unit, lastYear }) => ({ sector, indicator, unit, lastYear }));
}
