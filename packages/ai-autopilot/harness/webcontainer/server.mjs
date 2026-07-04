import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = join(__dirname, '..', '..')
const DIST_DIR = join(PKG_ROOT, 'dist')
// Resolve the installed @webcontainer/api so the page can serve it same-origin.
// It is import-only (no CJS main), so resolve its ESM entry and take the dist dir.
const API_DIR = dirname(fileURLToPath(import.meta.resolve('@webcontainer/api')))

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
}

const safeJoin = (base, rel) => join(base, normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ''))

/** Start the COOP/COEP static server. Resolves with its chosen port. */
export function startServer() {
  const server = createServer(async (req, res) => {
    // Cross-origin isolation is what makes SharedArrayBuffer (and WebContainer) available.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

    const path = new URL(req.url, 'http://localhost').pathname
    const send = async (file) => {
      const body = await readFile(file)
      res.setHeader('Content-Type', TYPES['.' + file.split('.').pop()] ?? 'application/octet-stream')
      res.end(body)
    }
    try {
      if (path === '/favicon.ico') { res.statusCode = 204; return res.end() }
      if (path === '/' || path === '/index.html') return await send(join(__dirname, 'index.html'))
      if (path.startsWith('/dist/')) return await send(safeJoin(DIST_DIR, path.slice('/dist/'.length)))
      if (path.startsWith('/api/')) return await send(safeJoin(API_DIR, path.slice('/api/'.length)))
      res.statusCode = 404
      res.end('not found')
    } catch (err) {
      res.statusCode = 500
      res.end(String(err))
    }
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}
