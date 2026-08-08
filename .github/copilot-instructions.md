# Copilot instructions for this repo

Claude Progress is a local, dependency-light progress extension for Claude Code: a planning skill, lifecycle hooks, persistent per-session JSON state, and a status-line renderer. See [README.md](../README.md) for the full feature description and [CONTRIBUTING.md](../CONTRIBUTING.md) for the human contributor workflow.

## Setup and build

```sh
npm install
npm run build   # tsc, outputs to dist/
npm test        # builds, then runs node --test against dist/test/*.test.js
npm run lint     # eslint .
```

There is no watch mode; re-run `npm run build` (or `npm test`, which builds first) after editing `src/` or `test/`.

## Project layout

- `src/` — TypeScript sources (ESM, `NodeNext` module resolution, `strict: true`). Compiles to `dist/` with the same relative layout (e.g. `src/core.ts` → `dist/src/core.js`).
- `test/` — Node's built-in test runner (`node:test` + `node:assert/strict`), one file per `src/` module under test.
- `skill/SKILL.md` — the planning contract consumed by Claude Code's skill system, not application code.
- `dist/` is generated; never hand-edit files there.

## Constraints (do not violate)

- **No runtime dependencies.** `devDependencies` only (TypeScript, ESLint, etc.). Do not add a package to `dependencies`.
- **No network calls.** Hooks run local Node scripts against `.claude/progress/` in the target project and must never reach out to a network service — see the README's "Security and scope" section.
- Import with explicit `.js` extensions in TypeScript sources (required by `NodeNext` module resolution), e.g. `import { freshState } from "./state.js";`.

## Conventions

- Match the existing code style in the file you're editing rather than introducing a new one — this codebase is intentionally terse in places (e.g. multiple statements per line) and is not run through Prettier in CI.
- `npm run lint` (ESLint flat config, `eslint.config.js`) must pass; it enforces `prefer-const` and standard unused-vars/no-useless-escape rules among the TypeScript-ESLint recommended set.
- Add or update a test in `test/` for any behavior change; there is no separate integration/unit split, just one test file per module.

## CI

`.github/workflows/test.yml` runs `npm run lint` and `npm test` on Node 18, 20, and 22 for every push and pull request. Changes should pass both locally before opening a PR.
