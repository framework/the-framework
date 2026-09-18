import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { isMap, isSeq, parseDocument, YAMLSeq } from 'yaml'
import { DASHBOARD_DIR, DASHBOARD_HOOKS } from './names.js'

/**
 * `init`: this tool's lines written into a dashboard's hooks file, so a project added to the
 * dashboard can check and start a run with nothing typed by hand. The tool writes its own lines: the
 * dashboard names no tool, and a project that wants another tool writes that tool's lines.
 *
 * A person's file is never overwritten. A one-line key already there keeps its line, whatever
 * it says; a list (`open`, `close`) gains this tool's line only when it lacks it; comments and
 * the other keys stay as they were.
 */

/** The lines, in the order a new file lists them. `open` and `close` are lists, the rest one line each. */
export const HOOK_LINES: Readonly<Record<string, string | readonly string[]>> = {
  open: ['npx agent-scheduler start'],
  close: ['npx agent-scheduler stop --unless-keep-alive'],
  start: 'npx agent-scheduler run --detach "$PROMPT" ${DRIVER:+--driver "$DRIVER"} ${MODEL:+--model "$MODEL"}',
  resume: 'npx agent-scheduler run --detach --resume "$RUN_ID" ${TEXT:+"$TEXT"} ${ANSWER:+--answer "$ANSWER"}',
  check: 'npx agent-scheduler check ${DRIVER:+--driver "$DRIVER"}',
  offset: 'npx agent-scheduler offset -- "$POINTS"',
  switch: 'npx agent-scheduler switch "$COMMAND" "$SWITCH"',
}

export type InitOutcome =
  | { ok: true; file: string; added: string[]; kept: string[] }
  | { ok: false; reason: 'no-dashboard' | 'unreadable'; file: string; detail?: string }

/**
 * Write the lines into `<repo>/.the-framework/hooks.yml`. The dashboard's directory must be there
 * already (the dashboard makes it when the project is added, and hides it from git); without it
 * nothing is written. `added` names the keys that gained a line, `kept` the ones already set
 * otherwise.
 */
export async function initHooks(repo: string): Promise<InitOutcome> {
  const file = join(repo, DASHBOARD_HOOKS)
  if (!(await isDirectory(join(repo, DASHBOARD_DIR)))) return { ok: false, reason: 'no-dashboard', file }

  let raw = ''
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    // No file yet: every line is added.
  }
  const doc = parseDocument(raw)
  const error = doc.errors[0]
  if (error) return { ok: false, reason: 'unreadable', file, detail: error.message.split('\n')[0] ?? error.message }
  // An empty file, or one of comments only, is an empty map.
  if (doc.contents === null) doc.contents = doc.createNode({}) as unknown as typeof doc.contents
  if (!isMap(doc.contents)) return { ok: false, reason: 'unreadable', file, detail: 'the file is not a YAML map' }

  const added: string[] = []
  const kept: string[] = []
  for (const [key, line] of Object.entries(HOOK_LINES)) {
    const present = doc.get(key, true)
    if (typeof line === 'string') {
      if (present == null) {
        doc.set(key, line)
        added.push(key)
      } else if (String(doc.get(key)).trim() !== line) {
        kept.push(key)
      }
      continue
    }
    if (present == null) {
      doc.set(key, doc.createNode([...line]))
      added.push(key)
    } else if (isSeq(present)) {
      const lines = (present as YAMLSeq).items.map(item => String(isScalarLike(item) ? item.value : item).trim())
      const missing = line.filter(l => !lines.includes(l))
      for (const l of missing) (present as YAMLSeq).add(doc.createNode(l))
      if (missing.length > 0) added.push(key)
    } else {
      kept.push(key)
    }
  }
  if (added.length > 0) {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, doc.toString({ lineWidth: 0 }))
  }
  return { ok: true, file, added, kept }
}

function isScalarLike(item: unknown): item is { value: unknown } {
  return typeof item === 'object' && item !== null && 'value' in item
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}
