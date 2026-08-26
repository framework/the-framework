import { useEffect, useState } from 'react'
import type { Intervention, Activity, ProjectionRead, ProjectSummary, RecentAgent } from '../src/index.js'
import { onProjectFiles, onInterventions, onActivity, onRecentAgents } from './rpc/reads.js'
import { onProjects } from './rpc/projects.js'
import { AgentHistory } from './components/AgentHistory.js'
import { SidebarProvider } from './components/ui/sidebar.js'
import { ProjectHome } from './components/ProjectHome.js'
import { DashboardPage } from './components/DashboardPage.js'
import { SettingsPage } from './components/SettingsPage.js'
import { TicketsPage } from './components/TicketsPage.js'
import { TicketDetailPage } from './components/TicketDetailPage.js'
import { TicketPlanPage } from './components/TicketPlanPage.js'
import { AgentView } from './components/AgentView.js'
import { agentLabel } from './lib/agent-label.js'
import { RightRail } from './components/RightRail.js'
import { NotFound } from './components/NotFound.js'
import { useLiveEvents } from './lib/use-live-events.js'
import { useAgents } from './lib/use-agents.js'
import { usePolled } from './lib/use-async.js'
import { useRoute } from './lib/use-route.js'
import { useContextSet } from './lib/use-context-set.js'
import { useActivityNotifications, useInterventionNotifications } from './lib/use-notifications.js'
import { usePreferences, notificationsEnabled, newActivityEnabled, humanInterventionEnabled } from './lib/preferences.js'
import { agentViews, currentAgentEvents } from './lib/live-state.js'
import { useDocumentTitle } from './lib/document-title.js'
import { useWorking } from './lib/use-working.js'
import { useFavicon } from './lib/favicon.js'
import { useDaemonHealth } from './lib/use-daemon-health.js'
import { TriangleAlert } from 'lucide-react'

/** Stable, so `files` keeps one identity while no project is selected. */
const EMPTY_FILES: string[] = []

/** Stable initial for the projects load, so it does not churn on every render. */
const EMPTY_PROJECTS: ProjectSummary[] = []

/** Stable initial for the interventions poll, so it does not churn on every render. */
const EMPTY_INTERVENTIONS: ProjectionRead<Intervention> = { items: [], whole: [] }

/** Stable initial for the activity poll (#627), so it does not churn on every render. */
const EMPTY_ACTIVITY: ProjectionRead<Activity> = { items: [], whole: [] }

/** Stable initial for the cross-project recents poll, so it does not churn on every render. */
const EMPTY_RECENT: RecentAgent[] = []

