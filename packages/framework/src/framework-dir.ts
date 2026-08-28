/**
 * The directory, under a project root, that holds The Framework's own files.
 *
 * Its own module because it is the one piece of `logs.ts` the browser needs: the preset registry
 * builds `tf.presets.<name>.filePath` from it (#874), and the dashboard renders presets in the
 * browser (#520), where `logs.ts` cannot go — it imports `node:path`.
 */
export const THE_FRAMEWORK_DIR = '.the-framework'

/** The branch holding everything The Framework writes (#1582): the tickets, the queue, the session archives. */
export const DATA_BRANCH = 'tf-data'

/**
 * The data branch's checkout under a project, relative to the project root. A temporary spelling
 * (#1736): the agent checkouts moved to `.branches/`, and the data checkout stays where it has
 * always been until the convention for where a data branch lives is decided.
 */
export const DATA_CHECKOUT_DIR = `${THE_FRAMEWORK_DIR}/branches/${DATA_BRANCH}`
