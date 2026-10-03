import { useEffect, useRef, useState } from 'react'
import { SettingsSection, SettingsSelectRow, useCodingAgents, useModuleHost, usePolled, type ModuleSettingsProps } from 'framework/module'
import { DEFAULT_AT_ONCE, type Level, type Settings } from '../src/levels.js'
import { runnerChoices, runnerOf, runnerValue } from './choices.js'

// Settings → Subagents: which coding agent and model a main agent's subagents run on, by how hard
// the main agent says their task is, and how many of one main agent's subagents run at once. The
// same on every project: read with `orchestration settings` in the first project that answers,
// saved whole with `orchestration settings <json>` in every project that has this package.

/** The settings in force, or why none could be read. */
interface Read {
  settings: Settings
  error?: string
}

const NOTHING_READ: Read = { settings: {} }

export function SubagentsSettings({ projects }: ModuleSettingsProps) {
  const host = useModuleHost()
  const agents = useCodingAgents()
  const key = projects.map(p => p.id).join(',')
  const { value: read, reload } = usePolled<Read>(
    async () => {
      let error: string | undefined
      for (const project of projects) {
        const answer = await host.runCommand(project.id, ['settings'])
        if (!answer.ok) {
          error ??= `${project.name}: ${answer.error}`
          continue
        }
        const { ok: _ok, ...settings } = (answer.output ?? {}) as Settings & { ok?: boolean }
        return { settings }
      }
      return { settings: {}, ...(error !== undefined ? { error } : {}) }
    },
    NOTHING_READ,
    10_000,
    [key],
  )
  // What was last picked, shown until a read made after the last save brings the settings back:
  // the menus build each save on it, so a second pick made before the first is saved keeps the
  // first. Saves go one at a time, each to every project: a pick made while one is on its way waits,
  // and only the latest waiting pick is sent.
  const [picked, setPicked] = useState<Settings | undefined>()
  const sending = useRef(false)
  const waiting = useRef<Settings | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()
  useEffect(() => {
    if (!sending.current) setPicked(undefined)
  }, [read])
  const settings = picked ?? read.settings

  const send = async (next: Settings): Promise<void> => {
    sending.current = true
    const answers = await Promise.all(projects.map(async project => ({ project, answer: await host.runCommand(project.id, ['settings', JSON.stringify(next)]) })))
    const failed = answers.flatMap(({ project, answer }) => (answer.ok ? [] : [`${project.name}: ${answer.error}`]))
    if (failed.length > 0) setError(failed.join('; '))
    const after = waiting.current
    waiting.current = undefined
    if (after !== undefined) return send(after)
    sending.current = false
    setSaving(false)
    // A refused save shows what is saved again; a saved one stays shown until the read has it.
    if (failed.length > 0) setPicked(undefined)
    reload()
  }
  const save = (next: Settings): void => {
    setPicked(next)
    setSaving(true)
    setError(undefined)
    if (sending.current) waiting.current = next
    else void send(next)
  }
  const level = (name: Level) => (value: string) => {
    const { [name]: _old, ...rest } = settings
    const runner = runnerOf(value)
    save(runner ? { ...rest, [name]: runner } : rest)
  }
  const atOnce = settings.atOnce ?? DEFAULT_AT_ONCE
  if (projects.length === 0) return null
  return (
    <SettingsSection title="Subagents" description="The models a main agent's subagents run on, by how hard the main agent says each task is. The same on every project, on this machine.">
      <SettingsSelectRow label="Simple tasks" description="A task the main agent marks simple." value={runnerValue(settings.simple)} options={runnerChoices(agents, settings.simple)} onChange={level('simple')} />
      <SettingsSelectRow label="Hard tasks" description="A task the main agent marks hard." value={runnerValue(settings.hard)} options={runnerChoices(agents, settings.hard)} onChange={level('hard')} />
      <SettingsSelectRow
        label="At once"
        description="How many of one main agent's subagents run at the same time. It starts the next when one ends."
        value={String(atOnce)}
        options={Array.from({ length: Math.max(8, atOnce) }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
        onChange={value => save({ ...settings, atOnce: Number(value) })}
      />
      {saving && <p className="py-2 text-xs text-muted-foreground">Saving…</p>}
      {(error ?? read.error) !== undefined && (
        <p role="alert" className="py-2 text-xs text-danger">
          {error !== undefined ? `The subagent settings were not saved: ${error}` : `The subagent settings could not be read: ${read.error}`}
        </p>
      )}
    </SettingsSection>
  )
}
