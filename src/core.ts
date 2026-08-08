import { randomUUID } from "node:crypto";
import type { Blocker, ProgressState, ProgressStep, TestStats } from "./types.js";

export function calculateProgress(steps: ProgressStep[]): number | null {
  if (!steps.length) return null;
  const eligible = steps.filter(s => s.status !== "skipped");
  const total = eligible.reduce((n, s) => n + Math.max(0, s.weight), 0);
  if (!total) return null;
  const earned = eligible.reduce((n, s) => {
    const fraction = s.status === "done" ? 1 : s.status === "active" ? clamp(s.completion ?? 0.25) : 0;
    return n + Math.max(0, s.weight) * fraction;
  }, 0);
  return Math.round((earned / total) * 100);
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function normalizeWeights(steps: ProgressStep[]): ProgressStep[] {
  const sum = steps.filter(s => s.status !== "skipped").reduce((n, s) => n + Math.max(0, s.weight), 0);
  if (!sum) return steps;
  return steps.map(s => ({ ...s, weight: s.status === "skipped" ? s.weight : Math.round((s.weight / sum) * 1000) / 10 }));
}

export function truncateGoal(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, Math.max(1, max - 1))}…` : clean;
}

/** Starts a fresh per-turn state: temporary goal from the prompt, everything else reset, no percentage until a plan exists. */
export function startTurn(sessionId: string, prompt: string, turnId: string | undefined, now = new Date().toISOString()): ProgressState {
  return {
    version: 1,
    sessionId,
    turnId: turnId ?? randomUUID(),
    goal: truncateGoal(prompt),
    substantial: false,
    status: "active",
    steps: [],
    blockers: [],
    filesChanged: [],
    tests: { passed: 0, failed: 0, skipped: 0, total: 0 },
    failureSignatures: {},
    startedAt: now,
    updatedAt: now
  };
}

/** True when an event's turn identifier is known and differs from the state's active turn. */
export function isStaleEvent(state: ProgressState, eventTurnId: string | undefined): boolean {
  return Boolean(state.turnId && eventTurnId && eventTurnId !== state.turnId);
}

function recalcProvisionalWeights(steps: ProgressStep[]): ProgressStep[] {
  const provisional = steps.filter(s => s.weightSource === "provisional");
  if (!provisional.length) return steps;
  const othersTotal = steps.filter(s => s.weightSource !== "provisional").reduce((n, s) => n + Math.max(0, s.weight), 0);
  const share = Math.round((Math.max(0, 100 - othersTotal) / provisional.length) * 10) / 10;
  return steps.map(s => s.weightSource === "provisional" ? { ...s, weight: share } : s);
}

/** Keeps exactly one unfinished step active; the rest pending. Preserves order so an already-active step stays active. */
function ensureSingleActive(steps: ProgressStep[]): ProgressStep[] {
  let assigned = false;
  return steps.map(s => {
    if (s.status === "done" || s.status === "skipped" || s.status === "blocked") return s;
    if (!assigned) { assigned = true; return s.status === "active" ? s : { ...s, status: "active" }; }
    return s.status === "pending" ? s : { ...s, status: "pending" };
  });
}

/** Adds or updates a step from a TaskCreated event and rebalances provisional weights. */
export function upsertTaskStep(state: ProgressState, taskId: string, subject: string, description?: string): ProgressState {
  const now = new Date().toISOString();
  const name = subject || description || taskId;
  const index = state.steps.findIndex(s => s.id === taskId);
  let steps = index >= 0
    ? state.steps.map((s, i) => i === index ? { ...s, name, note: description ?? s.note } : s)
    : [...state.steps, { id: taskId, name, weight: 0, status: "pending" as const, weightSource: "provisional" as const, note: description }];
  steps = ensureSingleActive(recalcProvisionalWeights(steps));
  return { ...state, substantial: true, steps, updatedAt: now };
}

/** Marks a step done from a TaskCompleted event; completes the overall state once every non-skipped step is done. */
export function completeTaskStep(state: ProgressState, taskId: string): ProgressState {
  const now = new Date().toISOString();
  const steps = ensureSingleActive(state.steps.map(s => s.id === taskId ? { ...s, status: "done" as const, completion: 1 } : s));
  const allDone = steps.length > 0 && steps.every(s => s.status === "done" || s.status === "skipped");
  return { ...state, steps, status: allDone ? "complete" : state.status, updatedAt: now };
}

export function recordFailure(state: ProgressState, signature: string, message: string, threshold = 3): ProgressState {
  const count = (state.failureSignatures[signature] ?? 0) + 1;
  const now = new Date().toISOString();
  const blockers = [...state.blockers];
  if (count >= threshold) {
    const id = `failure:${signature}`;
    const index = blockers.findIndex(b => b.id === id);
    const blocker: Blocker = index >= 0
      ? { ...blockers[index], message, count, active: true, lastSeen: now }
      : { id, message, count, active: true, source: "automatic", firstSeen: now, lastSeen: now };
    if (index >= 0) blockers[index] = blocker; else blockers.push(blocker);
  }
  return { ...state, failureSignatures: { ...state.failureSignatures, [signature]: count }, blockers, updatedAt: now };
}

export function clearFailure(state: ProgressState, signature: string): ProgressState {
  const failures = { ...state.failureSignatures };
  delete failures[signature];
  return { ...state, failureSignatures: failures, blockers: state.blockers.map(b => b.id === `failure:${signature}` ? { ...b, active: false } : b), updatedAt: new Date().toISOString() };
}

export function parseTestStats(text: string): TestStats | null {
  const patterns = [
    /(?:tests?\s*)?(\d+)\s+passed(?:[^\d]+(\d+)\s+failed)?(?:[^\d]+(\d+)\s+skipped)?/i,
    /(?:Tests?:\s*)?(\d+)\s+passed[,.]?\s*(\d+)\s+failed[,.]?\s*(\d+)\s+(?:skipped|pending)/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const passed = Number(m[1] ?? 0), failed = Number(m[2] ?? 0), skipped = Number(m[3] ?? 0);
      return { passed, failed, skipped, total: passed + failed + skipped };
    }
  }
  return null;
}
