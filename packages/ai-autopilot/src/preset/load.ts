import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseSkillManifest } from '@gemstack/ai-skills'
import type { SkillManifest } from '@gemstack/ai-skills'
import { defineLoop } from '../loop/define.js'
import { defineSkill } from '../extensions/define.js'
import { parsePrompt } from '../prompts/parse.js'
import type { Loop } from '../loop/types.js'
import type { Prompt } from '../prompts/types.js'
import type { Skill } from '../extensions/types.js'
import { readConditions, selectWinners, stemOf } from './conditions.js'
import { defineDomainPreset, DomainPresetError } from './define.js'
import type { DomainPreset } from './types.js'

/** Options for {@link loadDomainPreset} and the per-directory loaders. */
export interface LoadPresetOptions {
  /** Active modes (e.g. `['autopilot']`); a `conditions` variant wins over its base when its modes are active. */
  modes?: readonly string[]
}

/**
 * Load a {@link DomainPreset} from a directory of `.md` files — the no-code,
 * marketplace-shippable form. Layout:
 *
 * ```text
 * <dir>/
 *   preset.md          # required: name + description (frontmatter), metadata.title
 *   loops/*.md         # metadata.on (kind or kinds) + metadata.run (prompt ids)
 *   prompts/*.md       # prompt bodies (the existing prompt bundle format)
 *   skills/*.md        # metadata.url (llms.txt) + metadata.title; body ignored
 * ```
 *
 * The three content subdirectories are all optional — a missing one yields an
 * empty list. The preset's identity comes from `preset.md`. Pass `modes` to
 * activate `conditions` variants (see `conditions.ts`); with none, only base
 * files load.
 */
export async function loadDomainPreset(dir: string, opts: LoadPresetOptions = {}): Promise<DomainPreset> {
  const modes = opts.modes ?? []
  const manifestPath = join(dir, 'preset.md')
  let raw: string
  try {
    raw = await readFile(manifestPath, 'utf8')
  } catch {
    throw new DomainPresetError(`preset directory ${JSON.stringify(dir)} has no preset.md manifest`)
  }
  const { manifest } = parseSkillManifest(raw, manifestPath)
  const title = str(manifest.metadata, 'title')

  const [loops, prompts, skills] = await Promise.all([
    loadLoopsFrom(join(dir, 'loops'), { modes }),
    loadPromptsIn(join(dir, 'prompts'), { modes }),
    loadSkillsFrom(join(dir, 'skills'), { modes }),
  ])

  return defineDomainPreset({
    name: manifest.name,
    ...(title ? { title } : {}),
    description: manifest.description,
    loops,
    prompts,
    skills,
  })
}

/** Absolute path to the package's shipped `presets/` directory. */
export function builtinPresetsDir(): string {
  // From dist/preset/load.js (and dist-test/…), the package root is two up.
  return fileURLToPath(new URL('../../presets/', import.meta.url))
}

/** The shipped, stack-agnostic "Software Development" domain preset (#243). */
export function softwareDevelopmentPreset(opts: LoadPresetOptions = {}): Promise<DomainPreset> {
  return loadDomainPreset(join(builtinPresetsDir(), 'software-development'), opts)
}

/** Load the loop files in a directory, applying mode overrides (a missing directory yields `[]`). */
export async function loadLoopsFrom(dir: string, opts: LoadPresetOptions = {}): Promise<Loop[]> {
  const winners = selectWinners(await manifestEntries(dir), opts.modes ?? [])
  return winners.map(({ path, manifest }) => {
    const meta = manifest.metadata ?? {}
    const on = meta['on']
    const run = meta['run']
    if (on === undefined) throw new DomainPresetError(`loop ${JSON.stringify(path)} is missing metadata.on`)
    if (!Array.isArray(run)) throw new DomainPresetError(`loop ${JSON.stringify(path)} needs metadata.run to be a list`)
    return defineLoop({ on: on as string | string[], run: run as string[] })
  })
}

/** Load the prompt bodies in a directory, applying mode overrides (a missing directory yields `[]`). Internal: the public prompt loader is `loadPromptsFrom` in `prompts/`. */
async function loadPromptsIn(dir: string, opts: LoadPresetOptions = {}): Promise<Prompt[]> {
  const winners = selectWinners(await manifestEntries(dir), opts.modes ?? [])
  return winners.map(({ raw, path }) => parsePrompt(raw, path))
}

/** Load the skill pointers in a directory, applying mode overrides (a missing directory yields `[]`). */
export async function loadSkillsFrom(dir: string, opts: LoadPresetOptions = {}): Promise<Skill[]> {
  const winners = selectWinners(await manifestEntries(dir), opts.modes ?? [])
  return winners.map(({ path, manifest }) => {
    const meta = manifest.metadata ?? {}
    const url = str(meta, 'url')
    if (!url) throw new DomainPresetError(`skill ${JSON.stringify(path)} is missing metadata.url (its llms.txt pointer)`)
    return defineSkill({
      name: manifest.name,
      title: str(meta, 'title') ?? manifest.name,
      description: manifest.description,
      url,
    })
  })
}

// ─── Internals ───────────────────────────────────────────────────

interface Entry {
  readonly stem: string
  readonly conditions: readonly string[]
  readonly path: string
  readonly raw: string
  readonly manifest: SkillManifest
}

/** Parse every `*.md` file's frontmatter in a directory (a missing directory yields `[]`). */
async function manifestEntries(dir: string): Promise<Entry[]> {
  let files: string[]
  try {
    files = (await readdir(dir)).filter(f => f.endsWith('.md')).sort()
  } catch {
    return []
  }
  return Promise.all(
    files.map(async f => {
      const path = join(dir, f)
      const raw = await readFile(path, 'utf8')
      const { manifest } = parseSkillManifest(raw, path)
      return { stem: stemOf(f), conditions: readConditions(manifest.metadata), path, raw, manifest }
    }),
  )
}

function str(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = meta?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}
