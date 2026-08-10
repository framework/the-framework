import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { PromptEditor } from './PromptEditor.js'

// The real Tiptap editor (no mock): what's under test is the keyboard seam itself — which
// Enter reaches the submit callback and which stays an editing key (#1510).

afterEach(cleanup)

async function renderEditor() {
  const onSubmit = vi.fn()
  const onChange = vi.fn()
  render(<PromptEditor onChange={onChange} onSubmit={onSubmit} projects={[]} presets={[]} />)
  // immediatelyRender: false — the contenteditable appears a tick after mount.
  const box = await waitFor(() => {
    const el = document.querySelector('[role="textbox"]')
    if (!el) throw new Error('editor not mounted yet')
    return el as HTMLElement
  })
  return { box, onSubmit }
}

describe('Enter sends the prompt (#1510)', () => {
  test('plain Enter submits; Shift+Enter and Alt+Enter do not', async () => {
    const { box, onSubmit } = await renderEditor()
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    fireEvent.keyDown(box, { key: 'Enter', altKey: true })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test('Cmd/Ctrl+Enter still submits', async () => {
    const { box, onSubmit } = await renderEditor()
    fireEvent.keyDown(box, { key: 'Enter', metaKey: true })
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true })
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  test('Enter is left to an open suggestion menu (aria-expanded), which uses it to pick', async () => {
    const { box, onSubmit } = await renderEditor()
    // The suggestion render marks the editor while its menu is visible; the guard reads that mark.
    box.setAttribute('aria-expanded', 'true')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
    box.setAttribute('aria-expanded', 'false')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test('Enter during IME composition is not a send', async () => {
    const { box, onSubmit } = await renderEditor()
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true })
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
