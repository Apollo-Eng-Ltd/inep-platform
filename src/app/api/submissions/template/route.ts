import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { getTemplateRows } from "@/lib/submission-template";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const profile = await requireProfile();
  const rows = await getTemplateRows(profile.submitter?.id);

  const header = ["Sector", "Technology / Fuel Type", "This Year's Value", "Last Year's Value"];
  const csv = [header, ...rows.map((r) => [r.sector, r.indicator, "", r.lastYear ?? ""])]
    .map((cols) => cols.map(csvCell).join(","))
    .join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="inep-submission-template.csv"',
    },
  });
}
