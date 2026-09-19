import { execFile } from 'node:child_process'
import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, join, normalize, sep } from 'node:path'

/**
 * A dashboard widget one of a project's packages brings (#1774): the package's own browser module,
 * named by its `exports["./dashboard"]`. The framework names no package: any dependency of the
 * project that exports `./dashboard` is a widget, whoever wrote it.
 */
export interface ProjectWidget {
  /** The package's name, as the project's package.json lists it. */
  package: string
  /** The package's version, when its package.json says one. */
  version?: string
  /** The directory the widget's module sits in, symlinks resolved: the only directory served for it. */
  dir: string
  /** The widget module's file name inside {@link dir}. */
  entry: string
  /** The package's commands, by name, as absolute paths: what the widget may run in this project. */
  bins: Record<string, string>
}

/** The fields of a package.json this module reads; anything else is ignored. */
interface PackageJson {
  name?: unknown
  version?: unknown
  exports?: unknown
  bin?: unknown
  framework?: unknown
  dependencies?: unknown
  devDependencies?: unknown
}

async function readJson(path: string): Promise<PackageJson | undefined> {
  try {
    const data: unknown = JSON.parse(await readFile(path, 'utf8'))
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as PackageJson) : undefined
  } catch {
    return undefined
  }
}

/** The file an `exports["./dashboard"]` entry names: a plain path, or the `browser`/`import`/`default` condition. */
function dashboardExport(exports: unknown): string | undefined {
  if (!exports || typeof exports !== 'object' || Array.isArray(exports)) return undefined
  const entry = (exports as Record<string, unknown>)['./dashboard']
  if (typeof entry === 'string') return entry
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined
  for (const condition of ['browser', 'import', 'default']) {
    const target = (entry as Record<string, unknown>)[condition]
    if (typeof target === 'string') return target
  }
  return undefined
}

