import { execFile } from 'node:child_process'
import { DRIVER_SPECS, type DriverName } from './driver-cli.js'

/**
 * Preflight checks for a live run. A turnkey tool should fail *early and
 * clearly* when a prerequisite is missing, not spawn a broken process mid-run.
 * The main one: is the wrapped driver's CLI actually installed and runnable?
 * A fake session needs none of this, so preflight only gates live runs.
 *
 * It probes the driver the session actually picked (#542), so a `codex` session is
 * checked against `codex` and fails on `codex` being missing, not `claude`.
 *
 * Installed is not the same as usable (#1326). Our first external-user report (#1323) was a
 * CLI that resolved fine and was logged out, under a daemon started with `sudo`: every session
 * died before writing its agent.json, on both agents, across six projects, while the daemon went
 * on spending a branch and a worktree per attempt. So preflight also asks the CLI whether it is
 * authenticated, and says so when the daemon runs as root.
 */

/** One preflight check's outcome. */
export interface PreflightCheck {
  name: string
  ok: boolean
  /** Human-readable detail: the version when ok, or how to fix it when not. */
  detail: string
  /**
   * A problem worth saying out loud that must not block the run. Root is the case: a container
   * legitimately runs everything as root, so refusing to start there would break more than it
   * explains.
   */
  warn?: boolean
}

/** The result of running all preflight checks. */
export interface PreflightResult {
  ok: boolean
  checks: PreflightCheck[]
}

/**
 * Run `<bin> <args>` and report whether it succeeded and everything it said. Injectable so
 * tests need no real CLI.
 *
 * `output` merges stdout and stderr on purpose: the two CLIs disagree about where a status line
 * belongs, and a check reading only stdout would call a CLI that answered on stderr "could not
 * say".
 */
export type CliProbe = (bin: string, args: readonly string[]) => Promise<{ ok: boolean; output: string }>

/** @deprecated The probe runs more than `--version` now. Use {@link CliProbe}. */
export type VersionProbe = CliProbe

function defaultProbe(bin: string, args: readonly string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise(resolvePromise => {
    execFile(bin, [...args], { timeout: 10_000 }, (err, stdout, stderr) => {
      resolvePromise({ ok: !err, output: `${String(stdout)}${String(stderr)}` })
    })
  })
}

/** Whether this process runs as root. Windows has no uid, and is never root by this test. */
function runningAsRoot(): boolean {
  return process.getuid?.() === 0
}

/** Options for {@link preflight}. */
export interface PreflightOptions {
  /** The agent to check for. Default `"claude"`. */
  driver?: DriverName
  /** The CLI binary to probe. Default the agent's own. */
  bin?: string
  /** CLI probe override (tests). Default runs the real binary. */
  probe?: CliProbe
  /** Root check override (tests). Default reads this process's uid. */
  isRoot?: () => boolean
  /** The invoking user `sudo` recorded, named in the root warning. Default read from the environment. */
  sudoUser?: string | undefined
  /**
   * Also check `gh` (#1419): the run's PR/merge rung is armed, and the handoff opens and merges
   * PRs through the GitHub CLI. Missing or logged-out `gh` warns without blocking — the run
   * itself starts fine and the push rung is plain git; only the PR onward would silently degrade.
   */
  publish?: boolean
}

/**
 * Run the preflight checks: Node is implicit (we are running), the picked driver's CLI must be
 * installed, and it must be logged in. Returns every check plus an overall `ok`, which counts
 * failures only, so a warning travels without blocking anything.
 *
 * The auth probe is skipped when the CLI is missing: a binary that does not resolve cannot
 * answer a second question, and one "not found" beats two lines saying the same thing.
 */
export async function preflight(opts: PreflightOptions = {}): Promise<PreflightResult> {
  const agent = opts.driver ?? 'claude'
  const spec = DRIVER_SPECS[agent]
  const bin = opts.bin ?? spec.bin
  const probe = opts.probe ?? defaultProbe
  const checks: PreflightCheck[] = [{ name: 'node', ok: true, detail: process.version }]

  const cli = await probe(bin, ['--version'])
  checks.push(
    cli.ok
      ? { name: agent, ok: true, detail: cli.output.trim() || 'installed' }
      : { name: agent, ok: false, detail: `\`${bin}\` not found — ${spec.installHint}` },
  )

  if (cli.ok) {
    const loggedIn = spec.auth.loggedIn(await probe(bin, spec.auth.args))
    // Only an explicit no fails. `undefined` means the CLI would not say, and a run that might
    // work is worth more than a warning we cannot stand behind.
    if (loggedIn === false) {
      checks.push({
        name: `${agent} auth`,
        ok: false,
        detail: `\`${bin}\` is not logged in. Run \`${spec.auth.fix}\`, then start the session again.`,
      })
    } else if (loggedIn === true) {
      checks.push({ name: `${agent} auth`, ok: true, detail: 'logged in' })
    }
  }

  // The publish half (#1419): an armed PR/merge fires `gh` at the finish, hours after the Start
  // that could have said it will not work. Warnings, not failures — the session's own work needs
  // no gh, and the push rung is plain git, so the run is worth starting either way.
  if (opts.publish) {
    const ghCli = await probe('gh', ['--version'])
    if (!ghCli.ok) {
      checks.push({
        name: 'gh',
        ok: true,
        warn: true,
        detail:
          '`gh` not found — the armed PR cannot be opened, so publishing stops at the pushed branch. Install the GitHub CLI (`brew install gh`, or https://cli.github.com) and run `gh auth login`.',
      })
    } else if (!(await probe('gh', ['auth', 'status'])).ok) {
      // `gh auth status` exits non-zero when no host is logged in, and says so on stderr —
      // which the probe folds into `output`, though the exit code alone decides here.
      checks.push({
        name: 'gh auth',
        ok: true,
        warn: true,
        detail:
          '`gh` is not logged in — the armed PR cannot be opened, so publishing stops at the pushed branch. Run `gh auth login`, then start the session.',
      })
    }
  }

  // Root is the sudo-HOME trap (#1323), and it fails every agent identically: `sudo` moves `HOME`, the CLI
  // looks for its credentials under root's home instead of the user's, finds none, and every run
  // dies the same way with the same empty log. Named here because the failure it causes says
  // nothing at all about its cause.
  if ((opts.isRoot ?? runningAsRoot)()) {
    const sudoUser = opts.sudoUser !== undefined ? opts.sudoUser : process.env.SUDO_USER
    const asUser = sudoUser ? `\`${sudoUser}\`` : 'your own user'
    checks.push({
      name: 'root',
      ok: true,
      warn: true,
      detail: `running as root, so the agent looks for credentials under root's home and will not find yours. Restart the daemon as ${asUser}, without \`sudo\`.`,
    })
  }

  return { ok: checks.every(c => c.ok), checks }
}

/** The failing checks, one line each, the way a user is told what to fix. */
export function preflightProblems(result: PreflightResult): string[] {
  return result.checks.filter(c => !c.ok).map(c => `${c.name}: ${c.detail}`)
}
