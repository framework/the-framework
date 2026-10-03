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
  // What was last picked, shown until a read made after every save brings the settings back: the
  // menus build each save on it, so a second pick made before the first is read back keeps the first.
  const [picked, setPicked] = useState<Settings | undefined>()
  const inFlight = useRef(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()
  useEffect(() => {
    if (inFlight.current === 0) setPicked(undefined)
  }, [read])
  const settings = picked ?? read.settings

  const save = (next: Settings): void => {
    inFlight.current++
    setPicked(next)
    setSaving(true)
    setError(undefined)
    void Promise.all(projects.map(async project => ({ project, answer: await host.runCommand(project.id, ['settings', JSON.stringify(next)]) }))).then(answers => {
      inFlight.current--
      const failed = answers.flatMap(({ project, answer }) => (answer.ok ? [] : [`${project.name}: ${answer.error}`]))
      if (failed.length > 0) setError(failed.join('; '))
      if (inFlight.current > 0) return
      setSaving(false)
      // A refused save shows what is saved again; a saved one stays shown until the read has it.
      if (failed.length > 0) setPicked(undefined)
      reload()
    })
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
