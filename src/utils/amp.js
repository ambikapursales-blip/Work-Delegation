const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export function ampCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "AMP-Access-Control-Allow-Source-Origin": FRONTEND_URL,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };
}

export function ampJsonResponse(data, init) {
  return Response.json(data, {
    ...init,
    headers: { ...ampCorsHeaders(), ...init?.headers },
  });
}
