import type { Entry, EntryInput } from "@/lib/content-types";

export class EntrySaveError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code = "ENTRY_SAVE_FAILED") {
    super(message);
    this.name = "EntrySaveError";
    this.status = status;
    this.code = code;
  }
}

async function responseError(response: Response, fallback: string): Promise<EntrySaveError> {
  const detail: unknown = await response.json().catch(() => null);
  const message = detail && typeof detail === "object" && !Array.isArray(detail)
    && "error" in detail && typeof detail.error === "string" ? detail.error : fallback;
  const code = response.status === 401 ? "AUTH_REQUIRED" : response.status === 403 ? "FORBIDDEN" : "ENTRY_SAVE_FAILED";
  return new EntrySaveError(message, response.status, code);
}

export async function createEntryRequest(
  createId: string,
  input: EntryInput,
  fetcher: typeof fetch = fetch,
): Promise<Entry> {
  const response = await fetcher("/api/admin/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": createId },
    body: JSON.stringify(input),
  });
  if (response.status === 400) throw new EntrySaveError("请检查文章内容后重试。", 400, "ENTRY_VALIDATION");
  if (response.status === 409) throw new EntrySaveError("创建编号对应的内容已变化，系统未覆盖现有文章。当前草稿已保留；请先查看可能对应的文章再继续。", 409, "ENTRY_CREATE_CONFLICT");
  if (!response.ok) throw await responseError(response, response.status === 401 ? "管理登录已过期，请在新标签页登录后再保存。" : "保存失败");
  let data: { entry?: Entry } | null;
  try { data = await response.json() as { entry?: Entry } | null; }
  catch { throw new EntrySaveError("保存结果尚未确认，请再次保存以查询并恢复。", response.status, "ENTRY_RESPONSE_UNCERTAIN"); }
  if (!data || typeof data !== "object" || !data.entry || data.entry.id !== createId) {
    throw new EntrySaveError("保存结果尚未确认，请再次保存以查询并恢复。", response.status, "ENTRY_RESPONSE_UNCERTAIN");
  }
  return data.entry;
}

export async function updateEntryRequest(
  id: string,
  input: EntryInput,
  fetcher: typeof fetch = fetch,
): Promise<Entry> {
  const response = await fetcher(`/api/admin/entries/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.status === 401) throw new EntrySaveError("管理登录已过期，请在新标签页登录后再保存。", 401, "AUTH_REQUIRED");
  if (!response.ok) throw await responseError(response, "保存失败");
  let data: { entry?: Entry } | null;
  try { data = await response.json() as { entry?: Entry } | null; }
  catch { throw new EntrySaveError("保存结果尚未确认，请再次保存。", response.status, "ENTRY_RESPONSE_UNCERTAIN"); }
  if (!data || typeof data !== "object" || !data.entry || data.entry.id !== id) throw new EntrySaveError("保存结果尚未确认，请再次保存。", response.status, "ENTRY_RESPONSE_UNCERTAIN");
  return data.entry;
}

export async function createEntryAndApplyLatest(
  createId: string,
  original: EntryInput,
  latest: EntryInput,
  onCreated: (id: string) => void,
  fetcher: typeof fetch = fetch,
): Promise<Entry> {
  const entry = await createEntryRequest(createId, original, fetcher);
  onCreated(entry.id);
  return sameEntryInput(original, latest) ? entry : updateEntryRequest(entry.id, latest, fetcher);
}

export function sameEntryInput(left: EntryInput, right: EntryInput): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
