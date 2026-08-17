import { TriangleAlert } from 'lucide-react'
import type { RetiredProjectNotice } from '../rpc/reads.js'

// The banner for the per-project settings tier that was deleted (#840). Everything else retired on
// that branch is silent — a renamed key is an unknown key — but this one drops in the *permissive*
// direction: a repo the user had set to "don't publish" falls through to their default, which
// pushes the branch and opens a pull request. The product's premise is that nobody is at the
// keyboard, so the daemon's stdout at boot is exactly where this would not be read; it belongs
// where they will next look.
//
// Each row arrives written, from the same function the daemon's log prints, so the two surfaces
// cannot drift into saying different things about the same repo. This decides only where it goes.
//
// Not dismissible, and no acknowledgement: the daemon reads the block at boot and the session's
// first preference write drops it, so the banner goes when the fact does. Withholding anything
// until it is acknowledged would be the deleted tier under another name.
export function RetiredSettingsNotice({ projects }: { projects: readonly RetiredProjectNotice[] }) {
  if (!projects.length) return null
  return (
    <div role="alert" className="flex items-start gap-2 border-b border-border bg-warning/10 px-4 py-2 text-xs text-warning">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p>
          Per-project settings are no longer kept here — a repo&apos;s settings live in its own{' '}
          <code className="font-mono">the-framework.yml</code>.
        </p>
        <ul className="mt-1 space-y-0.5">
          {projects.map(project => (
            <li key={project.path} className="break-words">
              <span className="font-medium">{project.path}</span> had {project.keys.join(', ')}. {project.advice}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
