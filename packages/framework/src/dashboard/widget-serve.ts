import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { contentTypeFor } from './content-type.js'
import { defaultProjectsProvider, type ProjectsProvider } from './projects.js'
import { findProjectWidget, widgetFile, type ProjectWidget } from '../project-widgets.js'

/** Where widget files are served: `/_widgets/<project id>/<package>/<file>`, each segment encoded. */
export const WIDGETS_PREFIX = '/_widgets'

/** The URL a widget's module is served at from one project. */
export function widgetUrl(projectId: string, widget: Pick<ProjectWidget, 'package' | 'entry'>): string {
  const file = widget.entry.split('/').map(encodeURIComponent).join('/')
  return `${WIDGETS_PREFIX}/${encodeURIComponent(projectId)}/${encodeURIComponent(widget.package)}/${file}`
}

function decode(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment)
  } catch {
    return undefined
  }
}

/**
 * Serve one widget file (#1774): the project must be registered, the package must be a widget of
 * that project, and the file must sit inside the widget module's own directory. Anything else is a
 * 404, never a fallback: a widget URL is asked for by the dashboard's loader, not typed by a person.
 * Served as `no-cache`, since a widget is rebuilt in place under the same name.
 */
export async function serveWidgetFile(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  projects: ProjectsProvider = defaultProjectsProvider(),
): Promise<void> {
  const notFound = () => void res.writeHead(404, { 'content-type': 'text/plain' }).end('no such widget file')
  if (req.method !== 'GET' && req.method !== 'HEAD') return void res.writeHead(405, { allow: 'GET, HEAD' }).end()
  const [projectSegment, packageSegment, ...rest] = pathname.slice(WIDGETS_PREFIX.length + 1).split('/')
  const projectId = projectSegment !== undefined ? decode(projectSegment) : undefined
  const pkg = packageSegment !== undefined ? decode(packageSegment) : undefined
  const rel = rest.map(decode)
  if (!projectId || !pkg || rel.length === 0 || rel.some(part => part === undefined)) return notFound()
  const root = await projects.resolvePath(projectId)
  const widget = root ? await findProjectWidget(root, pkg).catch(() => undefined) : undefined
  const file = widget ? await widgetFile(widget, rel.join('/')) : undefined
  const body = file ? await readFile(file).catch(() => undefined) : undefined
  if (!file || body === undefined) return notFound()
  res.writeHead(200, { 'content-type': contentTypeFor(file), 'cache-control': 'no-cache' })
  res.end(req.method === 'HEAD' ? undefined : body)
}
