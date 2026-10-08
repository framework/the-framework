// The scheduler's module for the dashboard: the package's `./dashboard` export. It adds the
// Automations page, the Scheduler section of the Settings page, the Scheduler card of the Overview,
// and the stop line on the usage bar. Its data is the `agent-scheduler` command's own, run in each
// project by the dashboard: `status` to read, `offset`, `switch`, `pace`, `agents` and `publish` to save.
import { CalendarClock } from 'lucide-react'
import { defineModule } from '@openagt/dashboard/module'
import { AutomationsPage } from './AutomationsPage.js'
import { SchedulerCard } from './SchedulerCard.js'
import { SchedulerSettings } from './SchedulerSettings.js'
import { loosestSpendOffset, readSchedulers, saveSpendOffset } from './schedulers.js'
import './dashboard.css'

export default defineModule({
  pages: [{ segment: 'automations', label: 'Automations', icon: CalendarClock, Page: AutomationsPage }],
  cards: [{ id: 'scheduler', order: 90, Card: SchedulerCard }],
  settings: [{ id: 'scheduler', order: 20, Section: SchedulerSettings }],
  usageLimit: {
    read: async (host, projects) => loosestSpendOffset(await readSchedulers(host, projects)),
    save: saveSpendOffset,
  },
  stylesheet: 'dashboard.css',
})
