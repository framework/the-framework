import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { checkLayout, layoutMarker, layoutMarkerPath, LAYOUT_FILE } from './layout.js'
import type { StoreFs } from './store/index.js'

/** The two calls {@link checkLayout} makes, over an optional single file. */
function markerFs(content?: string): StoreFs {
  return {
    async read(path) {
      if (content === undefined) throw new Error(`ENOENT: ${path}`)
      return content
    },
    async write() {},
    async append() {},
    async exists() {
      return content !== undefined
    },
    async mkdir() {},
    async subdirs() { return [] },
    async readdir() {
      return []
    },
  }
}

test('a repo without a layout marker is ungated', async () => {
  assert.deepEqual(await checkLayout('/proj', markerFs()), { ok: true })
})

test('a marker matching this build passes', async () => {
  assert.deepEqual(await checkLayout('/proj', markerFs(layoutMarker())), { ok: true })
})

test('a mismatched marker refuses, naming both layouts and the fix (#1575)', async () => {
  const recorded = layoutMarker().replace('archive-dir: agents', 'archive-dir: sessions')
  const result = await checkLayout('/proj', markerFs(recorded))
  assert.equal(result.ok, false)
  if (result.ok) return
  // The refusal carries what a stranded session's log needs: the file, both sides, the cause.
  assert.match(result.error, /\.the-framework\/LAYOUT/)
  assert.match(result.error, /archive-dir: agents/)
  assert.match(result.error, /archive-dir: sessions/)
  assert.match(result.error, /#1575/)
  assert.match(result.error, /update/i)
})

test('the marker derives from the layout constants, so a rename changes it by itself', () => {
  // Pure data, one `name: value` per line — no comment whose rewording would trip the equality.
  for (const line of layoutMarker().trimEnd().split('\n')) {
    assert.match(line, /^[a-z-]+: \S+$/)
  }
  assert.equal(layoutMarkerPath('/proj'), `/proj/.the-framework/${LAYOUT_FILE}`)
})

test('the checked-in marker matches this build (#1575) — regenerate it when a layout name changes', () => {
  // Same lockstep trick as the extension gate's manifest test: the repo's own marker must equal
  // the derivation, so the PR renaming a layout constant fails here until the file is regenerated.
  let recorded: string
  try {
    recorded = readFileSync(new URL('../../../.the-framework/LAYOUT', import.meta.url), 'utf8')
  } catch {
    return // not the repo checkout (an installed package, say): there is nothing to pin here
  }
  assert.equal(recorded, layoutMarker())
})
