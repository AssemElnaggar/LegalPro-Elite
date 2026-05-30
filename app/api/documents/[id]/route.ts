import { eq } from "drizzle-orm";
import fs from "node:fs/promises";

import { db } from "@/db";
import { documents } from "@/db/schema";
import { getSessionContext, getUploadPath, hasPermission } from "@/lib/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const context = await getSessionContext();
  if (!context) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(context, "documents", "view")) {
    return Response.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const [record] = await db.select().from(documents).where(eq(documents.id, id));
  if (!record) {
    return Response.json({ ok: false, message: "Not found" }, { status: 404 });
  }

  try {
    const file = await fs.readFile(getUploadPath(record.storedName));
    const url = new URL(request.url);
    const download = url.searchParams.get("download") === "1";
    const disposition = download ? "attachment" : "inline";

    return new Response(file, {
      headers: {
        "Content-Type": record.mimeType,
        "Content-Length": String(record.size),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(record.originalName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json({ ok: false, message: "File missing" }, { status: 404 });
  }
}
