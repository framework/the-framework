import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const onPreferences = vi.hoisted(() => vi.fn())
const patchPreferences = vi.hoisted(() => vi.fn())
const onProjectPresets = vi.hoisted(() => vi.fn())
const saveProjectPresets = vi.hoisted(() => vi.fn())
vi.mock('../rpc/preferences.js', () => ({
  onPreferences,
  patchPreferences,
  onProjectPresets,
  saveProjectPresets,
}))
// The repo tier (#842) rides on the project payload, so the store reads the projects RPC too.
const onProjects = vi.hoisted(() => vi.fn())
vi.mock('../rpc/projects.js', () => ({ onProjects }))

const flush = () => act(async () => {
  await Promise.resolve()
  await Promise.resolve()
})

/** Put the test on a project's page: the URL is the selection (#784), and #840 reads it. */
const openProject = (projectId: string | null) =>
  window.history.replaceState({}, '', projectId ? `/${projectId}` : '/')

describe('preferences', () => {
  beforeEach(() => {
    // The cache is module state, so each test needs a fresh module instance.
    vi.resetModules()
    onPreferences.mockReset()
    // The daemon merges the patch and hands back what it stored (#1148); with nothing else
    // stored, that is the patch itself.
    patchPreferences.mockReset().mockImplementation(async (patch: unknown) => ({ ok: true, preferences: patch }))
    onProjectPresets.mockReset().mockResolvedValue([])
    saveProjectPresets.mockReset().mockResolvedValue({ ok: true })
    onProjects.mockReset().mockResolvedValue([])
    openProject(null)
  })

  test('an optimistic update made during the initial load survives the load resolving', async () => {
    let resolveLoad: (p: unknown) => void = () => {}
    onPreferences.mockReturnValue(new Promise(r => (resolveLoad = r)))
    const { usePreferences, updatePreferences } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferences())
    // The load is in flight; the user toggles the browser off before it resolves.
    act(() => updatePreferences({ browser: false }))
    expect(result.current.browser).toBe(false)

    // The load now resolves with the server's pre-toggle value; the toggle must win.
    await act(async () => {
      resolveLoad({ browser: true })
      await Promise.resolve()
    })
    expect(result.current.browser).toBe(false)
  })

  test('the initial load populates the cache when no optimistic write raced it', async () => {
    onPreferences.mockResolvedValue({ browser: false, vanilla: true })
    const { usePreferences } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferences())
    await flush()
    expect(result.current).toEqual({ browser: false, vanilla: true })
  })

  test("the repo's the-framework.yml resolves over the global tier (#842)", async () => {
    onPreferences.mockResolvedValue({ browser: true, transparent: false })
    onProjects.mockResolvedValue([{ id: 'app-a-1', path: '/repos/a', name: 'a', activated: true, fileConfig: { transparent: true, vanilla: true } }])
    openProject('app-a-1')
    const { usePreferences } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferences())
    await flush()
    expect(result.current.transparent).toBe(true) // the repo turned it on over the global off
    expect(result.current.vanilla).toBe(true) // the file's own key, same name and direction (C3)
    expect(result.current.browser).toBe(true) // the repo said nothing, so global stands
  })

  test('a repo-shaped setting is written in the repo, so a toggle only ever writes your tier (B5)', async () => {
    // A third tier used to sit above the file — the user's per-project overrides — so the same
    // question had two answers on one machine and a write had to be split between them.
    openProject('app-a-1')
    onPreferences.mockResolvedValue({})
    onProjects.mockResolvedValue([{ id: 'app-a-1', path: '/repos/a', name: 'a', activated: true, fileConfig: { transparent: true } }])
    const { usePreferences, updatePreferences } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferences())
    await flush()
    act(() => updatePreferences({ model: 'opus', theme: 'dark' }))

    expect(patchPreferences).toHaveBeenCalledWith({ model: 'opus', theme: 'dark' })
    expect(result.current.model).toBe('opus')
    // And the repo's own key still wins over yours, which is the point of it being committed.
    expect(result.current.transparent).toBe(true)
  })

  test('a repo that sets nothing changes nothing (#842)', async () => {
    onPreferences.mockResolvedValue({ vanilla: true })
    onProjects.mockResolvedValue([{ id: 'app-a-1', path: '/repos/a', name: 'a', activated: true }])
    openProject('app-a-1')
    const { usePreferences } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferences())
    await flush()
    expect(result.current).toEqual({ vanilla: true })
  })

  test('usePreferenceSources names the tier that won each key (#842)', async () => {
    onPreferences.mockResolvedValue({ browser: true, model: 'sonnet' })
    onProjects.mockResolvedValue([{ id: 'app-a-1', path: '/repos/a', name: 'a', activated: true, fileConfig: { transparent: true, vanilla: true } }])
    openProject('app-a-1')
    const { usePreferenceSources } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferenceSources())
    await flush()
    expect(result.current.transparent).toBe('repo')
    expect(result.current.vanilla).toBe('repo') // the repo's own vanilla:true
    expect(result.current.model).toBe('global')
    expect(result.current.browser).toBe('global')
  })

  test('useProjectFileConfig exposes the keys the gear cannot set (#842)', async () => {
    onPreferences.mockResolvedValue({})
    onProjects.mockResolvedValue([{ id: 'app-a-1', path: '/repos/a', name: 'a', activated: true, fileConfig: { preset: 'software-development', event: 'bug-fix' } }])
    openProject('app-a-1')
    const { useProjectFileConfig } = await import('./preferences.js')

    const { result } = renderHook(() => useProjectFileConfig())
    await flush()
    expect(result.current).toEqual({ preset: 'software-development', event: 'bug-fix' })
  })

  test('refreshFileConfigs re-reads the repo tier after an edit on disk (#842)', async () => {
    onPreferences.mockResolvedValue({})
    onProjects.mockResolvedValue([{ id: 'app-a-1', path: '/repos/a', name: 'a', activated: true, fileConfig: { transparent: true } }])
    openProject('app-a-1')
    const { usePreferences, refreshFileConfigs } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferences())
    await flush()
    expect(result.current.transparent).toBe(true)

    // Someone edits the yml; the launcher must not keep showing the old answer.
    onProjects.mockResolvedValue([{ id: 'app-a-1', path: '/repos/a', name: 'a', activated: true, fileConfig: { transparent: false } }])
    refreshFileConfigs()
    await flush()
    expect(result.current.transparent).toBe(false)

    // And a yml deleted outright stops contributing at all, rather than lingering in the cache.
    onProjects.mockResolvedValue([{ id: 'app-a-1', path: '/repos/a', name: 'a', activated: true }])
    refreshFileConfigs()
    await flush()
    expect('vanilla' in result.current).toBe(false)
  })

  test('a failed project read leaves the other tiers intact (#842)', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    onPreferences.mockResolvedValue({ browser: false })
    onProjects.mockRejectedValue(new Error('offline'))
    openProject('app-a-1')
    const { usePreferences, refreshFileConfigs } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferences())
    await flush()
    expect(result.current.browser).toBe(false)

    // The read is best-effort like every other tier: it must be swallowed, not left to surface as
    // an unhandled rejection, and the next refresh must still be able to run.
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(unhandled).not.toHaveBeenCalled()
    process.off('unhandledRejection', unhandled)

    onProjects.mockResolvedValue([{ id: 'app-a-1', path: '/repos/a', name: 'a', activated: true, fileConfig: { transparent: true } }])
    refreshFileConfigs()
    await flush()
    expect(result.current.transparent).toBe(true)
  })

  // A stale tab reverting settings it never touched (#1148).

  test('a write sends only the keys it changed, so it cannot replay the rest', async () => {
    onPreferences.mockResolvedValue({ theme: 'dark', notifyBrowser: false })
    const { usePreferences, updatePreferences } = await import('./preferences.js')

    renderHook(() => usePreferences())
    await flush()
    act(() => updatePreferences({ notifyBrowser: true }))

    // Not `{ theme: 'dark', notifyBrowser: true }`: sending the whole cached object is how a tab
    // opened before someone else changed the theme wrote the old theme back over it.
    expect(patchPreferences).toHaveBeenCalledWith({ notifyBrowser: true })
  })

  test("a write adopts the daemon's answer, so a stale tab converges", async () => {
    onPreferences.mockResolvedValue({ theme: 'dark' })
    // Another tab set the theme to light in the meantime; the merged result carries it back.
    patchPreferences.mockResolvedValue({ ok: true, preferences: { theme: 'light', notifyBrowser: true } })
    const { usePreferences, updatePreferences } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferences())
    await flush()
    act(() => updatePreferences({ notifyBrowser: true }))
    await flush()

    expect(result.current).toEqual({ theme: 'light', notifyBrowser: true })
  })

  test('a reply that lands after a newer write does not undo it', async () => {
    onPreferences.mockResolvedValue({})
    let resolveFirst: (value: unknown) => void = () => {}
    patchPreferences
      .mockReturnValueOnce(new Promise(r => (resolveFirst = r)))
      .mockResolvedValue({ ok: true, preferences: { theme: 'light' } })
    const { usePreferences, updatePreferences } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferences())
    await flush()
    act(() => updatePreferences({ theme: 'dark' }))
    act(() => updatePreferences({ theme: 'light' }))
    await flush()
    expect(result.current.theme).toBe('light')

    // The first write's answer arrives last, carrying the value the user already moved off.
    await act(async () => {
      resolveFirst({ ok: true, preferences: { theme: 'dark' } })
      await Promise.resolve()
    })
    expect(result.current.theme).toBe('light')
  })

  test('a failed write leaves the optimistic value in place', async () => {
    onPreferences.mockResolvedValue({ theme: 'dark' })
    // What a host with no preferences store (the relay) answers.
    patchPreferences.mockResolvedValue({ ok: false, error: 'preferences are not enabled on this server' })
    const { usePreferences, updatePreferences } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferences())
    await flush()
    act(() => updatePreferences({ theme: 'light' }))
    await flush()

    expect(result.current.theme).toBe('light')
  })

  test('refreshPreferences re-reads your tier, so a background tab stops showing a stale value', async () => {
    openProject('app-a-14csz1v')
    onPreferences.mockResolvedValue({ theme: 'dark', model: 'sonnet' })
    const { usePreferences, refreshPreferences } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferences())
    await flush()
    expect(result.current).toEqual({ theme: 'dark', model: 'sonnet' })

    onPreferences.mockResolvedValue({ theme: 'light', model: 'opus' })
    refreshPreferences()
    await flush()
    expect(result.current).toEqual({ theme: 'light', model: 'opus' })
  })

  test('refreshPreferences does not overwrite a write still in flight', async () => {
    onPreferences.mockResolvedValue({ theme: 'dark' })
    patchPreferences.mockReturnValue(new Promise(() => {}))
    const { usePreferences, updatePreferences, refreshPreferences } = await import('./preferences.js')

    const { result } = renderHook(() => usePreferences())
    await flush()
    act(() => updatePreferences({ theme: 'light' }))
    // The read fires while the write is still out, and answers with the pre-write value.
    refreshPreferences()
    await flush()

    expect(result.current.theme).toBe('light')
  })

  test('themePreference falls back to system and resolvedDark honours the choice (#725)', async () => {
    const { themePreference, resolvedDark } = await import('./preferences.js')

    expect(themePreference({})).toBe('system')
    expect(themePreference({ theme: 'light' })).toBe('light')

    // Fixed choices ignore the OS; `system` follows it.
    expect(resolvedDark('dark', false)).toBe(true)
    expect(resolvedDark('light', true)).toBe(false)
    expect(resolvedDark('system', true)).toBe(true)
    expect(resolvedDark('system', false)).toBe(false)
  })
})
