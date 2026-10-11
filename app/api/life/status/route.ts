import { getLifeAccessState } from "@/lib/server/life-auth";
import { error, json } from "@/lib/server/http";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: Request) {
  try { return json(await getLifeAccessState(request.headers.get("cookie")), 200, headers); }
  catch { return error("无法读取生活访问状态。", 500, headers); }
}
export async function HEAD(request: Request) {
  const response = await GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
