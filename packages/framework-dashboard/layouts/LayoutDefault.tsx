import { useEffect, type ReactNode } from 'react'
import './tailwind.css'
import { usePreferences, themePreference, resolvedDark } from '../lib/preferences.js'
import { ErrorBoundary } from '../components/ErrorBoundary.js'

// The dashboard's color theme (#725): system (default, follow the OS), light, or dark. Client-only
// (ssr:false), so toggling the `.dark` class in an effect is fine. Until the preferences load over
// Telefunc the choice is `system`, so a dark-OS user still gets dark first paint.
export default function LayoutDefault({ children }: { children: ReactNode }) {
  const theme = themePreference(usePreferences())
  useEffect(() => {
    const root = document.documentElement
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => root.classList.toggle('dark', resolvedDark(theme, mql.matches))
    apply()
    // Only follow live OS changes while on `system`; light/dark are fixed choices.
    if (theme !== 'system') return
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [theme])
  // Everything dynamic renders below here — the live feed, the polled panels, the markdown — so the
  // error boundary (#1194) sits inside the themed shell: a caught crash shows its recoverable card on
  // the app's own background rather than the browser's blank white.
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ErrorBoundary>{children}</ErrorBoundary>
    </div>
  )
}
