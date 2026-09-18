import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Preferences } from '../../src/index.js'
import { addProfile } from '../lib/profiles.js'
import { selectRemoteDevice } from '../lib/remote-target.js'
import { hoverTooltip } from '../test-utils.js'

// Preferences are the shared daemon store; stub them so the composer reads a fixed value.
const updatePreferences = vi.hoisted(() => vi.fn())
let prefs: Preferences = {}
vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => prefs,
  updatePreferences,
  // #1025: the project's saved prompts; none here.
  useProjectPresets: () => [],
  saveProjectPresetList: vi.fn(),
  useActiveProjectId: () => 'p1',
}))
// The editor picker (#727) detects installed editors over an RPC; stub it to none in the test.
vi.mock('../lib/editors.js', () => ({ useDetectedEditors: () => [] }))
// Composer loads its own projects for the `@` picker (#743) and the project's commands for the
// `/` list; stub the reads.
const onCommands = vi.hoisted(() => vi.fn())
vi.mock('../rpc/projects.js', () => ({ onProjects: () => Promise.resolve([]), onCommands }))
// The device health poll (#1072) reaches the daemon over an RPC; a hoisted stub so each test can
// answer online/offline for the "Run on" target (#1073).
const checkDevices = vi.hoisted(() => vi.fn())
vi.mock('../rpc/devices.js', () => ({ checkDevices }))

// Stub the Tiptap editor (it needs a real DOM/ProseMirror): a plain input driving onChange, a
// "type-submit" button firing onSubmit, and a ref exposing the same handle the composer calls.
//
// The stub models one thing about the real editor deliberately: `loadTemplate` does NOTHING until
// the editor has resolved. Tiptap runs with `immediatelyRender: false`, so on the first render the
// handle is a no-op that returns false — and a stub that answered it synchronously is exactly why a
// carried draft passed here while arriving as an empty composer in a browser. An opening draft
// therefore has to travel as `initialText`, which the editor applies when it is ready.
// It also holds and renders its own text, so a test can ask what is IN the box rather than only
// what Start would send. The two used to be assertable only together, which hid this exact bug: the
// composer's own `prompt` state was set alongside the editor call, so a dropped `loadTemplate` still
// submitted the right text while the user looked at an empty box and had nothing to edit.
vi.mock('./PromptEditor.js', async () => {
  const { forwardRef, useEffect, useImperativeHandle, useRef, useState } = await import('react')
  const PromptEditor = forwardRef((props: any, ref: any) => {
    const [ready, setReady] = useState(false)
    const [held, setHeld] = useState('')
    useEffect(() => setReady(true), []) // resolves a render late, like useEditor
    const put = (text: string) => {
      setHeld(text)
      props.onChange(text)
    }
    useImperativeHandle(ref, () => ({
      clear: () => put(''),
      focus: () => {},
      // Loading a command puts its text in the box, which is what makes it submittable.
      loadTemplate: (text: string) => {
        if (!ready) return false
        put(text)
        return false
      },
    }))
    const seeded = useRef(false)
    useEffect(() => {
      if (!ready || seeded.current || !props.initialText) return
      seeded.current = true
      put(props.initialText)
    }, [ready, props.initialText])
    return (
      <div>
        <input aria-label="prompt" value={held} onChange={e => put(e.target.value)} disabled={props.disabled} />
        <button type="button" onClick={() => props.onSubmit()}>
          editor-submit
        </button>
      </div>
    )
  })
  return { PromptEditor }
})

/** What the editor is actually holding, as opposed to what Start would submit. */
const editorText = (): string => (screen.getByLabelText('prompt') as HTMLInputElement).value

const { Composer } = await import('./Composer.js')

function renderComposer(over: Partial<Parameters<typeof Composer>[0]> = {}) {
  const onSubmit = vi.fn()
  render(
    <Composer
      files={[]}
      onSubmit={onSubmit}
      busy={false}
      submitLabel="Send"
      submitBusyLabel="Sending…"
      {...over}
    />,
  )
  return { onSubmit }
}

