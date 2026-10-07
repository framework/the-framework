import type { ProjectSummary } from '../../src/index.js'
import { useMountedModules } from '../lib/use-modules.js'
import { projectsHaving, ModuleSlot } from './ModulePageView.js'

/**
 * The Settings sections the installed packages declare (#1902), after the page's own: each in its
 * own slot, given the projects that have its package, in the order the shell mounted them (by
 * `order`, then package). Nothing when no package declares one.
 */
export function ModuleSettingsSections({ projects }: { projects: ProjectSummary[] }) {
  const { settings } = useMountedModules()
  return (
    <>
      {settings.map(section => {
        const Section = section.Section
        return (
          <ModuleSlot key={`${section.package}/${section.id}`} package={section.package} label={`${section.id} settings`}>
            <Section projects={projectsHaving(section.projects, projects)} />
          </ModuleSlot>
        )
      })}
    </>
  )
}
