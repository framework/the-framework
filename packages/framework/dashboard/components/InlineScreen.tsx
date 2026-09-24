/**
 * A live screen in the chat: the page a `screen` line names, framed where the line is. The page
 * is the command's own (for a browser: its address bar over the live picture, taking clicks and
 * typing); this knows nothing of what it shows. Only a loopback address is framed, since the line
 * was written by whatever the agent ran; the sandbox keeps the page from reaching the dashboard.
 */
export function InlineScreen({ url, label }: { url: string; label: string }) {
  return (
    <iframe
      src={url}
      title={label}
      sandbox="allow-scripts allow-same-origin allow-forms"
      className="aspect-[16/11] max-h-[32rem] w-full rounded-md border border-border bg-muted"
    />
  )
}

/** Whether a screen's address is on this machine: the only kind of address the chat frames. */
export function isLoopbackScreen(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'http:' && (hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]')
  } catch {
    return false
  }
}
