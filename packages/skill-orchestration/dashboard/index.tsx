// Orchestration's module for the dashboard: the package's `./dashboard` export. It adds one section
// to the Settings page, Subagents: which coding agent and model a main agent's subagents run on, by
// how hard their task is, and how many run at once. Its data is the `orchestration settings`
// command's own, run in each project by the dashboard: the file `orchestration start` reads.
import { defineModule } from '@openagt/dashboard/module'
import { SubagentsSettings } from './SubagentsSettings.js'
import './dashboard.css'

export default defineModule({
  settings: [{ id: 'subagents', order: 10, Section: SubagentsSettings }],
  stylesheet: 'dashboard.css',
})
