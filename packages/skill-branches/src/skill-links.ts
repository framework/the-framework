import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nodeGitRunner, type GitRunner, excludeFromGit } from '@gemstack/agent-data'
import { nodeLinkFs, type LinkFs } from './worktree-deps.js'

/**
 * The skill, where the agent's harness looks for one (#1739). A harness discovers skills under a
 * directory of its own at the checkout root — `.claude/skills/<name>/SKILL.md` for Claude Code,
 * `.agents/skills/<name>/SKILL.md` for Codex — and a checkout under `.branches/` is its own
 * repository root to it, so nothing the project keeps in those directories reaches the agent.
 * Every checkout the package creates therefore gets one symlink per harness, named as the skill
 * and pointing at this package, whose `SKILL.md` is the skill. One mechanism for every harness,
 * and the same text for every agent; a new harness is one more entry in {@link HARNESS_SKILL_DIRS}.
 */

/** The skill's name: the `name` in `SKILL.md`'s front matter, and the directory a harness lists it under. */
export const SKILL_NAME = 'branches'

/** Where each harness looks for skills, relative to the checkout root. */
export const HARNESS_SKILL_DIRS = ['.claude/skills', '.agents/skills'] as const

/**
 * This package's directory — the one holding `SKILL.md`. Beside `dist/`, so it is the same path
 * from a workspace checkout and from an installed package.
 */
export const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * A skill to link into a checkout: its name (the directory a harness lists it under) and the
 * directory holding its `SKILL.md`.
 *
 * TEMPORARY (#1748): a caller names the *other* skills it wants in a checkout — the `tickets`
 * skill, today — because nothing else puts a skill there yet. Dies when the skills are committed
 * into the repository by use-npm-skills: a tracked `.claude/skills/<name>` is in every worktree by
 * itself, and this package goes back to linking only its own.
 */
export interface SkillLink {
  name: string
  dir: string
}

/** This package's own skill, as a {@link SkillLink}. */
export const OWN_SKILL: SkillLink = { name: SKILL_NAME, dir: SKILL_DIR }

/**
 * Link the skill into `checkout` for every harness — this package's own, plus whatever `skills`
 * the caller names (temporary, see {@link SkillLink}) — and hide the links from the project's git
 * through the repository's exclude file: a symlink at the checkout root would otherwise ride any
 * sweeping `git add -A` onto the agent's branch. Best-effort: an entry already at a link's path is
 * left alone, and a link that cannot be made is a worse run, not a failed one.
 */
export async function linkSkill(
  repo: string,
  checkout: string,
  fs: LinkFs = nodeLinkFs(),
  git: GitRunner = nodeGitRunner(),
  skills: readonly SkillLink[] = [],
): Promise<void> {
  for (const skill of [OWN_SKILL, ...skills]) {
    for (const dir of HARNESS_SKILL_DIRS) {
      const rel = `${dir}/${skill.name}`
      await excludeFromGit(repo, `/${rel}`, undefined, git).catch(() => {})
      try {
        const path = join(checkout, rel)
        if (await fs.entryExists(path)) continue
        await fs.mkdir(join(checkout, dir))
        await fs.symlinkDir(skill.dir, path)
      } catch {
        // A filesystem that refuses the link: the agent still starts, without the skill.
      }
    }
  }
}
