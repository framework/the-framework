import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { sendAddProject, sendPickProjectDirectory } from '../rpc/projects.js'
import { useAction } from '../lib/use-action.js'
import { AddProjectEffects } from './AddProjectEffects.js'
import { Button } from './ui/button.js'

// Add a project (#396/#1150): the OS's own folder picker instead of a typed path — the daemon
// opens the dialog (a browser page cannot learn an absolute path from a picker of its own) and
// hands the choice back, the user confirms they trust the repo, and the daemon installs and
// registers it. Opened as a small modal from the projects picker and the onboarding checklist.
// The checklist may hand it the folder the dashboard runs in: then there is nothing to pick.
//
// Before the add, the person also says where the agents' records go: kept on this machine, which
// is what is picked until they pick the other, or shared to the repository's remote. Nothing is
// pushed for a project added with the first.
//
// It behaves like the dialog it claims to be (#948): Esc closes, Tab stays inside, focus
// returns to the opener on close.
export function AddProjectPanel({ folder, onAdded, onClose }: { folder?: string | undefined; onAdded: () => void; onClose: () => void }) {
  // The picked path, once the system dialog answered; the phases are picking (no path yet),
  // confirming trust (path, not added), and done (added set).
  const [path, setPath] = useState<string | null>(folder ?? null)
  const [share, setShare] = useState(false)
  const [added, setAdded] = useState<{ alreadyActivated: boolean; noRemote: boolean } | null>(null)
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
    if (!folder) void pick()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-close a beat after success; Done closes sooner.
  useEffect(() => {
    if (!added) return
    const timer = setTimeout(onClose, added.noRemote ? 6000 : 2500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [added])

  // Trust confirmed (#439) -> install + register.
  const confirmAdd = async () => {
    if (busy || !path) return
    const outcome = await run(() => sendAddProject(path, share), 'Failed to add the project.')
    if (outcome.ok) {
      setAdded({ alreadyActivated: outcome.value.alreadyActivated, noRemote: outcome.value.noRemote === true })
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
            {/* Sharing was picked and there is nothing to share with: said, not dropped. */}
            {added.noRemote && <p className="mb-3 text-xs text-muted-foreground">This repository has no remote, so the agents&rsquo; records stay on this machine.</p>}
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
            <div className="mb-3">
              <AddProjectEffects />
            </div>
            <fieldset className="mb-3 text-xs">
              <legend className="mb-1 font-medium text-foreground">The agents&rsquo; records (what you ask, what each agent answers)</legend>
              <label className="flex items-start gap-2 py-0.5">
                <input type="radio" name="records" className="mt-0.5" checked={!share} disabled={busy} onChange={() => setShare(false)} />
                <span>
                  Keep them on this machine
                  <span className="block text-muted-foreground">Nothing is pushed.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 py-0.5">
                <input type="radio" name="records" className="mt-0.5" checked={share} disabled={busy} onChange={() => setShare(true)} />
                <span>
                  Share them to the repository&rsquo;s remote
                  <span className="block text-muted-foreground">
                    Pushes a branch <code className="rounded bg-muted px-1">agent-data</code> to origin, and keeps pushing as agents work.
                  </span>
                </span>
              </label>
              <p className="mt-1 text-muted-foreground">You can change this later in the project&rsquo;s menu.</p>
            </fieldset>
            {error && <p className="mb-2 text-xs text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => (folder ? onClose() : void pick())}>
                {folder ? 'Cancel' : 'Choose again'}
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
