import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { ProjectSummary, CustomPreset } from '../../src/index.js'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import type { Editor, Range } from '@tiptap/core'
import { Token, type TokenSpec } from './prompt-editor/tokens.js'
import { makeTrigger } from './prompt-editor/suggestion.js'
import { ScrollArea } from './ui/scroll-area.js'
import type { SuggestionItem } from './prompt-editor/SuggestionList.js'
// The same entry the Commands button renders: the `/` menu is the other face of that one list,
// so it reads the shape rather than restating it structurally.
import type { CommandEntry } from './CommandsMenu.js'

// The rich prompt editor (#470): a Tiptap surface that replaces the plain textarea. `/` opens
// the project's commands and the saved prompts, `@` the registered projects, `#` the project's
// files. A project or a file is inserted as a chip that serializes back to plain text, so the
// prompt over the wire is what it reads as. Markdown is live (StarterKit shortcuts) and
// round-trips via tiptap-markdown. Text flows out via onChange, and the handle only clears,
// focuses and loads.

export interface PromptEditorHandle {
  clear: () => void
  focus: () => void
  /** Load a text (a command, a saved prompt) into the editor. Returns whether it replaced a draft. */
  loadTemplate: (text: string) => boolean
}

interface PromptEditorProps {
  onChange: (markdown: string) => void
  /** Enter (and Cmd/Ctrl+Enter); Shift+Enter stays a line break (#1510). */
  onSubmit: () => void
  /** A command or a saved prompt picked from the `/` menu. `replaced` says whether a typed draft
   *  was overwritten — undo brings it back, and the form's note says so. */
  onPreset?: (label: string, replaced: boolean) => void
  projects: ProjectSummary[]
  /** The current project's files, repo-relative, for the `#` picker (#504). */
  files?: string[]
  /** The project's commands: each loads as `/<name> `, for the person to add an argument or send. */
  commands: CommandEntry[]
  /** The user's saved prompts (#626), loaded verbatim from the `/` menu (#722). */
  customPresets?: CustomPreset[]
  /** The open project's shared saved prompts (#1025), committed in its repo; loaded verbatim like the user's. */
  projectPresets?: CustomPreset[]
  /** Open the create panel from the `/` menu's "Save prompt…" (#722). Omit where there is no panel
   *  (the compact navbar launch), which also drops the item. */
  onNewPreset?: () => void
  disabled?: boolean
  placeholder?: string
  /**
   * Text to open with, applied once as soon as the editor exists (#1066/#1139).
   *
   * A prop rather than a mount-time `loadTemplate` call, because `immediatelyRender: false` leaves
   * `editor` null on the first render: the handle's loadTemplate returns false and does nothing,
   * so a caller that had already taken its one-shot draft lost it silently. Seeding through a prop
   * lets the editor apply it when it is ready instead of the caller guessing when that is.
   */
  initialText?: string | undefined
  /** A shorter surface for the navbar quick-launch (#723): starts one line tall instead of ~three. */
  compact?: boolean
}

/** Insert a token chip at the suggestion range, followed by a space. */
function insertToken(editor: Editor, range: Range, spec: TokenSpec): void {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent([{ type: 'token', attrs: { kind: spec.kind, label: spec.label, text: spec.text } }, { type: 'text', text: ' ' }])
    .run()
}

/**
 * Replace the editor content with a text. Takes the live editor instance (not a captured one),
 * so it works from the `/` menu — whose closures are built once on first render, when the
 * useEditor result is still null.
 */
function applyTemplate(editor: Editor, text: string): void {
  editor.commands.setContent(text)
  editor.commands.focus('end')
}

