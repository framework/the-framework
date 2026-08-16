import vikeReact from 'vike-react/config'
import type { Config } from 'vike/types'
import Layout from '../layouts/LayoutDefault.js'

// Global Vike config. SPA / client-only (ssr:false) per #405 — the dashboard is a
// projection of local files behind localhost, not an SSR app. `prerender` emits a
// static `index.html` shell (+ assets) so the daemon serves it as plain files with no
// Vike runtime (the single `/` route writes straight to `../dist/dashboard-bundle/client/index.html`,
// which is where the daemon looks — see src/dashboard/bundle.ts).
// vike-react wires React.
export default {
  extends: vikeReact,
  Layout,
  ssr: false,
  prerender: true,
  title: 'The Framework',
  // The brand mark as the tab icon (#757). It carries its own dark-mode ramp inside the file:
  // a favicon sits on browser chrome, which follows the OS theme, not our in-app theme choice.
  favicon: '/logo.svg',
} satisfies Config
