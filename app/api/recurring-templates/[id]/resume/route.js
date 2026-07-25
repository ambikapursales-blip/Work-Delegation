import { NextResponse } from "next/server";
import {
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import {
  resumeTemplate,
} from "@/src/controllers/recurringTemplateController";

export async function POST(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const result = await resumeTemplate({ user, params });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
