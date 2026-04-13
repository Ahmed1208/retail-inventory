import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const root = process.cwd()
  const define: Record<string, string> = {}

  /**
   * Admin → Data sync needs hosted URL + anon while `npm run dev` uses local `VITE_SUPABASE_*`.
   * Users often keep hosted credentials only in `.env.cloud.local` (for `npm run dev:cloud`).
   * Merge those into development so `VITE_SYNC_CLOUD_*` resolve without duplicating keys.
   */
  if (mode === 'development') {
    const dev = loadEnv('development', root, '')
    const cloud = loadEnv('cloud', root, '')
    const syncUrl =
      dev.VITE_SYNC_CLOUD_URL?.trim() ||
      cloud.VITE_SYNC_CLOUD_URL?.trim() ||
      cloud.VITE_SUPABASE_URL?.trim() ||
      ''
    const syncAnon =
      dev.VITE_SYNC_CLOUD_ANON_KEY?.trim() ||
      cloud.VITE_SYNC_CLOUD_ANON_KEY?.trim() ||
      cloud.VITE_SUPABASE_ANON_KEY?.trim() ||
      ''
    if (syncUrl && syncAnon) {
      define['import.meta.env.VITE_SYNC_CLOUD_URL'] = JSON.stringify(syncUrl)
      define['import.meta.env.VITE_SYNC_CLOUD_ANON_KEY'] = JSON.stringify(syncAnon)
    }
  }

  return {
    define,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
