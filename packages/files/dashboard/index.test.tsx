import { expect, test } from 'vitest'
import files from './index.js'

test('the module adds two side-panel tabs, Changes first: the side panel opens on what changed', () => {
  expect(files.panels?.map(panel => panel.id)).toEqual(['changes', 'files'])
})
