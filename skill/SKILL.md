---
name: progress
description: Creates and maintains semantic weighted progress for substantial multi-step tasks. Use for implementations, migrations, investigations, or other work likely to require several tool calls. Omit percentage plans for small tasks.
---

# Semantic progress tracking

For a substantial task, read `.claude/progress/current-session` and create or update `.claude/progress/<session-id>.json` using that value. Hooks create both on first tool activity, and also seed a fresh per-turn state as soon as you submit a prompt. If the pointer does not exist yet, make one harmless tool call before planning. Keep updates concise and factual.

## Stay in sync automatically

A `UserPromptSubmit` hook already resets the session state for every new prompt (temporary goal, empty steps, `Planning…`) and reminds you to maintain the plan, so you never need `/progress` to start tracking. `TaskCreated` and `TaskCompleted` hooks also add, update, and complete steps automatically whenever you create or finish tasks with the task tool, using equal provisional weights until you supply better ones.

Even so, **update `.claude/progress/<session-id>.json` yourself right after you create or change your task list** for any substantial turn: replace provisional weights with effort/risk-based ones, tighten step names, and set `completion` as concrete sub-results land. The hooks keep the state from going stale between your edits; they are not a substitute for your semantic judgment.

Steps the `TaskCreated` hook adds carry `"weightSource": "provisional"` and split the remaining weight evenly. When you assign a deliberate weight to a step, delete its `weightSource` field (or set it to `"semantic"`) so hook-driven rebalancing never overwrites your value again.

## Decide whether to track a percentage

- Set `substantial: true` only when the work has at least three meaningful deliverables or will likely take more than a few minutes.
- For a small or single-action task, set `substantial: false`, leave `steps` empty, and do not invent a percentage.
- Never derive progress from elapsed time, token use, or tool-call count.

## Create a semantic plan

Break the outcome into 3–8 verifiable steps. Assign weights by expected effort and risk, totaling 100. Each step uses `pending`, `active`, `done`, `blocked`, or `skipped`. Only one step should normally be `active`.

Active steps may have `completion` from 0 to 1, but update it only when a concrete sub-result changes. A step is `done` only after its acceptance condition is met. Mark obsolete work `skipped`; skipped weight is excluded from the denominator.

Example:

```json
{
  "goal": "Implement mission input variables",
  "substantial": true,
  "steps": [
    { "id": "schema", "name": "Database schema", "weight": 15, "status": "done" },
    { "id": "backend", "name": "Backend interpolation", "weight": 25, "status": "active", "completion": 0.5 },
    { "id": "frontend", "name": "Frontend form", "weight": 25, "status": "pending" },
    { "id": "tests", "name": "Tests", "weight": 25, "status": "pending" },
    { "id": "docs", "name": "Documentation", "weight": 10, "status": "pending" }
  ]
}
```

Preserve the other state fields written by hooks. Write updates atomically (temporary file followed by rename) when practical.

## Maintain it

- Update the plan when starting or finishing a meaningful step, when scope changes, and when blocked.
- Set explicit blockers in `blockers` with `source: "explicit"`, an active flag, count, and ISO timestamps. State the dependency or decision needed, not merely that work is difficult.
- Clear `active` when a blocker is resolved. Hooks separately add automatic blockers after three identical failed tool calls and when Claude is waiting for permission or user input.
- Record newly discovered work by rebalancing unfinished weights; do not distort completed work merely to make the percentage look smooth.
- At completion, mark accepted steps done and set top-level `status: "complete"`.

Progress is the sum of completed weights plus the concrete completion fraction of the active step. Communicate uncertainty when the remaining scope is still being discovered.
