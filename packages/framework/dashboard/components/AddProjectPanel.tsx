import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { sendAddProject, sendPickProjectDirectory } from '../rpc/projects.js'
import { useAction } from '../lib/use-action.js'
import { Button } from './ui/button.js'

// Add a project (#396/#1150): the OS's own folder picker instead of a typed path — the daemon
// opens the dialog (a browser page cannot learn an absolute path from a picker of its own) and
// hands the choice back, the user confirms they trust the repo, and the daemon installs and
// registers it. Opened as a small modal from the projects picker and the onboarding checklist.
//
// It behaves like the dialog it claims to be (#948): Esc closes, Tab stays inside, focus
// returns to the opener on close.
export function AddProjectPanel({ onAdded, onClose }: { onAdded: () => void; onClose: () => void }) {
  // The picked path, once the system dialog answered; the phases are picking (no path yet),
  // confirming trust (path, not added), and done (added set).
  const [path, setPath] = useState<string | null>(null)
  const [added, setAdded] = useState<{ alreadyActivated: boolean } | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const { busy, error, reset, run } = useAction()
  const panelRef = useRef<HTMLDivElement>(null)

  // Give focus back to the control that opened the dialog (the picker's Add item is gone by
  // then, so its trigger is the stable target).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => opener?.focus()
  }, [])

  // The system dialog opens with the modal: picking the folder IS the form. A dismissed dialog
  // closes the modal too — the user said "not now" once already.
  const pick = async () => {
    setPickError(null)
    const picked = await sendPickProjectDirectory().catch(() => ({ ok: false as const, error: 'Could not reach the daemon.' }))
    if (!picked.ok) {
      setPickError(picked.error)
      return
    }
    if (!picked.path) {
      onClose()
      return
    }
    reset()
    setPath(picked.path)
  }
  useEffect(() => {
    void pick()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-close a beat after success; Done closes sooner.
  useEffect(() => {
    if (!added) return
    const timer = setTimeout(onClose, 2500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [added])

  // Trust confirmed (#439) -> install + register.
  const confirmAdd = async () => {
    if (busy || !path) return
    const result = await run(() => sendAddProject(path), 'Failed to add the project.')
    if (result?.ok) {
      setAdded({ alreadyActivated: result.alreadyActivated })
      onAdded()
    }
  }

  // The dialog contract: Esc closes; Tab cycles inside rather than escaping to the page.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')].filter(
      el => !el.hasAttribute('disabled'),
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24" onKeyDown={onKeyDown}>
      {/* Click-away closes, same as dismissing the dropdown it was opened from. */}
      <div className="absolute inset-0" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add project"
        className="relative w-96 max-w-[90vw] rounded-lg border border-border bg-background p-4 shadow-lg"
      >
        {added ? (
          <>
            <p role="status" className="mb-3 text-sm font-medium">
              {added.alreadyActivated ? 'Already added' : 'Project added'}
            </p>
            <div className="flex justify-end">
              <Button type="button" size="sm" autoFocus onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        ) : pickError ? (
          <>
            <p className="mb-2 text-sm font-medium">Add project</p>
            <p className="mb-3 text-xs text-danger">{pickError}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={() => void pick()}>
                Try again
              </Button>
            </div>
          </>
        ) : path ? (
          // The trust confirmation (#439): a plain-language prompt-injection warning before adding.
          <>
            <p className="mb-2 text-sm font-medium">Do you trust this repository?</p>
            <p className="mb-2 break-all text-xs text-muted-foreground">
              <code className="rounded bg-muted px-1">{path}</code>
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Adding it lets the agent read its files. Hidden instructions in an untrusted repo can hijack the agent
              (prompt injection), so only add repos you trust.
            </p>
            {error && <p className="mb-2 text-xs text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void pick()}>
                Choose again
              </Button>
              <Button type="button" size="sm" autoFocus disabled={busy} onClick={() => void confirmAdd()}>
                {busy ? 'Adding…' : 'I trust it, add it'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium">Add project</p>
            <p role="status" className="mb-3 text-xs text-muted-foreground">
              Choose the repository&apos;s folder in the system dialog…
            </p>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
