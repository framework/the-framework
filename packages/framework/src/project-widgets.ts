import { realpath, stat } from 'node:fs/promises'
import { dirname, join, normalize, sep } from 'node:path'
import { packageBins, projectPackages, runPackageCommand, type PackageCommandResult, type ProjectPackage } from '@gemstack/agent-data'

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

/** Whether `path` is `dir` itself or inside it; both already normalized. */
function within(dir: string, path: string): boolean {
  return path === dir || path.startsWith(dir + sep)
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
    bins: packageBins(name, pkg.bin, pkgDir),
  }
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
export type WidgetCommandResult = PackageCommandResult

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
