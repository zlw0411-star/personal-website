import { randomUUID } from 'node:crypto';
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'http://127.0.0.1:5173';
const DIR = fileURLToPath(new URL('../.sites-runtime/public-migration/', import.meta.url));
const DEFAULT_PROFILE = {
  siteName: '关于我', nickname: '你的昵称', bio: '记录生活，保持好奇，慢慢成长。',
  about: '这里将放下我的故事、兴趣，以及正在探索的方向。', experience: '',
  avatarId: null, email: '', links: [], contacts: [],
};
const LIMIT_MS = 15_000;
const fail = message => { throw new Error(message); };
const stable = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

async function readInput() {
  const chunks = []; let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 2048) fail('stdin JSON 超过 2048 字节。');
    chunks.push(chunk);
  }
  let input;
  try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail('stdin JSON 格式无效。'); }
  if (!isObject(input) || Object.keys(input).sort().join(',') !== 'password,targetOrigin'
      || typeof input.password !== 'string' || !input.password || input.password.length > 256
      || typeof input.targetOrigin !== 'string') fail('stdin 必须包含 password 和 targetOrigin。');
  let target;
  try { target = new URL(input.targetOrigin); } catch { fail('targetOrigin 必须是合法 HTTPS 根 origin。'); }
  if (target.protocol !== 'https:' || target.username || target.password || target.pathname !== '/'
      || target.search || target.hash || input.targetOrigin !== target.origin || target.origin === SOURCE) {
    fail('targetOrigin 必须是与本地源不同的 HTTPS 根 origin。');
  }
  return { password: input.password, targetOrigin: target.origin };
}

function cookieFrom(response) {
  const values = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''];
  return values.map(value => value.split(';', 1)[0]).filter(value => value.includes('=')).join('; ');
}

async function call(origin, cookie, path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (cookie) headers.set('Cookie', cookie);
  const response = await fetch(`${origin}${path}`, {
    ...options, headers, redirect: 'error', signal: AbortSignal.timeout(LIMIT_MS),
  });
  return response;
}

async function jsonCall(origin, cookie, path, options = {}, expected = [200]) {
  const response = await call(origin, cookie, path, options);
  if (!expected.includes(response.status)) fail(`接口请求失败（${path}，HTTP ${response.status}）。`);
  try { return { response, data: await response.json() }; }
  catch { fail(`接口响应格式无效（${path}）。`); }
}

