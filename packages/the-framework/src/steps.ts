import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { definePrompt, promptInstructions, renderTask } from '@gemstack/ai-autopilot'
import type {
  BuildContext,
  PlannedSubtask,
  Prompt,
  SubtaskResult,
  SupervisorRun,
} from '@gemstack/ai-autopilot'
import type { DriverSession } from './driver/index.js'
import { continuationPrompt, parseAwaitGate, type ParsedAwaitGate } from './turn-gate.js'

/**
 * Driver-backed {@link https://github.com/gemstack-land/the-framework | Bootstrap} steps.
 *
 * These implement the injectable steps of ai-autopilot's `Bootstrap` by running
 * everything *through* a {@link DriverSession} (option A, #166): build / improve
 * are prompts that let the wrapped agent's own loop do the work; a domain
 * preset's review loop (#252) gates on the `{ blockers }` verdicts its prompts
 * report. There is no built-in review — the agent is treated as a black box
 * (#1372), so a run reviews only what the user opted into (a preset) or what is
 * mechanically checkable (the serve gate). Reusing the `Bootstrap` spine keeps
 * scope, narration, the loop gate, and deploy for free; only *who runs the inner
 * loop* changes.
 */

const ZERO_USAGE = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

/**
 * Resolve an agent-authored await gate (#337/#339) to the user's answer text.
 * Wired by the run (see `resolveAwaitGate` there); absent on a headless run.
 */
export type AwaitResolver = (gate: ParsedAwaitGate, round: number) => Promise<string>

/** Compose the build prompt for an intent. The stack is the agent's call (#545). */
export function buildPrompt(intent: string): string {
  return [
    `Build this app end to end: ${intent}`,
    'The workspace may be empty — if so, scaffold the whole project from scratch:',
    'create package.json with scripts, all config, and every source file, install',
    'the dependencies, and make the app run.',
    'When done, summarize what you built in one short paragraph.',
  ].join('\n')
}

/**
 * Framing for a run against an *existing* codebase. The greenfield {@link buildPrompt} tells the
 * agent the workspace may be empty and to scaffold from scratch, which is the wrong instruction
 * when the user pointed the framework at a project that already exists (#185).
 *
 * Naming the workspace is the whole job. The rules that used to follow it (do not re-scaffold,
 * read the existing code first, make the smallest coherent set of changes) were dropped in #1224:
 * they told a capable agent how to do its work rather than what the work was, and the one thing it
 * cannot infer, that this codebase already exists, is in the first line. Chosen when the workspace
 * already holds source at build time.
 */
export function extendPrompt(intent: string): string {
  return [
    `Work within the existing codebase in this workspace to deliver: ${intent}`,
    'When done, summarize what you changed in one short paragraph.',
  ].join('\n')
}

/**
 * A hard "the app does not exist yet — create it from scratch" directive. Used
 * when the workspace is empty at build or improve time, where the normal
 * {@link improvePrompt} ("smallest changes / no unrelated features") would
 * wrongly discourage scaffolding (#182).
 */
function scaffoldPrompt(intent: string): string {
  return [
    `The workspace is empty — no app exists here yet. You must create the entire app now from scratch: ${intent}`,
    'This is a from-scratch build, not an edit: do not wait for existing code, and do',
    'not refuse because the directory is empty — that is expected. Scaffold the full',
    'project (package.json with scripts, config, and every source file), install',
    'dependencies, and do not stop until the requested features exist and the app runs.',
  ].join('\n')
}

/** Compose the improve prompt for a set of blockers. */
export function improvePrompt(blockers: readonly string[]): string {
  return [
    'Address these blockers in the app, then stop:',
    ...blockers.map(b => `- ${b}`),
    'Make the changes needed to clear them, and only those — but do whatever they',
    'require, including adding missing features, files, or dependencies. Do not chase',
    'unrelated polish.',
  ].join('\n')
}

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', '.cache', '.vite'])
const IGNORED_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.gitignore',
  '.npmrc',
  '.DS_Store',
])

/**
 * Whether a workspace holds no app yet — no source file the agent could have
 * produced. Used to detect a build that stalled without scaffolding (#182):
 * lockfiles, dotfiles, and dependency/output dirs do not count. Best-effort and
 * cheap: it stops at the first real file and never throws.
 */
export function isWorkspaceEmpty(dir: string): boolean {
  return !hasSourceFile(dir, 0)
}

function hasSourceFile(dir: string, depth: number): boolean {
  if (depth > 6) return false
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return false // unreadable / missing dir: treat as empty.
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      if (hasSourceFile(join(dir, entry.name), depth + 1)) return true
    } else if (entry.isFile()) {
      if (IGNORED_FILES.has(entry.name) || entry.name.startsWith('.')) continue
      return true
    }
  }
  return false
}

/**
 * Whether a step should hard-scaffold rather than build/improve normally (#182): the
 * workspace is still empty and this driver verifies its output (a real driver; the fake
 * one writes nothing, so it opts out to stay deterministic). Read at the moment the step
 * decides, since the workspace changes as the agent works.
 */
