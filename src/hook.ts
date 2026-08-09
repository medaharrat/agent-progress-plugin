#!/usr/bin/env node
import { createHash } from "node:crypto";
import { loadState, saveState } from "./state.js";
import { clearFailure, clearNotificationBlockers, completeTaskStep, isStaleEvent, parseTestStats, recordFailure, startTurn, upsertTaskStep } from "./core.js";
import type { HookInput, ProgressState } from "./types.js";

const readStdin = async () => { let s = ""; for await (const c of process.stdin) s += c; return s; };
const stringify = (v: unknown) => typeof v === "string" ? v : JSON.stringify(v ?? "");
const signatureFor = (i: HookInput) => createHash("sha1").update(`${i.tool_name ?? "tool"}:${stringify(i.tool_input)}`).digest("hex").slice(0, 12);
const fileFrom = (i: HookInput) => [i.tool_input?.file_path, i.tool_input?.path].find(v => typeof v === "string") as string | undefined;

const PROMPT_REMINDER = "Progress tracking: if this request has several deliverables or will take more than a few tool calls, create or update the session progress plan now (see the \"progress\" skill) and keep it synchronized whenever your task list changes. Small, single-action requests should omit percentages entirely.";

export interface HookResult { state: ProgressState; hookOutput?: Record<string, unknown>; }

export async function handleHook(input: HookInput): Promise<HookResult> {
  const cwd = input.cwd ?? process.cwd(), session = input.session_id ?? "unknown";
  let state = await loadState(cwd, session);
  const event = input.hook_event_name ?? process.argv[2] ?? "";
  const eventTurnId = input.prompt_id;

  if (event === "UserPromptSubmit") {
    state = startTurn(session, input.prompt ?? "", eventTurnId);
    await saveState(cwd, state);
    return { state, hookOutput: { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: PROMPT_REMINDER } } };
  }

  if (isStaleEvent(state, eventTurnId)) return { state };

  state = clearNotificationBlockers(state);

  if (event === "TaskCreated") {
    if (input.task_id) state = upsertTaskStep(state, input.task_id, input.task_subject ?? "", input.task_description);
  } else if (event === "TaskCompleted") {
    if (input.task_id) state = completeTaskStep(state, input.task_id);
  } else if (event === "PostToolUse") {
    const sig = signatureFor(input);
    state = clearFailure(state, sig);
    const file = fileFrom(input);
    if (file && /^(Write|Edit|MultiEdit|NotebookEdit)$/i.test(input.tool_name ?? "") && !state.filesChanged.includes(file)) state.filesChanged.push(file);
    const stats = parseTestStats(stringify(input.tool_response));
    if (stats) state.tests = stats;
  } else if (event === "PostToolUseFailure") {
    const message = input.error ?? input.error_message ?? `Repeated failure: ${input.tool_name ?? "tool"}`;
    state = recordFailure(state, signatureFor(input), message);
  } else if (event === "Notification") {
    if (input.notification_type === "permission_prompt" || input.notification_type === "agent_needs_input") {
      const now = new Date().toISOString(), id = `notification:${input.notification_type}`;
      const found = state.blockers.find(b => b.id === id);
      if (found) { found.active = true; found.count++; found.lastSeen = now; }
      else state.blockers.push({ id, message: input.message ?? "Waiting for user input", source: "automatic", active: true, count: 1, firstSeen: now, lastSeen: now });
    }
  } else if (event === "SubagentStop") {
    state.updatedAt = new Date().toISOString();
  } else if (event === "Stop") {
    if (state.steps.length && state.steps.every(s => s.status === "done" || s.status === "skipped")) state.status = "complete";
  }
  state.updatedAt = new Date().toISOString();
  await saveState(cwd, state);
  return { state };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  try {
    const { hookOutput } = await handleHook(JSON.parse(await readStdin() || "{}"));
    if (hookOutput) console.log(JSON.stringify(hookOutput));
  } catch (e) { console.error(`claude-progress hook: ${e instanceof Error ? e.message : e}`); }
}