async function login(origin, password) {
  const response = await call(origin, '', '/api/admin/auth/login', {
    method: 'POST',
    headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) fail(`管理登录失败（HTTP ${response.status}）。`);
  const cookie = cookieFrom(response);
  if (!cookie) fail('登录成功但没有会话 cookie。');
  return cookie;
}

function readJournal(path, targetOrigin) {
  if (!existsSync(path)) return { version: 1, source: SOURCE, target: targetOrigin, entries: {}, media: {} };
  let journal;
  try { journal = JSON.parse(readFileSync(path, 'utf8')); } catch { fail('迁移 journal 无法读取；为保护恢复记录已停止。'); }
  if (!isObject(journal) || journal.version !== 1 || journal.source !== SOURCE || journal.target !== targetOrigin
      || !isObject(journal.entries) || !isObject(journal.media)) fail('迁移 journal 格式或目标不匹配；为保护恢复记录已停止。');
  for (const [key, value] of Object.entries(journal.entries)) if (!key || typeof value !== 'string' || !value) fail('迁移 journal 的条目映射无效。');
  for (const [key, value] of Object.entries(journal.media)) if (!key || typeof value !== 'string' || !value) fail('迁移 journal 的媒体映射无效。');
  return journal;
}

function writeJournal(path, journal) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, `${JSON.stringify(journal, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    renameSync(temp, path);
  } catch (error) {
    try { if (existsSync(temp)) unlinkSync(temp); } catch {}
    throw error;
  }
}

function requireProfile(value) {
  if (!value?.profile || !isObject(value.profile)) fail('管理资料响应无效。');
  return value.profile;
}

async function adminProfile(origin, cookie) {
  return requireProfile((await jsonCall(origin, cookie, '/api/admin/profile')).data);
}

async function adminEntries(origin, cookie) {
  const data = (await jsonCall(origin, cookie, '/api/admin/entries')).data;
  if (!Array.isArray(data.entries)) fail('管理条目列表响应无效。');
  return data.entries;
}

function collectMedia(profile, entries) {
  const ids = new Set();
  const add = value => {
    if (value == null || value === '') return;
    if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) fail('源内容含无效媒体 ID。');
    ids.add(value);
  };
  add(profile.avatarId);
  const visit = node => {
    if (!isObject(node)) return;
    if (node.type === 'image') {
      const attrs = isObject(node.attrs) ? node.attrs : {};
      if (attrs.mediaId !== undefined) add(attrs.mediaId);
      else if (typeof attrs.src === 'string') {
        const match = attrs.src.match(/^\/api\/(?:admin\/)?media\/([0-9a-f-]{36})$/i);
        if (!match) fail('源图片未引用本站媒体。');
        add(match[1]);
      } else fail('源图片缺少媒体 ID。');
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  for (const entry of entries) {
    add(entry.coverId);
    visit(entry.body);
  }
  return [...ids];
}

function profilePayload(profile, avatarId) {
  return {
    siteName: profile.siteName, nickname: profile.nickname, bio: profile.bio,
    about: profile.about, experience: profile.experience, avatarId,
    email: profile.email, links: profile.links, contacts: profile.contacts,
  };
}

function rewriteDoc(node, mediaMap) {
  if (!isObject(node)) fail('源正文格式无效。');
  const output = { ...node };
  if (node.type === 'image') {
    const attrs = isObject(node.attrs) ? { ...node.attrs } : {};
    const fromAttr = attrs.mediaId;
    const fromSrc = typeof attrs.src === 'string' ? attrs.src.match(/^\/api\/(?:admin\/)?media\/([0-9a-f-]{36})$/i)?.[1] : null;
    const sourceId = fromAttr ?? fromSrc;
    if (typeof sourceId !== 'string' || !mediaMap[sourceId]) fail('正文图片缺少已迁移的媒体映射。');
    attrs.mediaId = mediaMap[sourceId];
    attrs.src = `/api/media/${mediaMap[sourceId]}`;
    output.attrs = attrs;
  }
  if (Array.isArray(node.content)) output.content = node.content.map(child => rewriteDoc(child, mediaMap));
  return output;
}

async function uploadMedia(sourceCookie, targetOrigin, targetCookie, sourceId) {
  const source = await call(SOURCE, sourceCookie, `/api/admin/media/${sourceId}`);
  if (!source.ok) fail(`源媒体读取失败（HTTP ${source.status}）。`);
  const mime = source.headers.get('content-type')?.split(';', 1)[0] ?? '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) fail('源媒体不是支持的图片类型。');
  const bytes = await source.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) fail('源图片为空或超过 10 MB。');
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), `migration.${mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]}`);
  const { data } = await jsonCall(targetOrigin, targetCookie, '/api/admin/media', {
    method: 'POST', headers: { Origin: targetOrigin, 'Sec-Fetch-Site': 'same-origin' }, body: form,
  }, [201]);
  if (typeof data.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(data.id)) fail('目标媒体上传响应无效。');
  return data.id;
}

async function verifyMappedMedia(origin, cookie, id) {
  const response = await call(origin, cookie, `/api/admin/media/${id}`);
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) fail('目标媒体映射无法验证。');
  await response.body?.cancel();
}

async function logout(origin, cookie) {
  if (!cookie) return;
  try {
    await call(origin, cookie, '/api/admin/auth/logout', {
      method: 'POST', headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin' },
    });
  } catch {}
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  const lockPath = join(DIR, 'migration.lock');
  let lockFd, ownsLock = false, sourceCookie = '', targetCookie = '';
  let targetOrigin = '';
  const result = { status: 'started', sourceEntries: 0, publicCount: 0, draftCount: 0, migratedEntries: 0, migratedMedia: 0, profileVerified: false, avatarVerified: false, snapshot: null, journal: null };
  try {
    lockFd = openSync(lockPath, 'wx', 0o600); ownsLock = true;
    const input = await readInput();
    const password = input.password;
    targetOrigin = input.targetOrigin;
    const journalPath = join(DIR, 'journal.json');
    const journal = readJournal(journalPath, targetOrigin);
    result.journal = journalPath;
    sourceCookie = await login(SOURCE, password);
    targetCookie = await login(targetOrigin, password);

    const sourceProfile = await adminProfile(SOURCE, sourceCookie);
    const sourceSummaries = await adminEntries(SOURCE, sourceCookie);
    const sourceEntries = [];
    for (const summary of sourceSummaries) {
      if (typeof summary.id !== 'string') fail('源条目列表含无效 ID。');
      const { data } = await jsonCall(SOURCE, sourceCookie, `/api/admin/entries/${encodeURIComponent(summary.id)}`);
      if (!data.entry || data.entry.id !== summary.id) fail('源条目详情与列表不匹配。');
      sourceEntries.push(data.entry);
    }
    result.sourceEntries = sourceEntries.length;

    const snapshotPath = join(DIR, `local-snapshot-${randomUUID()}.json`);
    writeFileSync(snapshotPath, `${JSON.stringify({ profile: sourceProfile, entries: sourceEntries }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    result.snapshot = snapshotPath;

    let targetProfile = await adminProfile(targetOrigin, targetCookie);
    const initialTargetProfile = structuredClone(targetProfile);
    let targetEntries = await adminEntries(targetOrigin, targetCookie);
    const mappedTargetIds = new Set(Object.values(journal.entries));
    if (journalPath && existsSync(journalPath)) {
      if (targetEntries.some(entry => !mappedTargetIds.has(entry.id))) fail('目标含有 journal 未记录的条目；为避免覆盖用户内容已停止。');
      if ([...mappedTargetIds].some(id => !targetEntries.some(entry => entry.id === id))) fail('journal 指向的目标条目已不存在；请先人工核对恢复状态。');
    } else if (targetEntries.length || stable(targetProfile) !== stable(DEFAULT_PROFILE)) {
      fail('首次迁移要求目标条目为空且个人资料为默认占位。');
    }
    if (!existsSync(journalPath)) writeJournal(journalPath, journal);

    const knownAvatarId = sourceProfile.avatarId ? journal.media[sourceProfile.avatarId] ?? null : null;
    const knownDesiredProfile = profilePayload(sourceProfile, knownAvatarId);
    if (stable(targetProfile) !== stable(DEFAULT_PROFILE) && stable(targetProfile) !== stable(knownDesiredProfile)) {
      fail('目标个人资料已改变；为避免覆盖用户改动已停止。');
    }

    const mediaIds = collectMedia(sourceProfile, sourceEntries);
    for (const sourceId of mediaIds) {
      if (journal.media[sourceId]) {
        await verifyMappedMedia(targetOrigin, targetCookie, journal.media[sourceId]);
        continue;
      }
      const targetId = await uploadMedia(sourceCookie, targetOrigin, targetCookie, sourceId);
      journal.media[sourceId] = targetId;
      writeJournal(journalPath, journal);
      result.migratedMedia++;
    }

    const desiredProfile = profilePayload(sourceProfile, sourceProfile.avatarId ? journal.media[sourceProfile.avatarId] : null);
    if (sourceProfile.avatarId && !desiredProfile.avatarId) fail('头像媒体映射缺失。');
    const currentIsDesired = stable(targetProfile) === stable(desiredProfile);
    if (!currentIsDesired && stable(targetProfile) !== stable(DEFAULT_PROFILE)) fail('目标个人资料已改变；为避免覆盖用户改动已停止。');

    const rewritten = sourceEntries.map(entry => ({
      source: entry,
      input: {
        category: entry.category,
        title: entry.title,
        summary: entry.summary,
        body: rewriteDoc(entry.body, journal.media),
        coverId: entry.coverId ? journal.media[entry.coverId] : null,
        status: entry.status,
        visibility: entry.category === 'life' ? 'private' : entry.visibility,
        projectUrl: entry.projectUrl,
        repositoryUrl: entry.repositoryUrl,
      },
    }));

    const targetById = new Map(targetEntries.map(entry => [entry.id, entry]));
    for (const { source, input } of [...rewritten].reverse()) {
      const existingId = journal.entries[source.id];
      if (existingId) {
        if (!targetById.has(existingId)) fail('journal 映射的目标条目已不存在。');
        continue;
      }
      const { data } = await jsonCall(targetOrigin, targetCookie, '/api/admin/entries', {
        method: 'POST', headers: { Origin: targetOrigin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }, [201]);
      if (!data.entry?.id) fail('目标条目创建响应无 ID；结果可能不确定，请人工核对 journal 后再继续。');
      journal.entries[source.id] = data.entry.id;
      writeJournal(journalPath, journal);
      result.migratedEntries++;
    }

    targetProfile = await adminProfile(targetOrigin, targetCookie);
    if (stable(targetProfile) !== stable(desiredProfile)) {
      if (stable(targetProfile) !== stable(initialTargetProfile)) fail('写入 profile 前目标资料已并发变化；为避免覆盖已停止。');
      const beforePut = await adminProfile(targetOrigin, targetCookie);
      if (stable(beforePut) !== stable(initialTargetProfile)) fail('写入 profile 前检测到并发变化；为避免覆盖已停止。');
      const latestSourceProfile = await adminProfile(SOURCE, sourceCookie);
      if (stable(latestSourceProfile) !== stable(sourceProfile)) fail('写入 profile 前本地资料已变化；为避免覆盖已停止。');
      await jsonCall(targetOrigin, targetCookie, '/api/admin/profile', {
        method: 'PUT', headers: { Origin: targetOrigin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' },
        body: JSON.stringify(desiredProfile),
      });
    }

    const finalProfile = requireProfile((await jsonCall(targetOrigin, '', '/api/profile')).data);
    if (stable(finalProfile) !== stable(desiredProfile)) fail('匿名 profile 校验失败。');
    result.profileVerified = true;
    if (desiredProfile.avatarId) {
      const avatar = await call(targetOrigin, '', `/api/media/${desiredProfile.avatarId}`);
      if (!avatar.ok || !avatar.headers.get('content-type')?.startsWith('image/')) fail('匿名头像校验失败。');
      await avatar.body?.cancel();
    }
    result.avatarVerified = true;

    targetEntries = await adminEntries(targetOrigin, targetCookie);
    const finalById = new Map(targetEntries.map(entry => [entry.id, entry]));
    const migratedIds = Object.values(journal.entries);
    if (migratedIds.some(id => !finalById.has(id))) fail('最终管理条目列表缺少迁移项。');
    const expectedPublic = rewritten.filter(({ input }) => input.status === 'published' && input.visibility === 'public' && input.category !== 'life');
    const expectedDraft = rewritten.filter(({ input }) => input.status === 'draft');
    const publicListData = (await jsonCall(targetOrigin, '', '/api/entries')).data;
    if (!Array.isArray(publicListData.entries)) fail('匿名公开条目列表响应无效。');
    const expectedPublicIds = new Set(expectedPublic.map(({ source }) => journal.entries[source.id]));
    if (publicListData.entries.length !== expectedPublicIds.size || publicListData.entries.some(entry => !expectedPublicIds.has(entry.id))) fail('匿名公开条目数量或 ID 校验失败。');
    for (const { source, input } of rewritten) {
      const id = journal.entries[source.id], stored = finalById.get(id);
      if (!stored || stored.status !== input.status || stored.visibility !== input.visibility || stored.category !== input.category) fail('目标条目的发布状态或分类校验失败。');
      const detail = (await jsonCall(targetOrigin, targetCookie, `/api/admin/entries/${encodeURIComponent(id)}`)).data.entry;
      if (!detail || ['title', 'summary', 'body', 'coverId', 'status', 'visibility', 'projectUrl', 'repositoryUrl']
          .some(field => stable(detail[field]) !== stable(input[field])) || detail.category !== input.category) fail('目标条目内容校验失败。');
      const publicResponse = await call(targetOrigin, '', `/api/entries/${encodeURIComponent(id)}`);
      if (expectedPublicIds.has(id) ? !publicResponse.ok : publicResponse.status !== 404) fail('匿名条目可见性校验失败。');
    }
    result.publicCount = expectedPublic.length;
    result.draftCount = expectedDraft.length;
    result.migratedEntries = Object.keys(journal.entries).length;
    result.migratedMedia = Object.keys(journal.media).length;
    result.status = 'complete';
  } catch (error) {
    result.status = 'partial-or-failed';
    result.error = error instanceof Error ? error.message : '迁移失败。';
  } finally {
    await logout(SOURCE, sourceCookie);
    await logout(targetOrigin, targetCookie);
    if (lockFd !== undefined) { try { closeSync(lockFd); } catch {} }
    if (ownsLock) { try { unlinkSync(lockPath); } catch {} }
    const resultPath = join(DIR, 'result.json');
    if (ownsLock) {
      try { writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 }); } catch { result.status = 'result-write-failed'; }
    }
    const { error, ...safe } = result;
    console.log(JSON.stringify({ ...safe, ...(error ? { error } : {}), ...(ownsLock ? { result: resultPath } : {}) }));
  }
}

await main();
