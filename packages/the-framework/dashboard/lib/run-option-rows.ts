import type { Preferences } from '../../dist/index.js'
import { DRIVERS, DRIVER_LABELS, handoffFromPreferences, handoffReaches, type DriverName } from '../../dist/client.js'

// The Global options as one table (#314), and the rules between them.
//
// This used to be built inline in the composer, which was fine while the launcher was the only
// place that showed it. The settings page (#958) shows the same options, and a second hand-rolled
// copy would drift: the rules here are not decoration, they decide whether a box means anything
// (Eco under Vanilla trims nothing; Browser on Codex is inert). One table, rendered by both.
//
// It is pure data — no JSX — so the launcher can render it as dropdown items and the settings page
// as page rows, without either one owning the rules.

export type OptionRow = {
  /**
   * The row's identity. A preference key for most rows; for the three publish rungs it is the
   * rung's name, because all three write the one `handoff` ordinal (B5) rather than a boolean each.
   */
  key: string
  label: string
  /** The long form, shown in the row's tooltip. */
  title: string
  /** A short one-line summary shown under the label (#654). */
  description?: string
  checked: boolean
  /** Disabled beyond the form-wide busy flag (e.g. Eco has nothing to trim under Vanilla). */
  disabled?: boolean
  /** Why it's disabled, shown in the description so a greyed row isn't a mystery (a disabled
   * dropdown item takes no pointer events, so its tooltip never opens). Only rendered while
   * {@link disabled}. */
  disabledReason?: string
  /**
   * What ticking or unticking this row writes.
   *
   * A function rather than "the row's key gets `checked`", because the three publish rungs are
   * three views of one ordinal (B5): unticking `Open PR` has to *lower* the ladder to `push`, which
   * no per-key boolean write can say.
   */
  patch: (checked: boolean) => Partial<Preferences>
}

/** The run options, with every rule between them already applied. */
export interface RunOptionRows {
  main: OptionRow[]
}

/**
 * The run-option table for a resolved set of preferences.
 *
 * `checked` is the *effective* value, not the stored one: an option overridden by Transparent reads
 * as off, because that is what the run will do. So a surface that renders this can never claim an
 * option is on while the run ignores it.
 */
