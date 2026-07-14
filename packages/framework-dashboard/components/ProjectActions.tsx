import { useEffect, useState } from 'react'
import { Github, FolderOpen, Code } from 'lucide-react'
import { onGithubUrl } from '../server/reads.telefunc.js'
import { sendOpenInApp } from '../server/control.telefunc.js'
import { Button } from './ui/button.js'

// Project-panel quick actions (#488). "Open on GitHub" (#489) when the repo has a github.com
// remote, plus localhost-only "Open folder" / "Open in editor" (#490) that ask the daemon to
// spawn the OS file manager / editor on the project's path. This bar only renders in the local
// dashboard (the relay shows RelayView instead), so the localhost actions never appear there.
export function ProjectActions({ projectId }: { projectId: string }) {
  const [githubUrl, setGithubUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setGithubUrl(null)
    setError(null)
    void onGithubUrl(projectId).then(url => live && setGithubUrl(url))
    return () => {
      live = false
    }
  }, [projectId])

  const open = async (target: 'files' | 'editor') => {
    setBusy(true)
    setError(null)
    try {
      const result = await sendOpenInApp(projectId, target)
      if (!result.ok) setError(result.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      {githubUrl && (
        <a href={githubUrl} target="_blank" rel="noreferrer" title={githubUrl}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Github className="h-4 w-4" /> Open on GitHub
          </Button>
        </a>
      )}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={busy}
        title="Reveal the repo in your file manager (Finder / Explorer)"
        onClick={() => void open('files')}
      >
        <FolderOpen className="h-4 w-4" /> Open folder
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={busy}
        title="Open the repo in your editor (code, or $FRAMEWORK_EDITOR)"
        onClick={() => void open('editor')}
      >
        <Code className="h-4 w-4" /> Open in editor
      </Button>
      {error && <p className="w-full text-xs text-red-500">{error}</p>}
    </div>
  )
}
