import { lifeSessionClearCookie, revokeLifeSession } from "@/lib/server/life-auth";
import { error, json, sameOriginMutation } from "@/lib/server/http";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return error("请求来源无效。", 403, headers);
  try {
    await revokeLifeSession(request.headers.get("cookie"));
    return json({ ok: true }, 200, { ...headers, "Set-Cookie": lifeSessionClearCookie(request) });
  } catch { return error("无法锁定生活栏目。", 500, headers); }
}
