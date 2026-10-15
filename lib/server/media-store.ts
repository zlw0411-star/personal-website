// 图片存储适配层。
//
// 站点原本把图片放在 R2（`env.BUCKET`）。R2 需要单独开通订阅并绑定支付方式，Workers 免费
// 计划无法直接使用，因此改用同样包含在免费计划内的 KV（`env.MEDIA`）。两者差异收敛在这一层，
// 路由只依赖 put / get / delete 三个方法，将来若要换回 R2 或换到别处，只改这个文件。
//
// 与 R2 的行为差异：
// - KV 是最终一致的，写入后其他地区最长约 60 秒才可见；同一地区通常立即可见。
// - KV 单个值上限 25 MiB，免费计划总存储 1 GB、每天 1000 次写操作。

export interface MediaStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<ReadableStream | null>;
  delete(key: string): Promise<void>;
}

// 上传接口已限制 10 MB；这里再挡一次，避免把 KV 自身的报错直接暴露给用户。
const MAX_VALUE_BYTES = 25 * 1024 * 1024;

export function getMediaStore(namespace: KVNamespace | undefined): MediaStore | null {
  if (!namespace) return null;

  return {
    async put(key, bytes, contentType) {
      if (bytes.byteLength > MAX_VALUE_BYTES) {
        throw new Error("媒体文件超出存储单值上限。");
      }
      await namespace.put(key, bytes, { metadata: { contentType } });
    },
    async get(key) {
      return await namespace.get(key, "stream");
    },
    async delete(key) {
      await namespace.delete(key);
    },
  };
}
