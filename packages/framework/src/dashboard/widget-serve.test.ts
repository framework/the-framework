import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serveWidgetFile, widgetUrl, WIDGETS_PREFIX } from './widget-serve.js'
import type { ProjectsProvider } from './projects.js'

test('widget files are served per project and package, and nothing outside the widget\'s own directory', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-widget-serve-')))
  const dir = join(root, 'node_modules', '@acme', 'logs')
  await mkdir(join(dir, 'dist'), { recursive: true })
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { '@acme/logs': '1', plain: '1' } }))
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: '@acme/logs', exports: { './dashboard': './dist/dashboard.js' } }))
  await writeFile(join(dir, 'dist', 'dashboard.js'), 'export default {}')
  await writeFile(join(dir, 'dist', 'dashboard.css'), '.a{}')
  await mkdir(join(root, 'node_modules', 'plain'), { recursive: true })
  await writeFile(join(root, 'node_modules', 'plain', 'package.json'), JSON.stringify({ name: 'plain' }))
  await writeFile(join(root, 'node_modules', 'plain', 'index.js'), 'secret')

  const projects: ProjectsProvider = { list: async () => [], resolvePath: async id => (id === 'app-abc' ? root : undefined) }
  const server = createServer((req, res) => void serveWidgetFile(req, res, new URL(req.url ?? '/', 'http://x').pathname, projects))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  try {
    const url = widgetUrl('app-abc', { package: '@acme/logs', entry: 'dashboard.js' })
    assert.equal(url, `${WIDGETS_PREFIX}/app-abc/%40acme%2Flogs/dashboard.js`)
    const module = await fetch(base + url)
    assert.equal(module.status, 200)
    assert.match(module.headers.get('content-type') ?? '', /javascript/)
    assert.equal(module.headers.get('cache-control'), 'no-cache')
    assert.equal(await module.text(), 'export default {}')
    assert.equal((await fetch(`${base}${WIDGETS_PREFIX}/app-abc/%40acme%2Flogs/dashboard.css`)).status, 200)

    for (const path of [
      `${WIDGETS_PREFIX}/app-abc/%40acme%2Flogs/..%2Fpackage.json`, // out of the widget's directory
      `${WIDGETS_PREFIX}/app-abc/plain/index.js`, // a dependency that brings no widget
      `${WIDGETS_PREFIX}/other-xyz/%40acme%2Flogs/dashboard.js`, // an unknown project
      `${WIDGETS_PREFIX}/app-abc/%40acme%2Flogs`, // no file
      `${WIDGETS_PREFIX}/app-abc/%zz/dashboard.js`, // a malformed escape
    ])
      assert.equal((await fetch(base + path)).status, 404, path)
    assert.equal((await fetch(base + url, { method: 'POST' })).status, 405)
  } finally {
    await new Promise(resolve => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})
