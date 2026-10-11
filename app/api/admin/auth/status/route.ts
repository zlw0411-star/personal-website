import { getAdminAccessState } from "@/lib/server/admin-auth";
import { error, json, requireLocalAdmin } from "@/lib/server/http";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: Request) {
  const denied = requireLocalAdmin(request);
  if (denied) return denied;
  try { return json(await getAdminAccessState(request.headers.get("cookie")), 200, headers); }
  catch { return error("无法读取管理登录状态。", 500, headers); }
}
export async function HEAD(request: Request) {
  const response = await GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
