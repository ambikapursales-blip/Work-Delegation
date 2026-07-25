import { NextResponse } from "next/server";
import {
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import {
  getTemplateOccurrences,
} from "@/src/controllers/recurringTemplateController";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());
    const result = await getTemplateOccurrences({ user, params, query });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