function shouldScaffold(session: DriverSession, verifyWorkspace: boolean | undefined): boolean {
  return verifyWorkspace === true && isWorkspaceEmpty(session.cwd)
}

/** Options shared by the driver-backed steps. */
export interface DriverStepOptions {
  /** Extra per-step framing appended to the session system prompt. */
  system?: string
}

/** One synthetic subtask result: a driver turn's text, always "ok" (the driver owns pass/fail). */
function subtaskResult(subtask: PlannedSubtask, text: string): SubtaskResult {
  return { subtask, text, ok: true, usage: ZERO_USAGE }
}

/** Wrap driver-turn results in a {@link SupervisorRun} so the bootstrap narration shows a phase. */
function supervisorRun(results: SubtaskResult[]): SupervisorRun {
  return {
    text: results[results.length - 1]!.text,
    plan: results.map(r => r.subtask),
    results,
    usage: ZERO_USAGE,
    stoppedEarly: false,
  }
}

/**
 * Resume the build after the agent stopped to ask (#337): the turn-boundary choice
 * gate re-prompts the driver with the user's pick so it continues from the decision
 * rather than deciding for itself. A fresh turn (option A), so the agent re-reads the
 * workspace and the pick frames what to do next. Returns a {@link SupervisorRun} in
 * the same shape as {@link driverBuild} so the gate can hand it straight back.
 */
export function continueAfterChoice(
  session: DriverSession,
  ctx: BuildContext,
  question: string,
  answer: string,
): Promise<SupervisorRun> {
  const prompt = continuationPrompt(question, answer)
  return session
    .prompt(prompt, { ...(ctx.signal ? { signal: ctx.signal } : {}) })
    .then(turn => {
      const subtask: PlannedSubtask = { id: 'build-resume', description: 'Continue after the user picked' }
      return supervisorRun([subtaskResult(subtask, turn.text)])
    })
}

/**
 * The build step: prompt the driver to build the app and let its own loop run.
 * Emits synthetic Supervisor events so the bootstrap narration still shows a
 * build phase, and returns a {@link SupervisorRun} carrying the driver's summary.
 */
export function driverBuild(
  session: DriverSession,
  opts: {
    prompt?: (intent: string) => string
    /**
     * Guarantee the build produced files: after the build turn, if the workspace
     * is still empty (the agent stalled instead of scaffolding), re-prompt once
     * with a hard from-scratch directive (#182). Off by default; the runner
     * enables it for real drivers (the fake driver writes no files, so it stays
     * off there).
     */
    verifyWorkspace?: boolean
  } & DriverStepOptions = {},
): (ctx: BuildContext) => Promise<SupervisorRun> {
  const composeOverride = opts.prompt
  const promptOpts = {
    ...(opts.system ? { system: opts.system } : {}),
  }
  return async ctx => {
    const signalOpt = ctx.signal ? { signal: ctx.signal } : {}
    // An existing project (a non-empty workspace at build time) is *extended*, not
    // rebuilt from scratch (#185). Gated on verifyWorkspace so the fake driver
    // (which writes nothing, so its workspace always reads empty) always takes the
    // greenfield path and stays deterministic. A caller-supplied prompt wins.
    const existing = opts.verifyWorkspace === true && !isWorkspaceEmpty(session.cwd)
    const firstPrompt = composeOverride
      ? composeOverride(ctx.intent)
      : existing
        ? extendPrompt(ctx.intent)
        : buildPrompt(ctx.intent)
    const subtask: PlannedSubtask = {
      id: 'build-1',
      description: existing ? 'Extend the existing codebase' : 'Build with the wrapped agent',
    }
    ctx.onEvent({ type: 'plan', task: ctx.intent, subtasks: [subtask] })
    ctx.onEvent({ type: 'dispatch-start', subtask })

    let turn = await session.prompt(firstPrompt, { ...promptOpts, ...signalOpt })
    const results: SubtaskResult[] = [subtaskResult(subtask, turn.text)]
    ctx.onEvent({ type: 'dispatch-result', result: results[0]! })

    // #182: the build must actually produce an app. If nothing landed on disk,
    // the agent stalled (e.g. sanity-checking the stack) — re-prompt once with a
    // hard "create it from scratch" directive so an empty-dir run starts building.
    // Exception (#337 / #339): an empty workspace plus an await block means the agent
    // stopped *on purpose* to ask; the await gate handles it, so don't clobber the
    // question with a scaffold directive.
    if (shouldScaffold(session, opts.verifyWorkspace) && !parseAwaitGate(turn.text)) {
      const retry: PlannedSubtask = { id: 'build-2', description: 'Scaffold the app from scratch (workspace was empty)' }
      ctx.onEvent({ type: 'dispatch-start', subtask: retry })
      turn = await session.prompt(scaffoldPrompt(ctx.intent), { ...promptOpts, ...signalOpt })
      const retryResult = subtaskResult(retry, turn.text)
      results.push(retryResult)
      ctx.onEvent({ type: 'dispatch-result', result: retryResult })
    }

    ctx.onEvent({ type: 'synthesize', results })
    return supervisorRun(results)
  }
}
