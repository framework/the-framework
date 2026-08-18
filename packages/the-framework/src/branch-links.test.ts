import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { reconcileBranchLinks, startBranchLinksPass, type LinksFs } from './branch-links.js'
import { FRAMEWORK_DIR, BRANCHES_DIR, type WorktreeDirEntry } from './store/index.js'

const CWD = '/repo'
const LINKS = join(CWD, FRAMEWORK_DIR, BRANCHES_DIR)
const ROOT_LINK = join(CWD, 'branches')

/** A checkout at the #1580 location, dir named as its birth branch. */
const current = (agentId: string): WorktreeDirEntry => ({ agentId, path: join(LINKS, `tf-agent-${agentId}`) })

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

/** The links inside the branches dir, as name -> target. */
const branchLinksOf = (links: Map<string, string>) =>
  Object.fromEntries([...links].filter(([path]) => path.startsWith(LINKS + '/')).map(([path, t]) => [path.slice(LINKS.length + 1), t]))

test('a checkout still on its birth branch gets no link — the dir already carries the name (#1580)', async () => {
  const { fs, links } = memFs()
  await reconcileBranchLinks(CWD, { fs, worktrees: async () => [current('r1')], branchOf: async () => 'tf-agent-r1' })
  assert.deepEqual(branchLinksOf(links), {})
})

test('a renamed branch gets a sibling link, and the stale name goes in the same pass', async () => {
  const { fs, links } = memFs({ links: { [join(LINKS, 'tf-old-name')]: 'tf-agent-r1' } })
  await reconcileBranchLinks(CWD, { fs, worktrees: async () => [current('r1')], branchOf: async () => 'tf-cool-name' })
  assert.deepEqual(branchLinksOf(links), { 'tf-cool-name': 'tf-agent-r1' })
})

test('a reclaimed checkout loses its link; detached and slash-named branches never get one', async () => {
  const { fs, links } = memFs({ links: { [join(LINKS, 'tf-done')]: 'tf-agent-gone' } })
  await reconcileBranchLinks(CWD, {
    fs,
    worktrees: async () => [current('detached'), current('old')],
    branchOf: async path => (path.endsWith('old') ? 'the-framework/old-name' : undefined),
  })
  assert.deepEqual(branchLinksOf(links), {}, 'the dead link is gone, nothing new appeared')
})

test('only our own links are touched: user files and foreign symlinks stay', async () => {
  const userFile = join(LINKS, 'tf-mine')
  const foreignLink = join(LINKS, 'elsewhere')
  const { fs, links, files } = memFs({ files: [userFile], links: { [foreignLink]: '/somewhere/else' } })
  await reconcileBranchLinks(CWD, { fs, worktrees: async () => [current('r1')], branchOf: async () => 'tf-mine' })
  assert.ok(files.has(userFile), 'the user file at the wanted name is untouched')
  assert.equal(links.get(foreignLink), '/somewhere/else', 'a foreign symlink is never removed')
  assert.equal(links.has(join(LINKS, 'tf-mine')), false, 'nothing was created over the user file')
})

test('the repo-root branches shortcut is created once, relative, and never clobbers', async () => {
  const fresh = memFs()
  await reconcileBranchLinks(CWD, { fs: fresh.fs, worktrees: async () => [] })
  assert.equal(fresh.links.get(ROOT_LINK), join(FRAMEWORK_DIR, BRANCHES_DIR))

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
