import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ConnectionProfile } from '../lib/profiles.js'
import { hoverTooltip, openMenu } from '../test-utils.js'
import { RunOnMenu, type ConnectionControl } from './RunOnMenu.js'

afterEach(cleanup)

const STUDIO: ConnectionProfile = { id: 'studio', url: 'http://192.168.1.5:4200', token: 'aaa', label: 'Studio' }

function renderMenu(over: Partial<ConnectionControl> = {}, chip = true) {
  const connection: ConnectionControl = {
    profiles: [STUDIO],
    currentUrl: 'http://localhost:4200',
    isLocal: true,
    selectedDeviceId: null,
    onSelect: vi.fn(),
    onSelectLocal: vi.fn(),
    onConnectLocal: vi.fn(),
    onAddDevice: vi.fn(),
    onRemove: vi.fn(),
    status: {},
    ...over,
  }
  render(<RunOnMenu connection={connection} busy={false} chip={chip} />)
  return connection
}

const trigger = () => screen.getByRole('button', { name: 'Run on' })

describe('the "Run on" pick as a chip', () => {
  test('it reads "This machine" while no device is picked, and looks like a chip', () => {
    renderMenu()
    expect(trigger().textContent).toBe('This machine')
    expect(trigger().className).toContain('rounded-full')
    expect(trigger().className).toContain('border')
    // An icon before the name and a chevron after it.
    expect(trigger().querySelectorAll('svg')).toHaveLength(2)
  })

  test('it reads the picked device\'s label, an offline one too, and a long label is cut short', () => {
    renderMenu({ selectedDeviceId: 'studio', status: { studio: 'offline' } })
    expect(trigger().textContent).toBe('Studio')
    const name = screen.getByText('Studio')
    expect(name.className).toContain('truncate')
    expect(trigger().className).toContain('min-w-0')
  })

  test('a pick that names a removed device reads "This machine"', () => {
    renderMenu({ selectedDeviceId: 'gone' })
    expect(trigger().textContent).toBe('This machine')
  })

  test('open on a device\'s own daemon, it reads that device\'s label, and "A device" for one not saved', () => {
    renderMenu({ isLocal: false, currentUrl: STUDIO.url })
    expect(trigger().textContent).toBe('Studio')
    cleanup()
    renderMenu({ isLocal: false, currentUrl: 'http://10.0.0.9:4200' })
    expect(trigger().textContent).toBe('A device')
  })

  test('its menu lists this machine, the devices and "Add a device…", and a click picks', async () => {
    const connection = renderMenu({ selectedDeviceId: 'studio' })
    await openMenu(trigger())
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(3)
    expect(items[0]!.textContent).toContain('This machine')
    expect(items[1]!.textContent).toContain('Studio')
    expect(items[2]!.textContent).toContain('Add a device…')

    fireEvent.click(items[1]!)
    expect(connection.onSelect).toHaveBeenCalledWith(STUDIO)

    await openMenu(trigger())
    fireEvent.click(screen.getByRole('menuitem', { name: /^This machine/ }))
    expect(connection.onSelectLocal).toHaveBeenCalled()
    expect(connection.onConnectLocal).not.toHaveBeenCalled()
  })

  test('the X on a device\'s row removes it and does not pick it', async () => {
    const connection = renderMenu()
    await openMenu(trigger())
    fireEvent.click(screen.getByRole('button', { name: 'Remove device Studio' }))
    expect(connection.onRemove).toHaveBeenCalledWith(STUDIO)
    expect(connection.onSelect).not.toHaveBeenCalled()
  })
})

describe('the "Run on" pick as an icon button', () => {
  test('it shows no words, and its tooltip names the target', async () => {
    renderMenu({ selectedDeviceId: 'studio' }, false)
    expect(trigger().textContent).toBe('')
    expect(trigger().className).not.toContain('rounded-full')
    expect((await hoverTooltip(trigger())).textContent).toBe('Run on — Studio')
  })

  test('its menu is the same one', async () => {
    const connection = renderMenu({}, false)
    await openMenu(trigger())
    fireEvent.click(screen.getByRole('menuitem', { name: /^Studio/ }))
    expect(connection.onSelect).toHaveBeenCalledWith(STUDIO)
  })
})
