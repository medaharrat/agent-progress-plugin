#!/usr/bin/env node
import { loadState } from "./state.js";
import { renderStatus } from "./render.js";

let raw = ""; for await (const c of process.stdin) raw += c;
try {
  const input = JSON.parse(raw || "{}") as { session_id?: string; cwd?: string; workspace?: { project_dir?: string; current_dir?: string } };
  const cwd = input.workspace?.project_dir ?? input.workspace?.current_dir ?? input.cwd ?? process.cwd();
  const state = await loadState(cwd, input.session_id ?? "unknown");
  console.log(renderStatus(state, Number(process.env.COLUMNS ?? 100), process.env.NO_COLOR === undefined));
} catch { console.log("Progress: unavailable"); }