// The dashboard shell (#405 phase 2): Sessions | main | Docs/History rail, with the project
// selection in the top nav as a dropdown since #772 (it used to be a rail of its own). The main pane
// is one of three views chosen by the selection: the project home/launcher (Live, the default —
// Start form + cards) or one session's own view (AgentView), live or finished — the same frame
// either way (#1026). Everything over the wire is `POST /_rpc/<name>`. A projection of the same
// .the-framework files the daemon writes.
//
// The selection IS the URL (#784): `/` the Overview, `/{projectId}` the project home,
// `/{projectId}/{sessionId}` one session. It used to be three pieces of React state — the
// selected agent, the just-started agent, and a "follow the live feed" flag — reconciled at render,
// and each of #761/#766/#768/#774 was a case where they disagreed about which run was in play.
// A route cannot disagree with itself, and a session becomes a link: paste it, reload it,
// bookmark it, open two side by side. A refresh returns to the same project for free, which is
// what the remembered-project state (#475) was for.
export function App() {
  const { route, go } = useRoute()
  const { view, projectId, agentId: agentId, ticketSlug, plan } = route

  // A just-started agent: bump the tick so the Sessions rail shows an optimistic "starting…" row
  // with the typed prompt at once, before the spawned process writes its agent.json. `id` is the
  // one the daemon allocated for it (#761) — the URL already points there, and this is what tells
  // the main pane that a session missing from the list is starting, not gone.
  // `runsOn` names the device a just-started remote agent executes on (#1067), so the live view can
  // mark where it runs and degrade the panels that are local-only. Undefined for a local agent.
  const [agentStart, setAgentStart] = useState<{ tick: number; intent: string; id: string | null; runsOn?: string }>({ tick: 0, intent: '', id: null })
  // A project with no git checkout gets no worktree, so Start hands back no id and there is
  // nothing to navigate to yet. That fallback is one agent at a time (daemon.ts keys the busy guard
  // by project there), so "the running one" is still a safe guess — adopt it the moment the poll
  // surfaces it. This is the one place the selection is still inferred, and only where it can't
  // be known.
  const [adopting, setAdopting] = useState(false)

  const { agents: agents, reload, loaded: agentsLoaded } = useAgents(projectId)

  // The agent Context set lives in the shell (#492/#504) so the two surfaces that feed it share
  // one source of truth: the `#` file chips + whole-repo Context selector in the Start form
  // (main pane), and the file tree in the right rail.
  const { context, add: addContext, remove: removeContext, toggle: toggleContext, reset: resetContext } = useContextSet()

  // The picked context is one project's, so changing projects starts fresh. Keyed off the route
  // rather than the click, because Back/Forward change projects too.
  useEffect(() => {
    resetContext()
    // `resetContext` is a fresh closure each render; the project is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // The selected project's files (git ls-files), handed to both the `#` picker and the tree.
  // Empty when no project (no checkout). Scoped to the selected session's
  // worktree (#815), the same checkout the action bar's branch, Serve and open-folder act on;
  // polled so a file the agent creates shows up rather than waiting for a reload.
  const { value: files } = usePolled<string[]>(
    projectId ? () => onProjectFiles(projectId, agentId ?? undefined) : null,
    EMPTY_FILES,
    10_000,
    [projectId, agentId],
  )

  // The cross-project "needs you" queue (#632): open PRs to review. Polled here in the shell so
  // the sidebar badge and the Overview card share one poll. Slow cadence — PRs change rarely and
  // each poll spawns `gh` per project.
  const { value: interventionsRead } = usePolled<ProjectionRead<Intervention>>(onInterventions, EMPTY_INTERVENTIONS, 15000, [])
  // The queue itself for every panel; the read as a whole for the notifier, which also needs to know
  // which projects the poll actually reached before it calls anything "new" (#1625).
  const interventions = interventionsRead.items

  // The registered projects, for the browser-tab title (#695/U3) — the selected project's name
  // plus the needs-you count drive `document.title` so a backgrounded tab tells you which project
  // needs attention — and for the sidebar's Projects list. Polled rather than read once (#1500):
  // each project carries what the daemon currently finds wrong with it, a state that appears and
  // clears on the daemon's own minute cadence, so the sidebar dot and the project's banner have to
  // follow it. Slow, and reloadable so adding a project from the sidebar's "New" reflects at once
  // (bump the key).
  const [projectsKey, setProjectsKey] = useState(0)
  const { value: projects } = usePolled<ProjectSummary[]>(onProjects, EMPTY_PROJECTS, 30_000, [projectsKey])
  const project = projectId ? projects.find(p => p.id === projectId) : undefined
  const projectName = project?.name ?? null
  useDocumentTitle(interventions.length, projectName)
  // A URL naming a project that is not registered (renamed, removed, mistyped). A non-empty list
  // is the answer, so this never fires while the first read is still out.
  const unknownProject = projectId !== null && projects.length > 0 && !projects.some(p => p.id === projectId)

  // Fire a browser notification when a new item lands on the "needs you" queue (#627). Rides the
  // one interventions poll above (the poll stays unconditional — it also feeds the sidebar badge
  // and Overview card); only the notification is gated, on both the category (`notifyHumanIntervention`,
  // default on) and the browser method (`notifyBrowser`).
  const preferences = usePreferences()
  useInterventionNotifications(interventionsRead, humanInterventionEnabled(preferences) && notificationsEnabled(preferences))

  // The "New activity" category (#627): the default-off feed of agents starting/finishing. Its only
  // client consumer is the browser notification below, so it is polled exactly when that will fire —
  // both the category (`notifyNewActivity`) and the browser method (`notifyBrowser`) on. (Discord
  // delivery, if enabled, is the daemon's own watcher, independent of this poll.)
  const browserActivity = newActivityEnabled(preferences) && notificationsEnabled(preferences)
  const { value: activity } = usePolled<ProjectionRead<Activity>>(browserActivity ? onActivity : null, EMPTY_ACTIVITY, 15000, [browserActivity])
  useActivityNotifications(activity, browserActivity)

  // The shared sidebar's recents on the Overview (#shared-shell): with no project selected the rail
  // has no project runs to show, so it pools every project's sessions here. Polled only on the home
  // route — a selected project's own `runs` (above) carry its rail.
  const { value: recentAgents } = usePolled<RecentAgent[]>(projectId === null ? onRecentAgents : null, EMPTY_RECENT, 10_000, [projectId])

  // An agent just started in `inProject`, which is not always the selected one: the onboarding
  // checklist starts one from the Overview and the settings page, where nothing is selected (#1169).
  const agentStarted = (inProject: string | null, intent: string, startedId?: string, runsOn?: string) => {
    // Continuing the agent already on screen (#762) appends to its journal — nothing truncates, so
    // nothing would re-replay after a reset. Bumping the tick here is what blanked the transcript
    // the moment a message resumed an ended session; a continuation keeps the feed instead.
    const continued = startedId !== undefined && startedId === agentId && inProject === projectId
    setAgentStart(prev => ({ tick: continued ? prev.tick : prev.tick + 1, intent, id: startedId ?? null, ...(runsOn ? { runsOn } : {}) }))
    setAdopting(startedId === undefined)
    // The picked context went with that agent; the next launch starts from a clean focus (#948).
    resetContext()
    // Go to the agent we just started — a real history entry, so Back returns to where you launched
    // from. Its row does not exist yet; the main pane shows it live on the strength of the id.
    // With no id yet, land on its project so the effect below can adopt the running one; `go`
    // no-ops when that is already the URL.
    go({ projectId: inProject, agentId: startedId ?? null })
    // The new agent just appends to the rail; reload so its real row shows up quickly.
    reload()
  }

  /** The same, for the surfaces that start an agent inside the selected project. */
  const onAgentStarted = (intent: string, startedId?: string, runsOn?: string) => agentStarted(projectId, intent, startedId, runsOn)

  // The no-id fallback only: adopt the running agent as the selection once the poll surfaces it.
  // A correction rather than a step, so it replaces the history entry.
  useEffect(() => {
    if (!adopting) return
    const running = agents.find(agent => agent.status === 'running')
    if (!running) return
    setAdopting(false)
    go({ projectId, agentId: running.id }, { replace: true })
    // `go` is a fresh closure each render; the route it needs is in the deps below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adopting, agents, projectId])

  // Selecting a session (or the Live/Home row) is always an explicit choice, so it ends the
  // just-started follow.
  const selectAgent = (id: string | null) => {
    setAdopting(false)
    go({ projectId, agentId: id })
  }

  const selectProject = (id: string) => {
    setAdopting(false)
    go({ projectId: id, agentId: null }) // switching projects always returns to the home launcher
  }

  // Naming a session in another project. The Overview's cross-project rows — the sidebar recents,
  // the Agents view (#1139), and the hot tickets — know which run they are about, and going through
  // selectProject drops that on the way, landing on the launcher instead of the session the row was
  // describing.
  const selectAgentInProject = (id: string, agentId: string) => {
    setAdopting(false)
    go({ projectId: id, agentId: agentId })
  }

  // "New" in the sidebar: start a fresh session in a named project (the sidebar decides which —
  // the current one, the only one, or a picked one). resetContext explicitly, since staying in the
  // same project would not trip the project-change effect above.
  const newAgentInProject = (id: string) => {
    setAdopting(false)
    resetContext()
    go({ projectId: id, agentId: null })
  }

  // The Overview dashboard (#471): no project selected.
  const showDashboard = () => {
    setAdopting(false)
    go({ projectId: null, agentId: null })
  }

  // The settings page (#958): every setting in one place, plus the Onboarding checklist, which is
  // where dismissing it from the Overview says you can pick it back up.
  const showSettings = () => {
    setAdopting(false)
    go({ view: 'settings', projectId: null, agentId: null })
  }

  // Tickets (#1144): every registered project's backlog, one section each — required reading for a
  // demo, so it gets the full width rather than the 22rem right rail. A cross-project destination
  // like the Overview, not scoped to whichever project happened to be selected.
  const showTickets = () => {
    setAdopting(false)
    go({ view: 'tickets', projectId: null, agentId: null })
  }

  // One ticket's own page (#1144), by the same slug as its filename — what a one-liner row opens
  // into, since Queue and the rest of its detail no longer fit on the list row.
  const openTicket = (id: string, slug: string) => {
    setAdopting(false)
    go({ view: 'tickets', projectId: id, agentId: null, ticketSlug: slug })
  }

  // One ticket's plan view (#685), the plan column's link: the ticket's `.plan.md` rendered on its
  // own page, addressed by the same slug as the ticket it belongs to.
  const openTicketPlan = (id: string, slug: string) => {
    setAdopting(false)
    go({ view: 'tickets', projectId: id, agentId: null, ticketSlug: slug, plan: true })
  }

  // The live agent feed is owned here so both the main view and the right rail's views tab read
  // one shared event stream.
  // The agent whose feed and controls are in play is simply the one in the URL; in the no-id
  // fallback there is none yet, and a null id resolves to the project root, as before.
  const { events, lost } = useLiveEvents(projectId, agentId, agentStart.tick)
  // The rail's views stay scoped to the newest `session` segment even though an agent's feed no
  // longer is (a resumed session appends a second segment to the same journal). Choice gates
  // are no longer folded here: they live inline in the transcript (#1455 items 6/7), where
  // EventList derives open/answered state from the same events it renders.
  const current = currentAgentEvents(events)
  const views = projectId ? agentViews(current) : []
  // The selected session's loop verdict, for the rail's pinned block under the tabs. It comes up
  // from AgentView rather than being folded here: a finished agent's events live in its archived log,
  // which that view is the one to read.

  // Is an agent working (#875)? Drives the mark and the tab icon.
  const working = useWorking()
  useFavicon(working)

  // Whether the daemon answers at all (#948). Without this, a dead daemon froze every surface
  // silently: the channels retry their transport without a verdict and the polls keep their
  // last value, so "the agent went quiet" and "nothing on this page is live" looked identical.
  const healthy = useDaemonHealth()

  // Route the main pane: the Overview dashboard when no project is selected (#471); else the
  // project home/launcher, a running agent's live output, or a finished agent's replay. Each live
  // run streams its own feed and is steered by its own id (#749).
  const selectedAgent = agentId ? agents.find(agent => agent.id === agentId) : undefined
  const renderMain = () => {
    if (view === 'settings')
      return <SettingsPage onAgentStarted={agentStarted} onSelectProject={selectProject} onDone={showDashboard} />
    // A ticket's plan view is the same shape plus the `plan` flag (#685): its `.plan.md` on its own
    // page, checked before the detail page since the flag only rides alongside a slug.
    if (view === 'tickets' && projectId && ticketSlug && plan)
      return <TicketPlanPage projectId={projectId} slug={ticketSlug} onBack={showTickets} onOpenAgent={selectAgent} />
    // A ticket's own page needs both a project and a slug; anything short of that (including the
    // bare cross-project route) is the list — every registered project, one section each.
    if (view === 'tickets' && projectId && ticketSlug)
      return <TicketDetailPage projectId={projectId} slug={ticketSlug} onBack={showTickets} />
    if (view === 'tickets')
      return (
        <TicketsPage
          onOpenTicket={openTicket}
          onOpenTicketPlan={openTicketPlan}
          onAgentStarted={agentStarted}
          onSelectProject={selectProject}
        />
      )
    if (!projectId)
      return (
        <DashboardPage
          onSelectProject={selectProject}
          onSelectAgent={selectAgentInProject}
          onOpenTicket={openTicket}
          onAgentStarted={agentStarted}
          interventions={interventions}
        />
      )
    if (unknownProject)
      return (
        <NotFound
          title="No such project"
          detail={`No project is registered as "${projectId}". It may have been removed, or the link may be from another machine.`}
          actionLabel="Go to the Overview"
          onAction={showDashboard}
        />
      )
    if (agentId === null) {
      // Just pressed Start on a project with no worktree: follow the live output until the poll
      // surfaces the agent and the effect above adopts its id.
      if (adopting) return <AgentView projectId={projectId} agentId={null} events={events} live label={agentStart.intent || undefined} projectName={projectName} remoteLabel={agentStart.runsOn} files={files} addContext={addContext} removeContext={removeContext} lost={lost} onAgentStarted={onAgentStarted} />
      return (
        <ProjectHome
          projectId={projectId}
          events={events}
          onAgentStarted={onAgentStarted}
          files={files}
          context={context}
          addContext={addContext}
          removeContext={removeContext}
          toggleContext={toggleContext}
          onOpenAgent={selectAgentInProject}
          errors={project?.errors}
        />
      )
    }
    if (!selectedAgent) {
      // Not in the list: either the agent we just started (its agent.json lands a beat later) or a
      // list we have not read yet. Both are live views; only a session that is genuinely absent
      // from a list we did read is gone.
      if (agentId === agentStart.id || !agentsLoaded)
        return <AgentView projectId={projectId} agentId={agentId} events={events} live label={agentStart.intent || undefined} projectName={projectName} remoteLabel={agentId === agentStart.id ? agentStart.runsOn : undefined} files={files} addContext={addContext} removeContext={removeContext} lost={lost} onAgentStarted={onAgentStarted} />
      return (
        <NotFound
          title="This agent is gone"
          detail="It is not in this project's agents. An agent disappears when its worktree is removed."
          actionLabel="Back to the project"
          onAction={() => selectAgent(null)}
        />
      )
    }
    // Live and finished are the same view (#1026): only `live` changes, so an agent ending swaps
    // what the bar, feed and composer say without remounting any of them.
    return (
      <AgentView
        projectId={projectId}
        agentId={agentId}
        events={events}
        live={selectedAgent.status === 'running'}
        label={agentLabel(selectedAgent)}
        projectName={projectName}
        files={files}
        addContext={addContext}
        removeContext={removeContext}
        lost={lost}
        target={selectedAgent.target}
        remoteLabel={selectedAgent.remoteLabel}
        armedDefault={selectedAgent.handoff}
        onAgentStarted={onAgentStarted}
       
        onDeleted={() => {
          // Its view is about to point at a session that no longer exists; go home and refresh
          // the rail so the row is gone (#1032).
          selectAgent(null)
          reload()
        }}
      />
    )
  }

  return (
    // The whole shell lives inside the SidebarProvider so the sidebar's context (state + Cmd/Ctrl+B,
    // the `--sidebar-width` var) is available on every route, home and session alike. Its wrapper is
    // the column that used to be a plain div.
    <SidebarProvider className="h-screen flex-col overflow-hidden">
      {/* The top navbar is gone (#772 follow-up): its brand, global nav and utility controls moved
          into the sidebar (AgentHistory), so the workspace and right rail get the full height. */}
      {!healthy && (
        <div role="alert" className="flex items-center gap-2 border-b border-border bg-warning/10 px-4 py-2 text-xs text-warning">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          The daemon is not answering — retrying. Everything on this page is frozen until it returns.
        </div>
      )}
      {/* The workspace row is fixed-height: each column scrolls internally, so the row itself
          must never scroll. overflow-hidden clips any stray horizontal bleed (no page X-scroll).
          `relative` is load-bearing (#904): overflow only clips a descendant this box is the
          containing block for, and Tailwind's `.sr-only` is position:absolute. Without it those
          labels resolve against the initial containing block, keep their static position deep in
          the scrolled content, and give the document a phantom scrollbar that slides the whole
          app off-screen. */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <AgentHistory
          projectId={projectId}
          agents={agents}
          selectedAgentId={agentId}
          onSelect={selectAgent}
          recentAgents={recentAgents}
          onSelectRecent={selectAgentInProject}
          projects={projects}
          onNewAgentInProject={newAgentInProject}
          onProjectAdded={() => {
            setProjectsKey(k => k + 1)
            reload()
          }}
          startTick={agentStart.tick}
          startIntent={agentStart.intent}
          followLive={adopting}
          working={working}
          onDashboard={showDashboard}
          onSelectProject={selectProject}
          onSettings={showSettings}
          onTickets={showTickets}
          ticketsActive={view === 'tickets'}
          interventionCount={interventions.length}
        />
        <main className="flex min-w-0 flex-1 flex-col">{renderMain()}</main>
        {/* The tickets page takes the full width itself (#1144): no rail beside it, the way
            Settings takes the whole main pane with none either. */}
        {view !== 'tickets' && (
          <RightRail
            projectId={projectId}
            agentId={agentId}
            views={views}
            files={files}
            context={context}
            toggleContext={toggleContext}
            hasBrowser={selectedAgent?.status === 'running' && selectedAgent.browserStreamPort !== undefined}
            target={selectedAgent?.target}
            // The launcher shows Docs/History in its main column (#1455 items 2/3): exactly when
            // renderMain resolves to ProjectHome — a project selected, no run (and not adopting
            // one), on the default view. Session views keep the full rail.
            docsInMain={view !== 'settings' && !!projectId && !unknownProject && agentId === null && !adopting}
          />
        )}
      </div>
    </SidebarProvider>
  )
}
