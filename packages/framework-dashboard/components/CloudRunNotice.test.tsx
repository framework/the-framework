import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { FrameworkEvent } from '@gemstack/the-framework'
import { CloudRunNotice } from './CloudRunNotice.js'

afterEach(cleanup)

const URL = 'https://claude.ai/code/session_01ABCdefGHIjklMNO?from=cli&m=0'
const handOff = (url = URL): FrameworkEvent => ({ kind: 'driver', event: { type: 'action', label: `cloud ${url}` } })

describe('CloudRunNotice (#610)', () => {
  test('says the session is still being created before the hand-off lands', () => {
    render(<CloudRunNotice target="web" events={[]} />)
    expect(screen.getByRole('status').textContent).toMatch(/Starting a Claude Code cloud session/i)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('links through to the cloud session once the driver reports it', () => {
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    expect(screen.getByRole('link', { name: /Open the session/i }).getAttribute('href')).toBe(URL)
  })

  test('offers the teleport command, which is how the work comes back to this machine', () => {
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    expect(screen.getByRole('status').textContent).toMatch(/claude --teleport session_01ABCdefGHIjklMNO/)
  })

  test('says the cloud session opens its own PR, since nothing streams back here', () => {
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    expect(screen.getByRole('status').textContent).toMatch(/opens its own pull request/i)
  })

  test('says the session asks its questions over there, since none can be answered here (#1225)', () => {
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    expect(screen.getByRole('status').textContent).toMatch(/asks its questions.*over there, not here/i)
  })

  test('renders nothing for the other targets', () => {
    for (const target of ['local', 'actions', 'remote'] as const) {
      const { container } = render(<CloudRunNotice target={target} events={[handOff()]} />)
      expect(container.firstChild).toBeNull()
    }
    expect(render(<CloudRunNotice events={[]} />).container.firstChild).toBeNull()
  })
})
