import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

// Every panel here reads the same way: ask the daemon, hold the answer, drop it on the
// floor if the component moved on. That was written out 12 times, and only the usage
// panel remembered to catch — so a daemon restart made every other tick an unhandled
// rejection. These two hooks are that pattern, once.

/**
 * What a read shows when its deps change, until the new answer lands. By default, nothing: the
 * `initial` value, so one target's data is never shown as another's.
 *
 * - `'previous'`: the last answer, whatever it was for. For a read whose target barely matters
 *   to the eye (the git host page of a project), where blanking would only flicker.
 * - `{ remember: key }`: the last answer read under this key, marked loaded, or nothing when no
 *   answer was. For a page a person goes back and forth between (a run's facts): going back shows
 *   what was read last time at once, and the read is made again all the same, so it is replaced
 *   the moment the fresh answer lands. The key names the target, so no other target's answer is
 *   ever shown.
 */
export type Keep = 'previous' | { remember: string }

/** The answers kept under their keys, for the page's life. Capped: the oldest goes first. */
const remembered = new Map<string, unknown>()
const REMEMBERED_MAX = 500

function remember(key: string, value: unknown): void {
  remembered.delete(key)
  remembered.set(key, value)
  if (remembered.size > REMEMBERED_MAX) remembered.delete(remembered.keys().next().value!)
}

/** Forget the answer remembered under a key, for a target known to have changed since; with no key, every answer (for tests). */
export function forgetRemembered(key?: string): void {
  if (key === undefined) remembered.clear()
  else remembered.delete(key)
}

/**
 * A rejected read keeps the last value rather than blanking it, which is what the usage
 * panel already did deliberately: an empty bar reads as "nothing used" rather than "no
 * answer". The next tick usually succeeds.
 */
function useAsyncValue<T>(
  load: (() => Promise<T>) | null,
  initial: T,
  everyMs: number | null,
  deps: DependencyList,
  keep?: Keep,
): { value: T; reload: () => Promise<void>; loaded: boolean } {
  const [value, setValue] = useState<T>(initial)
  // Whether `value` is an answer rather than the initial. Only a successful read sets it, so a
  // caller that reads absence as a fact ("is this session gone, or just not fetched yet?", #784)
  // never mistakes a daemon hiccup for an answer.
  const [loaded, setLoaded] = useState(false)
  // Captured once, like useState's own initial: it is also what a dep change resets to,
  // and callers pass literals like `[]` that would otherwise be a new value every render.
  const initialRef = useRef(initial)
  // A dep change and an unmount both retire the in-flight read. `reload` reads the same
  // token, so an imperative refetch can't write back after either.
  const liveRef = useRef<{ live: boolean; key?: string }>({ live: false })
  // The deps the state above was set for. The effect that switches it runs after the frame is
  // painted, so for one frame after a switch the state still holds the last target's answer:
  // the render below answers for the new deps itself in that frame.
  const shownFor = useRef<DependencyList>(deps)

  const apply = useCallback((token: { live: boolean; key?: string }, agent: () => Promise<T>): Promise<void> => {
    return agent()
      .then(next => {
        if (!token.live) return
        if (token.key !== undefined) remember(token.key, next)
        setValue(next)
        setLoaded(true)
      })
      .catch(() => {
        // Keep whatever we last showed; the next read may well succeed.
      })
  }, [])

  useEffect(() => {
    // Nothing to read, nothing remembered shown: a remembered answer stands in only for a read
    // that is being made again.
    const key = load && typeof keep === 'object' ? keep.remember : undefined
    const token = { live: true, ...(key !== undefined ? { key } : {}) }
    liveRef.current = token
    // A switch shows nothing rather than the last target's data, unless `keep` says otherwise.
    if (key !== undefined && remembered.has(key)) {
      setValue(remembered.get(key) as T)
      setLoaded(true)
    } else {
      if (keep !== 'previous') setValue(initialRef.current)
      setLoaded(false)
    }
    shownFor.current = deps
    if (!load) return () => void (token.live = false)
    const agent = (): void => void apply(token, load)
    agent()
    if (everyMs === null) return () => void (token.live = false)
    const timer = setInterval(agent, everyMs)
    return () => {
      token.live = false
      clearInterval(timer)
    }
    // The caller owns the dep list: `load` closes over exactly these, by contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const reload = useCallback((): Promise<void> => {
    if (!load) return Promise.resolve()
    return apply(liveRef.current, load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  if (!sameDeps(shownFor.current, deps)) {
    const key = load && typeof keep === 'object' ? keep.remember : undefined
    if (key !== undefined && remembered.has(key)) return { value: remembered.get(key) as T, reload, loaded: true }
    return { value: keep === 'previous' ? value : initialRef.current, reload, loaded: false }
  }
  return { value, reload, loaded }
}

function sameDeps(a: DependencyList, b: DependencyList): boolean {
  return a.length === b.length && a.every((dep, i) => Object.is(dep, b[i]))
}

/**
 * Read once, and again whenever `deps` change.
 *
 * Pass `null` for `load` when there is nothing to read yet (no project selected): the
 * value stays `initial` and no read is made. `load` must close over exactly `deps`.
 */
export function useLoaded<T>(
  load: (() => Promise<T>) | null,
  initial: T,
  deps: DependencyList,
  keep?: Keep,
): T {
  return useAsyncValue(load, initial, null, deps, keep).value
}

/**
 * Read now, again every `everyMs`, and again whenever `deps` change. Polling stops on
 * unmount. `reload` reads immediately, for when a local action means the next tick is
 * too late to wait for, and settles once that read has answered.
 *
 * Pass `null` for `load` when there is nothing to read yet. `load` must close over
 * exactly `deps`. `loaded` is false until the first successful read, and again after
 * a dep change — for callers that must tell "not there" from "not read yet".
 */
export function usePolled<T>(
  load: (() => Promise<T>) | null,
  initial: T,
  everyMs: number,
  deps: DependencyList,
  keep?: Keep,
): { value: T; reload: () => Promise<void>; loaded: boolean } {
  return useAsyncValue(load, initial, everyMs, deps, keep)
}