export function runOptionRows(preferences: Preferences): RunOptionRows {
  const transparent = preferences.transparent ?? false // #625: the master off-switch
  const vanilla = preferences.vanilla ?? false
  const onBeforeMergeableQuality = preferences.onBeforeMergeableQuality ?? false
  const browser = preferences.browser ?? false
  // Default-on (#1102), so it reads through `handoffFromPreferences` rather than `?? false` like
  // the rest. One rung (B5), which is what makes PR imply push without anyone saying so.
  const handoff = handoffFromPreferences(preferences)
  const agent = preferences.driver ?? 'claude' // #650: which coding agent drives the run
  // The stored agent as a display name; an unknown stored value falls back to Claude Code.
  const agentLabel = DRIVER_LABELS[DRIVERS.includes(agent as DriverName) ? (agent as DriverName) : 'claude']


  const main: OptionRow[] = [
    // Named for the agent actually selected (#948): under Codex, "Raw Claude Code" was a lie.
    {
      ...flag('transparent'),
      label: 'Transparent',
      description: `Raw ${agentLabel} — turns the whole framework off.`,
      title: `Fully transparent (#625): run the agent exactly like plain ${agentLabel}, with no framework system prompt, controls, dashboard, guard, or TODO loop. Overrides the options below.`,
      checked: transparent,
    },
    {
      ...flag('vanilla'),
      label: 'Disable system prompt',
      description: 'Drops the added system prompt; keeps the agent controls.',
      title:
        "Remove the built-in system prompt but keep the framework's own controls. For a fully raw agent, use Transparent. Expand 'Enhanced System Prompt' to read what it removes.",
      checked: vanilla && !transparent,
      ...overriddenByTransparent(transparent),
    },
    {
      ...flag('onBeforeMergeableQuality'),
      label: 'Post-merge cleanup',
      description: 'Runs quality passes once it is ready to merge.',
      title: "When the agent signals it's ready for merge, run maintainability, readability, and security-audit passes",
      checked: onBeforeMergeableQuality && !transparent,
      ...overriddenByTransparent(transparent),
    },
    // Where the handoff gets its default (#1102). A session's own action bar can still untick the
    // whole ladder for that one run (#1173); this is what every new session starts from.
    //
    // The publish ladder (#1379): three rungs, each enabled only while the one below it is on. The
    // pair this replaced (#1164/#1173) showed only `Open PR`, so "Open PR: off" silently meant
    // "push-only" — a user who read that as "publishing off" still got their branch pushed, and the
    // launcher disagreed with the session header, where unticking means the session hands off
    // nothing. A strict ladder cannot express the contradictory state (PR on / push off) that made
    // the old two-equal-boxes UI unreadable, and it finally makes "publish nothing" reachable here
    // rather than only via the preference key and `the-framework.yml`.
    //
    // Three boxes over one stored ordinal (B5): the gating below is presentation, and what each box
    // *writes* is the rung it means — so unticking one lowers the ladder rather than leaving a
    // merge armed with no PR beneath it.
    {
      key: 'push',
      label: 'Push branch',
      description: 'Pushes the agent branch when it finishes.',
      title: "Push the agent's branch to the remote when it finishes. The bottom rung: with this off the agent publishes nothing, and neither PR nor merge can run",
      checked: handoffReaches(handoff, 'push'),
      patch: checked => ({ handoff: checked ? 'push' : 'local' }),
    },
    {
      key: 'pr',
      label: 'Open PR',
      description: 'Opens a draft pull request when it finishes.',
      title: 'Open a draft pull request when the agent finishes, pushing the branch on the way. Draft, so it does not request review; it still shows on the needs-you queue',
      checked: handoffReaches(handoff, 'pr'),
      patch: checked => ({ handoff: checked ? 'pr' : 'push' }),
      ...(handoffReaches(handoff, 'push')
        ? {}
        : { disabled: true, disabledReason: 'nothing to open while Push branch is off' }),
    },
    // Default-off, unlike the row above (#1216): publishing a branch is reversible, landing it on
    // the default branch is not. The routines that merge their own work (the queue drain) say so
    // per job rather than through this box.
    {
      key: 'merge',
      label: 'Auto-merge',
      description: 'Merges the pull request once it is opened.',
      title:
        'Merge the pull request the agent opens: GitHub auto-merge where the repo allows it, so it lands when checks pass; merged directly otherwise',
      checked: handoffReaches(handoff, 'merge'),
      patch: checked => ({ handoff: checked ? 'merge' : 'pr' }),
      ...(handoffReaches(handoff, 'pr')
        ? {}
        : { disabled: true, disabledReason: 'nothing to merge while Open PR is off' }),
    },
    // Claude-only (#801): the browser is wired through Claude Code's MCP config, so another agent's
    // driver takes no MCP servers and the box would be checkable but inert.
    {
      ...flag('browser'),
      label: 'Browser',
      description: 'Gives the agent a real browser to inspect pages.',
      title:
        'Give the agent a real browser via chrome-devtools-mcp: navigate pages, read console + network, inspect the DOM, and screenshot',
      checked: browser && !transparent && agent === 'claude',
      ...(transparent || agent !== 'claude'
        ? {
            disabled: true,
            disabledReason: transparent
              ? 'off while Transparent is on'
              : 'only on Claude Code — the browser is wired through its MCP config',
          }
        : {}),
    },
  ]

  return { main }
}

/**
 * An ordinary row: its identity is a preference key, and ticking it writes that key.
 *
 * The publish rungs are the exception and spell their own {@link OptionRow.patch} out, because
 * three of them share one stored ordinal (B5).
 */
function flag(key: keyof Preferences): Pick<OptionRow, 'key' | 'patch'> {
  return { key, patch: checked => ({ [key]: checked }) as Partial<Preferences> }
}

/** The shared "Transparent overrides it" disable, which most of the main rows carry. */
function overriddenByTransparent(transparent: boolean): Pick<OptionRow, 'disabled' | 'disabledReason'> {
  return transparent ? { disabled: true, disabledReason: 'off while Transparent is on' } : {}
}

/**
 * The option keys that shape a continuation leg (#1467/#1469): the publish ladder and the browser.
 * The prompt-shaping rows (Transparent, Disable system prompt, Post-merge cleanup) are omitted —
 * the resumed transcript already carries its framing — and Run on / agent / model are pinned by
 * the conversation being continued.
 */
const RESUME_OPTION_KEYS: ReadonlySet<string> = new Set(['push', 'pr', 'merge', 'browser'])

/**
 * The subset of the main table a finished session's composer offers (#1172): the options the next
 * Resume leg will actually arm. They write the same shared preferences the launcher's gear writes;
 * the continuation start resolves them at resume time (#1469), which is what makes showing them
 * here truthful. Same rows, same rules (ladder gating, effective values) — just filtered.
 */
export function resumeOptionRows(preferences: Preferences): OptionRow[] {
  return runOptionRows(preferences).main.filter(row => RESUME_OPTION_KEYS.has(row.key))
}
