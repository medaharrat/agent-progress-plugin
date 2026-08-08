export type StepStatus = "pending" | "active" | "done" | "blocked" | "skipped";
export type WeightSource = "provisional" | "semantic";

export interface ProgressStep {
  id: string;
  name: string;
  weight: number;
  status: StepStatus;
  completion?: number;
  note?: string;
  /** "provisional" weights are auto-rebalanced by hooks; anything else is preserved as authored by the skill. */
  weightSource?: WeightSource;
}

export interface Blocker {
  id: string;
  message: string;
  source: "automatic" | "explicit";
  active: boolean;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export interface TestStats { passed: number; failed: number; skipped: number; total: number; }

export interface ProgressState {
  version: 1;
  sessionId: string;
  /** Identifies the current turn (Claude Code's `prompt_id` when available). Guards against stale cross-turn writes. */
  turnId: string;
  goal: string;
  substantial: boolean;
  status: "active" | "complete" | "stopped";
  steps: ProgressStep[];
  blockers: Blocker[];
  filesChanged: string[];
  tests: TestStats;
  failureSignatures: Record<string, number>;
  startedAt: string;
  updatedAt: string;
}

export interface HookInput {
  session_id?: string;
  cwd?: string;
  hook_event_name?: string;
  /** UUID for the prompt currently being processed; doubles as our turn identifier. */
  prompt_id?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  error?: string;
  error_message?: string;
  notification_type?: string;
  message?: string;
  agent_id?: string;
  agent_type?: string;
  last_assistant_message?: string;
  task_id?: string;
  task_subject?: string;
  task_description?: string;
}
