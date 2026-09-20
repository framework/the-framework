import type { ProjectSummary } from '../../src/index.js'
import { useMountedWidgets } from '../lib/use-widgets.js'
import { projectsHaving, WidgetSlot } from './WidgetPageView.js'

/**
 * The cards the installed packages declare (#1818), on the Overview: each in its own slot, given
 * the projects that have its package, in the order the shell mounted them (by `order`, then
 * package). Nothing when no package declares one: the Overview then shows only its own cards.
 */
export function WidgetCards({ projects }: { projects: ProjectSummary[] }) {
  const { cards } = useMountedWidgets()
  return (
    <>
      {cards.map(card => {
        const Card = card.Card
        return (
          <WidgetSlot key={`${card.package}/${card.id}`} package={card.package} label={`${card.id} card`}>
            <Card projects={projectsHaving(card.projects, projects)} />
          </WidgetSlot>
        )
      })}
    </>
  )
}
