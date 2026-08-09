#!/usr/bin/env node
import { cp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderStatus } from "./render.js";
import type { ProgressState } from "./types.js";

type Json = Record<string, unknown>;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const marker = "claude-progress-managed";
const exists = async (p: string) => { try { await stat(p); return true; } catch { return false; } };
const readJson = async (p: string): Promise<Json> => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return {}; } };
const readSettings = async (p: string): Promise<Json> => {
  if (!(await exists(p))) return {};
  try { return JSON.parse(await readFile(p, "utf8")) as Json; }
  catch (e) { throw new Error(`Refusing to modify invalid JSON at ${p}: ${e instanceof Error ? e.message : e}`); }
};
const parseProject = () => {
  const i = process.argv.indexOf("--project");
  return path.resolve(i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : process.cwd());
};

function hook(command: string) { return [{ hooks: [{ type: "command", command }] }]; }
function isManagedGroup(v: unknown): boolean {
  return !!v && typeof v === "object" && JSON.stringify(v).includes(marker);
}

export async function init(project: string, opts: { symlink?: boolean } = {}) {
  const claude = path.join(project, ".claude"), installDir = path.join(claude, "progress-extension");
  const settingsPath = path.join(claude, "settings.local.json"), manifestPath = path.join(installDir, "manifest.json");
  const current = await readSettings(settingsPath);
  await mkdir(installDir, { recursive: true });
  const distDest = path.join(installDir, "dist"), skillDir = path.join(claude, "skills", "progress");
  await rm(distDest, { recursive: true, force: true });
  if (opts.symlink) await symlink(path.join(root, "dist", "src"), distDest, "dir");
  else await cp(path.join(root, "dist", "src"), distDest, { recursive: true });
  await rm(skillDir, { recursive: true, force: true });
  await mkdir(path.join(claude, "skills"), { recursive: true });
  if (opts.symlink) await symlink(path.join(root, "skill"), skillDir, "dir");
  else { await mkdir(skillDir); await cp(path.join(root, "skill", "SKILL.md"), path.join(skillDir, "SKILL.md")); }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let backup: string | null = null;
  if (await exists(settingsPath)) {
    backup = `${settingsPath}.backup-${stamp}`;
    await cp(settingsPath, backup);
  }
  const hooks = (current.hooks && typeof current.hooks === "object" ? current.hooks : {}) as Record<string, unknown>;
  const command = `node "${path.join(installDir, "dist", "hook.js")}" ${marker}`;
  for (const event of ["PostToolUse", "PostToolUseFailure", "Stop", "SubagentStop", "Notification", "UserPromptSubmit", "TaskCreated", "TaskCompleted"]) {
    const old = Array.isArray(hooks[event]) ? hooks[event] as unknown[] : [];
    hooks[event] = [...old.filter(x => !isManagedGroup(x)), ...hook(command)];
  }
  const previousStatusLine = current.statusLine ?? null;
  current.hooks = hooks;
  current.statusLine = { type: "command", command: `node "${path.join(installDir, "dist", "statusline.js")}"`, refreshInterval: 1 };
  await writeFile(settingsPath, `${JSON.stringify(current, null, 2)}\n`);
  await writeFile(manifestPath, `${JSON.stringify({ marker, settingsPath, backup, previousStatusLine, symlinked: !!opts.symlink }, null, 2)}\n`);
  console.log(`Installed Claude Progress in ${project}${opts.symlink ? " (symlinked dev build)" : ""}`);
  console.log(`Settings backup: ${backup ?? "not needed (new settings file)"}`);
}

export async function uninstall(project: string) {
  const installDir = path.join(project, ".claude", "progress-extension"), manifestPath = path.join(installDir, "manifest.json");
  if (!(await exists(manifestPath))) throw new Error(`No Claude Progress installation manifest found at ${manifestPath}`);
  const manifest = await readJson(manifestPath);
  const settingsPath = String(manifest.settingsPath ?? path.join(project, ".claude", "settings.local.json"));
  const current = await readSettings(settingsPath);
  const hooks = (current.hooks && typeof current.hooks === "object" ? current.hooks : {}) as Record<string, unknown>;
  for (const event of Object.keys(hooks)) if (Array.isArray(hooks[event])) hooks[event] = (hooks[event] as unknown[]).filter(x => !isManagedGroup(x));
  current.hooks = hooks;
  if (manifest.previousStatusLine == null) delete current.statusLine; else current.statusLine = manifest.previousStatusLine;
  await writeFile(settingsPath, `${JSON.stringify(current, null, 2)}\n`);
  await rm(path.join(project, ".claude", "skills", "progress"), { recursive: true, force: true });
  await rm(installDir, { recursive: true, force: true });
  console.log(`Uninstalled Claude Progress from ${project}; session state in .claude/progress was preserved.`);
}

const sample: ProgressState = {
  version: 1, sessionId: "sample", turnId: "sample-turn", goal: "Implement variable mission inputs", substantial: true, status: "active",
  steps: [
    { id: "schema", name: "Database schema", weight: 15, status: "done" },
    { id: "api", name: "API models", weight: 25, status: "done" },
    { id: "ui", name: "Update frontend form", weight: 25, status: "active", completion: 0.6 },
    { id: "tests", name: "Integration tests", weight: 25, status: "pending" },
    { id: "docs", name: "Documentation", weight: 10, status: "pending" }
  ], blockers: [], filesChanged: Array.from({ length: 11 }, (_, i) => `file-${i}`), tests: { passed: 27, failed: 4, skipped: 0, total: 31 }, failureSignatures: {}, startedAt: new Date(Date.now() - 18 * 60000).toISOString(), updatedAt: new Date().toISOString()
};

async function main() {
  const command = process.argv[2] ?? "help";
  if (command === "init") await init(parseProject());
  else if (command === "dev-install") await init(parseProject(), { symlink: true });
  else if (command === "uninstall") await uninstall(parseProject());
  else if (command === "sample") console.log(renderStatus(sample, 100, process.env.NO_COLOR === undefined));
  else { console.log("Usage: claude-progress <init|dev-install|uninstall|sample> [--project PATH]"); process.exitCode = command === "help" ? 0 : 1; }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) await main();
