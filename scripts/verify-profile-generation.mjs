import assert from "node:assert/strict";
import { parseContacts } from "../lib/contact-utils.ts";
import { profileContacts } from "../lib/content-types.ts";
import { extractEntryText, generateProfile } from "../lib/server/profile-generation.ts";

function entry({ id, title, category = "learning", summary = "", content = [], status = "published", visibility = "public" }) {
  return { id, title, category, summary, body: { type: "doc", content }, status, visibility, coverId: null, projectUrl: "", repositoryUrl: "", createdAt: "2026-01-01", updatedAt: "2026-01-01", publishedAt: null };
}
function paragraph(text) { return { type: "paragraph", content: [{ type: "text", text }] }; }

const rich = entry({ id: "rich", title: "研究助理", summary: "", content: [
  paragraph("第一段事实。"), paragraph("第二段事实。"),
  { type: "image", attrs: { src: "https://invalid.example/private.jpg", alt: "不可采图片属性" } },
  { type: "codeBlock", content: [{ type: "text", text: "不可采代码文字" }] },
  { type: "paragraph", content: [{ type: "text", text: "链接文字", marks: [{ type: "link", attrs: { href: "https://invalid.example/private" } }] }] },
] });
const richResult = generateProfile([rich]);
const richText = extractEntryText(rich);
assert.match(richText, /第一段事实。\n第二段事实。\n链接文字/u, "paragraphs and inline text stay readable and separated");
assert.doesNotMatch(richText, /不可采图片属性|不可采代码文字|invalid\.example/u, "image, code, and URL attributes are excluded");

const selected = [
  entry({ id: "e1", title: "大学求学", summary: "在甲校完成数学课程并参与实验室研究。此后继续课程学习。" }),
  entry({ id: "l1", title: "旅行记录", category: "life", summary: "记录一次很长的旅行生活。".repeat(100), visibility: "private" }),
  entry({ id: "e2", title: "实习", summary: "在乙单位参与数据整理与报告撰写。" }),
  entry({ id: "e3", title: "工作", summary: "负责每周维护团队内部资料。" }),
];
const generated = generateProfile(selected);
assert.ok(generated.about.includes("甲校") && generated.about.includes("乙单位"), "about prioritizes experience representatives");
assert.ok(generated.about.length <= 600 + 200 + 8, "about respects compact text budgets");
assert.ok(generated.experience.includes("大学求学：") && generated.experience.includes("实习：") && generated.experience.includes("工作："), "experience overview is organized by entry title");
assert.notEqual(generated.about, generated.experience, "about and experience overview serve distinct purposes");
const experienceOnly = generateProfile(selected.filter((item) => item.category !== "life"));
assert.ok(generated.about.startsWith(`${experienceOnly.about}\n`), "mixed about starts with the selected experience excerpt");
const lifeExcerpt = generated.about.slice(experienceOnly.about.length).trim();
assert.ok(lifeExcerpt.length > 0 && lifeExcerpt.length <= Math.floor(experienceOnly.about.length / 3), "life excerpt is present but no more than one third of experience text");
assert.equal(generated.sources.length, selected.length);
assert.deepEqual(generated.counts, { experience: 3, life: 1 });
assert.deepEqual(generated.weights, { experience: 3, life: 1 });

