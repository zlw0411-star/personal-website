import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createEntryAndApplyLatest } from "../lib/client/entry-save.ts";

const input = {
  category: "learning", status: "draft", visibility: "private", title: "A draft", summary: "",
  projectUrl: "", repositoryUrl: "", coverId: null,
  body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Original text" }] }] },
};
const latest = { ...input, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Edited after uncertain save" }] }] } };
const stored = new Map();
const submitted = [];
let loseNextResponse = false;
let corruptNextJson = false;
let nullNextJson = false;
let rejectNextAsUnauthorized = false;
let rejectNextAsConflict = false;

function response(entry, status) {
  return { ok: status >= 200 && status < 300, status, json: async () => ({ entry }) };
}

async function fakeFetch(path, init) {
  const key = new Headers(init.headers).get("Idempotency-Key");
  const body = JSON.parse(init.body);
  submitted.push({ path, key, body: structuredClone(body), method: init.method });
  if (rejectNextAsUnauthorized) { rejectNextAsUnauthorized = false; return { ok: false, status: 401, json: async () => ({ error: "Management session expired" }) }; }
  if (rejectNextAsConflict) { rejectNextAsConflict = false; return { ok: false, status: 409, json: async () => ({ error: "Conflict" }) }; }
  if (init.method === "POST") {
    const existing = stored.get(key);
    if (existing && JSON.stringify(existing.input) !== JSON.stringify(body)) return response(undefined, 409);
    const record = existing ?? { id: key, input: body };
    stored.set(key, record);
    if (loseNextResponse) { loseNextResponse = false; throw new TypeError("simulated lost response"); }
    if (corruptNextJson) { corruptNextJson = false; return { ok: true, status: 201, json: async () => { throw new SyntaxError("simulated truncated JSON"); } }; }
    if (nullNextJson) { nullNextJson = false; return { ok: true, status: 201, json: async () => null }; }
    return response(record, existing ? 200 : 201);
  }
  const id = decodeURIComponent(path.split("/").at(-1));
  if (!stored.has(id)) return response(undefined, 404);
  stored.set(id, { id, input: body });
  return response(stored.get(id), 200);
}

const createId = randomUUID();
let recoveredId = null;
loseNextResponse = true;
await assert.rejects(createEntryAndApplyLatest(createId, input, input, id => { recoveredId = id; }, fakeFetch), TypeError);
assert.equal(recoveredId, null, "lost response does not mark the create as recovered");
const recovered = await createEntryAndApplyLatest(createId, input, latest, id => { recoveredId = id; }, fakeFetch);
assert.equal(recovered.id, createId);
assert.equal(recoveredId, createId);
assert.equal(stored.size, 1);
assert.equal(submitted[0].key, submitted[1].key);
assert.deepEqual(submitted[0].body, submitted[1].body);
assert.equal(stored.get(createId).input.body.content[0].content[0].text, "Edited after uncertain save");
assert.deepEqual(submitted.filter(item => item.key === createId || item.path.endsWith(`/${createId}`)).map(item => item.method), ["POST", "POST", "PUT"]);
assert.equal(stored.size, 1);

const parseFailureId = randomUUID(), parseFailureInput = { ...input, title: "Unreadable response fixture" };
corruptNextJson = true;
await assert.rejects(createEntryAndApplyLatest(parseFailureId, parseFailureInput, parseFailureInput, () => {}, fakeFetch), { code: "ENTRY_RESPONSE_UNCERTAIN" });
const afterUnreadable = await createEntryAndApplyLatest(parseFailureId, parseFailureInput, parseFailureInput, () => {}, fakeFetch);
assert.equal(afterUnreadable.id, parseFailureId);
assert.equal(stored.size, 2);

const nullId = randomUUID(), nullInput = { ...input, title: "Null response fixture" };
nullNextJson = true;
await assert.rejects(createEntryAndApplyLatest(nullId, nullInput, nullInput, () => {}, fakeFetch), { code: "ENTRY_RESPONSE_UNCERTAIN" });
assert.equal((await createEntryAndApplyLatest(nullId, nullInput, nullInput, () => {}, fakeFetch)).id, nullId);

rejectNextAsUnauthorized = true;
await assert.rejects(createEntryAndApplyLatest(randomUUID(), input, input, () => {}, fakeFetch), { status: 401, message: "Management session expired" });
rejectNextAsConflict = true;
await assert.rejects(createEntryAndApplyLatest(randomUUID(), input, input, () => {}, fakeFetch), { status: 409, code: "ENTRY_CREATE_CONFLICT" });

console.log("✓ entry creation retries keep the same key and payload, recover unreadable responses, and preserve later edits");
