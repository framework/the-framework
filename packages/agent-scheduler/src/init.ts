import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isMap, isScalar, isSeq, parseDocument, type YAMLSeq } from 'yaml'
import { OPENAGENT_DIR, lineRuns } from '@openagt/agent-data'
import { writeHookLines, type InitOutcome } from '@openagt/agent-runner'

/**
 * `init`: this tool's lines written into a dashboard's hooks file, so the scheduler runs while the
 * dashboard is open. The tool writes
 * its own lines: the dashboard names no tool. The lines that start, resume and check a run are
 * `agent-runner`'s, written by its own `init`. The writer is `agent-runner`'s too, with its rule: a
 * person's file is never overwritten, a list gains a line only when it lacks it.
 *
 * The lines name the tool bare, with no `npx`, like `agent-runner`'s: the dashboard brings this
 * tool and puts it on a line's PATH, so nothing is fetched from npm to run one. With `npx`, a
 * project that installed nothing got whatever package holds the name `agent-scheduler` on npm.
 *
 * A line that already runs the tool is the tool's line, however it is spelled: the one an earlier
 * version wrote (`npx agent-scheduler start`), or a person's own. `init` writes no second line
 * beside it, and `removeHooks` takes it out with the rest.
 */

/** The lines, in the order a new file lists them: `open` and `close`, each a list. */
export const HOOK_LINES: Readonly<Record<string, string | readonly string[]>> = {
  open: ['agent-scheduler start'],
  close: ['agent-scheduler stop --unless-keep-alive'],
}

/** This tool, as a hook line names it: its package or its command. */
const TOOL = { name: '@openagt/agent-scheduler', commands: ['agent-scheduler'] }

const HOOKS_FILE = `${OPENAGENT_DIR}/hooks.yml`

export type { InitOutcome }

/** What taking the lines out answered: the keys that lost a line, or why the file could not be changed. */
export type RemoveOutcome = { ok: true; file: string; removed: string[] } | { ok: false; reason: 'unreadable'; file: string; detail?: string }

/** One item of a hooks list, as the line it is. */
function lineOf(item: unknown): string {
  return String(isScalar(item) ? item.value : item)
}

/** The lists of the hooks file that hold this tool's lines, as written; none for a file that is not there or cannot be read. */
async function lists(repo: string): Promise<Record<string, string[]>> {
  const raw = await readFile(join(repo, HOOKS_FILE), 'utf8').catch(() => '')
  const doc = parseDocument(raw)
  if (doc.errors.length > 0 || !isMap(doc.contents)) return {}
  const found: Record<string, string[]> = {}
  for (const key of Object.keys(HOOK_LINES)) {
    const list = doc.get(key, true)
    if (isSeq(list)) found[key] = (list as YAMLSeq).items.map(item => lineOf(item))
  }
  return found
}

/** Whether the project's hooks start this tool when the dashboard opens: an `open` line runs it. */
export async function hasHooks(repo: string): Promise<boolean> {
  return ((await lists(repo))['open'] ?? []).some(line => lineRuns(line, TOOL))
}

/** Write the lines into `<repo>/.openagent/hooks.yml`, each only where no line of its list runs the tool yet; nothing where the dashboard has no directory. */
export async function initHooks(repo: string): Promise<InitOutcome> {
  const present = await lists(repo)
  const missing = Object.fromEntries(Object.entries(HOOK_LINES).filter(([key]) => !(present[key] ?? []).some(line => lineRuns(line, TOOL))))
  return writeHookLines(repo, missing)
}

/**
 * Take this tool's lines out of the hooks file: every `open` and `close` line that runs it. A list
 * left empty goes with its key; every other line, key and comment stays, and a file left with
 * nothing in it is deleted. A file that is not there has nothing to take.
 */
export async function removeHooks(repo: string): Promise<RemoveOutcome> {
  const file = join(repo, HOOKS_FILE)
  const raw = await readFile(file, 'utf8').catch(() => undefined)
  if (raw === undefined) return { ok: true, file, removed: [] }
  const doc = parseDocument(raw)
  const error = doc.errors[0]
  if (error) return { ok: false, reason: 'unreadable', file, detail: error.message.split('\n')[0] ?? error.message }
  if (!isMap(doc.contents)) return { ok: true, file, removed: [] }
  const removed: string[] = []
  for (const key of Object.keys(HOOK_LINES)) {
    const list = doc.get(key, true)
    if (!isSeq(list)) continue
    const seq = list as YAMLSeq
    const kept = seq.items.filter(item => !lineRuns(lineOf(item), TOOL))
    if (kept.length === seq.items.length) continue
    removed.push(key)
    if (kept.length === 0) doc.delete(key)
    else seq.items = kept
  }
  if (removed.length === 0) return { ok: true, file, removed }
  // A file that held nothing but these lines goes with them: it was this tool's.
  if (doc.contents.items.length === 0 && !/^\s*#/m.test(raw)) await rm(file)
  else await writeFile(file, doc.toString({ lineWidth: 0 }))
  return { ok: true, file, removed }
}
