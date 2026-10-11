import { adminSessionClearCookie, revokeAdminSession } from "@/lib/server/admin-auth";
import { error, json, requireLocalAdmin, sameOriginMutation } from "@/lib/server/http";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function POST(request: Request) {
  const denied = requireLocalAdmin(request);
  if (denied) return denied;
  if (!sameOriginMutation(request)) return error("Forbidden", 403, headers);
  try {
    await revokeAdminSession(request.headers.get("cookie"));
    return json({ ok: true }, 200, { ...headers, "Set-Cookie": adminSessionClearCookie(request) });
  } catch { return error("无法结束管理会话。", 500, headers); }
}
