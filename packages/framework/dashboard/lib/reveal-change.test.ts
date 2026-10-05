import { afterEach, describe, expect, test } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { forgetRevealedChanges, revealChange, useRevealedChange } from './reveal-change.js'
import { setSidePanelOpen, useSidePanelOpen } from './side-panel.js'

afterEach(() => {
  forgetRevealedChanges()
  setSidePanelOpen('p1/r1', false)
})

describe('revealChange', () => {
  test('an ask opens that page\'s side panel and is the file its tab is handed; no ask, no file', () => {
    const { result } = renderHook(() => ({ asked: useRevealedChange('p1/r1'), open: useSidePanelOpen('p1/r1') }))
    expect(result.current).toEqual({ asked: undefined, open: false })
    act(() => revealChange('p1/r1', 'src/app.ts'))
    expect(result.current.asked?.path).toBe('src/app.ts')
    expect(result.current.open).toBe(true)
  })

  test('a second ask for the same file is a new ask; another page\'s ask is not this page\'s', () => {
    const { result } = renderHook(() => useRevealedChange('p1/r1'))
    act(() => revealChange('p1/r1', 'src/app.ts'))
    const first = result.current!.at
    act(() => revealChange('p1/r1', 'src/app.ts'))
    expect(result.current!.at).toBeGreaterThan(first)
    act(() => revealChange('p1/other', 'README.md'))
    expect(result.current!.path).toBe('src/app.ts')
    setSidePanelOpen('p1/other', false)
  })
})
