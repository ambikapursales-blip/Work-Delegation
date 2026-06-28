import { NextResponse } from "next/server";
import { ensureDbConnection } from "@/src/lib/route-adapter";

export async function GET() {
  await ensureDbConnection();
  return NextResponse.json({
    status: "OK",
    message: "FMS API is running",
    timestamp: new Date(),
  });
}
