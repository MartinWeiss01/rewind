import { NextResponse } from "next/server";
import { getRequestContext } from "@/server/request-context";

/** Downloads everything Rewind stores about the viewer as JSON. */
export async function GET() {
  const { source, now } = await getRequestContext();
  const data = await source.exportData();
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="rewind-export-${now.toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
