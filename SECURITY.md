# Security Policy

## Scope

Claude Progress runs local Node.js scripts triggered by Claude Code hooks. It
has no runtime dependencies and never makes network calls; all state is
written to `.claude/progress/` inside the target project. See the README's
["Security and scope"](README.md#security-and-scope) section for details.

## Reporting a Vulnerability

If you find a security issue (e.g., a way for hook input to escape its
intended scope, path traversal in state file handling, or unsafe settings
merging), please report it privately rather than opening a public issue:

- Use GitHub's [private vulnerability reporting](https://github.com/medaharrat/agent-progress-plugin/security/advisories/new) for this repository, or
- Open a GitHub issue requesting a private contact channel if the above is unavailable.

Please include steps to reproduce and the potential impact. We'll acknowledge
reports as quickly as we can and work with you on a fix before any public
disclosure.
