import react from '@vitejs/plugin-react'
import vike from 'vike/plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), vike()],
  // @ts-ignore
  // TO-DO/eventually: remove this workaround once upstream fixed the issue
  // Temporary workaround for Vike error
  // https://github.com/gemstack-land/the-framework/issues/460
  vitePluginServerEntry: { disableAutoImport: true },
})
