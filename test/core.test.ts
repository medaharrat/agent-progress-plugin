import test from "node:test";
import assert from "node:assert/strict";
import { calculateProgress, clearFailure, completeTaskStep, isStaleEvent, parseTestStats, recordFailure, startTurn, upsertTaskStep } from "../src/core.js";
import { freshState } from "../src/state.js";

test("weighted progress includes active fraction", () => {
  assert.equal(calculateProgress([
    { id: "a", name: "A", weight: 40, status: "done" },
    { id: "b", name: "B", weight: 40, status: "active", completion: 0.5 },
    { id: "c", name: "C", weight: 20, status: "pending" }
  ]), 60);
});

test("skipped work leaves denominator", () => {
  assert.equal(calculateProgress([
    { id: "a", name: "A", weight: 50, status: "done" },
    { id: "b", name: "B", weight: 50, status: "skipped" }
  ]), 100);
});

test("small empty plans have no percentage", () => assert.equal(calculateProgress([]), null));

test("third repeated failure creates and success clears blocker", () => {
  let s = freshState("s");
  s = recordFailure(s, "x", "command failed"); s = recordFailure(s, "x", "command failed");
  assert.equal(s.blockers.length, 0);
  s = recordFailure(s, "x", "command failed");
  assert.equal(s.blockers[0]?.active, true);
  s = clearFailure(s, "x");
  assert.equal(s.blockers[0]?.active, false);
});

test("parses common test summary", () => assert.deepEqual(parseTestStats("27 passed, 4 failed, 2 skipped"), { passed: 27, failed: 4, skipped: 2, total: 33 }));

test("new prompt resets a completed turn's state", () => {
  const s = freshState("s");
  s.goal = "Old goal"; s.status = "complete"; s.substantial = true;
  s.steps = [{ id: "a", name: "A", weight: 100, status: "done" }];
  s.filesChanged = ["a.ts", "b.ts"];
  s.tests = { passed: 5, failed: 1, skipped: 0, total: 6 };
  s.failureSignatures = { x: 3 };
  s.blockers = [{ id: "b1", message: "stuck", source: "explicit", active: true, count: 1, firstSeen: "t", lastSeen: "t" }];

  const next = startTurn("s", "Refactor the payment module", "turn-2");
  assert.equal(next.goal, "Refactor the payment module");
  assert.equal(next.status, "active");
  assert.equal(next.substantial, false);
  assert.deepEqual(next.steps, []);
  assert.deepEqual(next.filesChanged, []);
  assert.deepEqual(next.tests, { passed: 0, failed: 0, skipped: 0, total: 0 });
  assert.deepEqual(next.failureSignatures, {});
  assert.deepEqual(next.blockers, []);
});

test("new-turn telemetry gets a fresh turn identifier and start time", () => {
  const first = startTurn("s", "Do a thing", "turn-1", "2020-01-01T00:00:00.000Z");
  const second = startTurn("s", "Do another thing", "turn-2", "2020-01-01T01:00:00.000Z");
  assert.notEqual(first.turnId, second.turnId);
  assert.notEqual(first.startedAt, second.startedAt);
});

test("planning state (no steps yet) has no percentage", () => {
  const s = startTurn("s", "Investigate the flaky test suite", "turn-1");
  assert.equal(s.steps.length, 0);
  assert.equal(calculateProgress(s.steps), null);
});

test("task creation produces steps with provisional weights", () => {
  let s = startTurn("s", "Build the export feature", "turn-1");
  s = upsertTaskStep(s, "t1", "Design schema");
  s = upsertTaskStep(s, "t2", "Implement export endpoint");
  assert.equal(s.substantial, true);
  assert.equal(s.steps.length, 2);
  assert.equal(s.steps[0].status, "active");
  assert.equal(s.steps[1].status, "pending");
  assert.equal(s.steps[0].weight, 50);
  assert.equal(s.steps[1].weight, 50);
});

test("task completion advances weighted progress", () => {
  let s = startTurn("s", "Build the export feature", "turn-1");
  s = upsertTaskStep(s, "t1", "Design schema");
  s = upsertTaskStep(s, "t2", "Implement export endpoint");
  const before = calculateProgress(s.steps) ?? 0;
  s = completeTaskStep(s, "t1");
  const after = calculateProgress(s.steps) ?? 0;
  assert.ok(after > before, `expected progress to advance: ${before} -> ${after}`);
  assert.equal(s.steps.find(step => step.id === "t2")?.status, "active");
});

test("semantic weights supplied by the skill are preserved", () => {
  let s = startTurn("s", "Build the export feature", "turn-1");
  s = upsertTaskStep(s, "t1", "Design schema");
  s = upsertTaskStep(s, "t2", "Implement export endpoint");
  // Skill assigns a deliberate semantic weight and detaches it from auto-rebalancing.
  s.steps = s.steps.map(step => step.id === "t1" ? { ...step, weight: 70, weightSource: "semantic" } : step);
  s = upsertTaskStep(s, "t3", "Write tests");
  const schema = s.steps.find(step => step.id === "t1");
  const others = s.steps.filter(step => step.id !== "t1");
  assert.equal(schema?.weight, 70);
  for (const step of others) assert.equal(step.weight, 15);
});

test("all tasks completed sets overall status to complete", () => {
  let s = startTurn("s", "Build the export feature", "turn-1");
  s = upsertTaskStep(s, "t1", "Design schema");
  s = upsertTaskStep(s, "t2", "Implement export endpoint");
  s = completeTaskStep(s, "t1");
  assert.equal(s.status, "active");
  s = completeTaskStep(s, "t2");
  assert.equal(s.status, "complete");
});

test("stale events cannot mutate a newer turn", () => {
  const s = startTurn("s", "Build the export feature", "turn-2");
  assert.equal(isStaleEvent(s, "turn-1"), true);
  assert.equal(isStaleEvent(s, "turn-2"), false);
  assert.equal(isStaleEvent(s, undefined), false);
});
