import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const mapFile = path.join(root, "docs", "ai-map.md");
const srcDir = path.join(root, "src");

const groupMatchers = [
  { name: "dashboard", test: (p) => p.includes("components/dashboard") || p.includes("utils/historyStats") },
  { name: "session", test: (p) => p.includes("/session/") },
  { name: "template", test: (p) => p.includes("/template/") },
  { name: "history", test: (p) => p.includes("/history/") || p.includes("useHistory") },
  { name: "ai-generator", test: (p) => p.includes("features/ai-generator") },
  { name: "i18n", test: (p) => p.startsWith("i18n/") },
  { name: "shared", test: (p) => p.includes("/hooks/") || p.includes("/utils/") || p.includes("/types/") },
];

function walkFiles(dir, relBase = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = path.join(relBase, entry.name);
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(abs, rel));
    else files.push(rel.replace(/\\/g, "/"));
  }
  return files;
}

function listChangedSrcFiles() {
  try {
    const out = execSync("git diff --name-only HEAD", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((p) => p.startsWith("src/"))
      .map((p) => p.slice(4))
      .map((p) => p.replace(/\\/g, "/"));
  } catch {
    return [];
  }
}

function parseAutoList(content, sectionName) {
  const start = `<!-- AUTO:${sectionName}:start -->`;
  const end = `<!-- AUTO:${sectionName}:end -->`;
  const s = content.indexOf(start);
  const e = content.indexOf(end);
  if (s === -1 || e === -1 || e < s) return [];
  const body = content.slice(s + start.length, e);
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- `src/") && line.endsWith("`"))
    .map((line) => line.slice(7, -1)); // remove - `src/ ... `
}

function renderAutoList(files) {
  if (files.length === 0) return "- (no entries yet)";
  return files.map((f) => `- \`src/${f}\``).join("\n");
}

function replaceAutoSection(content, sectionName, files) {
  const start = `<!-- AUTO:${sectionName}:start -->`;
  const end = `<!-- AUTO:${sectionName}:end -->`;
  const pattern = new RegExp(
    `${start}[\\s\\S]*?${end}`,
    "m",
  );
  const body = `${start}\n${renderAutoList(files)}\n${end}`;
  if (!pattern.test(content)) return content;
  return content.replace(pattern, body);
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

function limit(arr, n = 40) {
  return arr.slice(0, n);
}

const allTsFiles = walkFiles(srcDir).filter((p) => /\.(ts|tsx)$/.test(p));
const changedSrcFiles = listChangedSrcFiles();
const seedFiles = changedSrcFiles.length > 0 ? changedSrcFiles : allTsFiles;

let mapContent = fs.readFileSync(mapFile, "utf8");

for (const group of groupMatchers) {
  const existing = parseAutoList(mapContent, group.name);
  const touched = seedFiles.filter((p) => group.test(p));
  const merged = limit(uniqueSorted([...existing, ...touched]));
  mapContent = replaceAutoSection(mapContent, group.name, merged);
}

const existingOther = parseAutoList(mapContent, "other");
const matched = new Set(groupMatchers.flatMap((g) => seedFiles.filter((p) => g.test(p))));
const otherTouched = seedFiles.filter((p) => !matched.has(p));
const mergedOther = limit(uniqueSorted([...existingOther, ...otherTouched]));
mapContent = replaceAutoSection(mapContent, "other", mergedOther);

fs.writeFileSync(mapFile, mapContent, "utf8");
console.log(
  changedSrcFiles.length > 0
    ? `Updated docs/ai-map.md from ${changedSrcFiles.length} changed src files`
    : "Updated docs/ai-map.md from full src scan (no local diff)",
);

