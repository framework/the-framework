import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DriverSession } from 'agent-driver'
import { parseQueueEntries, queueDone, readQueueEntries, ticketFromQueueEntry } from '@gemstack/skill-tickets'
import type { ChoicePick, ChoiceRequest, FrameworkEvent } from './events.js'
import { requestChoices, runAwaitRounds } from './await-gate.js'
import { drainsQueue } from './preset-catalog.js'
import { createTurnSignalEmitter } from './turn-gate.js'

/**
 * The backlog loop (#323): once the main work settles, consume the agent queue one entry per
 * turn until it is empty. The agent writes the queue itself (a very large scope, the Maintenance
 * follow-ups, or the [Research] preset's deep-dive picks all add entries); the framework only
 * drives: read the queue, gate ("start the next item?") when someone can answer, prompt the agent
 * to complete exactly one entry, take it off the queue, repeat. Termination is Rom's call on the
 * issue: stop when the queue is empty. The dashboard's autopilot auto-accepts the per-item gate,
 * so `[x] autopilot` consumes the whole queue unattended; autopilot off pauses before each entry.
 *
 * The queue is the `tickets` skill's (#1748): it lives on the `agent-data` branch, read and changed
 * through the skill's library — the framework holds no copy and edits no file of its own.
 */

/**
 * Does this session's own backlog still have open work (#1363)?
 *
 * Reads only `TODO_<SESSION_NAME>.agent.md` — the file the [Research] preset (and a very-large
 * scope) has the agent keep for its own session. Never the global queue: the queue is decoupled
 * from sessions (#1390), and withholding a merge on it would mean auto-merge never fires while
 * the project has any backlog at all. `false` on a missing or unreadable file, and on a session
 * name that could not name a file — no pendingness known is not pendingness.
 *
 * TEMPORARY SAFETY BELT, built to be deleted (#1390): the agent's setReadyForMerge() is the
 * authorization, and this only catches the agent declaring done while its own session file says
 * otherwise. When the agent's word is deemed enough, delete this function and its single call
 * site in `maybeAutoHandoff`.
 */
export async function agentTodoPending(cwd: string, sessionName: string | undefined): Promise<boolean> {
  // The prompt asks for [a-z0-9-]+; anything wider (a path separator above all) names no file.
  if (!sessionName || !/^[A-Za-z0-9._-]+$/.test(sessionName)) return false
  const md = await readFile(join(cwd, `TODO_${sessionName}.agent.md`), 'utf8').catch(() => undefined)
  return md !== undefined && parseQueueEntries(md).length > 0
}

/**
 * The ticket the next drain agent will pick up, or `undefined` when there is none (#1117).
 *
 * "Next" is the first open entry of the queue, because that is what the [Drain queue] preset
 * says to work ("the FIRST open entry only") and the queue reads in file order. Read from the
 * same copy the sweep already consults when it decides whether there is anything to drain, so
 * the entry this names is the entry that decision was made on.
 *
 * A best guess by construction: the agent reads the queue a moment later, and an entry taken off
 * in between would move it on. Being wrong here costs a mislabelled lane on the Overview and
 * nothing else — no run is started or steered by this.
 */
export async function nextQueuedTicket(cwd: string): Promise<string | undefined> {
  const first = (await readQueueEntries(cwd))[0]
  return first ? ticketFromQueueEntry(first) : undefined
}

/**
 * The ticket an agent started by hand is about to implement, when that agent is a drain (#1117).
 *
 * The daemon already does this for the sweep's own drain, off the `drains` flag on the job. An agent
 * fired from the dashboard reaches the same start with none of that context, so a hand-fired drain
 * showed up working on nothing: the agent implemented the ticket, and the lane it belonged in stayed
 * empty. Same read as the sweep's, so both agree on which entry is next.
 *
 * Undefined for anything that is not a drain, and for a drain over an empty queue. The `read` seam
 * is for tests; production always takes the default.
 */
export async function ticketForPrompt(
  prompt: string,
  cwd: string,
  read: (cwd: string) => Promise<string | undefined> = nextQueuedTicket,
): Promise<string | undefined> {
  if (!drainsQueue(prompt)) return undefined
  return read(cwd).catch(() => undefined)
}

/** Why the loop ended. */
export type TodoLoopReason =
  /** The queue is empty (or was never written) — the success case. */
  | 'empty'
  /** The user picked "stop" at a per-item gate. */
  | 'stopped'
  /** Two removals in a row could not be written to the `agent-data` branch. */
  | 'stalled'
  /** The item cap was reached with entries still open. */
  | 'max-items'

/** What {@link runTodoLoop} resolves with. */
export interface TodoLoopResult {
  /** Queue entries worked (turns taken), regardless of outcome. */
  completed: number
  /** Why the loop ended. */
  reason: TodoLoopReason
  /**
   * An answer marked `stop` (#358) inside an item's turn — a plan the user declined — ends the
   * whole session, not just the loop. Distinct from the benign `reason: 'stopped'` per-item gate,
   * which only stops draining the queue. The caller aborts the session on this.
   */
  sessionStopped?: boolean
}

/** Options for {@link runTodoLoop}. */
export interface TodoLoopOptions {
  /** The live driver session the agent already owns. */
  session: DriverSession
  /** The agent's checkout; the queue is read from the repository it belongs to. */
  cwd: string
  /** Emit the loop's events onto the agent stream. */
  emit: (event: FrameworkEvent) => void
  /**
   * The interactive gate handler (#304). When wired, the loop pauses before each
   * entry ("start the next item?") — the dashboard's autopilot auto-accepts, so
   * autopilot off means a human gate per item (#323). Headless runs don't pause.
   */
  requestChoice?: ((req: ChoiceRequest) => Promise<ChoicePick>) | undefined
  /** The agent signal; aborting (Stop button / budget cap #322) ends the loop. */
  signal?: AbortSignal | undefined
  /** Hard cap on entries worked in one agent. Default {@link DEFAULT_MAX_TODO_ITEMS}. */
  maxItems?: number | undefined
}

