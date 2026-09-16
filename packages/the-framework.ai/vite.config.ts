import react from '@vitejs/plugin-react'
import vike from 'vike/plugin'
import { defineConfig } from 'vite'

// Vike reads every `+name.*` file beside a page as a config file, `.md` included, so the
// `+config.LOGIC.md` and `+config.BUG-ANALYSIS.md` sidecars the repository keeps beside each
// source file broke the build. Vike's crawl takes its ignore list from this variable only.
process.env['VIKE_CRAWL'] ??= JSON.stringify({ ignore: ['**/*.LOGIC.md', '**/*.BUG-ANALYSIS.md'] })

export default defineConfig({
  plugins: [react(), vike()],
})
