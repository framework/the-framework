// The scheduler's module for the dashboard: the package's `./dashboard` export. It adds the
// Scheduler section to the Settings page, the Scheduler card to the Overview, and the stop line on
// the usage bar. Its data is the `agent-scheduler` command's own, run in each project by the
// dashboard: `status` to read, `offset`, `switch` and `publish` to save.
import { defineModule } from 'framework/module'
import { SchedulerCard } from './SchedulerCard.js'
import { SchedulerSettings } from './SchedulerSettings.js'
import { loosestSpendOffset, readSchedulers, saveSpendOffset } from './schedulers.js'
import './dashboard.css'

export default defineModule({
  cards: [{ id: 'scheduler', order: 90, Card: SchedulerCard }],
  settings: [{ id: 'scheduler', order: 20, Section: SchedulerSettings }],
  usageLimit: {
    read: async (host, projects) => loosestSpendOffset(await readSchedulers(host, projects)),
    save: saveSpendOffset,
  },
  stylesheet: 'dashboard.css',
})
