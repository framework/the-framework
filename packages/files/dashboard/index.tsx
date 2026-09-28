// The Files module for the dashboard: the package's `./dashboard` export, built into OpenAgent and
// loaded for every project. It adds one side-rail tab, Files, that shows the project's files, or a
// run's with what the run changed marked, for as long as its checkout, branch or merge commit
// exists; and, on a working run's page, the count of files it has changed so far in the action bar
// and their list under it. Its data is its own server part's reads (`../src/server.ts`).
import { defineModule } from 'framework/module'
import { FileTree } from './FileTree.js'
import { ChangesDetails, ChangesSummary } from './AgentChanges.js'
import './dashboard.css'

export default defineModule({
  panels: [
    {
      id: 'files',
      label: 'Files',
      help: 'The project’s files, or a session’s with what it changed, for as long as its checkout, branch or merge commit exists — hover one to preview it, click one to add it to the next run’s Context.',
      count: ({ context }) => context.files.size,
      Panel: FileTree,
    },
  ],
  run: { summary: ChangesSummary, details: ChangesDetails },
  stylesheet: 'dashboard.css',
})
