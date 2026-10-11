import type { Entry, ProfileGeneration, RichNode } from "@/lib/content-types";

const ABOUT_EXPERIENCE_BUDGET = 600;
const ABOUT_LIFE_BUDGET = 180;
const EXPERIENCE_OVERVIEW_BUDGET = 1600;
const MAX_ABOUT_ITEMS = 6;
const MAX_OVERVIEW_ITEMS = 8;
const SENTENCE_END = /(?<=[。！？!?；;])\s*|\n+/u;

function collectAllowedText(node: RichNode): string {
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (node.type === "image" || node.type === "codeBlock") return "";
  if (node.type === "hardBreak") return " ";
  if (!["doc", "paragraph", "heading", "listItem", "blockquote", "bulletList", "orderedList"].includes(node.type)) return "";
  const children = (node.content ?? []).map(collectAllowedText).filter(Boolean);
  const separator = ["paragraph", "heading"].includes(node.type) ? "" : "\n";
  return children.join(separator);
}

export function extractEntryText(entry: Entry): string {
  const summary = entry.summary.trim();
  const source = summary || collectAllowedText(entry.body);
  return source.replace(/[\t\r ]+/gu, " ").replace(/ *\n+ */gu, "\n").trim();
}

function splitSentences(value: string): string[] {
  return value.split(SENTENCE_END).map((sentence) => sentence.replace(/\s+/gu, " ").trim()).filter(Boolean);
}

function excerpt(value: string, budget: number): string {
  if (value.length <= budget) return value;
  if (budget <= 1) return "";
  let prefix = "";
  for (const character of value) {
    if (prefix.length + character.length > budget - 1) break;
    prefix += character;
  }
  const trimmedPrefix = prefix.trimEnd();
  return trimmedPrefix ? `${trimmedPrefix}…` : "";
}

function representative(entry: Entry): string {
  return splitSentences(extractEntryText(entry))[0] ?? "";
}

type GeneratedText = { text: string; sourceIds: string[] };

function roundRobinAbout(entries: Entry[], budget: number, allowExperienceTitle = false): GeneratedText {
  const candidates = entries.map((entry) => ({ entry, text: representative(entry) || (allowExperienceTitle ? entry.title.trim() : "") })).filter((candidate) => candidate.text).slice(0, MAX_ABOUT_ITEMS);
  const selected: string[] = [];
  const sourceIds: string[] = [];
  let used = 0;
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    const separator = selected.length ? 1 : 0;
    const remaining = budget - used - separator;
    if (remaining <= 0) break;
    const remainingCandidates = candidates.length - index;
    const quota = Math.max(1, Math.floor(remaining / remainingCandidates));
    const picked = excerpt(candidate.text, quota);
    if (!picked) continue;
    selected.push(picked);
    sourceIds.push(candidate.entry.id);
    used += separator + picked.length;
  }
  return { text: selected.join("\n"), sourceIds };
}

function overview(entries: Entry[]): GeneratedText {
  const candidates = entries.map((entry) => ({ entry, title: entry.title.trim(), text: representative(entry) })).filter((candidate) => candidate.title || candidate.text).slice(0, MAX_OVERVIEW_ITEMS);
  const lines: string[] = [];
  const sourceIds: string[] = [];
  let used = 0;
  for (let index = 0; index < candidates.length; index++) {
    const { entry, title, text } = candidates[index];
    const remaining = EXPERIENCE_OVERVIEW_BUDGET - used;
    if (remaining <= 0) break;
    const remainingItems = candidates.length - index;
    const quota = Math.max(1, Math.floor((remaining - Math.max(0, remainingItems - 1)) / remainingItems));
    const titleText = excerpt(title, Math.min(120, quota));
    const titlePrefix = text && titleText ? `${titleText}：` : titleText;
    const excerptBudget = Math.max(0, quota - titlePrefix.length);
    const bodyText = text ? excerpt(text, excerptBudget) : "";
    const line = `${titlePrefix}${bodyText}`.trim();
    if (!line) continue;
    const separator = lines.length ? 1 : 0;
    if (used + separator + line.length > EXPERIENCE_OVERVIEW_BUDGET) break;
    lines.push(line);
    sourceIds.push(entry.id);
    used += separator + line.length;
  }
  return { text: lines.join("\n"), sourceIds };
}

export function generateProfile(entries: Entry[]): ProfileGeneration {
  const experienceEntries = entries.filter((entry) => entry.category !== "life");
  const lifeEntries = entries.filter((entry) => entry.category === "life");
  const aboutExperience = roundRobinAbout(experienceEntries, ABOUT_EXPERIENCE_BUDGET, true);
  const experienceLength = aboutExperience.text.split("\n").reduce((sum, value) => sum + value.length, 0);
  const lifeBudget = aboutExperience.text
    ? Math.floor(experienceLength / 3)
    : Math.min(ABOUT_LIFE_BUDGET, lifeEntries.some((entry) => representative(entry)) ? ABOUT_LIFE_BUDGET : 0);
  const aboutLife = roundRobinAbout(lifeEntries, lifeBudget);
  const generatedOverview = overview(experienceEntries);
  const usedIds = new Set([...aboutExperience.sourceIds, ...aboutLife.sourceIds, ...generatedOverview.sourceIds]);
  const sources = entries.filter((entry) => usedIds.has(entry.id));

  return {
    about: [aboutExperience.text, aboutLife.text].filter(Boolean).join("\n"),
    experience: generatedOverview.text,
    sources: sources.map((entry) => ({
      id: entry.id,
      title: entry.title,
      category: entry.category,
      status: entry.status,
      visibility: entry.visibility,
    })),
    counts: {
      experience: sources.filter((entry) => entry.category !== "life").length,
      life: sources.filter((entry) => entry.category === "life").length,
    },
    omittedCount: entries.length - sources.length,
    weights: { experience: 3, life: 1 },
  };
}
