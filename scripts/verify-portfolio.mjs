// Read-only portfolio checks: no server, database, credentials or network needed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PORTFOLIO_PROJECTS,
  PORTFOLIO_STAGES,
  FEATURED_PROJECTS,
  getPortfolioProject,
} from "../lib/portfolio-data.ts";

const publicRepos = [
  "campus-card-system", "air-ticket-system", "java-ee", "desktop-pet",
  "cs-study-assistant", "emberfall-arena",
];

test("project slugs, stages and detail content are valid", () => {
  const slugs = new Set();
  for (const project of PORTFOLIO_PROJECTS) {
    assert.match(project.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!slugs.has(project.slug), `duplicate slug: ${project.slug}`);
    slugs.add(project.slug);
    assert.ok(PORTFOLIO_STAGES.some(stage => stage.id === project.stage));
    for (const field of ["title", "summary", "kind", "period", "background"]) {
      assert.ok(project[field]?.trim(), `${project.slug}: missing ${field}`);
    }
    for (const field of ["features", "implementation", "limitations", "stack", "highlights"]) {
      assert.ok(project[field]?.length, `${project.slug}: missing ${field}`);
    }
    assert.equal(new Set(project.stack).size, project.stack.length);
    assert.equal(getPortfolioProject(project.slug), project);
  }
  assert.equal(getPortfolioProject("not-a-project"), undefined);
});

test("all six verified public repositories have visible HTTPS source links", () => {
  const projects = PORTFOLIO_PROJECTS.filter(project => project.sourceUrl);
  assert.equal(projects.length, publicRepos.length);
  for (const repo of publicRepos) {
    const project = projects.find(item => item.sourceUrl === `https://github.com/zlw0411-star/${repo}`);
    assert.ok(project, `missing repository: ${repo}`);
    assert.equal(project.sourceVisibility, "public", repo);
    assert.equal(new URL(project.sourceUrl).protocol, "https:");
  }
  for (const project of PORTFOLIO_PROJECTS) {
    if (project.sourceVisibility === "public") assert.ok(project.sourceUrl);
  }
});

test("homepage keeps two Java systems and features the updated learning tool", () => {
  const expected = ["campus-card-system", "air-ticket-system", "cs-study-assistant"];
  assert.deepEqual(FEATURED_PROJECTS.map(project => project.slug), expected);
  assert.deepEqual(PORTFOLIO_PROJECTS.filter(project => project.featured).map(project => project.slug).sort(), [...expected].sort());
});

test("learning tool describes both current interfaces and optional online processing", () => {
  const project = getPortfolioProject("cs-study-assistant");
  assert.equal(project.title, "学习资料分析助手");
  for (const stack of ["PySide6", "Streamlit", "SQLite"]) assert.ok(project.stack.includes(stack));
  assert.match(project.summary, /PDF、DOCX、TXT 与 Markdown/);
  assert.ok(project.limitations.some(text => text.includes("全部提取文字") && text.includes("计费")));
});

test("game explicitly states the player and local AI scope and excludes online services", () => {
  const project = getPortfolioProject("emberfall-arena");
  assert.match(project.summary, /1 名玩家与 11 名本地 AI/);
  assert.ok(project.limitations.some(text => text.includes("不支持网络联机")));
  assert.ok(project.limitations.some(text => text.includes("局内伤害排名")));
  assert.ok(project.limitations.some(text => text.includes("未声明开源许可证")));
});

test("game documents its three modes, controls, and melee damage boundary", () => {
  const project = getPortfolioProject("emberfall-arena");
  assert.match(project.summary, /经典远程、近战刀战和首领竞伤/);
  const features = project.features.join("\n");
  for (const skill of ["突进斩", "旋风斩", "重斩", "穿云刺", "护体刀阵"]) assert.ok(features.includes(skill), skill);
  assert.match(features, /左键点击挥刀或按住连斩/);
  assert.match(features, /倒下后可复活并保留成长/);
  assert.match(features, /十分钟时限结束后结算/);
  assert.ok(project.implementation.some(item => item.description.includes("视觉余效不参与伤害")));
  assert.ok(project.limitations.some(text => text.includes("不含翻滚、格挡或弹反")));
});

test("updated portfolio pages retain the plain-anchor navigation workaround", () => {
  for (const path of ["app/page.tsx", "app/projects/[slug]/page.tsx"]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.ok(!source.includes('from "next/link"'), path);
    assert.ok(source.includes("<SiteLink"), path);
  }
});
