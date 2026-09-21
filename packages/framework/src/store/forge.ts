import { readProvidedCommand, runPackageCommand, type ProvidedCommand } from '@gemstack/agent-data'

/**
 * The project's forge, as the framework reads and acts on it (#1820): the pull requests of the
 * project, opening one, landing one, and the project's page there. The framework names no forge
 * and runs no forge tool: a project's forge comes from whichever of its packages declares that it
 * provides it — `"framework": { "forge": "<command>" }` in the package's own package.json — and
 * the framework asks by running that command. Swap the package for another that answers the same
 * command line and prints the same shapes, and nothing here changes. No package declares it: the
 * project has no forge, so no pull requests, and a finished run's last step is the push.
 *
 * The command line a provider answers, each printing one JSON document and exiting 0 (a refusal
 * exits 1 with its reason on stderr):
 *   `<command> requests [--branch <b>] [--state open|merged|all] [--since <iso>]`
 *                                                       the project's pull requests, newest first, as an array of {@link ForgeRequest}
 *   `<command> open --branch <b> --title <t> [--body <text>] [--draft]`
 *                                                       open the branch's pull request; an open one is answered as it is (`existing`)
 *   `<command> merge <number>`                          land the pull request: armed to merge on green, or merged at once
 *   `<command> home`                                    the project's page on the forge, and the forge's name
 * The branch `open` is asked for must already be on the remote: pushing is the branches
 * provider's step, and the framework runs it first.
 *
 * The shapes, owned here: {@link ForgeRequest}, {@link ForgeHome}.
 */

/** A pull request, as a provider lists it. */
export interface ForgeRequest {
  number: number
  url: string
  state: 'open' | 'merged' | 'closed'
  title: string
  draft: boolean
  /** The branch the request is from. */
  branch: string
  /** The commit the request's head is at. */
  head: string
  /** ISO creation time. */
  createdAt: string
  /** ISO merge time, for a merged request. */
  mergedAt?: string
}

/** The project's page on the forge, and what the forge is called: what a link is drawn from. */
export interface ForgeHome {
  url: string
  name: string
}

/** What asking for requests answered: the list, or why there is none: "none" and "could not tell" are different answers. */
export type RequestsOutcome = { ok: true; requests: ForgeRequest[] } | { ok: false; error: string }

/** What opening a pull request left: the request, and whether it was open already. */
export type OpenOutcome = { ok: true; request: { number: number; url: string }; existing: boolean } | { ok: false; error: string }

/** What landing a pull request did: armed to merge on green, merged at once, or the provider watching its checks. */
export type MergeOutcome = { ok: true; outcome: 'auto-armed' | 'merged' | 'watching' } | { ok: false; error: string }

/** A project's forge: what a provider answers, read and moved by the framework. */
export interface ForgeSource {
  /** The project's pull requests, newest first: all, or one branch's, or by state, or since a time. */
  requests(opts?: { branch?: string; state?: 'open' | 'merged' | 'all'; since?: string }): Promise<RequestsOutcome>
  /** Open a branch's pull request, or answer the open one. */
  open(branch: string, opts: { title: string; body?: string; draft?: boolean }): Promise<OpenOutcome>
  /** Land a pull request. */
  merge(number: number): Promise<MergeOutcome>
  /** The project's page on the forge; `undefined` when the provider cannot tell (no remote there). */
  home(): Promise<ForgeHome | undefined>
}

/** The forge of the project at `root`, or `undefined` when none of its packages provides one. */
export type ForgeFor = (root: string) => Promise<ForgeSource | undefined>

/** A {@link ForgeFor} that also forgets what it knows of one project. */
export type ForgeReader = ForgeFor & { changed(root: string): void }

/** How long a provider lookup is reused: the dashboard asks for the forge on every handoff read. */
const CACHE_MS = 5_000