/** The default per-agent cap on queue entries — a backstop beside the budget cap (#322). */
const DEFAULT_MAX_TODO_ITEMS = 25

/** How many consecutive failed removals before the loop stops rather than spins. */
const MAX_STALLS = 2

/**
 * Drive the queue to empty: read the next open entry (fresh off the `agent-data` branch), gate, prompt
 * the agent to complete exactly that entry, take it off the queue, and repeat. The removal is the
 * framework's, not the agent's (#1582): the queue lives on a branch the agent's checkout does not
 * hold, and the one writer model keeps every edit going through the same funnel. Caps make it
 * safe to leave unattended (#322's concern): the agent's budget/abort signal ends any turn, a
 * hard item cap bounds the agent, and two removals in a row failing to land stop the loop
 * instead of re-working the same entry. A queue turn is a turn like any other: await gates
 * (`showChoices()` / `showMultiSelect()`) and the signals (`showMarkdown()`, `setReadyForMerge()`,
 * `open-pr`) are honored here too.
 */
export async function runTodoLoop(opts: TodoLoopOptions): Promise<TodoLoopResult> {
  const { session, cwd, emit } = opts
  const maxItems = opts.maxItems ?? DEFAULT_MAX_TODO_ITEMS
  // One emitter for the whole queue, so ready-for-merge fires once across every item
  // and a session name only re-emits on an actual rename.
  const gateDeps = {
    requestChoice: opts.requestChoice,
    emit,
    signal: opts.signal,
    emitTurnSignals: createTurnSignalEmitter(emit),
  }

  let completed = 0

  // The queue emptied: announce it if we did any work, and report a clean finish.
  // Both the mid-loop find and the post-loop re-check funnel through here.
  const finishEmpty = (): TodoLoopResult => {
    if (completed > 0) emit({ kind: 'log', message: `Queue done: empty after ${completed} item(s).` })
    return { completed, reason: 'empty' }
  }

  for (let item = 0; item < maxItems; item++) {
    if (opts.signal?.aborted) break
    const entries = await readQueueEntries(cwd, { fresh: true })
    if (!entries.length) return finishEmpty()
    const next = entries[0]!
    const preview = next.length > 100 ? `${next.slice(0, 100)}…` : next

    if (item === 0) emit({ kind: 'log', message: `Queue: ${entries.length} open item(s).` })

    // The per-item gate (#323): pause before starting a new entry when someone
    // can answer. Interactive-only, like the plan-approval gate — a headless agent
    // emits no gate and just proceeds (autopilot semantics, budget-capped).
    if (opts.requestChoice) {
      const picked = await requestChoices({
        id: item === 0 ? 'todo-next' : `todo-next-${item}`,
        title: `Start the next queue item? (${entries.length} open)`,
        options: [
          { id: 'proceed', label: `Work on: ${preview}` },
          { id: 'stop', label: 'Stop the queue loop' },
        ],
        recommended: 'proceed',
        requestChoice: opts.requestChoice,
        emit,
        ...(opts.signal ? { signal: opts.signal } : {}),
      })
      if (picked === 'stop') {
        emit({ kind: 'log', message: `Queue loop stopped by you (${entries.length} item(s) left).` })
        return { completed, reason: 'stopped' }
      }
    }

    emit({ kind: 'log', message: `Queue item ${completed + 1}: ${preview}` })
    // Complete exactly this entry, honoring await gates. The queue is not the agent's to touch
    // (#1582): it lives on the `agent-data` branch, and the removal below is the framework's.
    const prompt = `Work on exactly this task from the project's agent queue, and nothing else:\n\n${next}\n\nComplete it fully and verify your work. Do not start any other task; the framework takes this entry off the queue when the turn ends.`
    const rounds = await runAwaitRounds({ session, prompt, ...gateDeps })
    completed++
    // A plan the user declined with a stop-marked answer (#358) ends the whole session, not just
    // this loop — so the session does not go on to publish work that was just rejected. The caller
    // aborts on `sessionStopped`; `reason` stays descriptive of the loop itself.
    if (rounds.stopped) {
      emit({ kind: 'log', message: `Session stopped by your answer (${entries.length} item(s) left).` })
      return { completed, reason: 'stopped', sessionStopped: true }
    }

    // Take the entry off the queue. A no-op when someone else already removed it meanwhile — the
    // write re-reads the fresh queue either way. Retried inline rather than across rounds: a
    // removal that never lands would re-serve the same entry, and re-doing finished work is worse
    // than stopping with the queue intact.
    let landed = false
    for (let tries = 0; tries < MAX_STALLS && !landed; tries++) {
      landed = (await queueDone(cwd, next)).ok
    }
    if (!landed) {
      emit({ kind: 'log', message: `Queue loop stopped: "${preview}" could not be taken off the queue after ${MAX_STALLS} attempt(s).` })
      return { completed, reason: 'stalled' }
    }
  }

  // Aborted mid-loop (Stop button / budget cap #322): the agent is ending anyway,
  // so report a clean stop without extra narration.
  if (opts.signal?.aborted) return { completed, reason: 'stopped' }

  const remaining = await readQueueEntries(cwd)
  if (!remaining.length) return finishEmpty()
  emit({ kind: 'log', message: `Queue loop stopped at the ${maxItems}-item cap; ${remaining.length} item(s) left.` })
  return { completed, reason: 'max-items' }
}
