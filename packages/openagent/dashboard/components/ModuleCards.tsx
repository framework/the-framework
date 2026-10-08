import type { ProjectSummary } from '../../src/index.js'
import { useMountedModules } from '../lib/use-modules.js'
import { projectsHaving, ModuleSlot } from './ModulePageView.js'

/**
 * The cards the installed packages declare (#1818), on the Overview: each in its own slot, given
 * the projects that have its package, in the order the shell mounted them (by `order`, then
 * package). A card is drawn only when one of the projects this component is handed has its
 * package: with one project picked, the cards of the packages that project does not have are not
 * drawn, and before the projects are first read none is. Nothing when no package declares one: the
 * Overview then shows only its own cards.
 */
export function ModuleCards({ projects }: { projects: ProjectSummary[] }) {
  const { cards } = useMountedModules()
  return (
    <>
      {cards.map(card => {
        const Card = card.Card
        const having = projectsHaving(card.projects, projects)
        if (having.length === 0) return null
        return (
          <ModuleSlot key={`${card.package}/${card.id}`} package={card.package} label={`${card.id} card`}>
            <Card projects={having} />
          </ModuleSlot>
        )
      })}
    </>
  )
}
