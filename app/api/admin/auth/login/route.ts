import { adminSessionSetCookie, verifyAdminPassword } from "@/lib/server/admin-auth";
import { error, json, requireLocalAdmin, sameOriginMutation } from "@/lib/server/http";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function POST(request: Request) {
  const denied = requireLocalAdmin(request);
  if (denied) return denied;
  if (!sameOriginMutation(request)) return error("Forbidden", 403, headers);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2048) return error("请求内容过大。", 413, headers);
  let value: unknown;
  try { const raw = await request.text(); if (raw.length > 2048) return error("请求内容过大。", 413, headers); value = JSON.parse(raw); }
  catch { return error("请求格式无效。", 400, headers); }
  if (typeof value !== "object" || value === null || Array.isArray(value) || typeof (value as Record<string, unknown>).password !== "string") return error("密码格式无效。", 400, headers);
  const password = (value as { password: string }).password;
  if (password.length > 256) return error("密码长度无效。", 400, headers);
  try {
    const result = await verifyAdminPassword(password);
    if (result.status === "unconfigured") return error("管理密码尚未配置。", 503, headers);
    if (result.status === "locked") return error("尝试次数过多，请稍后重试。", 429, { ...headers, "Retry-After": String(result.retryAfter) });
    if (result.status === "wrong") return error("管理密码不正确。", 401, headers);
    if (result.status === "ok") return json({ ok: true }, 200, { ...headers, "Set-Cookie": adminSessionSetCookie(result.token, request) });
    return error("管理登录失败。", 401, headers);
  } catch { return error("管理登录暂时不可用。", 500, headers); }
}
