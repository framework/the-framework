import { useWidgetHost, usePolled, type WidgetPageProps, type WidgetProject } from 'framework/widget'
import type { PlacedEntry } from '../src/queue.js'
import { entryLabel } from '../src/widget.js'

/** One project's queue as read: its entries with their sections, or why the command failed. */
interface ProjectRead {
  project: WidgetProject
  entries?: PlacedEntry[]
  error?: string
}

const NOTHING_READ: ProjectRead[] = []

/** The entries grouped by section, the highest priority first, the unranked last. */
function sections(entries: PlacedEntry[]): { priority: number | undefined; entries: string[] }[] {
  const byPriority = new Map<number | undefined, string[]>()
  for (const { entry, priority } of entries) {
    const list = byPriority.get(priority) ?? []
    list.push(entry)
    byPriority.set(priority, list)
  }
  return [...byPriority.entries()]
    .map(([priority, list]) => ({ priority, entries: list }))
    .sort((a, b) => (b.priority ?? -1) - (a.priority ?? -1))
}

/**
 * The Queue page: every project's open entries, in the order agents will take them, under the
 * priority section each sits in, from `queue --local --full` in each project. A project whose
 * command fails is named with the command's own reason, and the other projects still show.
 * Read-only: what is queued is changed by agents and by the "Add to queue" action on the pages
 * that show links.
 */
export function QueuePage({ projects }: WidgetPageProps) {
  const host = useWidgetHost()
  const key = projects.map(p => p.id).join(',')
  const { value: reads, loaded } = usePolled<ProjectRead[]>(
    () =>
      Promise.all(
        projects.map(async (project): Promise<ProjectRead> => {
          const result = await host.runCommand(project.id, ['--local', '--full'])
          if (!result.ok) return { project, error: result.error }
          if (!Array.isArray(result.output)) return { project, error: 'the queue command did not print a list' }
          return { project, entries: result.output.filter(isPlacedEntry) }
        }),
      ),
    NOTHING_READ,
    // A local read, no fetch: cheap enough to follow the queue closely.
    10_000,
    [key],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <h1 className="text-lg font-semibold">Queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">What agents will work on next, in order, per project.</p>
      {!loaded && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {reads.map(({ project, entries, error }) => (
        <section key={project.id} className="mt-6">
          {projects.length > 1 && <h2 className="text-sm font-semibold">{project.name}</h2>}
          {error !== undefined ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              Could not read the queue of {project.name}: {error}
            </p>
          ) : entries!.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing queued.</p>
          ) : (
            sections(entries!).map(section => (
              <div key={section.priority ?? 'none'} className="mt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.priority === undefined ? 'No priority' : `Priority ${section.priority}`}
                </h3>
                <ul className="mt-1 space-y-1">
                  {section.entries.map((entry, i) => {
                    const label = entryLabel(entry)
                    return (
                      <li key={i} className="flex items-center gap-2 text-sm" title={entry}>
                        <span aria-hidden className="text-muted-foreground/50">•</span>
                        {label.url !== undefined ? (
                          <a href={label.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-info hover:underline">
                            {label.text}
                          </a>
                        ) : (
                          <span className="min-w-0 truncate">{label.text}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </section>
      ))}
    </div>
  )
}

/** Whether the command printed one entry as `--full` prints it. */
function isPlacedEntry(value: unknown): value is PlacedEntry {
  if (!value || typeof value !== 'object') return false
  const { entry, priority } = value as Record<string, unknown>
  return typeof entry === 'string' && (priority === undefined || typeof priority === 'number')
}
