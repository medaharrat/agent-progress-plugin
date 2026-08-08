import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { init, uninstall } from "../src/cli.js";

async function withTempProject(fn: (project: string) => Promise<void>) {
  const project = await mkdtemp(path.join(os.tmpdir(), "claude-progress-cli-"));
  try { await fn(project); } finally { await rm(project, { recursive: true, force: true }); }
}

test("install preserves unrelated hooks and settings, uninstall restores them", () => withTempProject(async project => {
  const claude = path.join(project, ".claude");
  await mkdir(claude, { recursive: true });
  const settingsPath = path.join(claude, "settings.local.json");
  const original = {
    theme: "dark",
    hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "echo unrelated" }] }] },
    statusLine: { type: "command", command: "echo previous-status-line" }
  };
  await writeFile(settingsPath, `${JSON.stringify(original, null, 2)}\n`);

  await init(project);
  const afterInstall = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(afterInstall.theme, "dark");
  assert.deepEqual(afterInstall.hooks.PreToolUse, original.hooks.PreToolUse);
  for (const event of ["PostToolUse", "PostToolUseFailure", "Stop", "SubagentStop", "Notification", "UserPromptSubmit", "TaskCreated", "TaskCompleted"]) {
    assert.ok(Array.isArray(afterInstall.hooks[event]) && afterInstall.hooks[event].length > 0, `missing managed hook for ${event}`);
  }
  assert.match(afterInstall.statusLine.command, /statusline\.js/);

  await uninstall(project);
  const afterUninstall = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(afterUninstall.theme, "dark");
  assert.deepEqual(afterUninstall.hooks.PreToolUse, original.hooks.PreToolUse);
  for (const event of ["PostToolUse", "PostToolUseFailure", "Stop", "SubagentStop", "Notification", "UserPromptSubmit", "TaskCreated", "TaskCompleted"]) {
    assert.ok(!afterUninstall.hooks[event] || afterUninstall.hooks[event].length === 0, `managed hook for ${event} was not removed`);
  }
  assert.deepEqual(afterUninstall.statusLine, original.statusLine);
}));

test("install refuses to touch malformed settings JSON", () => withTempProject(async project => {
  const claude = path.join(project, ".claude");
  await mkdir(claude, { recursive: true });
  await writeFile(path.join(claude, "settings.local.json"), "{ not valid json");
  await assert.rejects(() => init(project), /invalid JSON/i);
}));
