// The queue's widget for the dashboard: the package's `./dashboard` export. It adds one page,
// Queue, that lists the open entries of every project that has this package, by priority section,
// and one action on the links dashboard pages show, "Add to queue". Its data is the `queue`
// command's own output, run in each project by the dashboard: the widget reads exactly what an
// agent reads with `npx queue`, and writes exactly the line an agent writes with `npx queue add`.
import { ListTodo } from 'lucide-react'
import { defineWidget } from 'framework/widget'
import { QueuePage } from './QueuePage.js'
import { ADD_TO_QUEUE } from './add-to-queue.js'
import './dashboard.css'

export default defineWidget({
  pages: [{ segment: 'queue', label: 'Queue', icon: ListTodo, Page: QueuePage }],
  linkActions: [ADD_TO_QUEUE],
  stylesheet: 'dashboard.css',
})
