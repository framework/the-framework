import { isHandoffLevel, type HandoffLevel } from './handoff-level.js'
import { nodeRegistryFs, registryPath, type RegistryFs } from './registry.js'

/**
 * The one-time notice for the per-project preference tier B5 deleted (#840).
 *
 * Every other retirement on that branch is silent by design — a renamed key is an unknown key, and
 * an unknown key is dropped. This one is not silent, because dropping it moves in the *permissive*
 * direction and the permissive thing is an outward action under the user's name: a repo they had
 * set to "don't publish" falls through to the user-level default, which pushes the branch and opens
 * a pull request. A setting that quietly stops applying is a bug report; a setting that quietly
 * starts publishing is a pull request on someone else's repo.
 *
 * It is a report, not a migration: nothing here is honoured, carried, or written back. It names
 * what the file holds and the line that replaces it, and the block goes on being ignored.
 */

/** The retired block's key in the registry file. Read to report it; never written. */
const RETIRED_KEY = 'projectPreferences'

/**
 * Every spelling a block could say "how far this repo publishes" in: the rung, and the three
 * booleans it replaced.
 *
 * Named rather than interpreted. A block written before the ladder cannot be turned back into a
 * rung without the mapping this branch deleted, and resurrecting it here would be the migration
 * code the deletion was about. What the notice needs is only whether this repo's publishing was
 * set here at all, because that decides whether the row warns or reassures — and a row that
 * reassures about a repo whose block said "don't publish" is the failure this exists to prevent.
 */
const PUBLISH_KEYS = ['handoff', 'autoPushBranch', 'autoOpenPr', 'autoMerge']

/** One project that had a block, as the notice needs to talk about it. */
export interface RetiredProjectSettings {
  /** The repo the block was about. Its path, because a project id names nothing to a reader. */
  path: string
  /** The keys the block held, in file order — so the notice can say what stopped applying. */
  keys: string[]
  /** Whether the block set how far this repo publishes, in any spelling. See {@link PUBLISH_KEYS}. */
  publishes: boolean
  /**
   * The publish rung the block set, when it set one this can name. Absent for a block written
   * before the ladder, which the reader restates by hand — `publishes` is what says to.
   */
  handoff?: HandoffLevel
}

/**
 * The retired blocks in the registry file, or `[]` when there are none (which is everyone who
 * never used the tier, and everyone whose file has been written once since).
 *
 * Reads the raw file rather than going through `readRegistry`, which drops the block on the way in
 * — that is the point of the removal, and it is what leaves this the only reader.
 */
export async function readRetiredProjectSettings(
  fs: RegistryFs = nodeRegistryFs(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<RetiredProjectSettings[]> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await fs.read(registryPath(env)))
  } catch {
    return [] // missing or malformed: the same nothing readRegistry answers
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return []
  const stored = (parsed as Record<string, unknown>)[RETIRED_KEY]
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return []
  // The project list is the same file's, so an id resolves to the path the user knows it by.
  const projects = (parsed as { projects?: unknown }).projects
  const paths = new Map<string, string>()
  if (Array.isArray(projects)) {
    for (const project of projects) {
      const record = project as { id?: unknown; path?: unknown }
      if (typeof record?.id === 'string' && typeof record.path === 'string') paths.set(record.id, record.path)
    }
  }
  const retired: RetiredProjectSettings[] = []
  for (const [projectId, block] of Object.entries(stored as Record<string, unknown>)) {
    if (typeof block !== 'object' || block === null || Array.isArray(block)) continue
    const keys = Object.keys(block as Record<string, unknown>)
    if (!keys.length) continue
    const handoff = (block as Record<string, unknown>)['handoff']
    retired.push({
      // A project since removed from the registry still had settings; name it by the id rather
      // than dropping it, since the point is that nothing stopped applying silently.
      path: paths.get(projectId) ?? projectId,
      keys,
      publishes: keys.some(key => PUBLISH_KEYS.includes(key)),
      ...(isHandoffLevel(handoff) ? { handoff } : {}),
    })
  }
  return retired
}

/**
 * The boot snapshot, and why there is one.
 *
 * `writeRegistry` rewrites the file from the fields it knows, so the first preference write of a
 * session erases the block this notice is about. A notice raised lazily — at the first publish,
 * say — would race that erasure and lose, so the read happens once at boot, ahead of every write
 * path, and the dashboard is served from what it found.
 */
let captured: readonly RetiredProjectSettings[] = []

/** Read the blocks and hold them for this process. Called once, first thing, by the daemon. */
export async function captureRetiredProjectSettings(
  fs?: RegistryFs,
  env: NodeJS.ProcessEnv = process.env,
): Promise<readonly RetiredProjectSettings[]> {
  captured = await readRetiredProjectSettings(fs, env).catch(() => [])
  return captured
}

/** What the boot read found. Empty until {@link captureRetiredProjectSettings} has run. */
export function retiredProjectSettings(): readonly RetiredProjectSettings[] {
  return captured
}

/**
 * What a repo's row has to say, as both surfaces say it.
 *
 * A block that set publishing gets the line to write and what happens without it, because that is
 * the direction that acts outward on its own. Everything else is told what applies instead, which
 * is true only for a block that did *not* set publishing — hence the flag rather than the rung.
 */
export function retiredProjectAdvice(project: RetiredProjectSettings): string {
  if (!project.publishes) return 'Your own settings apply to it now.'
  const rung = project.handoff ?? 'local | push | pr | merge'
  return `Add \`handoff: ${rung}\` to its the-framework.yml — without it, agents there push their branch and open a pull request.`
}

/**
 * The notice as the daemon's log prints it: one line naming the tier, then one per project.
 *
 * Empty for an empty list, so the caller prints nothing rather than a heading over nothing.
 */
export function retiredProjectSettingsNotice(retired: readonly RetiredProjectSettings[]): string[] {
  if (!retired.length) return []
  const lines = [
    `[framework] per-project settings are no longer read — a repo's settings live in its own the-framework.yml.`,
  ]
  for (const project of retired) {
    lines.push(`[framework]   ${project.path} had ${project.keys.join(', ')}. ${retiredProjectAdvice(project)}`)
  }
  return lines
}
