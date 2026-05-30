import * as XLSX from "xlsx";

import { getReportDataset, getSessionContext, hasPermission } from "@/lib/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ type: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const context = await getSessionContext();
  if (!context) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(context, "reports", "view")) {
    return Response.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const { type } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const dataset = await getReportDataset(type);

  if (format === "json") {
    return Response.json(dataset);
  }

  if (format === "xlsx") {
    if (!hasPermission(context, "reports", "export")) {
      return Response.json({ ok: false, message: "Export forbidden" }, { status: 403 });
    }

    const workbook = XLSX.utils.book_new();
    const titleSafe = sanitize(dataset.title).slice(0, 25) || "report";
    const worksheet = XLSX.utils.aoa_to_sheet([dataset.columns, ...dataset.rows]);
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["Metric", "Value"],
      ...dataset.summary.map((item) => [sanitize(item.label), item.value]),
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, titleSafe);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="legalpro-${type}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return Response.json({ ok: false, message: "Invalid format" }, { status: 400 });
}

function sanitize(value: string) {
  return value.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
}
