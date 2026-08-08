# Contributing

Thanks for considering a contribution to Claude Progress.

## Development setup

```sh
npm install
npm test
```

`npm test` builds the TypeScript sources and runs the Node test runner suite in `test/`.

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
