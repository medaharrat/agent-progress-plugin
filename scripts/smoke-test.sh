#!/usr/bin/env bash
# Automates the "simulate hook events" walkthrough from CONTRIBUTING.md against a disposable project.
set -euo pipefail

PROJECT=""
KEEP=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CREATED_TMP=0
if [[ -z "$PROJECT" ]]; then
  PROJECT="$(mktemp -d "${TMPDIR:-/tmp}/claude-progress-smoke.XXXXXX")"
  CREATED_TMP=1
fi

HOOK="$PROJECT/.claude/progress-extension/dist/hook.js"
STATUSLINE="$PROJECT/.claude/progress-extension/dist/statusline.js"
SESSION="smoke-test"

section() { echo; echo "=== $1 ==="; }
send_hook() { node "$HOOK" <<<"$1" >/dev/null; }
show_status() { echo "{\"session_id\":\"$SESSION\",\"workspace\":{\"project_dir\":\"$PROJECT\"}}" | NO_COLOR=1 node "$STATUSLINE"; }

mkdir -p "$PROJECT/.claude"

section "Installing into disposable project: $PROJECT"
node "$REPO_ROOT/dist/src/cli.js" init --project "$PROJECT"

section "Stage 1: UserPromptSubmit (new prompt)"
send_hook "{\"session_id\":\"$SESSION\",\"cwd\":\"$PROJECT\",\"hook_event_name\":\"UserPromptSubmit\",\"prompt_id\":\"turn-1\",\"prompt\":\"Implement authentication with tests and documentation\"}"
show_status

section "Stage 2: TaskCreated x2"
send_hook "{\"session_id\":\"$SESSION\",\"cwd\":\"$PROJECT\",\"hook_event_name\":\"TaskCreated\",\"prompt_id\":\"turn-1\",\"task_id\":\"task-1\",\"task_subject\":\"Implement authentication backend\"}"
send_hook "{\"session_id\":\"$SESSION\",\"cwd\":\"$PROJECT\",\"hook_event_name\":\"TaskCreated\",\"prompt_id\":\"turn-1\",\"task_id\":\"task-2\",\"task_subject\":\"Add authentication tests\"}"
show_status

section "Stage 3: PostToolUse (simulated file edit)"
send_hook "{\"session_id\":\"$SESSION\",\"cwd\":\"$PROJECT\",\"hook_event_name\":\"PostToolUse\",\"prompt_id\":\"turn-1\",\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"src/auth.ts\"}}"
show_status

section "Stage 4: TaskCompleted x2"
send_hook "{\"session_id\":\"$SESSION\",\"cwd\":\"$PROJECT\",\"hook_event_name\":\"TaskCompleted\",\"prompt_id\":\"turn-1\",\"task_id\":\"task-1\",\"task_subject\":\"Implement authentication backend\"}"
show_status
send_hook "{\"session_id\":\"$SESSION\",\"cwd\":\"$PROJECT\",\"hook_event_name\":\"TaskCompleted\",\"prompt_id\":\"turn-1\",\"task_id\":\"task-2\",\"task_subject\":\"Add authentication tests\"}"
show_status

section "Raw session state"
cat "$PROJECT/.claude/progress/$SESSION.json"
echo

section "Uninstalling"
node "$REPO_ROOT/dist/src/cli.js" uninstall --project "$PROJECT"

if [[ $CREATED_TMP -eq 1 && $KEEP -eq 0 ]]; then
  rm -rf "$PROJECT"
  echo
  echo "Removed disposable project directory."
else
  echo
  echo "Project left in place: $PROJECT"
fi
