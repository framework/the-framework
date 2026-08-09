import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

/**
 * The parsed YAML frontmatter of a `SKILL.md`-shaped bundle (used here for
 * domain presets, loops, and prompts — all share the same `SKILL.md` shape).
 */
export interface SkillManifest {
  /** Unique name (kebab-case by convention). */
  name: string
  /** One-line summary. */
  description: string
  /** SPDX license id, optional. */
  license?: string
  /** Hints (package names / globs) the bundle applies to; free-form. */
  appliesTo?: string[]
  /** When to load this bundle (natural-language cue). */
  trigger?: string
  /** When NOT to load it (points at a sibling instead). */
  skip?: string
  /** Arbitrary author metadata; passed through untouched. */
  metadata?: Record<string, unknown>
}

/** A `SKILL.md`-shaped document split into its validated manifest and its markdown body. */
export interface ParsedSkill {
  manifest: SkillManifest
  /** The markdown instructions body (everything after the frontmatter). */
  instructions: string
}

/**
 * Zod schema for `SKILL.md` frontmatter. Unknown keys are allowed and dropped
 * (forward-compat with richer Anthropic-style manifests); `metadata` is the
 * escape hatch for author-defined fields that should survive.
 */
const manifestSchema = z.object({
  name: z.string()
    .min(1, 'skill name is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'skill name may only contain letters, numbers, hyphens, and underscores'),
  description: z.string().min(1, 'skill description is required'),
  license: z.string().optional(),
  appliesTo: z.array(z.string()).optional(),
  trigger: z.string().optional(),
  skip: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

/** Raised when a `SKILL.md`-shaped document is missing frontmatter or fails validation. */
export class SkillManifestError extends Error {
  constructor(message: string, readonly source?: string) {
    super(message)
    this.name = 'SkillManifestError'
  }
}

/**
 * Parse a `SKILL.md`-shaped document into a validated {@link SkillManifest} and
 * its markdown instructions body. Shared by domain presets, loops, and prompt
 * bundles — they all reuse this same frontmatter format.
 *
 * @param markdown - the full document contents
 * @param source - optional label (file path) used in error messages
 */
export function parseSkillManifest(markdown: string, source?: string): ParsedSkill {
  const match = FRONTMATTER.exec(markdown)
  if (!match) {
    throw new SkillManifestError(
      `SKILL.md is missing a YAML frontmatter block (expected a leading "---" fence)`,
      source,
    )
  }

  const [, frontmatter, body] = match

  let raw: unknown
  try {
    raw = parseYaml(frontmatter ?? '')
  } catch (err) {
    throw new SkillManifestError(
      `SKILL.md frontmatter is not valid YAML: ${(err as Error).message}`,
      source,
    )
  }

  const parsed = manifestSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
    throw new SkillManifestError(`SKILL.md frontmatter is invalid: ${issues}`, source)
  }

  return {
    manifest: parsed.data as SkillManifest,
    instructions: (body ?? '').trim(),
  }
}
