import { execFile } from 'node:child_process'
import { readFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Which of a project's packages provides one kind of the framework's data, and how its command is
 * run (#1774, #1820). A package declares what it provides in its own package.json,
 * `"framework": { "<kind>": "<command>" }`, naming one of its own commands; the framework and the
 * scheduler name no package: whoever declares the kind provides it. When several installed
 * packages declare the same kind, the project's own root package.json says which one, under the
 * same key with the package's name as the value, `"framework": { "<kind>": "<package>" }`; with
 * no such line nothing provides the kind, and the reason is said, never the first in dependency
 * order taken silently.
 */

/** The fields of a package.json this module reads; anything else is ignored. */
export interface PackageManifest {
  name?: unknown
  version?: unknown
  exports?: unknown
  bin?: unknown
  framework?: unknown
  dependencies?: unknown
  devDependencies?: unknown
}

/** A dependency of the project, resolved: its directory (symlinks followed) and its package.json. */
export interface ProjectPackage {
  name: string
  dir: string
  manifest: PackageManifest
}

export async function readManifest(path: string): Promise<PackageManifest | undefined> {
  try {
    const data: unknown = JSON.parse(await readFile(path, 'utf8'))
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as PackageManifest) : undefined
  } catch {
    return undefined
  }
}

/**
 * The project's installed dependencies: each name its own package.json lists (both
 * `dependencies` and `devDependencies`, in that order, a name listed twice read once), resolved
 * from the project's `node_modules` with symlinks followed, so a pnpm workspace link reads like
 * any install. A project with no package.json, a name that is not a package name and an
 * uninstalled dependency contribute nothing.
 */
export async function projectPackages(root: string): Promise<ProjectPackage[]> {
  const manifest = await readManifest(join(root, 'package.json'))
  if (!manifest) return []
  const names = new Set<string>()
  for (const field of [manifest.dependencies, manifest.devDependencies]) {
    if (field && typeof field === 'object' && !Array.isArray(field)) for (const name of Object.keys(field)) names.add(name)
  }
  const packages: ProjectPackage[] = []
  for (const name of names) {
    // A name that is not a package name (a path, `..`) is never looked up.
    if (!/^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(name)) continue
    const dir = await realpath(join(root, 'node_modules', name)).catch(() => undefined)
    const pkg = dir ? await readManifest(join(dir, 'package.json')) : undefined
    if (dir && pkg) packages.push({ name, dir, manifest: pkg })
  }
  return packages
}

/** A package's commands: `bin` as one path (named after the package) or as a name → path map. */
export function packageBins(name: string, bin: unknown, pkgDir: string): Record<string, string> {
  if (typeof bin === 'string') return { [name.replace(/^@[^/]+\//, '')]: join(pkgDir, bin) }
  if (!bin || typeof bin !== 'object' || Array.isArray(bin)) return {}
  const bins: Record<string, string> = {}
  for (const [command, path] of Object.entries(bin)) if (typeof path === 'string') bins[command] = join(pkgDir, path)
  return bins
}

/** The command of a project's package that provides one kind of the framework's data, by the package's declaration. */
export interface ProvidedCommand {
  /** The package that declares it. */
  package: string
  /** The command's name, one of the package's own commands. */
  name: string
  /** The command's script, an absolute path inside the package. */
  bin: string
}

/**
 * What looking a kind up found: its command, or nothing. `problem` is why nothing, when the
 * project has to act: several packages provide the kind and its package.json names none, or
 * names one that does not provide it. Nobody declaring the kind is no problem: the project has
 * none of that data.
 */
export type ProvidedCommandLookup = { command: ProvidedCommand; problem?: undefined } | { command?: undefined; problem?: string }

/** The `framework` object of a manifest, when it has one. */
function frameworkKey(manifest: PackageManifest, kind: string): unknown {
  const framework = manifest.framework
  return framework && typeof framework === 'object' && !Array.isArray(framework) ? (framework as Record<string, unknown>)[kind] : undefined
}

/**
 * The command that provides `kind` in the project at `root`: the one installed dependency whose
 * own package.json declares the kind naming one of its commands; a declaration naming a command
 * the package does not have is no declaration. Two or more declare it: the one the project's own
 * package.json names under `"framework": { "<kind>": "<package name>" }`, else none, with the
 * reason. The project naming a package that does not declare the kind is the same: none, said.
 */
export async function lookupProvidedCommand(root: string, kind: string): Promise<ProvidedCommandLookup> {
  const providers: ProvidedCommand[] = []
  for (const { name, dir, manifest } of await projectPackages(root)) {
    const declared = frameworkKey(manifest, kind)
    if (typeof declared !== 'string') continue
    const bin = packageBins(name, manifest.bin, dir)[declared]
    if (bin !== undefined) providers.push({ package: name, name: declared, bin })
  }
  const project = await readManifest(join(root, 'package.json'))
  const named = project ? frameworkKey(project, kind) : undefined
  const names = providers.map(p => p.package).join(', ')
  if (typeof named === 'string') {
    const command = providers.find(p => p.package === named)
    if (command) return { command }
    return { problem: `package.json names ${named} for ${kind}, which does not provide it${providers.length ? `; the providers are ${names}` : ''}` }
  }
  if (providers.length === 1) return { command: providers[0]! }
  if (providers.length === 0) return {}
  return { problem: `${providers.length} packages provide ${kind}: ${names}; name one under "framework" in package.json` }
}

/** {@link lookupProvidedCommand}'s command, for a caller that only needs to run it. */
export async function readProvidedCommand(root: string, kind: string): Promise<ProvidedCommand | undefined> {
  return (await lookupProvidedCommand(root, kind)).command
}

/** What a package's command answered: its JSON output, or why there is none. */
export type PackageCommandResult = { ok: true; output: unknown } | { ok: false; error: string }

/** How long a package's command may run, and how much it may print. */
export const COMMAND_TIMEOUT_MS = 30_000
export const COMMAND_MAX_OUTPUT = 16 * 1024 * 1024

/**
 * Run one package command in the project and read its standard output as JSON: with Node (a
 * package's commands are Node scripts), in the project root, never through a shell, bounded in
 * time and output. A command that exits non-zero answers its last stderr line; one that prints no
 * JSON says so.
 */
export async function runPackageCommand(root: string, command: { name: string; bin: string }, args: readonly string[]): Promise<PackageCommandResult> {
  const { name, bin } = command
  const run = await new Promise<{ failed?: string; stdout: string }>(resolvePromise => {
    execFile(
      process.execPath,
      [bin, ...args],
      { cwd: root, timeout: COMMAND_TIMEOUT_MS, maxBuffer: COMMAND_MAX_OUTPUT, encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (!error) return resolvePromise({ stdout })
        const said = stderr.trim().split('\n').at(-1)?.trim()
        const failed =
          (error as NodeJS.ErrnoException).code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'
            ? `${name} printed too much`
            : error.killed
              ? `${name} took too long`
              : said || `${name} failed: ${error.message}`
        resolvePromise({ failed, stdout })
      },
    )
  })
  if (run.failed !== undefined) return { ok: false, error: run.failed }
  try {
    return { ok: true, output: JSON.parse(run.stdout) as unknown }
  } catch {
    return { ok: false, error: `${name} printed no JSON` }
  }
}
