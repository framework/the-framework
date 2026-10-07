import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { contentTypeFor } from './content-type.js'
import { defaultProjectsProvider, type ProjectsProvider } from './projects.js'
import { findProjectModule, moduleFile, type ProjectModule } from '../project-modules.js'

/** Where module files are served: `/_modules/<project id>/<package>/<file>`, each segment encoded. */
export const MODULES_PREFIX = '/_modules'

/** The URL a module's browser part is served at from one project. */
export function moduleUrl(projectId: string, module: Pick<ProjectModule, 'package' | 'entry'>): string {
  const file = module.entry.split('/').map(encodeURIComponent).join('/')
  return `${MODULES_PREFIX}/${encodeURIComponent(projectId)}/${encodeURIComponent(module.package)}/${file}`
}

function decode(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment)
  } catch {
    return undefined
  }
}

/**
 * Serve one module file (#1774): the project must be registered, the package must be a module of
 * that project, and the file must sit inside the module's browser part's own directory. Anything else is a
 * 404, never a fallback: a module URL is asked for by the dashboard's loader, not typed by a person.
 * Served as `no-cache`, since a module is rebuilt in place under the same name.
 */
export async function serveModuleFile(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  projects: ProjectsProvider = defaultProjectsProvider(),
): Promise<void> {
  const notFound = () => void res.writeHead(404, { 'content-type': 'text/plain' }).end('no such module file')
  if (req.method !== 'GET' && req.method !== 'HEAD') return void res.writeHead(405, { allow: 'GET, HEAD' }).end()
  const [projectSegment, packageSegment, ...rest] = pathname.slice(MODULES_PREFIX.length + 1).split('/')
  const projectId = projectSegment !== undefined ? decode(projectSegment) : undefined
  const pkg = packageSegment !== undefined ? decode(packageSegment) : undefined
  const rel = rest.map(decode)
  if (!projectId || !pkg || rel.length === 0 || rel.some(part => part === undefined)) return notFound()
  const root = await projects.resolvePath(projectId)
  const module = root ? await findProjectModule(root, pkg).catch(() => undefined) : undefined
  const file = module ? await moduleFile(module, rel.join('/')) : undefined
  const body = file ? await readFile(file).catch(() => undefined) : undefined
  if (!file || body === undefined) return notFound()
  res.writeHead(200, { 'content-type': contentTypeFor(file), 'cache-control': 'no-cache' })
  res.end(req.method === 'HEAD' ? undefined : body)
}
