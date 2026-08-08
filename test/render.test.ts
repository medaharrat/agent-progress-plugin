import test from "node:test";
import assert from "node:assert/strict";
import { renderStatus } from "../src/render.js";
import { freshState } from "../src/state.js";
import { startTurn } from "../src/core.js";

test("small tasks omit percentage", () => {
  const s = freshState("x"); s.goal = "Rename one symbol"; s.substantial = false;
  assert.doesNotMatch(renderStatus(s, 80, false), /%/);
});

test("renderer includes required telemetry", () => {
  const s = freshState("x"); s.goal = "Build feature"; s.substantial = true;
  s.steps = [{ id: "a", name: "Implement", weight: 100, status: "active", completion: .5 }];
  s.filesChanged = ["a.ts"]; s.tests = { passed: 2, failed: 0, skipped: 0, total: 2 };
  const out = renderStatus(s, 100, false);
  for (const value of ["50%", "Now:", "Next:", "Blockers:", "Files: 1", "Tests: 2/2", "Elapsed:"]) assert.match(out, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("planning state before a task plan exists shows no percentage", () => {
  const s = startTurn("x", "Investigate the intermittent CI failure", "turn-1");
  const out = renderStatus(s, 100, false);
  assert.doesNotMatch(out, /%/);
  assert.match(out, /Now: Planning…/);
  assert.match(out, /Next: waiting for task plan/);
});

test("a long goal is truncated but the percentage stays visible", () => {
  const s = freshState("x");
  s.goal = "A".repeat(500);
  s.substantial = true;
  s.steps = [{ id: "a", name: "Implement", weight: 100, status: "active", completion: .5 }];
  const out = renderStatus(s, 80, false);
  const firstLine = out.split("\n")[0];
  assert.ok(firstLine.length <= 80 + 2, `first line too wide: ${firstLine.length}`);
  assert.match(firstLine, /50%/);
});
