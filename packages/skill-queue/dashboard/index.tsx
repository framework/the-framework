// The queue's widget for the dashboard: the package's `./dashboard` export. It adds one page,
// Queue, that lists the open entries of every project that has this package, by priority section;
// one Overview card, AI Queue, that lists them in full and starts agents on them; and one action
// on the links dashboard pages show, "Add to queue". Its data is the `queue` command's own output,
// run in each project by the dashboard: the widget reads exactly what an agent reads with
// `npx queue`, and writes exactly the line an agent writes with `npx queue add`.
import { ListTodo } from 'lucide-react'
import { defineWidget } from 'framework/widget'
import { QueuePage } from './QueuePage.js'
import { QueueCard } from './QueueCard.js'
import { ADD_TO_QUEUE } from './add-to-queue.js'
import './dashboard.css'

export default defineWidget({
  pages: [{ segment: 'queue', label: 'Queue', icon: ListTodo, Page: QueuePage }],
  cards: [{ id: 'queue', order: 10, Card: QueueCard }],
  linkActions: [ADD_TO_QUEUE],
  stylesheet: 'dashboard.css',
})
