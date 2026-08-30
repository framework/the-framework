import { BRANCHES_DIR } from '@gemstack/skill-branches/branch-names'

/**
 * The directory, under a project root, that holds The Framework's own files.
 *
 * Its own module because it is the one piece of `logs.ts` the browser needs: the preset registry
 * builds `tf.presets.<name>.filePath` from it (#874), and the dashboard renders presets in the
 * browser (#520), where `logs.ts` cannot go — it imports `node:path`.
 */
export const THE_FRAMEWORK_DIR = '.the-framework'

/**
 * The branch holding what The Framework itself records about its runs (#1582/#1748): the agent
 * archives and the routine locks. The tickets and the queue are the `tickets` skill's, on its
 * own branch — nothing of the product's rides there.
 */
export const LOGS_BRANCH = 'agents-logs'

/**
 * The logs branch's checkout under a project, relative to the project root: `.branches/agents-logs`,
 * beside the agent checkouts and named as its branch like each of them (#1736).
 */
export const LOGS_CHECKOUT_DIR = `${BRANCHES_DIR}/${LOGS_BRANCH}`
