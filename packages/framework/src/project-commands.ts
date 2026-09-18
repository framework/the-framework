import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

/**
 * A project's commands (#1774): its skills, read off the folders the coding agents read them
 * from. The framework ships no prompt text; what a project can be asked to do is what its own
 * skills say, and the launcher lists them the way Claude Code's `/` list does.
 */

/** Where coding agents read a project's skills: Claude Code's folder, and the shared one Codex reads. */
export const SKILLS_DIRS = ['.claude/skills', '.agents/skills'] as const

/** One skill as the launcher shows it. */
export interface ProjectCommand {
  /** What is typed after the slash: the skill's folder name. */
  name: string
  /** The `description` of the skill's front matter, when it has one. */
  description?: string
  /**
   * Written to be run by a person, not picked up by the agent on its own: the front matter says
   * `disable-model-invocation: true`. These are the launcher's buttons; every command is in the `/` list.
   */
  button: boolean
}

/**
 * The project's commands, by name. A skill in both folders is listed once. A skill whose front
 * matter says `user-invocable: false` is no command, as in Claude Code. A folder without a
 * readable `SKILL.md` is skipped, and a project with no skills folder has no commands.
 */
export async function readProjectCommands(cwd: string): Promise<ProjectCommand[]> {
  const commands = new Map<string, ProjectCommand>()
  for (const dir of SKILLS_DIRS) {
    const entries = await readdir(join(cwd, dir), { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (commands.has(entry.name) || !/^[a-z0-9][a-z0-9-]*$/.test(entry.name)) continue
      const raw = await readFile(join(cwd, dir, entry.name, 'SKILL.md'), 'utf8').catch(() => undefined)
      if (raw === undefined) continue
      const front = frontMatter(raw)
      if (front['user-invocable'] === false) continue
      commands.set(entry.name, {
        name: entry.name,
        ...(typeof front['description'] === 'string' && front['description'].trim() ? { description: front['description'].trim() } : {}),
        button: front['disable-model-invocation'] === true,
      })
    }
  }
  return [...commands.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** The YAML front matter of a markdown file as a map; none, or one that does not parse, is empty. */
function frontMatter(raw: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)
  if (!match) return {}
  try {
    const data: unknown = parseYaml(match[1]!)
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
