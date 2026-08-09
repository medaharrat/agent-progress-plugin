import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

// Compiled test lives at dist/test/main-module.test.js; repo root is two levels up.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function withSymlinkedDist(fn: (linkedDist: string) => Promise<void>) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "claude-progress-symlink-"));
  try {
    const linkedDist = path.join(tmp, "dist");
    await symlink(path.join(repoRoot, "dist", "src"), linkedDist, "dir");
    await fn(linkedDist);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

test("hook.js still runs when reached through a symlink, as dev-install sets up", () => withSymlinkedDist(async linkedDist => {
  const project = await mkdtemp(path.join(os.tmpdir(), "claude-progress-symlink-project-"));
  try {
    const input = JSON.stringify({ session_id: "sym-test", cwd: project, hook_event_name: "UserPromptSubmit", prompt_id: "turn-1", prompt: "Test symlinked invocation" });
    const stdout = execFileSync("node", [path.join(linkedDist, "hook.js")], { input, encoding: "utf8" });
    assert.match(stdout, /hookSpecificOutput/);
    const state = JSON.parse(await readFile(path.join(project, ".claude", "progress", "sym-test.json"), "utf8"));
    assert.equal(state.goal, "Test symlinked invocation");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}));

test("statusline.js still runs when reached through a symlink", () => withSymlinkedDist(async linkedDist => {
  const project = await mkdtemp(path.join(os.tmpdir(), "claude-progress-symlink-project-"));
  try {
    const input = JSON.stringify({ session_id: "sym-test", workspace: { project_dir: project } });
    const stdout = execFileSync("node", [path.join(linkedDist, "statusline.js")], { input, encoding: "utf8" });
    assert.match(stdout, /Progress:/);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}));
