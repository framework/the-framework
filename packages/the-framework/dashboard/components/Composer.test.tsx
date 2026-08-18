import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Preferences } from '../../src/index.js'
import { presets } from '../../src/client.js'
import { addProfile } from '../lib/profiles.js'
import { selectRemoteDevice } from '../lib/remote-target.js'
import { hoverTooltip } from '../test-utils.js'

// Preferences are the shared daemon store; stub them so the composer reads a fixed value.
const updatePreferences = vi.hoisted(() => vi.fn())
let prefs: Preferences = {}
vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => prefs,
  updatePreferences,
  themePreference: (p: Preferences) => p.theme ?? 'system',
  // #842: the launcher strip reads the resolved layers; nothing here sets a repo tier.
  usePreferenceSources: () => ({}),
  useProjectFileConfig: () => ({}),
  // #1025: project presets; nothing here opens a project, so no shared presets and no project scope.
  useProjectPresets: () => [],
  saveProjectPresetList: vi.fn(),
  useActiveProjectId: () => null,
}))
// The editor picker (#727) detects installed editors over an RPC; stub it to none in the test.
vi.mock('../lib/editors.js', () => ({ useDetectedEditors: () => [] }))
// Composer loads its own projects for the `@` picker (#743); stub the read to none.
vi.mock('../rpc/projects.js', () => ({ onProjects: () => Promise.resolve([]) }))
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
      // Loading a preset puts its text in the box, which is what makes a loaded preset submittable.
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
      addContext={vi.fn()}
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
})
afterEach(cleanup)

const STUDIO = 'http://192.168.1.5:4200'

// The driver/model trigger names both in its own label (#1143): with no model pinned it is a logo
// and a chevron, so the name cannot come from the rendered text the way it used to.
const agentTrigger = () => screen.getByRole('button', { name: /^Driver: / })

