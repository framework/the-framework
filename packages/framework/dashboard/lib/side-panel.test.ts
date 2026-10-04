import { beforeEach, expect, test } from 'vitest'
import { setSidePanelOpen, sidePanelName } from './side-panel.js'

beforeEach(() => localStorage.clear())

test('an agent has its own name, and every "New agent" page shares one', () => {
  expect(sidePanelName('p1', 'r1')).toBe('p1/r1')
  expect(sidePanelName('p1', null)).toBe('new')
  expect(sidePanelName('p2', undefined)).toBe('new')
})

test('only the last 200 open panels are remembered: one more forgets the oldest', () => {
  for (let i = 0; i <= 200; i++) setSidePanelOpen(`p/${i}`, true)
  const kept = JSON.parse(localStorage.getItem('fw.side-panel')!) as string[]
  expect(kept).toHaveLength(200)
  expect(kept[0]).toBe('p/1')
  expect(kept.at(-1)).toBe('p/200')
})

test('something unreadable kept there reads as nothing open', () => {
  localStorage.setItem('fw.side-panel', 'open')
  setSidePanelOpen('p/1', true)
  expect(localStorage.getItem('fw.side-panel')).toBe('["p/1"]')
})