/** A package's commands: `bin` as one path (named after the package) or as a name → path map. */
function binsOf(name: string, bin: unknown, pkgDir: string): Record<string, string> {
  if (typeof bin === 'string') return { [name.replace(/^@[^/]+\//, '')]: join(pkgDir, bin) }
  if (!bin || typeof bin !== 'object' || Array.isArray(bin)) return {}
  const bins: Record<string, string> = {}
  for (const [command, path] of Object.entries(bin)) if (typeof path === 'string') bins[command] = join(pkgDir, path)
  return bins
}

/** Whether `path` is `dir` itself or inside it; both already normalized. */
function within(dir: string, path: string): boolean {
  return path === dir || path.startsWith(dir + sep)
}

/** A dependency of the project, resolved: its directory (symlinks followed) and its package.json. */
interface ProjectPackage {
  name: string
  dir: string
  manifest: PackageJson
}

/**
 * The project's installed dependencies: each name its own package.json lists (both
 * `dependencies` and `devDependencies`, in that order, a name listed twice read once), resolved
 * from the project's `node_modules` with symlinks followed, so a pnpm workspace link reads like
 * any install. A project with no package.json, a name that is not a package name and an
 * uninstalled dependency contribute nothing.
 */
async function projectPackages(root: string): Promise<ProjectPackage[]> {
  const manifest = await readJson(join(root, 'package.json'))
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
    const pkg = dir ? await readJson(join(dir, 'package.json')) : undefined
    if (dir && pkg) packages.push({ name, dir, manifest: pkg })
  }
  return packages
}

/**
 * The widgets a project's packages bring: each of the project's dependencies whose package.json
 * exports `./dashboard` to a file that exists inside the package. Sorted by name.
 */
export async function readProjectWidgets(root: string): Promise<ProjectWidget[]> {
  const widgets: ProjectWidget[] = []
  for (const pkg of await projectPackages(root)) {
    const widget = await readWidget(pkg)
    if (widget) widgets.push(widget)
  }
  return widgets.sort((a, b) => a.package.localeCompare(b.package))
}

async function readWidget({ name, dir: pkgDir, manifest: pkg }: ProjectPackage): Promise<ProjectWidget | undefined> {
  const target = dashboardExport(pkg.exports)
  if (!target) return undefined
  const file = await realpath(join(pkgDir, target)).catch(() => undefined)
  if (!file || !within(pkgDir, file) || !(await stat(file).then(s => s.isFile()).catch(() => false))) return undefined
  return {
    package: name,
    ...(typeof pkg.version === 'string' ? { version: pkg.version } : {}),
    dir: dirname(file),
    entry: file.slice(dirname(file).length + 1),
    bins: binsOf(name, pkg.bin, pkgDir),
  }
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
 * The command that provides `kind` of the framework's data in this project (#1774): the first of
 * the project's dependencies, in its package.json's order, whose own package.json declares
 * `"framework": { "<kind>": "<command>" }` naming one of its commands. The framework names no
 * package: whoever declares the kind provides it. `undefined` when no dependency does.
 */
export async function readProvidedCommand(root: string, kind: string): Promise<ProvidedCommand | undefined> {
  for (const { name, dir, manifest } of await projectPackages(root)) {
    const declared = manifest.framework && typeof manifest.framework === 'object' && !Array.isArray(manifest.framework) ? (manifest.framework as Record<string, unknown>)[kind] : undefined
    if (typeof declared !== 'string') continue
    const bin = binsOf(name, manifest.bin, dir)[declared]
    if (bin !== undefined) return { package: name, name: declared, bin }
  }
  return undefined
}

/** The one widget of this project that `name` names, or undefined. */
export async function findProjectWidget(root: string, name: string): Promise<ProjectWidget | undefined> {
  return (await readProjectWidgets(root)).find(widget => widget.package === name)
}

/**
 * The file a widget serves at `rel`, a path relative to its module's directory: its module, its
 * stylesheet, a chunk. `undefined` for a path that leaves that directory (symlinks resolved) or
 * names no file, so nothing else of the package, and nothing of the project, is ever served.
 */
export async function widgetFile(widget: ProjectWidget, rel: string): Promise<string | undefined> {
  if (!rel) return undefined
  const candidate = await realpath(normalize(join(widget.dir, rel))).catch(() => undefined)
  if (!candidate || !within(widget.dir, candidate)) return undefined
  return (await stat(candidate).then(s => s.isFile()).catch(() => false)) ? candidate : undefined
}

/** What a widget's command answered: its JSON output, or why there is none. */
export type WidgetCommandResult = { ok: true; output: unknown } | { ok: false; error: string }

/** How long a widget's command may run, and how much it may print. */
const COMMAND_TIMEOUT_MS = 30_000
const COMMAND_MAX_OUTPUT = 16 * 1024 * 1024
/** How many arguments, and how long each, a widget may pass: a command line, not a payload. */
const MAX_ARGS = 32
const MAX_ARG_LENGTH = 4096

/**
 * Run one of a widget package's own commands in the project, with the given arguments, and read
 * its standard output as JSON. This is how a widget reads its data: the same command an agent runs
 * (`npx logs`), so the widget and the agent see the same thing and the framework knows neither.
 *
 * `command` picks one of the package's commands; a package with exactly one needs none. The
 * command runs with Node (a package's commands are Node scripts), in the project root, never
 * through a shell, bounded in time and output. Refused: a command the package does not have, too
 * many or too long arguments. A command that exits non-zero answers its last stderr line; one that
 * prints no JSON says so.
 */
export async function runWidgetCommand(
  root: string,
  widget: ProjectWidget,
  args: readonly string[],
  command?: string,
): Promise<WidgetCommandResult> {
  const names = Object.keys(widget.bins)
  const name = command ?? (names.length === 1 ? names[0] : undefined)
  const bin = name !== undefined ? widget.bins[name] : undefined
  if (bin === undefined)
    return { ok: false, error: command !== undefined ? `${widget.package} has no command ${command}` : `${widget.package} has ${names.length === 0 ? 'no command' : 'several commands; name one'}` }
  if (args.length > MAX_ARGS || args.some(arg => typeof arg !== 'string' || arg.length > MAX_ARG_LENGTH))
    return { ok: false, error: 'too many or too long arguments' }
  return runPackageCommand(root, { name: name!, bin }, args)
}

/**
 * Run one package command in the project and read its standard output as JSON: with Node (a
 * package's commands are Node scripts), in the project root, never through a shell, bounded in
 * time and output. A command that exits non-zero answers its last stderr line; one that prints no
 * JSON says so.
 */
export async function runPackageCommand(root: string, command: { name: string; bin: string }, args: readonly string[]): Promise<WidgetCommandResult> {
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
