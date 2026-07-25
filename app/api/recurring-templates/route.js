import { NextResponse } from "next/server";
import {
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import {
  getTemplates,
  createTemplate,
} from "@/src/controllers/recurringTemplateController";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());
    
    const result = await getTemplates({ user, query });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  if (user.role !== "Super Admin" && !user.canAssignTasks) {
    return NextResponse.json(
      { success: false, message: "Not authorized to create templates" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const result = await createTemplate({ user, body });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
