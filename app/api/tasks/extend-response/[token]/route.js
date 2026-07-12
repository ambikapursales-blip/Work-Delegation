import { NextResponse } from "next/server";
import { ensureDbConnection } from "@/src/lib/route-adapter";
import { verifyExtensionResponseToken } from "@/src/utils/extensionResponseToken";
import { processExtensionResponse } from "@/src/utils/extensionActions";

function htmlResponse(message, success) {
  const icon = success
    ? `<svg style="width:48px;height:48px;margin:0 auto 16px;display:block" viewBox="0 0 24 24" fill="none" stroke="#1F7A5C" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg style="width:48px;height:48px;margin:0 auto 16px;display:block" viewBox="0 0 24 24" fill="none" stroke="#A32424" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const color = success ? "#1F7A5C" : "#A32424";
  const title = success ? "Request Processed" : "Request Failed";

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>
  body{margin:0;padding:0;background:#F6F4EF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{background:#FFF;border-radius:8px;padding:40px;max-width:420px;width:90%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  h1{font-size:20px;font-weight:bold;color:#12161C;margin:0 0 8px}
  p{font-size:14px;color:#2A2620;line-height:1.6;margin:0}
  .bar{height:4px;background:${color};border-radius:4px 4px 0 0;margin:-40px -40px 24px}
</style>
</head>
<body><div class="card"><div class="bar"></div>${icon}<h1>${title}</h1><p>${message}</p></div></body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

export async function GET(request, { params }) {
  const { token } = params;

  try {
    const decoded = verifyExtensionResponseToken(token);
    if (decoded.purpose !== "extension_response") {
      return htmlResponse("Invalid token", false);
    }

    const { taskId, requestId, action } = decoded;

    if (action !== "approved" && action !== "rejected") {
      return htmlResponse("Invalid action", false);
    }

    await ensureDbConnection();

    const result = await processExtensionResponse(taskId, requestId, action);
    return htmlResponse(result.message, result.success);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return htmlResponse("This link has expired", false);
    }
    if (err.name === "JsonWebTokenError") {
      return htmlResponse("Invalid link", false);
    }
    return htmlResponse("Something went wrong", false);
  }
}
