import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const onProjects = vi.hoisted(() => vi.fn())
vi.mock('../rpc/projects.js', () => ({ onProjects }))

const { useDaemonHealth } = await import('./use-daemon-health.js')

afterEach(() => {
  cleanup()
  onProjects.mockReset()
})

function Probe() {
  return <span>{useDaemonHealth() ? 'healthy' : 'down'}</span>
}

// #948: a dead daemon froze every surface silently — the probe is what lets the shell say so.
describe('useDaemonHealth', () => {
  test('an answering daemon reads healthy', async () => {
    onProjects.mockResolvedValue([])
    render(<Probe />)
    await waitFor(() => expect(onProjects).toHaveBeenCalled())
    expect(screen.getByText('healthy')).toBeTruthy()
  })

  test('a failing probe flips to down', async () => {
    onProjects.mockRejectedValue(new Error('ECONNREFUSED'))
    render(<Probe />)
    await waitFor(() => expect(screen.getByText('down')).toBeTruthy())
  })
})
