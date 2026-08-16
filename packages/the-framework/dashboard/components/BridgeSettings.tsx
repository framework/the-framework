import { useEffect, useState } from 'react'
import { onBridgeToken } from '../server/reads.telefunc.js'
import { Button } from './ui/button.js'
import { CopyButton } from './ui/copy-button.js'

/**
 * Setting up the browser bridge (#1237).
 *
 * This exists because the feature was unusable without it: turning the bridge on meant editing
 * `~/.the-framework.json` by hand, and getting the token meant copying a field out of the same
 * file. Neither is something to ask of anyone, and a token nobody can find is a feature nobody
 * can enable.
 *
 * The token is revealed on request rather than rendered outright. Not because showing it is
 * dangerous here (anyone who can load this page can already start runs on this machine) but
 * because a secret sitting permanently on screen is a secret in every screen recording and
 * screenshot, and this dashboard is demoed.
 */
export function BridgeSettings({ enabled, onChange }: { enabled: boolean; onChange: (next: boolean) => void }) {
  const [token, setToken] = useState<string | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setToken(null)
      setShown(false)
      return
    }
    let live = true
    void onBridgeToken()
      .then(next => {
        if (live) setToken(next)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
      <p className="text-muted-foreground">
        Install the browser extension, open its options, and paste this token. It reports the question a Claude web
        session is parked on, so it shows up here instead of only on claude.ai.
      </p>
      {token === null ? (
        // A restart is genuinely required: the token is read when the daemon starts.
        <p className="text-muted-foreground">Restart the dashboard to generate the token.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono">
            {shown ? token : '•'.repeat(24)}
          </code>
          <Button variant="outline" size="sm" onClick={() => setShown(v => !v)}>
            {shown ? 'Hide' : 'Reveal'}
          </Button>
          <CopyButton text={token} label="Copy the bridge token" />
        </div>
      )}
    </div>
  )
}
