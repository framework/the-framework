import type { AgentLocation } from './agent-location.js'
import { createDriver, type CreateDriverOptions } from './driver-cli.js'
import { ActionsDriver, type ActionsDriverOptions, type Driver } from 'agent-driver'
import { CloudDriver, type CloudDriverOptions } from './driver/cloud.js'

/**
 * Build the {@link Driver} for an agent's *target* (#1050): where the turn runs, on top of the CLI
 * axis {@link createDriver} owns. `actions` returns an {@link ActionsDriver} (#934) built from the
 * resolved owner/repo/token; `web` returns a {@link CloudDriver} (#610), which hands the task to a
 * Claude Code cloud session; anything else falls through to the driver for the chosen CLI —
 * byte-identical to today.
 *
 * Kept off {@link createDriver} on purpose: ActionsDriver's owner/repo/token do not fit
 * {@link CreateDriverOptions}, and folding them in would push GitHub config onto every local agent.
 */
export interface CreateTargetDriverOptions extends CreateDriverOptions {
  /**
   * Where the agent executes: `local` (this device, the default), `actions` (a GitHub Actions
   * runner, #1050) or `web` (a Claude Code cloud session, #610).
   */
  target?: AgentLocation
  /** The Actions runner config, required when {@link target} is `actions`. */
  actionsConfig?: ActionsDriverOptions
  /** The cloud-session config used when {@link target} is `web`. Every field has a default. */
  cloudConfig?: CloudDriverOptions
}

/** The one place an agent path turns `--run-on` into a real driver. */
export function createTargetDriver(opts: CreateTargetDriverOptions): Driver {
  if (opts.target === 'actions') {
    if (!opts.actionsConfig) {
      throw new Error('run target "actions" needs the repo owner/repo and a GitHub token; set a GitHub origin remote and GH_TOKEN')
    }
    return new ActionsDriver(opts.actionsConfig)
  }
  // `web` needs no configuration of ours: the CLI already holds the account it signs the
  // cloud session in with, the same auth the local driver runs on.
  if (opts.target === 'web') return new CloudDriver(opts.cloudConfig ?? {})
  return createDriver(opts)
}
