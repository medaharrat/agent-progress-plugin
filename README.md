# Claude Progress

[![test](https://github.com/medaharrat/agent-progress-plugin/actions/workflows/test.yml/badge.svg)](https://github.com/medaharrat/agent-progress-plugin/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A local, dependency-light progress extension for Claude Code. It combines a semantic planning skill, lifecycle hooks, persistent per-session JSON, per-turn staleness protection, repeated-failure detection, and a multi-line status renderer.

```text
PROGRESS Implement variable mission inputs  ███████████░░░░░░░░░ 55%
Now: Update frontend form
Next: Integration tests → Documentation
Blockers: none
Files: 11  Tests: 27/31 (4 failed)  Elapsed: 18m
```

Percentages represent weighted deliverables, not time, tokens, or tool-call counts. Small tasks deliberately show no percentage. While Claude is still planning a fresh turn (before any task steps exist), the status line shows `Now: Planning…` / `Next: waiting for task plan` instead of a percentage.

## Requirements

- Claude Code with hooks and status-line support
- Node.js 18 or newer
- npm (only needed to build the TypeScript package)

There are no runtime npm dependencies.

## Install into a project

Unzip this package, open a terminal in the extracted directory, and run:

```sh
npm install
npm test
npm run init -- --project /absolute/path/to/your/project
```

The installer:

1. Copies the compiled runtime to `<project>/.claude/progress-extension/`.
2. Installs the skill at `<project>/.claude/skills/progress/SKILL.md`.
3. merges managed handlers into `<project>/.claude/settings.local.json` for `UserPromptSubmit`, `TaskCreated`, `TaskCompleted`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `SubagentStop`, and `Notification`;
4. configures a status line with a one-second refresh; and
5. makes a timestamped settings backup before changing an existing file.

It refuses to modify malformed settings JSON. Existing unrelated hooks are preserved. The previous status-line configuration is stored for uninstall.

Restart Claude Code or submit another interaction after installation. Settings normally reload automatically.

## Use

Ask Claude to perform a substantial task normally — no need to invoke `/progress` manually. A `UserPromptSubmit` hook starts a fresh, correctly-scoped turn for every new prompt (new goal, empty step list, zeroed telemetry) and reminds Claude to maintain the plan. `TaskCreated`/`TaskCompleted` hooks keep the step list synchronized automatically whenever Claude's task list changes, using equal provisional weights until the skill supplies more deliberate ones. The status line reads `.claude/progress/<session-id>.json` and displays:

- semantic percent, current step, and the next two steps (or a planning indicator before any steps exist);
- active blockers;
- unique files written or edited;
- parsed test totals when a common test summary appears in tool output; and
- elapsed wall time for the current turn.

Session state persists in `<project>/.claude/progress/`. The `current-session` pointer tells the skill which state file belongs to the active session. Each state file carries a `turnId` (Claude Code's `prompt_id` when available) so that a slow or out-of-order hook event from a previous turn can never overwrite the current turn's state.

### Blockers

The failure hook fingerprints the tool name and input. Three consecutive equivalent failures create an automatic blocker; a later successful equivalent call clears it. Permission prompts and `agent_needs_input` notifications are also recorded. Claude can add explicit blockers under the skill’s rules.

This is intentionally a signal, not an oracle: different inputs create different fingerprints, and test parsing recognizes common summaries rather than every test runner format.

## Preview

```sh
npm run sample
```

Set `NO_COLOR=1` to disable ANSI colors. The renderer respects the `COLUMNS` value provided by Claude Code.

## Uninstall

From the extracted package directory:

```sh
npm run uninstall:project -- --project /absolute/path/to/your/project
```

Uninstall removes only managed hook entries and the installed skill/runtime, and restores the prior status line. It intentionally preserves `.claude/progress/` session history and timestamped backups; those may be deleted manually after review.

## State format

The main fields are `goal`, `substantial`, `status`, `turnId`, weighted `steps`, `blockers`, `filesChanged`, `tests`, failure counters, and timestamps. Writes are atomic. A completed step earns its full weight; an active step earns `weight × completion`; pending/blocked steps earn zero; skipped steps leave the denominator.

Steps created automatically by the `TaskCreated` hook carry `"weightSource": "provisional"` and share the remaining weight budget equally. When the skill assigns a deliberate effort/risk-based weight to a step, it clears `weightSource` (or sets it to `"semantic"`) so that value survives later hook-driven rebalancing.

## Development

```sh
npm run build
npm test
```

Core logic and rendering tests use Node's built-in test runner. See [`skill/SKILL.md`](skill/SKILL.md) for the planning contract.

## Security and scope

Hooks run local Node scripts and never call a network service. Hook output is observational and does not approve, block, or rewrite Claude Code actions. Project-local settings are used so installation does not affect unrelated projects.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations. Security issues should be reported per [SECURITY.md](SECURITY.md).