/** The rows read back from a provider's `requests`: the objects with the facts a request needs; anything else is no request. */
export function parseRequests(output: unknown): ForgeRequest[] {
  if (!Array.isArray(output)) return []
  const requests: ForgeRequest[] = []
  for (const value of output) {
    if (!value || typeof value !== 'object') continue
    const row = value as Record<string, unknown>
    const state = row['state']
    if (typeof row['number'] !== 'number' || typeof row['url'] !== 'string' || (state !== 'open' && state !== 'merged' && state !== 'closed')) continue
    requests.push({
      number: row['number'],
      url: row['url'],
      state,
      title: typeof row['title'] === 'string' ? row['title'] : '',
      draft: row['draft'] === true,
      branch: typeof row['branch'] === 'string' ? row['branch'] : '',
      head: typeof row['head'] === 'string' ? row['head'] : '',
      createdAt: typeof row['createdAt'] === 'string' ? row['createdAt'] : '',
      ...(typeof row['mergedAt'] === 'string' ? { mergedAt: row['mergedAt'] } : {}),
    })
  }
  return requests
}

/** A pull request read back from an `open` answer, or undefined. */
function requestOf(output: unknown): { number: number; url: string } | undefined {
  const request = output && typeof output === 'object' ? ((output as Record<string, unknown>)['request'] as Record<string, unknown> | undefined) : undefined
  return request && typeof request === 'object' && typeof request['number'] === 'number' && typeof request['url'] === 'string' ? { number: request['number'], url: request['url'] } : undefined
}

/** The forge source over one provider command: each call one run of the command. */
function commandForge(root: string, command: ProvidedCommand): ForgeSource {
  return {
    async requests(opts = {}) {
      const args = ['requests', ...(opts.branch ? ['--branch', opts.branch] : []), ...(opts.state ? ['--state', opts.state] : []), ...(opts.since ? ['--since', opts.since] : [])]
      const result = await runPackageCommand(root, command, args)
      if (!result.ok) return { ok: false, error: result.error }
      return { ok: true, requests: parseRequests(result.output) }
    },
    async open(branch, opts) {
      const args = ['open', '--branch', branch, '--title', opts.title, ...(opts.body !== undefined ? ['--body', opts.body] : []), ...(opts.draft ? ['--draft'] : [])]
      const result = await runPackageCommand(root, command, args)
      if (!result.ok) return { ok: false, error: result.error }
      const request = requestOf(result.output)
      if (!request) return { ok: false, error: `${command.name} opened no pull request` }
      return { ok: true, request, existing: (result.output as Record<string, unknown>)['existing'] === true }
    },
    async merge(number) {
      const result = await runPackageCommand(root, command, ['merge', String(number)])
      if (!result.ok) return { ok: false, error: result.error }
      const outcome = result.output && typeof result.output === 'object' ? (result.output as Record<string, unknown>)['outcome'] : undefined
      if (outcome === 'auto-armed' || outcome === 'merged' || outcome === 'watching') return { ok: true, outcome }
      return { ok: false, error: `${command.name} did not merge` }
    },
    async home() {
      const result = await runPackageCommand(root, command, ['home'])
      if (!result.ok || !result.output || typeof result.output !== 'object') return undefined
      const home = result.output as Record<string, unknown>
      return typeof home['url'] === 'string' && typeof home['name'] === 'string' ? { url: home['url'], name: home['name'] } : undefined
    },
  }
}

/**
 * The production {@link ForgeReader}: the project's provider, looked up by its package.json, one
 * source per project kept while the same command provides, so a project that installs, swaps or
 * drops its forge is read the new way within {@link CACHE_MS}. `changed(root)` forgets the
 * project, so the next ask looks its provider up again.
 */
export function providedForge(now: () => number = Date.now): ForgeReader {
  const sources = new Map<string, { at: number; command?: ProvidedCommand; source?: ForgeSource }>()
  const reader: ForgeFor = async root => {
    let known = sources.get(root)
    if (!known || now() - known.at >= CACHE_MS) {
      const command = await readProvidedCommand(root, 'forge').catch(() => undefined)
      const same = known?.command && command && known.command.bin === command.bin
      known = { at: now(), ...(command ? { command, source: same ? known!.source! : commandForge(root, command) } : {}) }
      sources.set(root, known)
    }
    return known.source
  }
  return Object.assign(reader, { changed: (root: string) => sources.delete(root) })
}

/** The framework's one reader of the forge, shared by every caller. */
export const projectForge: ForgeReader = providedForge()

/** A {@link ForgeFor} for a project with no forge package. */
export const noForge: ForgeFor = async () => undefined
