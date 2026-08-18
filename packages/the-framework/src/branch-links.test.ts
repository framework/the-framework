import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { reconcileBranchLinks, startBranchLinksPass, BRANCH_LINKS_DIR, type LinksFs } from './branch-links.js'
import { FRAMEWORK_DIR, WORKTREES_DIR } from './store/index.js'

const CWD = '/repo'
const LINKS = join(CWD, FRAMEWORK_DIR, BRANCH_LINKS_DIR)
const ROOT_LINK = join(CWD, 'branches')

/** An in-memory {@link LinksFs}: `links` maps absolute path -> target; `files` are non-symlinks. */
function memFs(opts: { links?: Record<string, string>; files?: string[] } = {}) {
  const links = new Map(Object.entries(opts.links ?? {}))
  const files = new Set(opts.files ?? [])
  const fs: LinksFs = {
    readdir: async dir =>
      [...links.keys(), ...files].filter(p => p.startsWith(dir + '/')).map(p => p.slice(dir.length + 1)).filter(n => !n.includes('/')),
    mkdir: async () => {},
    symlink: async (target, path) => {
      if (links.has(path) || files.has(path)) throw new Error('EEXIST')
      links.set(path, target)
    },
    readlink: async path => links.get(path),
    unlink: async path => void links.delete(path),
    lexists: async path => links.has(path) || files.has(path),
  }
  return { fs, links, files }
}

const worktreeTarget = (agentId: string) => join('..', WORKTREES_DIR, agentId)

test('each worktree gets a link named as its branch, pointing into worktrees/ (#1580)', async () => {
  const { fs, links } = memFs()
  await reconcileBranchLinks(CWD, {
    fs,
    worktrees: async () => ['r1', 'r2'],
    branchOf: async path => (path.endsWith('r1') ? 'tf-agent-r1' : 'tf-add-auth'),
  })
  assert.equal(links.get(join(LINKS, 'tf-agent-r1')), worktreeTarget('r1'))
  assert.equal(links.get(join(LINKS, 'tf-add-auth')), worktreeTarget('r2'))
})

test('a rename settles in one pass: the old name goes, the new one appears', async () => {
  const { fs, links } = memFs({ links: { [join(LINKS, 'tf-agent-r1')]: worktreeTarget('r1') } })
  await reconcileBranchLinks(CWD, { fs, worktrees: async () => ['r1'], branchOf: async () => 'tf-cool-name' })
  assert.equal(links.has(join(LINKS, 'tf-agent-r1')), false, 'the stale name is gone')
  assert.equal(links.get(join(LINKS, 'tf-cool-name')), worktreeTarget('r1'))
})

test('a reclaimed worktree loses its link; a detached or slash-named branch never gets one', async () => {
  const { fs, links } = memFs({ links: { [join(LINKS, 'tf-done')]: worktreeTarget('gone') } })
  await reconcileBranchLinks(CWD, {
    fs,
    worktrees: async () => ['detached', 'legacy'],
    branchOf: async path => (path.endsWith('legacy') ? 'the-framework/old-name' : undefined),
  })
  assert.equal(links.has(join(LINKS, 'tf-done')), false, 'the dead link is dropped')
  const branchLinks = [...links.keys()].filter(path => path.startsWith(LINKS + '/'))
  assert.deepEqual(branchLinks, [], 'no branch link was created for either worktree')
})

test('only our own links are touched: user files and foreign symlinks stay', async () => {
  const userFile = join(LINKS, 'tf-mine')
  const foreignLink = join(LINKS, 'elsewhere')
  const { fs, links, files } = memFs({ files: [userFile], links: { [foreignLink]: '/somewhere/else' } })
  await reconcileBranchLinks(CWD, { fs, worktrees: async () => ['r1'], branchOf: async () => 'tf-mine' })
  assert.ok(files.has(userFile), 'the user file at the wanted name is untouched')
  assert.equal(links.get(foreignLink), '/somewhere/else', 'a foreign symlink is never removed')
  assert.equal(links.has(join(LINKS, 'tf-mine')), false, 'nothing was created over the user file')
})

test('the repo-root branches shortcut is created once, relative, and never clobbers', async () => {
  const fresh = memFs()
  await reconcileBranchLinks(CWD, { fs: fresh.fs, worktrees: async () => [] })
  assert.equal(fresh.links.get(ROOT_LINK), join(FRAMEWORK_DIR, BRANCH_LINKS_DIR))

  const taken = memFs({ files: [ROOT_LINK] })
  await reconcileBranchLinks(CWD, { fs: taken.fs, worktrees: async () => [] })
  assert.equal(taken.links.has(ROOT_LINK), false, 'an occupied path is left alone')
})

test('the pass covers every registered project and a stopped pass does nothing', async () => {
  const seen: string[] = []
  const pass = startBranchLinksPass({
    projects: async () => [{ path: '/a' }, { path: '/b' }],
    reconcile: async cwd => void seen.push(cwd),
  })
  await pass.tick()
  assert.deepEqual(seen, ['/a', '/b'])
  pass.stop()
  await pass.tick()
  assert.equal(seen.length, 2)
})
