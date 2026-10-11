import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { error, json, requireAdmin } from "@/lib/server/http";

export async function POST(request: Request) {
  const denied = await requireAdmin(request, true); if (denied) return denied;
  let uploadedKey: string | null = null;
  try {
    const form = await request.formData(), file = form.get("file");
    if (!(file instanceof File)) return error("请选择要上传的图片。");
    if (file.size < 1 || file.size > 10 * 1024 * 1024) return error("图片大小不能超过 10 MB。");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const isPng = bytes.length >= 8 && pngSignature.every((byte, index) => bytes[index] === byte);
    const isWebp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const mime = isJpeg ? "image/jpeg" : isPng ? "image/png" : isWebp ? "image/webp" : null;
    if (!mime) return error("仅支持有效的 JPG、PNG 或 WebP 图片。");
    if (!env.BUCKET) return error("媒体存储暂不可用。", 500);
    const id = crypto.randomUUID(), key = `${id}.${mime === "image/jpeg" ? "jpg" : mime.split("/")[1]}`;
    await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
    uploadedKey = key;
    await getDb().insert(media).values({ id, objectKey: key, mimeType: mime, size: bytes.length, createdAt: new Date().toISOString() });
    return json({ id, url: `/api/media/${id}`, adminUrl: `/api/admin/media/${id}` }, 201);
  } catch {
    if (uploadedKey && env.BUCKET) { try { await env.BUCKET.delete(uploadedKey); } catch { /* best-effort cleanup */ } }
    return error("图片上传失败，请稍后重试。", 500);
  }
}
