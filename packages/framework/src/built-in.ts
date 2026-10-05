import { realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { declaring, lookupProvidedCommand, packageBins, projectPackages, readManifest, runPackageCommand, type ProjectPackage, type ProvidedCommand, type ProvidedCommandLookup } from '@openagt/agent-data'

/**
 * The packages the framework ships for every project, by name: dependencies of the framework
 * itself, resolved from its own install, so a project installs nothing for them and an empty
 * folder starts an agent and shows it. Each comes through the same contract as a project's own
 * package: a module by its `./dashboard` export, a provider of a kind of data and the writer of
 * its hook lines by its `framework` key. This list is the one place the framework names a
 * package, and a project's own copy of any of them wins.
 */
export const BUILT_IN_PACKAGES: readonly string[] = ['@openagt/files', '@openagt/skill-branches', '@openagt/skill-github', '@openagt/skill-logs', '@openagt/agent-runner']

let resolved: Promise<ProjectPackage[]> | undefined

/** The built-in packages, resolved from the framework's own install, once; one that is not installed is skipped. */
export function builtInPackages(): Promise<ProjectPackage[]> {
  return (resolved ??= resolveBuiltIn())
}

async function resolveBuiltIn(): Promise<ProjectPackage[]> {
  const require = createRequire(import.meta.url)
  const packages: ProjectPackage[] = []
  for (const name of BUILT_IN_PACKAGES) {
    let manifestPath: string
    try {
      manifestPath = require.resolve(`${name}/package.json`)
    } catch {
      continue
    }
    const dir = await realpath(dirname(manifestPath)).catch(() => undefined)
    const manifest = dir ? await readManifest(join(dir, 'package.json')) : undefined
    if (dir && manifest) packages.push({ name, dir, manifest })
  }
  return packages
}

/** The directories the built-in packages' commands sit in: what a hook line's PATH gains after the project's own installed tools. */
export async function builtInBinDirs(): Promise<string[]> {
  const dirs = new Set<string>()
  for (const { name, dir, manifest } of await builtInPackages()) {
    for (const bin of Object.values(packageBins(name, manifest.bin, dir))) dirs.add(dirname(bin))
  }
  return [...dirs]
}

/** What provides `kind` in the project at `root`: one of the project's own packages, else a built-in one. */
export async function lookupProvided(root: string, kind: string): Promise<ProvidedCommandLookup> {
  return lookupProvidedCommand(root, kind, await builtInPackages())
}

/** {@link lookupProvided}'s command, for a caller that only needs to run it. */
export async function providedCommand(root: string, kind: string): Promise<ProvidedCommand | undefined> {
  return (await lookupProvided(root, kind)).command
}

/** Whether `command` comes from a built-in package the project has no copy of: one the project did not choose. */
export async function isBuiltIn(root: string, command: ProvidedCommand): Promise<boolean> {
  if ((await projectPackages(root)).some(pkg => pkg.name === command.package)) return false
  return (await builtInPackages()).some(pkg => pkg.name === command.package)
}

/**
 * Have every package that writes hook lines write its own into the project at `root`: a package
 * declares `"framework": { "hooks": "<command>" }`, and `<command> init`, run in the project,
 * writes its lines into the project's hooks file, keeping every line already there. The project's
 * own packages are asked, then the built-in ones the project has no copy of. Answers one line per
 * package that could not write, in words.
 */
export async function writeHookLines(root: string): Promise<string[]> {
  const own = await projectPackages(root)
  const packages = [...own, ...(await builtInPackages()).filter(pkg => !own.some(o => o.name === pkg.name))]
  const failed: string[] = []
  for (const command of declaring(packages, 'hooks')) {
    const result = await runPackageCommand(root, command, ['init'])
    if (!result.ok) failed.push(`${command.package}: ${result.error}`)
  }
  return failed
}
