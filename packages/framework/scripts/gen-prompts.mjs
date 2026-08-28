import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Compile `prompts/**/*.md` (#551) into `src/prompts.generated.ts` so the prompting is
// authored as markdown while the code keeps importing plain strings.
//
// Why generate instead of reading the .md at run time (the @gemstack/ai-autopilot pattern):
// the system prompt and every preset are reachable from `src/client.ts`, which the dashboard
// imports in the *browser* to show the prompt before a run (#520). A `node:fs` read there
// breaks the browser bundle, and `client.test.ts` fails the build over it. A generated module
// is just strings, so it crosses that boundary for free and the package stays `files: ["dist"]`.
//
// The .md is the only source of truth; the generated file is git-ignored and rebuilt by
// `build` / `test` / `typecheck`, so it cannot drift the way the hand-copied template did.

const here = dirname(fileURLToPath(import.meta.url))
const promptsDir = join(here, '..', 'prompts')
const outFile = join(here, '..', 'src', 'prompts.generated.ts')

/**
 * Every prompt .md under prompts/, as absolute paths, sorted so the output is stable.
 * README.md and the SPEC.md docs — the directory's own and each prompt's sibling — are
 * documentation for humans, not prompts.
 */
async function findMarkdown(dir) {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await findMarkdown(path)))
    else if (entry.name.endsWith('.md') && entry.name !== 'README.md' && !entry.name.endsWith('SPEC.md')) found.push(path)
  }
  return found.sort()
}

/** `presets/security_audit.md` -> `PRESETS_SECURITY_AUDIT`. */
function constName(relPath) {
  return relPath
    .replace(/\.md$/, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toUpperCase()
}

// The `branches` skill (#1725) rides in the system channel the way the prompts above do,
// but its text is the package's, not this directory's: read from wherever the package is
// installed, so the instructions and the command they name can never come from two versions.
// Its front matter is the skill catalogue's metadata, not instructions, and is dropped.
const skillPath = createRequire(import.meta.url).resolve('@gemstack/skill-branches/SKILL.md')
const sources = [
  ...(await findMarkdown(promptsDir)).map(path => {
    const relPath = relative(promptsDir, path).split('\\').join('/')
    return { label: `prompts/${relPath}`, name: constName(relPath), path, frontMatter: false }
  }),
  { label: '@gemstack/skill-branches/SKILL.md', name: 'BRANCHES_SKILL', path: skillPath, frontMatter: true },
]
const entries = await Promise.all(
  sources.map(async source => {
    const raw = await readFile(source.path, 'utf8')
    const text = source.frontMatter ? raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, '') : raw
    // Strip exactly one trailing newline: the files end with one so they are well-formed on
    // disk, the prompts they carry do not.
    return { ...source, text: text.replace(/\n$/, '') }
  }),
)

const body = entries
  // JSON.stringify, not a template literal: the prompts contain backticks and `${{ }}`
  // fragments, and hand-rolled escaping is exactly the kind of thing that silently corrupts
  // a prompt. Unreadable output is fine, nobody reads this file.
  .map(e => `/** \`${e.label}\` */\nexport const ${e.name} = ${JSON.stringify(e.text)}\n`)
  .join('\n')

const out = `// Generated from prompts/**/*.md by scripts/gen-prompts.mjs. Do not edit.
// Edit the markdown instead; this file is rebuilt on every build/test/typecheck.

${body}`

await writeFile(outFile, out)
console.log(`[gen-prompts] ${entries.length} prompts -> ${relative(join(here, '..'), outFile)}`)
