import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// Everything the form reads goes through a lib module, so the mocks stop short of telefunc: an
// unmocked `*.telefunc.js` in the import graph fails as an assertIsNotBrowser bug report.
const onProjects = vi.hoisted(() => vi.fn())
vi.mock('../server/projects.telefunc.js', () => ({ onProjects }))

const onSystemPromptUser = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onSystemPromptUser }))

vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => ({}),
  updatePreferences: vi.fn(),
  autopilotEnabled: () => false,
}))
vi.mock('../lib/profiles.js', () => ({ useConnectionProfiles: () => [] }))
vi.mock('../lib/remote-target.js', () => ({ useSelectedRemoteDeviceId: () => null }))

const start = vi.hoisted(() => vi.fn())
vi.mock('../lib/use-start-run.js', () => ({
  useStartRun: () => ({ busy: false, error: null, reset: vi.fn(), start }),
}))

// The Composer is exercised by its own tests; here it only has to hand back the two submit
// kinds its contract defines: 'build' for a typed prompt, 'prompt' once a preset was loaded.
vi.mock('./Composer.js', async () => {
  const { forwardRef } = await import('react')
  const Composer = forwardRef((props: any, _ref: any) => (
    <div>
      <button type="button" onClick={() => props.onSubmit('do the thing', 'build', { newSession: false })}>
        submit-typed
      </button>
      <button type="button" onClick={() => props.onSubmit('preset text', 'prompt', { newSession: false })}>
        submit-preset
      </button>
    </div>
  ))
  return { Composer }
})
vi.mock('./ContextMenu.js', () => ({ ContextMenu: () => null }))
vi.mock('./SystemPromptDisclosure.js', () => ({ SystemPromptDisclosure: () => null }))

const { StartRunForm } = await import('./StartRunForm.js')

afterEach(() => {
  cleanup()
  start.mockReset()
})

const props = {
  projectId: 'p1',
  files: [],
  context: new Set<string>(),
  addContext: () => {},
  removeContext: () => {},
  toggleContext: () => {},
}

describe('StartRunForm submit (#1279)', () => {
  test('a preset run starts unattended, so it ends at settle and its handoff fires', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    start.mockResolvedValue({ runId: 'r1' })
    render(<StartRunForm {...props} />)
    fireEvent.click(screen.getByText('submit-preset'))
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(start.mock.calls[0]![2]).toBe('prompt')
    expect(start.mock.calls[0]![3]).toMatchObject({ unattended: true })
  })

  test('a typed prompt stays attended: the stay-open chat (#714) is for conversations', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    start.mockResolvedValue({ runId: 'r1' })
    render(<StartRunForm {...props} />)
    fireEvent.click(screen.getByText('submit-typed'))
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(start.mock.calls[0]![2]).toBe('build')
    expect(start.mock.calls[0]![3]).not.toHaveProperty('unattended')
  })
})