export const PromptEditor = forwardRef<PromptEditorHandle, PromptEditorProps>(function PromptEditor(
  { onChange, onSubmit, onPreset, projects, files = [], commands, customPresets = [], projectPresets = [], onNewPreset, disabled = false, placeholder = 'Describe what to do…  ( / commands · @ projects · # files )', initialText, compact = false },
  ref,
) {
  const [isEmpty, setIsEmpty] = useState(true)

  // Refs so the once-built suggestion closures always see the latest props/editor.
  const projectsRef = useRef(projects)
  const filesRef = useRef(files)
  const commandsRef = useRef(commands)
  const customPresetsRef = useRef(customPresets)
  const projectPresetsRef = useRef(projectPresets)
  const onNewPresetRef = useRef(onNewPreset)
  const onPresetRef = useRef(onPreset)
  const onChangeRef = useRef(onChange)
  const onSubmitRef = useRef(onSubmit)
  useEffect(() => {
    projectsRef.current = projects
    filesRef.current = files
    commandsRef.current = commands
    customPresetsRef.current = customPresets
    projectPresetsRef.current = projectPresets
    onNewPresetRef.current = onNewPreset
    onPresetRef.current = onPreset
    onChangeRef.current = onChange
    onSubmitRef.current = onSubmit
  })

  // Load a template into the live editor and sync the derived state (the empty flag + the
  // markdown out). Takes the editor as an argument so the `/` menu — whose closures are built
  // once, before useEditor resolves — can call it too, not only the imperative handle.
  // Replacing a typed draft loads without a blocking confirm (#948): the replacement is one
  // undo step (history groups the draft separately after its ~500ms window), and the caller
  // gets `replaced` back so its note can say "undo brings it back".
  const loadTemplateInto = (ed: Editor, text: string): boolean => {
    const replaced = !ed.isEmpty
    applyTemplate(ed, text)
    setIsEmpty(ed.isEmpty)
    onChangeRef.current(ed.storage.markdown.getMarkdown())
    return replaced
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      // breaks:true keeps a single newline as a hard break, so a saved prompt's line-per-line
      // block survives the markdown round-trip instead of collapsing into one paragraph.
      Markdown.configure({ html: false, linkify: false, breaks: true, transformPastedText: true }),
      Token,
      // `/` — the project's commands, then the saved prompts.
      makeTrigger({
        char: '/',
        key: 'slash',
        items: query => {
          const q = query.toLowerCase()
          const commandItems: SuggestionItem[] = commandsRef.current
            .filter(c => c.name.includes(q))
            .map(c => ({ id: `command:${c.name}`, label: `/${c.name}`, group: 'Commands', ...(c.description ? { title: c.description } : {}) }))
          // The user's saved prompts (#626) load verbatim.
          const customItems: SuggestionItem[] = customPresetsRef.current
            .filter(p => p.label.toLowerCase().includes(q))
            .map(p => ({ id: `custom-preset:${p.id}`, label: p.label, hint: 'saved prompt', group: 'Saved prompts' }))
          // The open project's shared saved prompts (#1025): same verbatim load, tagged so the hint tells
          // them apart from your own.
          const projectItems: SuggestionItem[] = projectPresetsRef.current
            .filter(p => p.label.toLowerCase().includes(q))
            .map(p => ({ id: `project-preset:${p.id}`, label: p.label, hint: 'project saved prompt', group: 'Saved prompts' }))
          // "Save prompt…" to capture the current prompt (#722), only where the create panel exists
          // (the full composer, not the compact navbar launch, which passes no onNewPreset).
          const newPresetItem: SuggestionItem[] =
            onNewPresetRef.current && 'save prompt'.includes(q)
              ? [{ id: 'new-preset', label: 'Save prompt…', hint: 'save the current prompt', group: 'Saved prompts' }]
              : []
          return [...commandItems, ...customItems, ...projectItems, ...newPresetItem]
        },
        onSelect: (item, { editor: ed, range }) => {
          if (item.id.startsWith('command:')) {
            const command = commandsRef.current.find(c => `command:${c.name}` === item.id)
            if (command) {
              // Drop the `/query` trigger first so it does not count as a replaced draft.
              ed.chain().focus().deleteRange(range).run()
              const replaced = loadTemplateInto(ed, `/${command.name} `)
              onPresetRef.current?.(`/${command.name}`, replaced)
            }
            return
          }
          if (item.id.startsWith('custom-preset:')) {
            const preset = customPresetsRef.current.find(p => `custom-preset:${p.id}` === item.id)
            if (preset) {
              ed.chain().focus().deleteRange(range).run()
              const replaced = loadTemplateInto(ed, preset.prompt)
              onPresetRef.current?.(preset.label, replaced)
            }
            return
          }
          if (item.id.startsWith('project-preset:')) {
            const preset = projectPresetsRef.current.find(p => `project-preset:${p.id}` === item.id)
            if (preset) {
              ed.chain().focus().deleteRange(range).run()
              const replaced = loadTemplateInto(ed, preset.prompt)
              onPresetRef.current?.(preset.label, replaced)
            }
            return
          }
          if (item.id === 'new-preset') {
            // Drop the `/query` trigger so the create panel captures the real prompt, not the slash.
            ed.chain().focus().deleteRange(range).run()
            onNewPresetRef.current?.()
          }
        },
      }),
      // `@` — references: the registered projects, by name.
      makeTrigger({
        char: '@',
        key: 'at',
        emptyNote: 'No projects to reference yet.',
        items: query =>
          projectsRef.current
            .filter(p => p.name.toLowerCase().includes(query))
            .slice(0, 8)
            .map(p => ({ id: `project:${p.id}`, label: `@${p.name}`, hint: 'project', group: 'Projects' })),
        onSelect: (item, { editor: ed, range }) => {
          const project = projectsRef.current.find(p => `project:${p.id}` === item.id)
          if (project) insertToken(ed, range, { kind: 'project', label: `@${project.name}`, text: `@${project.name}` })
        },
      }),
      // `#` — files: the finer-grained sibling of `@` (#504). Type to filter the project's
      // files (git ls-files); picking one writes its path into the prompt.
      makeTrigger({
        char: '#',
        key: 'hash',
        emptyNote: 'No files indexed here yet.',
        items: query =>
          filesRef.current
            .filter(f => f.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 8)
            .map(f => ({ id: `file:${f}`, label: `#${f}`, hint: 'file', group: 'Files' })),
        onSelect: (item, { editor: ed, range }) => {
          const rel = item.id.slice('file:'.length)
          insertToken(ed, range, { kind: 'file', label: `#${rel}`, text: `#${rel}` })
        },
      }),
    ],
    editorProps: {
      // The bare contenteditable needs its textbox semantics spelled out (#948): without them a
      // screen reader gets an unlabeled editable region, and the placeholder span is decorative.
      attributes: {
        class: 'pe-prose focus:outline-none',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Prompt',
        'aria-placeholder': placeholder,
      },
      handleKeyDown: (view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          onSubmitRef.current()
          return true
        }
        // Enter sends, Shift+Enter breaks the line (#1510) — Claude Code web's bindings. This
        // direct prop outranks the plugins' handlers, so it must step aside where Enter already
        // means something: picking from an open suggestion menu (aria-expanded mirrors its
        // visibility), typing a newline in a code block, or confirming an IME composition.
        if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.isComposing) {
          if (view.dom.getAttribute('aria-expanded') === 'true') return false
          if (view.state.selection.$from.parent.type.name === 'codeBlock') return false
          event.preventDefault()
          onSubmitRef.current()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      setIsEmpty(ed.isEmpty)
      onChangeRef.current(ed.storage.markdown.getMarkdown())
    },
  })

  useImperativeHandle(ref, () => ({
    clear: () => {
      editor?.commands.clearContent()
      setIsEmpty(true)
      onChangeRef.current('')
    },
    focus: () => editor?.commands.focus('end'),
    loadTemplate: (text: string) => (editor ? loadTemplateInto(editor, text) : false),
  }))

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  // Seed {@link PromptEditorProps.initialText} the moment the editor exists, and only ever once:
  // it is an opening draft, not a controlled value, so re-applying it would overwrite whatever the
  // user has typed since. The ref (not state) because seeding must not itself cause a render.
  const seeded = useRef(false)
  useEffect(() => {
    if (!editor || seeded.current || !initialText) return
    seeded.current = true
    loadTemplateInto(editor, initialText)
  }, [editor, initialText])

  // The placeholder is absolutely positioned, so it must share the editor's padding to sit exactly
  // where the first typed character will (#721). The full composer breathes with more room; the
  // compact navbar row stays tight.
  const pad = compact ? 'px-2 py-1.5' : 'px-4 pt-4 pb-3'
  const placeholderInset = compact ? 'left-2 top-1.5' : 'left-4 top-4'
  return (
    <div className="relative">
      {/* The scroll rides a ScrollArea (#1046) so a long prompt shows our thin overlay bar, not the
          OS one. The resting height is deliberately short (#756): the editor grows with its content
          up to max-h, so the tall empty box no longer reserves room for text nobody has typed.
          Compact (navbar) keeps its own border+ring; the full composer's border lives on the
          surrounding composer box (#721) so the editor and its controls read as one surface. */}
      <ScrollArea
        className={compact ? 'rounded-md border border-border focus-within:ring-2 focus-within:ring-[var(--color-primary)]' : ''}
        // The height cap goes on the viewport (the scroller), not the Root — a Root max-h cannot be
        // resolved by the viewport's height, so the editor would grow instead of scrolling.
        viewportClassName={compact ? 'max-h-32 min-h-8' : 'max-h-64 min-h-[2.75rem]'}
      >
        <EditorContent editor={editor} className={`w-full bg-transparent text-sm ${pad}`} />
      </ScrollArea>
      {isEmpty && (
        <span className={`pointer-events-none absolute text-sm text-muted-foreground ${placeholderInset}`}>
          {placeholder}
        </span>
      )}
    </div>
  )
})
