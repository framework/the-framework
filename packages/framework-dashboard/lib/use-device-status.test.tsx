import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ConnectionProfile } from './profiles.js'

const checkDevices = vi.hoisted(() => vi.fn())
vi.mock('../server/devices.telefunc.js', () => ({ checkDevices }))

const { useDeviceStatus } = await import('./use-device-status.js')

afterEach(() => {
  cleanup()
  checkDevices.mockReset()
})

const STUDIO = 'http://192.168.1.5:4200'
const profiles: ConnectionProfile[] = [{ id: STUDIO, label: 'Studio', url: STUDIO, token: 'aaa' }]

function Probe({ list = profiles }: { list?: ConnectionProfile[] }) {
  const status = useDeviceStatus(list)
  return <span>{status[STUDIO] ?? 'unknown'}</span>
}

// #1072: the browser holds the tokens, so it hands the daemon each device and reads back a reachable
// map. The dots are display-only, so this just has to surface online/offline as the poll answers.
describe('useDeviceStatus', () => {
  test('a reachable device surfaces online', async () => {
    checkDevices.mockResolvedValue({ [STUDIO]: true })
    render(<Probe />)
    await waitFor(() => expect(screen.getByText('online')).toBeTruthy())
    // It passed the device's id/url/token to the daemon for the cookie'd ping.
    expect(checkDevices).toHaveBeenCalledWith([{ id: STUDIO, url: STUDIO, token: 'aaa' }])
  })

  test('an unreachable device surfaces offline', async () => {
    checkDevices.mockResolvedValue({ [STUDIO]: false })
    render(<Probe />)
    await waitFor(() => expect(screen.getByText('offline')).toBeTruthy())
  })

  test('with no saved devices it never polls', async () => {
    render(<Probe list={[]} />)
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(checkDevices).not.toHaveBeenCalled()
    expect(screen.getByText('unknown')).toBeTruthy()
  })
})
