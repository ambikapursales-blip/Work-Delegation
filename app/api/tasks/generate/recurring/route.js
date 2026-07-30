import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: "Direct task creation has been deprecated. Create tasks from Master Tasks.",
    },
    { status: 410 },
  );
}
