# Contributing

Thanks for considering a contribution to Claude Progress.

## Development setup

```sh
npm install
npm test
```

`npm test` builds the TypeScript sources and runs the Node test runner suite in `test/`.

## Testing before you push

There are three levels, from fastest to most realistic. Run them in order; stop once you're confident.

1. **Unit tests** — `npm test` (builds + runs everything in `test/`). During active development, `npx tsc --watch` recompiles on save.
2. **Simulated hooks** — `npm run smoke-test` installs the extension into a disposable temp project, pipes a realistic sequence of hook events (`UserPromptSubmit` → `TaskCreated` ×2 → `PostToolUse` → `TaskCompleted` ×2) straight into the compiled hook binary, prints the status line after each stage, and uninstalls/cleans up automatically. Pass `--project /some/path` to target a project you want to inspect afterwards, and add `--keep` to skip the automatic cleanup.
3. **Live Claude Code test** — for changes that touch hook wiring or the installer itself, verify against a real Claude Code session in a disposable Git repo:

   ```sh
   mkdir -p /tmp/claude-progress-live && cd /tmp/claude-progress-live && git init
   cd /path/to/claude-progress-extension
   npm run dev-install -- --project /tmp/claude-progress-live
   cd /tmp/claude-progress-live && claude --debug
   ```

   `dev-install` symlinks `dist/` and `skill/` into the target project instead of copying them, so `npm run build` in this repo is picked up immediately — no reinstall needed between edits. (Only use `dev-install` against disposable projects; use plain `init` for anything real.) Give Claude a multi-step task and confirm the status line moves through `Planning… → active task → partial percentage → completed`, then submit a second prompt in the same session and confirm it immediately resets to `Planning…` instead of showing the previous goal. Finish with `npm run uninstall:project -- --project /tmp/claude-progress-live` and confirm unrelated settings and the previous status line are restored.

## Making changes

1. Fork the repo and create a branch off `main`.
2. Keep changes focused — one logical change per PR.
3. Add or update tests in `test/` for any behavior change.
4. Run `npm test` before opening a PR; CI runs the same check on Node 18, 20, and 22.
5. Open a PR describing what changed and why.

## Reporting issues

Open a GitHub issue with steps to reproduce, expected vs. actual behavior, your Node version, and (if relevant) the contents of the session state file from `.claude/progress/`.

## Scope

This project intentionally has no runtime dependencies and never calls a network service — see the "Security and scope" section of the [README](README.md). Please keep that constraint in mind when proposing features.
