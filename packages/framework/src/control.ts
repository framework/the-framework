import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ChoiceBy } from './events.js'
import { isHandoffLevel, type HandoffLevel } from './handoff-level.js'
import { FRAMEWORK_DIR } from '@better-skills/branch-management'
import { JsonlTailer, followFile } from './jsonl-tail.js'

/**
 * The dashboard-to-agent control channel (#344): the reverse of the event log.
 * Events flow run -> `.the-framework/events.jsonl` -> daemon -> browser; steering
 * flows browser -> daemon -> `.the-framework/control.jsonl` -> run. The daemon
 * appends a {@link ControlEntry} per Stop click / choice pick, and the agent tails
 * the file, aborting or resolving its parked gate. Same file-is-the-seam design
 * as the forward direction — no run<->daemon IPC.
 */

/** The control log filename under `.the-framework/`. */
export const CONTROL_FILE = 'control.jsonl'

/** One steering instruction from the dashboard to the live agent. */
export type ControlEntry =
  /** Stop the agent (the daemon dashboard's Stop button). */
  | { kind: 'stop' }
  /** Resolve a parked choice gate: the pick for the pending {@link ChoiceRequest} id. */
  | { kind: 'choice'; id: string; pick: string | string[]; by: ChoiceBy }
  /** A live-chat message the user sent to the running agent (#714). */
  | { kind: 'message'; text: string }
  /**
   * Move the end-of-session handoff (#1102): how far this session publishes itself when it
   * finishes — keep it local, push the branch, open a PR, merge it.
   *
   * One rung rather than a pair of booleans (B5): a surface offering checkboxes converts on its
   * side, so an impossible answer resolves *down* there instead of arriving here as "a PR with no
   * push" for this end to repair upward.
   *
   * Steering rather than an event because it is an instruction to the agent, and it has to reach a
   * run whose dashboard tab was opened after it started. The agent echoes what it applied back as an
   * event, which is what puts it on the meta the checkboxes read.
   */
  | { kind: 'handoff'; level: HandoffLevel }
  /**
   * The user's Merge action on a live session (#1391): arm the full publish ladder and record that
   * a human authorized the merge, so the merge gate (#1363) does not also demand the agent's
   * ready-for-merge signal — a human's word outranks it. The session still merges at its own end
   * (it ends itself once nothing needs a human, #1390); this is a pre-commitment, not an abort.
   */
  | { kind: 'merge' }

/** The control log path for a workspace. */
export function controlPath(cwd: string): string {
  return join(cwd, FRAMEWORK_DIR, CONTROL_FILE)
}

/** Append one entry to the workspace's control log, creating it as needed. */
export async function appendControl(cwd: string, entry: ControlEntry): Promise<void> {
  await mkdir(join(cwd, FRAMEWORK_DIR), { recursive: true })
  await appendFile(controlPath(cwd), JSON.stringify(entry) + '\n')
}

/**
 * Truncate the control log. An agent calls this at start so a previous agent's picks
 * can never fire into this one (gate ids like `plan-approval` repeat across runs).
 */
export async function resetControl(cwd: string): Promise<void> {
  await mkdir(join(cwd, FRAMEWORK_DIR), { recursive: true })
  await writeFile(controlPath(cwd), '')
}

/** A live control tail. {@link close} stops watching (idempotent). */
export interface ControlWatcher {
  close(): void
}

/**
 * Tail the workspace's control log, dispatching each well-formed entry as it is
 * appended. An `fs.watch` on `.the-framework/` plus a poll backstop, mirroring the
 * daemon's event tail (`fs.watch` is unreliable across platforms). Malformed or
 * unknown lines are skipped so a bad write can never crash an agent.
 */
export function watchControl(
  cwd: string,
  onEntry: (entry: ControlEntry) => void,
  pollMs = 300,
): ControlWatcher {
  const tailer = new JsonlTailer<ControlEntry>(controlPath(cwd), entry => {
    if (isControlEntry(entry)) onEntry(entry)
  })
  // unref: never keep the process alive just for steering.
  const stop = followFile(join(cwd, FRAMEWORK_DIR), () => tailer.pull(), { pollMs, unref: true })
  return { close: stop }
}

/** Shape-check a parsed line. A multi-select pick may legitimately be `[]`. */
function isControlEntry(value: unknown): value is ControlEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (v['kind'] === 'stop') return true
  if (v['kind'] === 'merge') return true
  // The rung must be one of the four: a half-written entry would otherwise disarm by accident,
  // and this decides whether the session's work reaches the remote at all.
  if (v['kind'] === 'handoff') return isHandoffLevel(v['level'])
  if (v['kind'] === 'message') return typeof v['text'] === 'string' && v['text'].length > 0
  if (v['kind'] !== 'choice') return false
  if (typeof v['id'] !== 'string' || !v['id']) return false
  const pick = v['pick']
  return typeof pick === 'string' || (Array.isArray(pick) && pick.every(p => typeof p === 'string'))
}
