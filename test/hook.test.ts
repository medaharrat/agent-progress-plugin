import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { handleHook } from "../src/hook.js";
import { loadState } from "../src/state.js";

async function withTempProject(fn: (cwd: string) => Promise<void>) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "claude-progress-hook-"));
  try { await fn(cwd); } finally { await rm(cwd, { recursive: true, force: true }); }
}

test("UserPromptSubmit starts a new turn and resets a completed turn's state", () => withTempProject(async cwd => {
  const session = "s1";
  await handleHook({ hook_event_name: "TaskCreated", cwd, session_id: session, prompt_id: "turn-1", task_id: "t1", task_subject: "Old task" });
  const { state } = await handleHook({ hook_event_name: "TaskCompleted", cwd, session_id: session, prompt_id: "turn-1", task_id: "t1", task_subject: "Old task" });
  assert.equal(state.status, "complete");

  const result = await handleHook({ hook_event_name: "UserPromptSubmit", cwd, session_id: session, prompt_id: "turn-2", prompt: "Now do something completely different" });
  assert.equal(result.state.goal, "Now do something completely different");
  assert.equal(result.state.status, "active");
  assert.deepEqual(result.state.steps, []);
  const output = result.hookOutput as { hookSpecificOutput?: { hookEventName?: string; additionalContext?: string } } | undefined;
  assert.equal(output?.hookSpecificOutput?.hookEventName, "UserPromptSubmit");
  assert.match(String(output?.hookSpecificOutput?.additionalContext ?? ""), /progress plan/i);
}));

test("TaskCreated and TaskCompleted hooks drive the plan for the active turn", () => withTempProject(async cwd => {
  const session = "s2";
  await handleHook({ hook_event_name: "UserPromptSubmit", cwd, session_id: session, prompt_id: "turn-1", prompt: "Implement the export feature" });
  await handleHook({ hook_event_name: "TaskCreated", cwd, session_id: session, prompt_id: "turn-1", task_id: "t1", task_subject: "Design schema" });
  const { state: afterSecond } = await handleHook({ hook_event_name: "TaskCreated", cwd, session_id: session, prompt_id: "turn-1", task_id: "t2", task_subject: "Implement endpoint" });
  assert.equal(afterSecond.steps.length, 2);
  assert.equal(afterSecond.substantial, true);

  const { state: afterComplete } = await handleHook({ hook_event_name: "TaskCompleted", cwd, session_id: session, prompt_id: "turn-1", task_id: "t1", task_subject: "Design schema" });
  assert.equal(afterComplete.steps.find(s => s.id === "t1")?.status, "done");
  assert.equal(afterComplete.steps.find(s => s.id === "t2")?.status, "active");
}));

test("a permission-prompt blocker clears as soon as work resumes, even without a matching PostToolUse", () => withTempProject(async cwd => {
  const session = "s4";
  await handleHook({ hook_event_name: "UserPromptSubmit", cwd, session_id: session, prompt_id: "turn-1", prompt: "Refactor the payments module" });
  const { state: afterNotification } = await handleHook({ hook_event_name: "Notification", cwd, session_id: session, prompt_id: "turn-1", notification_type: "permission_prompt", message: "Claude needs your permission" });
  assert.equal(afterNotification.blockers.find(b => b.id === "notification:permission_prompt")?.active, true);

  const { state: afterResume } = await handleHook({ hook_event_name: "PostToolUse", cwd, session_id: session, prompt_id: "turn-1", tool_name: "Read", tool_input: { file_path: "a.ts" } });
  assert.equal(afterResume.blockers.find(b => b.id === "notification:permission_prompt")?.active, false);
}));

test("stale events from a previous turn cannot mutate the newer turn", () => withTempProject(async cwd => {
  const session = "s3";
  await handleHook({ hook_event_name: "UserPromptSubmit", cwd, session_id: session, prompt_id: "turn-1", prompt: "First task" });
  await handleHook({ hook_event_name: "TaskCreated", cwd, session_id: session, prompt_id: "turn-1", task_id: "t1", task_subject: "Step one" });

  await handleHook({ hook_event_name: "UserPromptSubmit", cwd, session_id: session, prompt_id: "turn-2", prompt: "Second, unrelated task" });

  // A slow hook invocation from the first turn arrives after the new prompt already started.
  const { state: afterStaleEvent } = await handleHook({ hook_event_name: "TaskCompleted", cwd, session_id: session, prompt_id: "turn-1", task_id: "t1", task_subject: "Step one" });
  assert.equal(afterStaleEvent.goal, "Second, unrelated task");
  assert.deepEqual(afterStaleEvent.steps, []);

  const persisted = await loadState(cwd, session);
  assert.equal(persisted.goal, "Second, unrelated task");
}));
