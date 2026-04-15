import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Admin → Data sync needs hosted URL + anon while the SPA uses self-hosted or CLI-local `VITE_SUPABASE_*`.
 * Users often keep hosted credentials only in `.env.cloud.local` (for `npm run dev:cloud`).
 * Merge those into `development` (dev server) and `production` (`npm run build`) so
 * `VITE_SYNC_CLOUD_*` resolve without duplicating keys in `.env.production.local`.
 */
function mergeSyncCloudFromEnv(
  define: Record<string, string>,
  mode: 'development' | 'production',
  root: string,
) {
  const primary = loadEnv(mode, root, '')
  const cloud = loadEnv('cloud', root, '')
  const syncUrl =
    primary.VITE_SYNC_CLOUD_URL?.trim() ||
    cloud.VITE_SYNC_CLOUD_URL?.trim() ||
    cloud.VITE_SUPABASE_URL?.trim() ||
    ''
  const syncAnon =
    primary.VITE_SYNC_CLOUD_ANON_KEY?.trim() ||
    cloud.VITE_SYNC_CLOUD_ANON_KEY?.trim() ||
    cloud.VITE_SUPABASE_ANON_KEY?.trim() ||
    ''
  if (syncUrl && syncAnon) {
    define['import.meta.env.VITE_SYNC_CLOUD_URL'] = JSON.stringify(syncUrl)
    define['import.meta.env.VITE_SYNC_CLOUD_ANON_KEY'] = JSON.stringify(syncAnon)
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const root = process.cwd()
  const define: Record<string, string> = {}

  if (mode === 'development' || mode === 'production') {
    mergeSyncCloudFromEnv(define, mode, root)
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
