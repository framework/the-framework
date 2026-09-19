// The logs' widget for the dashboard: the package's `./dashboard` export. It adds one page, Logs,
// that lists the recorded runs of every project that has this package. Its data is the `logs`
// command's own output, run in each project by the dashboard: the widget reads exactly what an
// agent reads with `npx logs`.
import { ScrollText } from 'lucide-react'
import { defineWidget } from 'framework/widget'
import { LogsPage } from './LogsPage.js'
import './dashboard.css'

export default defineWidget({
  pages: [{ segment: 'logs', label: 'Logs', icon: ScrollText, Page: LogsPage }],
  stylesheet: 'dashboard.css',
})
