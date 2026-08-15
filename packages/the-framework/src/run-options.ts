import { DEFAULT_HANDOFF, type HandoffLevel } from './handoff-level.js'
import type { Preferences } from './registry.js'
import type { StartRunOptions } from './dashboard/types.js'
import type { FrameworkFileConfig } from './config.js'

/**
 * Turning the user's preferences into the options a run starts with (#858).
 *
 * This lived in the dashboard client, which was fine while the browser was the only thing that
 * started runs. Auto PM (#685) starts them too, and passed nothing at all — so an unattended run
 * ignored the agent, the model and every other per-project setting (#840) that a run started from
 * the launcher would have honoured.
 *
 * It lives here, in pure code with no Node imports, so both callers share one mapping rather than
 * keeping two copies of rules that are not a plain field copy: autopilot defaults on, browser is
 * Claude-only, the eco drops are suppressed under vanilla/transparent, and the four eco
 * preferences collapse into one object. Re-exported from the browser-safe `./client` entry (#431)
 * so the dashboard can go on importing it at runtime.
 */

/**
 * A repo's committed `the-framework.yml` as the preference keys it speaks for (#842), so the
 * launcher and the daemon can layer it under the user's own options the same way. Only the keys
 * the file set come back, since an unset key must leave the tier below it alone.
 *
 * `antiLazyPill` is the file's name for the inverse of Vanilla: removing the built-in prompt.
 * `preset` and `event` have no preference counterpart (there is no preset picker) and stay on the
 * raw file config for display.
 */
export function preferencesFromFileConfig(file: FrameworkFileConfig): Preferences {
  return {
    ...(file.transparent !== undefined ? { transparent: file.transparent } : {}),
    ...(file.antiLazyPill !== undefined ? { vanilla: !file.antiLazyPill } : {}),
    // The handoff pair (#1102/#1173): whether a session publishes itself is a fact about the repo,
    // so the committed file may say it — and it is where push-without-PR stays reachable now the
    // launcher offers a single `Open PR` row.
    ...(file.handoff !== undefined ? { handoff: file.handoff } : {}),
  }
}

/**
 * How far a set of preferences publishes a finished session (#1102/B5). Defaults to `pr`, which is
 * what makes it zero-config: a session left alone pushes its branch and opens a draft PR.
 *
 * A ladder, not three switches (#1379): the rungs are nested, so "PR without push" was never a
 * state a session could honour — `gh` will not open a PR for a branch the remote has never seen.
 * As an ordinal that combination is not representable at all, rather than repaired by turning the
 * push back on, which is what made a launcher offering "publish nothing" unable to deliver it.
 */
export function handoffFromPreferences(preferences: Preferences): HandoffLevel {
  return preferences.handoff ?? DEFAULT_HANDOFF
}

/**
 * The run options a set of already-resolved preferences implies.
 *
 * Takes the merged view, not the two tiers: who wins between the global and the project setting is
 * `resolvePreferences`' job, and this stays a pure mapping of one settled answer.
 */
export function runOptionsFromPreferences(preferences: Preferences, context: string[] = []): StartRunOptions {
  const vanilla = preferences.vanilla ?? false
  const transparent = preferences.transparent ?? false
  const onBeforeMergeableQuality = preferences.onBeforeMergeableQuality ?? false
  const browser = preferences.browser ?? false
  const handoff = handoffFromPreferences(preferences)
  const model = preferences.model ?? ''
  const agent = preferences.agent ?? 'claude'
  const target = preferences.target ?? 'local'
  return {
    // The two toggles `the-framework.yml` also owns go out explicitly, `false` included (#842):
    // the caller has already resolved every layer it can see, so the run states the settled answer
    // and the CLI's own resolve (#841) takes it as the nearest layer. Sending nothing would let the
    // repo file turn back on what the launcher just showed as off.
    vanilla,
    transparent,
    ...(onBeforeMergeableQuality ? { onBeforeMergeable: true } : {}),
    // Stated explicitly, every rung included: it defaults to `pr` (#1102), so sending nothing
    // would let the session's own default publish more than the launcher just showed.
    handoff,
    // Claude-only (#801): another agent's driver takes no MCP servers, so sending it would only earn
    // the CLI's "no effect" notice. Matches the box being disabled off Claude Code.
    ...(browser && agent === 'claude' ? { browser: true } : {}),
    ...(model ? { model } : {}),
    ...(agent !== 'claude' ? { agent } : {}),
    // Run target (#1050/#610): only a non-local target travels; `local` is the default the CLI
    // already assumes, so a local run's options stay byte-identical to before either target existed.
    ...(target && target !== 'local' ? { target } : {}),
    ...(context.length ? { context } : {}),
  }
}
