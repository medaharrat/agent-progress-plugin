# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0]

- Added `UserPromptSubmit` hook: starts a fresh, correctly-scoped turn (new goal, empty steps, zeroed telemetry) for every new prompt and reminds Claude to maintain the progress plan, instead of carrying over stale state from a prior turn.
- Added `TaskCreated`/`TaskCompleted` hooks: automatically create, update, and complete plan steps as Claude's task list changes, using equal provisional weights until the skill supplies deliberate ones.
- Added a `turnId` per session state (Claude Code's `prompt_id` when available) and a staleness guard so a slow or out-of-order hook event from a previous turn can never overwrite the current turn's state.
- Added a `weightSource` convention (`"provisional"` vs `"semantic"`) so hand-authored weights survive later automatic rebalancing.
- Added a "planning" status-line state (`Now: Planning…` / `Next: waiting for task plan`) shown before any task steps exist.
- Updated the installer to register the 3 new hook events; existing unrelated hooks/settings are still preserved on install and uninstall.
- Updated `skill/SKILL.md` and README to document the new automatic lifecycle and weight-preservation rules.
- Added `npm run smoke-test`, which drives a realistic hook-event sequence against a disposable temp project and prints the status line after each stage.
- Added `npm run dev-install` (`claude-progress dev-install`), which symlinks `dist/` and `skill/` into a target project for fast local iteration without reinstalling after every build.

## [1.0.0]

Initial release.

- Semantic weighted progress tracking for Claude Code sessions.
- Planning skill, lifecycle hooks, persistent per-session JSON state.
- Repeated-failure detection and multi-line status renderer.
