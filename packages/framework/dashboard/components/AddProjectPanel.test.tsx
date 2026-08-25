import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const sendAddProject = vi.hoisted(() => vi.fn())
const sendPickProjectDirectory = vi.hoisted(() => vi.fn())
vi.mock('../rpc/projects.js', () => ({ sendAddProject, sendPickProjectDirectory }))

const { AddProjectPanel } = await import('./AddProjectPanel.js')

afterEach(() => {
  cleanup()
  sendAddProject.mockReset()
  sendPickProjectDirectory.mockReset()
})

describe('AddProjectPanel (#1150)', () => {
  test('the system dialog opens with the modal, and the picked repo is added only after the trust confirmation', async () => {
    sendPickProjectDirectory.mockResolvedValue({ ok: true, path: '/Users/dev/my-repo' })
    sendAddProject.mockResolvedValue({ ok: true, alreadyActivated: false })
    render(<AddProjectPanel onAdded={() => {}} onClose={() => {}} />)
    // Picking is the form: the dialog is already open, the modal just says so.
    expect(sendPickProjectDirectory).toHaveBeenCalledTimes(1)
    // The picked path is shown back for the trust gate (#439); nothing is registered yet.
    await screen.findByText('/Users/dev/my-repo')
    expect(sendAddProject).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'I trust it, add it' }))
    await screen.findByText('Project added')
    expect(sendAddProject).toHaveBeenCalledWith('/Users/dev/my-repo')
  })

  test('a repo that was already a project reads "Already added"', async () => {
    sendPickProjectDirectory.mockResolvedValue({ ok: true, path: '/Users/dev/my-repo' })
    sendAddProject.mockResolvedValue({ ok: true, alreadyActivated: true })
    render(<AddProjectPanel onAdded={() => {}} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'I trust it, add it' }))
    await screen.findByText('Already added')
  })

  test('dismissing the system dialog closes the modal without adding anything', async () => {
    sendPickProjectDirectory.mockResolvedValue({ ok: true, path: null })
    const onClose = vi.fn()
    render(<AddProjectPanel onAdded={() => {}} onClose={onClose} />)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(sendAddProject).not.toHaveBeenCalled()
  })

  test('a dialog that could not be opened reports why, and Try again asks again', async () => {
    sendPickProjectDirectory.mockResolvedValueOnce({ ok: false, error: 'The machine running The Framework has no desktop session, so no folder dialog can open there.' })
    sendPickProjectDirectory.mockResolvedValueOnce({ ok: true, path: '/Users/dev/my-repo' })
    render(<AddProjectPanel onAdded={() => {}} onClose={() => {}} />)
    await screen.findByText(/no desktop session/)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('/Users/dev/my-repo')
  })

  test('a failed add reports the daemon’s reason and stays on the trust step', async () => {
    sendPickProjectDirectory.mockResolvedValue({ ok: true, path: '/Users/dev/my-repo' })
    sendAddProject.mockResolvedValue({ ok: false, error: 'path does not exist or is not a directory: /Users/dev/my-repo' })
    render(<AddProjectPanel onAdded={() => {}} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'I trust it, add it' }))
    await screen.findByText(/path does not exist/)
    expect(screen.getByRole('button', { name: 'I trust it, add it' })).toBeTruthy()
  })

  test('Choose again reopens the system dialog from the trust step', async () => {
    sendPickProjectDirectory.mockResolvedValueOnce({ ok: true, path: '/Users/dev/first' })
    sendPickProjectDirectory.mockResolvedValueOnce({ ok: true, path: '/Users/dev/second' })
    render(<AddProjectPanel onAdded={() => {}} onClose={() => {}} />)
    await screen.findByText('/Users/dev/first')
    fireEvent.click(screen.getByRole('button', { name: 'Choose again' }))
    await screen.findByText('/Users/dev/second')
    expect(sendPickProjectDirectory).toHaveBeenCalledTimes(2)
  })
})
