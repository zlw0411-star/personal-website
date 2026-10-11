import { getLifePasswordConfigured, setLifePassword } from "@/lib/server/life-auth";
import { error, json, requireAdmin } from "@/lib/server/http";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try { return json({ configured: await getLifePasswordConfigured() }, 200, headers); }
  catch { return error("无法读取生活密码状态。", 500, headers); }
}
export async function HEAD(request: Request) { const response = await GET(request); return new Response(null, { status: response.status, headers: response.headers }); }
export async function PUT(request: Request) {
  const denied = await requireAdmin(request, true); if (denied) return denied;
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2048) return error("请求内容过大。", 413, headers);
  let value: unknown;
  try { const raw = await request.text(); if (raw.length > 2048) return error("请求内容过大。", 413, headers); value = JSON.parse(raw); }
  catch { return error("请求格式无效。", 400, headers); }
  if (typeof value !== "object" || value === null || Array.isArray(value) || typeof (value as Record<string, unknown>).password !== "string") return error("密码格式无效。", 400, headers);
  const password = (value as { password: string }).password;
  if (password.length < 8 || password.length > 256) return error("密码长度需为 8 至 256 个字符。", 400, headers);
  try { await setLifePassword(password); return json({ ok: true, configured: true }, 200, headers); }
  catch { return error("无法保存生活密码。", 500, headers); }
}
