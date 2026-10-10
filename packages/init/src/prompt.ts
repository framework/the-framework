import { emitKeypressEvents } from 'node:readline'

/**
 * The two questions `init` asks a person in a terminal: a list with ticks, and a yes or no. No
 * dependency: the list is a small pure state (`press`) and its drawing (`draw`), driven here by
 * the terminal's key presses.
 */

/** One row of the list. A row with no `name` is a group's title: it cannot be reached or ticked. */
export interface Row {
  name?: string
  label: string
  /** One line beside the name, cut to the terminal's width. */
  hint?: string
}

export interface ListState {
  rows: readonly Row[]
  ticked: ReadonlySet<string>
  /** The index of the row the cursor is on: always a row with a name. */
  cursor: number
  /** How the list ended, once it has: `enter` takes the ticks, `quit` changes nothing. */
  done?: 'enter' | 'quit'
}

/** A key as the list reads it. */
export type Key = 'up' | 'down' | 'space' | 'all' | 'none' | 'enter' | 'quit'

const named = (rows: readonly Row[]): number[] => rows.flatMap((row, index) => (row.name !== undefined ? [index] : []))

export function startList(rows: readonly Row[], ticked: Iterable<string>): ListState {
  return { rows, ticked: new Set(ticked), cursor: named(rows)[0] ?? 0 }
}

/** The list after one key. The cursor moves over the titles and stops at both ends. */
export function press(state: ListState, key: Key): ListState {
  const stops = named(state.rows)
  const at = stops.indexOf(state.cursor)
  switch (key) {
    case 'up':
      return { ...state, cursor: stops[Math.max(0, at - 1)] ?? state.cursor }
    case 'down':
      return { ...state, cursor: stops[Math.min(stops.length - 1, at + 1)] ?? state.cursor }
    case 'space': {
      const name = state.rows[state.cursor]?.name
      if (name === undefined) return state
      const ticked = new Set(state.ticked)
      if (!ticked.delete(name)) ticked.add(name)
      return { ...state, ticked }
    }
    case 'all':
      return { ...state, ticked: new Set(state.rows.flatMap(row => (row.name !== undefined ? [row.name] : []))) }
    case 'none':
      return { ...state, ticked: new Set() }
    case 'enter':
      return { ...state, done: 'enter' }
    case 'quit':
      return { ...state, done: 'quit' }
  }
}

export const LIST_KEYS = '↑↓ move · space tick · a all · n none · enter write · q leave as it is'

/** The list as lines of text, at most `height` of them and each at most `width` wide: the rows around the cursor when they do not all fit. */
export function draw(state: ListState, width: number, height: number): string[] {
  const lines = state.rows.map((row, index) => {
    if (row.name === undefined) return `  ${row.label}`
    const line = `${index === state.cursor ? '>' : ' '} [${state.ticked.has(row.name) ? 'x' : ' '}] ${row.label}${row.hint ? `  ${row.hint}` : ''}`
    return line.length > width ? `${line.slice(0, Math.max(0, width - 1))}…` : line
  })
  const room = Math.max(3, height - 2)
  if (lines.length <= room) return [...lines, '', LIST_KEYS]
  const first = Math.min(Math.max(0, state.cursor - Math.floor(room / 2)), lines.length - room)
  return [...lines.slice(first, first + room), '', LIST_KEYS]
}

/** The terminal a question is asked on. */
export interface Terminal {
  input: NodeJS.ReadStream
  output: NodeJS.WriteStream
}

const KEYS: Record<string, Key> = { up: 'up', k: 'up', down: 'down', j: 'down', space: 'space', a: 'all', n: 'none', return: 'enter', enter: 'enter', q: 'quit', escape: 'quit' }

/** Ask the list on a terminal: the names ticked at Enter, or nothing when the person left it as it is. */
export function askList(rows: readonly Row[], ticked: Iterable<string>, terminal: Terminal): Promise<Set<string> | undefined> {
  const { input, output } = terminal
  let state = startList(rows, ticked)
  let drawn = 0
  const paint = (): void => {
    const lines = draw(state, output.columns ?? 80, output.rows ?? 24)
    // Back to the first line of the last drawing, then every line written over and the rest cleared.
    if (drawn > 0) output.write(`\x1b[${drawn}A`)
    output.write(lines.map(line => `\x1b[2K${line}\n`).join('') + '\x1b[J')
    drawn = lines.length
  }
  return new Promise(resolve => {
    emitKeypressEvents(input)
    input.setRawMode(true)
    input.resume()
    output.write('\x1b[?25l')
    const end = (): void => {
      input.off('keypress', onKey)
      input.setRawMode(false)
      input.pause()
      output.write('\x1b[?25h')
    }
    const onKey = (_text: string | undefined, key: { name?: string; ctrl?: boolean } | undefined): void => {
      const pressed = key?.ctrl && (key.name === 'c' || key.name === 'd') ? 'quit' : KEYS[key?.name ?? '']
      if (!pressed) return
      state = press(state, pressed)
      paint()
      if (!state.done) return
      end()
      resolve(state.done === 'enter' ? new Set(state.ticked) : undefined)
    }
    input.on('keypress', onKey)
    paint()
  })
}

/** Ask yes or no on a terminal, one key: Enter takes `fallback`. */
export function askYesNo(question: string, fallback: boolean, terminal: Terminal): Promise<boolean> {
  const { input, output } = terminal
  output.write(`${question} ${fallback ? '(Y/n)' : '(y/N)'} `)
  return new Promise(resolve => {
    emitKeypressEvents(input)
    input.setRawMode(true)
    input.resume()
    const onKey = (_text: string | undefined, key: { name?: string; ctrl?: boolean } | undefined): void => {
      const name = key?.name ?? ''
      const answer = name === 'y' ? true : name === 'n' || name === 'escape' || (key?.ctrl && name === 'c') ? false : name === 'return' || name === 'enter' ? fallback : undefined
      if (answer === undefined) return
      input.off('keypress', onKey)
      input.setRawMode(false)
      input.pause()
      output.write(`${answer ? 'yes' : 'no'}\n`)
      resolve(answer)
    }
    input.on('keypress', onKey)
  })
}