const long = generateProfile([entry({ id: "long", title: "一段长记录", summary: "甲".repeat(1000) })]);
assert.ok(long.about.startsWith("甲".repeat(32)) && long.about.endsWith("…") && long.about.length === 600, "long unpunctuated text produces a marked excerpt");
assert.ok(long.experience.startsWith("一段长记录：") && long.experience.length <= 1600, "overview remains bounded");
const many = generateProfile(Array.from({ length: 8 }, (_, index) => entry({ id: `many-${index}`, title: `记录${index}`, summary: `事实${index}。` + "乙".repeat(400) })));
assert.equal(many.experience.split("\n").length, 8, "overview budget is shared across up to eight entries");
assert.ok(Array.from({ length: 8 }, (_, index) => many.experience.includes(`记录${index}：`)).every(Boolean) && many.experience.length <= 1600, "all eight entries retain room under the shared overview budget");
assert.equal(many.about.split("\n").length, 6, "about shares its budget across six representative sentences");
assert.ok(Array.from({ length: 6 }, (_, index) => many.about.includes(`事实${index}。`)).every(Boolean), "the first six experience entries each contribute to about");
const emojiExcerpt = generateProfile([entry({ id: "emoji", title: "Emoji", summary: "🙂".repeat(1000) })]);
assert.ok(emojiExcerpt.about.length <= 600 && emojiExcerpt.about.endsWith("…"), "excerpt budgets count UTF-16 units without splitting emoji");
const titleOnly = generateProfile([entry({ id: "title", title: "真实的岗位记录", summary: "" })]);
assert.equal(titleOnly.experience, "真实的岗位记录", "a real title is retained without a dangling separator when body and summary are empty");
const lifeOnly = generateProfile([entry({ id: "life", title: "生活", category: "life", summary: "记录周末散步和读书的日常。" })]);
assert.equal(lifeOnly.experience, "");
assert.ok(lifeOnly.about.includes("周末散步") && lifeOnly.about.length <= 180, "life-only selection produces a short introduction");
assert.deepEqual(generateProfile([]), { about: "", experience: "", sources: [], counts: { experience: 0, life: 0 }, weights: { experience: 3, life: 1 } });

const contacts = parseContacts([
  { kind: "email", label: " 工作邮箱 ", value: " person@example.com " },
  { kind: "phone", label: "电话", value: "+1 (555) 123-4567" },
  { kind: "link", label: "主页", value: "https://example.com/CaseSensitive" },
  { kind: "text", label: "备注", value: "仅文字" },
  { kind: "text", label: "", value: "" },
]);
assert.equal(contacts.length, 4, "all contact kinds validate and blank rows are removed");
assert.throws(() => parseContacts([{ kind: "phone", label: "电话", value: "555-abc" }]), /电话仅支持/u);
assert.throws(() => parseContacts([{ kind: "phone", label: "电话", value: "55+5123" }]), /需放在开头/u);
assert.throws(() => parseContacts([{ kind: "link", label: "主页", value: "javascript:alert(1)" }]), /仅支持 http 或 https/u);
assert.throws(() => parseContacts([{ kind: "text", label: "名称", value: "x".repeat(2049) }]), /联系方式格式或长度/u);
assert.throws(() => parseContacts(Array.from({ length: 31 }, () => ({ kind: "text", label: "备注", value: "文字" }))), /最多填写 30 项/u);

const mergedContacts = profileContacts({
  contacts: [
    { kind: "email", label: "工作", value: "Person@example.com" },
    { kind: "phone", label: "手机", value: "+1 555 123 4567" },
    { kind: "link", label: "主页", value: "https://example.com/CaseSensitive" },
    { kind: "link", label: "另一个地址", value: "https://example.com/casesensitive" },
  ],
  email: "person@EXAMPLE.com", links: [{ label: "主页副本", url: "https://example.com/CaseSensitive" }, { label: "旧链接", url: "https://legacy.example" }, { label: "旧邮箱", url: "mailto:other@example.com" }, { label: "带主题邮件", url: "mailto:other@example.com?subject=hello" }, { label: "旧文本", url: "custom:legacy-value" }],
});
assert.equal(mergedContacts.length, 8, "legacy email and links merge without duplicate values while preserving non-HTTP links");
assert.equal(mergedContacts[0].label, "工作", "new contact label takes precedence over legacy duplicate");
assert.ok(mergedContacts.some((contact) => contact.value === "https://example.com/casesensitive"), "link path casing is preserved");
assert.ok(mergedContacts.some((contact) => contact.kind === "email" && contact.label === "旧邮箱" && contact.value === "other@example.com"), "simple legacy mailto values become email contacts");
assert.ok(mergedContacts.some((contact) => contact.kind === "text" && contact.value === "mailto:other@example.com?subject=hello"), "legacy mailto query strings are preserved as text");

console.log("✓ profile generation, weighting, rich-text filtering, empty states, and contact validation passed");
