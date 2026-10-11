import { verifyLifePassword, lifeSessionSetCookie } from "@/lib/server/life-auth";
import { error, json, sameOriginMutation } from "@/lib/server/http";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return error("请求来源无效。", 403, headers);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2048) return error("请求内容过大。", 413, headers);
  let value: unknown;
  try { const raw = await request.text(); if (raw.length > 2048) return error("请求内容过大。", 413, headers); value = JSON.parse(raw); }
  catch { return error("请求格式无效。", 400, headers); }
  if (typeof value !== "object" || value === null || Array.isArray(value) || typeof (value as Record<string, unknown>).password !== "string" || ((value as Record<string, unknown>).password as string).length > 256) return error("密码格式无效。", 400, headers);
  try {
    const result = await verifyLifePassword((value as { password: string }).password);
    if (result.status === "unconfigured") return error("生活密码尚未设置。", 503, headers);
    if (result.status === "locked") return error("尝试次数过多，请稍后再试。", 429, { ...headers, "Retry-After": String(result.retryAfter) });
    if (result.status !== "ok") return error("密码不正确。", 401, headers);
    return json({ ok: true }, 200, { ...headers, "Set-Cookie": lifeSessionSetCookie(result.token, request) });
  } catch { return error("无法验证生活密码，请稍后重试。", 500, headers); }
}
