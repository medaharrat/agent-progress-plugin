import { calculateProgress } from "./core.js";
import type { ProgressState } from "./types.js";

const elapsed = (start: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(start)) / 60000));
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const trim = (s: string, n: number) => s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s;

export function renderStatus(state: ProgressState, columns = 100, color = true): string {
  if (!state.goal && !state.steps.length) return "Progress: no substantial task plan";
  const planning = !state.steps.length;
  const pct = state.substantial && !planning ? calculateProgress(state.steps) : null;
  const current = state.steps.find(s => s.status === "active" || s.status === "blocked");
  const next = state.steps.filter(s => s.status === "pending").slice(0, 2).map(s => s.name).join(" → ") || "none";
  const blockers = state.blockers.filter(b => b.active);
  const width = Math.max(10, Math.min(24, Math.floor(columns / 5)));
  const filled = pct === null ? 0 : Math.round(width * pct / 100);
  const bar = pct === null ? "" : `${"█".repeat(filled)}${"░".repeat(width - filled)} ${pct}%`;
  const green = color ? "\u001b[32m" : "", yellow = color ? "\u001b[33m" : "", red = color ? "\u001b[31m" : "", reset = color ? "\u001b[0m" : "";
  const tests = state.tests.total ? `${state.tests.passed}/${state.tests.total}${state.tests.failed ? ` (${state.tests.failed} failed)` : ""}` : "—";
  const suffix = bar ? `  ${bar}` : "";
  const goalWidth = Math.max(20, columns - "PROGRESS ".length - suffix.length);
  const nowText = current?.name ?? (state.status === "complete" ? "Complete" : planning ? "Planning…" : "Waiting for plan update");
  const nextText = planning ? "waiting for task plan" : next;
  const lines = [
    `${green}PROGRESS${reset} ${trim(state.goal || "Task", goalWidth)}${suffix}`,
    `${yellow}Now:${reset} ${trim(nowText, Math.max(20, columns - 12))}`,
    `Next: ${trim(nextText, Math.max(20, columns - 12))}`,
    `${blockers.length ? red : ""}Blockers: ${blockers.length ? blockers.map(b => b.message).join("; ") : "none"}${reset}`,
    `Files: ${state.filesChanged.length}  Tests: ${tests}  Elapsed: ${elapsed(state.startedAt)}`
  ];
  return lines.join("\n");
}
