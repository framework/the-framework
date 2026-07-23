import vikeReact from 'vike-react/config'
import type { Config } from 'vike/types'

export default {
  extends: vikeReact,
  prerender: true,
  title: 'The Framework',
  description:
    'Make the important decisions, let AI do the rest. The Framework turns AI agents into autonomous teammates that handle work end-to-end — while you stay in control of key decisions.',
  favicon: '/assets/logo.svg',
} satisfies Config
