import { readFile, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { declaring, packageBins, readManifest, runPackageCommand, type ProvidedCommand } from '@openagt/agent-data'
import type { SkillLink } from '@openagt/skill-branches'

/**
 * The basic skills (#2023): the ones every run gets, with nothing committed in the project. Each
 * one's text is linked into the agent's checkout, hidden from git, beside the branches skill the
 * checkout already carries, and with it the skill's package and command, so the text's
 * `npx @openagt/skill-logs@0.1` runs this install's own copy. They are what an agent needs in any
 * project to work at all: read what earlier agents did, ask the person a question, and hand its
 * work over on the project's git host. A project that tracks its own copy of one keeps it: an
 * entry already in the checkout is left alone.
 *
 * Dependencies of this tool, resolved from its own install; one that is not installed is skipped.
 * This list is the one place the tool names a skill. A git host's skill is linked only where its
 * package answers the project's page there (its `home` command): its text says the project's pull
 * requests are on that host, which is wrong anywhere else.
 */
const BASIC_PACKAGES: readonly string[] = ['@openagt/skill-logs', '@openagt/skill-question', '@openagt/skill-github']

interface BasicSkill {
  link: SkillLink
  /** The package's git host command, when it declares one: asked before its skill is linked. */
  gitHost?: ProvidedCommand
}

let resolved: Promise<BasicSkill[]> | undefined

async function resolveBasic(): Promise<BasicSkill[]> {
  const require = createRequire(import.meta.url)
  const skills: BasicSkill[] = []
  for (const name of BASIC_PACKAGES) {
    let manifestPath: string
    try {
      manifestPath = require.resolve(`${name}/package.json`)
    } catch {
      continue
    }
    const dir = await realpath(dirname(manifestPath)).catch(() => undefined)
    const manifest = dir ? await readManifest(join(dir, 'package.json')) : undefined
    const skill = dir ? skillName(await readFile(join(dir, 'SKILL.md'), 'utf8').catch(() => '')) : undefined
    if (!dir || !manifest || !skill) continue
    const bins = packageBins(name, manifest.bin, dir)
    const gitHost = declaring([{ name, dir, manifest }], 'git-host')[0]
    skills.push({ link: { name: skill, dir, ...(Object.keys(bins).length > 0 ? { package: { name, dir, bins } } : {}) }, ...(gitHost ? { gitHost } : {}) })
  }
  return skills
}

/** The `name` a skill's text gives in its front matter: the directory a harness lists it under. */
function skillName(text: string): string | undefined {
  const frontMatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1]
  const name = frontMatter ? /^name:\s*([a-z0-9][a-z0-9-]*)\s*$/m.exec(frontMatter)?.[1] : undefined
  return name
}

/** Every basic skill this install carries, whatever the project: what a cleanup takes the rules back for. */
export async function everyBasicSkill(): Promise<SkillLink[]> {
  return (await (resolved ??= resolveBasic())).map(skill => skill.link)
}

/** The basic skills of the project at `repo`: all of them, a git host's only where it answers for the project. */
export async function basicSkills(repo: string): Promise<SkillLink[]> {
  const skills: SkillLink[] = []
  for (const { link, gitHost } of await (resolved ??= resolveBasic())) {
    if (gitHost && !(await runPackageCommand(repo, gitHost, ['home'])).ok) continue
    skills.push(link)
  }
  return skills
}