describe('Composer (#721)', () => {
  test('renders the full control row: agent/model, options gear, and the submit button', async () => {
    renderComposer({ submitLabel: 'Start session' })
    // Presets have a visible surface again (#948): the `/` menu stays the fast path, the
    // button is the discoverable one.
    expect(screen.getByRole('button', { name: /Presets/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Session options' })).toBeTruthy()
    expect((await hoverTooltip(agentTrigger())).textContent).toContain('Driver: Claude Code')
    // The submit button appears only once the prompt has text (#721).
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'x' } })
    expect(screen.getByRole('button', { name: /Start session/ })).toBeTruthy()
  })

  test('compact (#723) keeps the agent/model + options controls (#755)', async () => {
    const { onSubmit } = renderComposer({ compact: true, submitLabel: 'Start' })
    // They used to be dropped here, which meant a navbar agent silently used the stored agent,
    // model and options with nothing on screen saying which.
    expect(screen.queryByRole('button', { name: 'Session options' })).not.toBeNull()
    expect((await hoverTooltip(agentTrigger())).textContent).toContain('Driver: Claude Code')
    // The editor + submit still work (so `/` `<` `@` `#` triggers remain live in the editor).
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'quick run' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onSubmit).toHaveBeenCalledWith('quick run', 'build', { newAgent: false })
  })

  test('showDriverModel={false} (#831) drops the agent/model select, keeping the rest of the row', () => {
    const { onSubmit } = renderComposer({ showDriverModel: false })
    // An in-session composer: the session is bound to the agent it started with, so offering the
    // select there would only ever rewrite the next session's default.
    expect(screen.queryByRole('button', { name: 'Default' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Session options' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'follow-up' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSubmit).toHaveBeenCalledWith('follow-up', 'build', { newAgent: false })
  })

  test('option labels promise only what the code delivers (#801)', async () => {
    prefs = { onBeforeMergeableQuality: true }
    renderComposer()
    fireEvent.click(screen.getByRole('button', { name: 'Session options' }))
    // Scoped to the menu: the same label is on the resolved-options strip (#842), which explains
    // where the value came from instead.
    const menu = screen.getByRole('menu')
    const row = within(menu).getByText('Post-merge cleanup').closest('[role="menuitemcheckbox"]')!
    const tip = await hoverTooltip(row)
    expect(tip.textContent).toMatch(/ready for merge/i)
  })

  test('Browser is disabled with a reason off Claude Code (#801)', () => {
    prefs = { driver: 'codex', browser: true }
    renderComposer()
    fireEvent.click(screen.getByRole('button', { name: 'Session options' }))
    // The browser rides Claude Code's MCP config, so under Codex the box was checkable and inert.
    expect(screen.getByText(/only on Claude Code/)).toBeTruthy()
  })

  test('the submit button is hidden until the editor has text, then appears and fires onSubmit', () => {
    const { onSubmit } = renderComposer()
    // Empty prompt: nothing to send, so the button is not in the DOM (#721).
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'ship it' } })
    const submit = screen.getByRole('button', { name: 'Send' })
    expect(submit.hasAttribute('disabled')).toBe(false)
    fireEvent.click(submit)
    expect(onSubmit).toHaveBeenCalledWith('ship it', 'build', { newAgent: false })
  })

  test('the editor shortcut (Cmd/Ctrl+Enter) submits too', () => {
    const { onSubmit } = renderComposer()
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'go' } })
    fireEvent.click(screen.getByText('editor-submit'))
    expect(onSubmit).toHaveBeenCalledWith('go', 'build', { newAgent: false })
  })

  test('mirrors prompt changes out via onPromptChange', () => {
    const onPromptChange = vi.fn()
    renderComposer({ onPromptChange })
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'hi' } })
    expect(onPromptChange).toHaveBeenLastCalledWith('hi', 'build')
  })

  // #959: a preset can declare that it never belongs in the open session. The Composer does not
  // act on that itself — it carries the flag out to the host, which is the only thing that knows
  // whether "new session" means anything on its surface.
  test('a new-session preset marks its submit, and a normal one does not (#959)', () => {
    const { onSubmit } = renderComposer()
    fireEvent.click(screen.getByRole('button', { name: /Presets/ }))
    fireEvent.click(screen.getByText('Update from GitHub'))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    // The menu row is the label; what is submitted is the preset's prompt. They used to be the same
    // string, which is how the import shipped asking for nothing in particular (#697).
    expect(onSubmit).toHaveBeenCalledWith(presets.updateTickets.render(), 'prompt', { newAgent: true })

    cleanup()
    const second = renderComposer()
    fireEvent.click(screen.getByRole('button', { name: /Presets/ }))
    fireEvent.click(screen.getByText('Security audit'))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(second.onSubmit).toHaveBeenCalledWith(expect.stringContaining('Security audit'), 'prompt', { newAgent: false })
  })

  // #1066: a draft carried across a device hop lands in sessionStorage; the launcher seeds it into
  // the editor on mount, as a build (not a preset), and takes it once.
  test('the launcher rehydrates a draft carried from another device (#1066)', () => {
    sessionStorage.setItem('fw.pending-draft', 'carried from the studio box')
    const { onSubmit } = renderComposer({ submitLabel: 'Start session' })
    fireEvent.click(screen.getByRole('button', { name: /Start session/ }))
    expect(onSubmit).toHaveBeenCalledWith('carried from the studio box', 'build', { newAgent: false })
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

  test('emptying the box drops the preset\'s new-session rule with the preset (#959)', () => {
    const { onSubmit } = renderComposer()
    fireEvent.click(screen.getByRole('button', { name: /Presets/ }))
    fireEvent.click(screen.getByText('Update from GitHub'))
    // The stub editor does not mirror the loaded text into the DOM input, and jsdom drops a
    // change event whose value did not actually change — so give it something to clear.
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'edited' } })
    // Clearing it back to a typed prompt is a fresh start: a plain build agent, in this session.
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'just a question' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSubmit).toHaveBeenCalledWith('just a question', 'build', { newAgent: false })
  })

  // #1073: pressing Start on an offline "Run on" device would silently attempt the ~15s relay, so
  // Start is blocked with a reason pointing back to the gear. No auto-fallback: the target stays.
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
    expect(onSubmit).toHaveBeenCalledWith('ship it', 'build', { newAgent: false })
  })
})

describe('the in-session options gear (#1172)', () => {
  test('a live session drops the gear entirely instead of opening an empty dropdown', () => {
    renderComposer({ inAgent: true })
    expect(screen.queryByRole('button', { name: 'Session options' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resume options' })).toBeNull()
    // The old half-measure: a "Preferences" trigger whose menu had zero rows.
    expect(screen.queryByRole('button', { name: 'Preferences' })).toBeNull()
  })

  test('an ended session offers exactly the options the Resume leg will arm (#1469)', () => {
    renderComposer({ inAgent: true, agentEnded: true })
    fireEvent.click(screen.getByRole('button', { name: 'Resume options' }))
    const menu = screen.getByRole('menu')
    for (const label of ['Push branch', 'Open PR', 'Auto-merge', 'Browser']) {
      expect(within(menu).getByText(label)).toBeTruthy()
    }
    // The prompt-shaping rows stay out — the resumed transcript already carries its framing —
    // and "Run on" stays out too: the continuation is pinned to its conversation.
    for (const label of ['Transparent', 'Disable system prompt', 'Post-merge cleanup']) {
      expect(within(menu).queryByText(label)).toBeNull()
    }
    expect(within(menu).queryByText('Run on')).toBeNull()
  })

  test('the resume gear writes the shared preference the continuation resolves at start (#1469)', () => {
    renderComposer({ inAgent: true, agentEnded: true })
    fireEvent.click(screen.getByRole('button', { name: 'Resume options' }))
    const menu = screen.getByRole('menu')
    fireEvent.click(within(menu).getByText('Browser').closest('[role="menuitemcheckbox"]')!)
    expect(updatePreferences).toHaveBeenCalledWith({ browser: true })
  })
})
