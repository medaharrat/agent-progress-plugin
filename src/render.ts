import { calculateProgress } from "./core.js";
import type { ProgressState } from "./types.js";

const elapsed = (start: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(start)) / 60000));
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const trim = (s: string, n: number) => s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s;

/** Eighth-block characters, indexed by how many eighths of the boundary cell are filled. */
const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];

/** Smooth, sub-character-precision bar: solid fill, one partial cell at the boundary, dim track. */
function buildBar(pct: number, width: number, color: boolean): string {
  const totalEighths = Math.round((width * 8 * pct) / 100);
  const full = Math.min(width, Math.floor(totalEighths / 8));
  const partial = full < width ? EIGHTHS[totalEighths - full * 8] : "";
  const track = "░".repeat(Math.max(0, width - full - (partial ? 1 : 0)));
  const filled = `${"█".repeat(full)}${partial}`;
  if (!color) return `${filled}${track} ${pct}%`;
  const cyan = "\u001b[36m", gray = "\u001b[90m", reset = "\u001b[0m";
  return `${cyan}${filled}${reset}${gray}${track}${reset} ${pct}%`;
}

export function renderStatus(state: ProgressState, columns = 100, color = true): string {
  if (!state.goal && !state.steps.length) return "Progress: no substantial task plan";
  const planning = !state.steps.length;
  const pct = state.substantial && !planning ? calculateProgress(state.steps) : null;
  const current = state.steps.find(s => s.status === "active" || s.status === "blocked");
  const next = state.steps.filter(s => s.status === "pending").slice(0, 2).map(s => s.name).join(" → ") || "none";
  const blockers = state.blockers.filter(b => b.active);
  const width = Math.max(10, Math.min(24, Math.floor(columns / 5)));
  const bar = pct === null ? "" : buildBar(pct, width, color);
  const plainBarLength = pct === null ? 0 : buildBar(pct, width, false).length;
  const green = color ? "\u001b[32m" : "", yellow = color ? "\u001b[33m" : "", red = color ? "\u001b[31m" : "", reset = color ? "\u001b[0m" : "";
  const tests = state.tests.total ? `${state.tests.passed}/${state.tests.total}${state.tests.failed ? ` (${state.tests.failed} failed)` : ""}` : "—";
  const suffix = bar ? `  ${bar}` : "";
  const goalWidth = Math.max(20, columns - "PROGRESS ".length - (bar ? 2 + plainBarLength : 0));
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
