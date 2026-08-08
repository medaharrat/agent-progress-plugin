import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProgressState } from "./types.js";

export function statePath(cwd: string, sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_") || "unknown";
  return path.join(cwd, ".claude", "progress", `${safe}.json`);
}

export function freshState(sessionId: string, now = new Date().toISOString()): ProgressState {
  return { version: 1, sessionId, turnId: "", goal: "", substantial: false, status: "active", steps: [], blockers: [], filesChanged: [], tests: { passed: 0, failed: 0, skipped: 0, total: 0 }, failureSignatures: {}, startedAt: now, updatedAt: now };
}

export async function loadState(cwd: string, sessionId: string): Promise<ProgressState> {
  try { return JSON.parse(await readFile(statePath(cwd, sessionId), "utf8")) as ProgressState; }
  catch { return freshState(sessionId); }
}

export async function saveState(cwd: string, state: ProgressState): Promise<void> {
  const file = statePath(cwd, state.sessionId);
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temp, file);
  await writeFile(path.join(path.dirname(file), "current-session"), `${state.sessionId}\n`, "utf8");
}