beforeEach(() => {
  prefs = {}
  updatePreferences.mockReset()
  sessionStorage.clear()
  localStorage.clear()
  selectRemoteDevice(null)
  checkDevices.mockReset()
  checkDevices.mockResolvedValue({}) // default: no devices reachable
  onCommands.mockReset()
  onCommands.mockResolvedValue({ commands: [{ name: 'work-queue', description: 'Work the agent queue', button: true }], startHook: true })
})
afterEach(cleanup)

const STUDIO = 'http://192.168.1.5:4200'

// The driver/model trigger names both in its own label (#1143): with no model pinned it is a logo
// and a chevron, so the name cannot come from the rendered text the way it used to.
const agentTrigger = () => screen.getByRole('button', { name: /^Driver: / })

describe('Composer (#721)', () => {
  test('renders the full control row: commands, agent/model, "Run on", and the submit button', async () => {
    renderComposer({ submitLabel: 'Start session' })
    // Commands have a visible surface (#948): the `/` menu stays the fast path, the button is
    // the discoverable one.
    expect(screen.getByRole('button', { name: 'Commands' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Run on' })).toBeTruthy()
    expect((await hoverTooltip(agentTrigger())).textContent).toContain('Driver: Claude Code')
    // The submit button appears only once the prompt has text (#721).
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'x' } })
    expect(screen.getByRole('button', { name: /Start session/ })).toBeTruthy()
  })

  test('compact (#723) keeps the agent/model + "Run on" controls (#755)', async () => {
    const { onSubmit } = renderComposer({ compact: true, submitLabel: 'Start' })
    // They used to be dropped here, which meant a navbar agent silently used the stored agent
    // and model with nothing on screen saying which.
    expect(screen.queryByRole('button', { name: 'Run on' })).not.toBeNull()
    expect((await hoverTooltip(agentTrigger())).textContent).toContain('Driver: Claude Code')
    // The editor + submit still work (so `/` `@` `#` triggers remain live in the editor).
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'quick run' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onSubmit).toHaveBeenCalledWith('quick run')
  })

  test('showDriverModel={false} (#831) drops the agent/model select, keeping the rest of the row', () => {
    const { onSubmit } = renderComposer({ showDriverModel: false })
    // An in-session composer: the session is bound to the agent it started with, so offering the
    // select there would only ever rewrite the next session's default.
    expect(screen.queryByRole('button', { name: /^Driver: / })).toBeNull()
    expect(screen.getByRole('button', { name: 'Commands' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'follow-up' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSubmit).toHaveBeenCalledWith('follow-up')
  })

  test('the submit button is hidden until the editor has text, then appears and fires onSubmit', () => {
    const { onSubmit } = renderComposer()
    // Empty prompt: nothing to send, so the button is not in the DOM (#721).
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'ship it' } })
    const submit = screen.getByRole('button', { name: 'Send' })
    expect(submit.hasAttribute('disabled')).toBe(false)
    fireEvent.click(submit)
    expect(onSubmit).toHaveBeenCalledWith('ship it')
  })

  test('the editor shortcut (Cmd/Ctrl+Enter) submits too', () => {
    const { onSubmit } = renderComposer()
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'go' } })
    fireEvent.click(screen.getByText('editor-submit'))
    expect(onSubmit).toHaveBeenCalledWith('go')
  })

  test('mirrors prompt changes out via onPromptChange', () => {
    const onPromptChange = vi.fn()
    renderComposer({ onPromptChange })
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'hi' } })
    expect(onPromptChange).toHaveBeenLastCalledWith('hi')
  })

  test('a command picked from the menu loads as its slash line, and what is sent is that line plus the argument typed after it', async () => {
    const onPreset = vi.fn()
    const { onSubmit } = renderComposer({ onPreset })
    await waitFor(() => expect(onCommands).toHaveBeenCalledWith('p1'))
    fireEvent.click(screen.getByRole('button', { name: 'Commands' }))
    fireEvent.click(await screen.findByText('/work-queue'))
    expect(editorText()).toBe('/work-queue ')
    expect(onPreset).toHaveBeenCalledWith('/work-queue', false)
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: '/work-queue now' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSubmit).toHaveBeenCalledWith('/work-queue now')
  })

  test('canSubmit={false} keeps the submit off, by click and by shortcut', () => {
    const { onSubmit } = renderComposer({ canSubmit: false })
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'ship it' } })
    const submit = screen.getByRole('button', { name: 'Send' })
    expect(submit.hasAttribute('disabled')).toBe(true)
    fireEvent.click(submit)
    fireEvent.click(screen.getByText('editor-submit'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // #1066: a draft carried across a device hop lands in sessionStorage; the launcher seeds it into
  // the editor on mount, and takes it once.
  test('the launcher rehydrates a draft carried from another device (#1066)', () => {
    sessionStorage.setItem('fw.pending-draft', 'carried from the studio box')
    const { onSubmit } = renderComposer({ submitLabel: 'Start session' })
    fireEvent.click(screen.getByRole('button', { name: /Start session/ }))
    expect(onSubmit).toHaveBeenCalledWith('carried from the studio box')
    expect(sessionStorage.getItem('fw.pending-draft')).toBeNull() // taken once
  })

  test('a carried draft is IN the editor, not just in what Start would send (#1139)', () => {
    // The regression the stub models: the draft is taken and cleared on the first render, while the
    // editor is not there yet to receive it. Seeding it as `initialText` is what keeps those two
    // facts from cancelling out. Asserted on the box rather than on submit, because submit was
    // right the whole time this was broken — the user was the one looking at an empty composer.
    const draft = 'Work on tickets/a.md. Do not start any other ticket.'
    sessionStorage.setItem('fw.pending-draft', draft)
    renderComposer({ submitLabel: 'Start session' })
    expect(editorText()).toBe(draft)
  })

  test('an in-session composer does not rehydrate a carried draft (#1066)', () => {
    sessionStorage.setItem('fw.pending-draft', 'not for here')
    renderComposer({ inAgent: true })
    expect(sessionStorage.getItem('fw.pending-draft')).toBe('not for here') // launcher-only
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull() // nothing seeded
  })

  // #1073: pressing Start on an offline "Run on" device would silently attempt the ~15s relay, so
  // Start is blocked with a reason pointing back to the "Run on" pick. No auto-fallback: the target stays.
  test('an offline "Run on" device disables Start and shows the reason (#1073)', async () => {
    checkDevices.mockResolvedValue({ [STUDIO]: false })
    addProfile({ url: STUDIO, token: 'aaa', label: 'Studio' })
    selectRemoteDevice(STUDIO)
    const { onSubmit } = renderComposer()
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'ship it' } })
    await waitFor(() => expect(screen.getByText(/Studio is offline/)).toBeTruthy())
    const submit = screen.getByRole('button', { name: 'Send' })
    expect(submit.hasAttribute('disabled')).toBe(true)
    // Both the click and the editor shortcut are blocked.
    fireEvent.click(submit)
    fireEvent.click(screen.getByText('editor-submit'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('an online "Run on" device leaves Start enabled with no offline note (#1073)', async () => {
    checkDevices.mockResolvedValue({ [STUDIO]: true })
    addProfile({ url: STUDIO, token: 'aaa', label: 'Studio' })
    selectRemoteDevice(STUDIO)
    const { onSubmit } = renderComposer()
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'ship it' } })
    await waitFor(() => expect(checkDevices).toHaveBeenCalled())
    expect(screen.queryByText(/is offline/)).toBeNull()
    const submit = screen.getByRole('button', { name: 'Send' })
    expect(submit.hasAttribute('disabled')).toBe(false)
    fireEvent.click(submit)
    expect(onSubmit).toHaveBeenCalledWith('ship it')
  })
})

describe('in a session', () => {
  test('there is no "Run on" pick: a session already runs where it was started', () => {
    renderComposer({ inAgent: true })
    expect(screen.queryByRole('button', { name: 'Run on' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Commands' })).toBeTruthy()
  })
})
