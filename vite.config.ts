import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // A developer checkout builds both SPAs, so the shop build (which reads
  // `.env.shop.local` and sends "/" straight to sign-in) must not overwrite
  // the landing-page build in `dist`.
  ...(mode === 'shop' ? { build: { outDir: 'dist-shop' } } : {}),
}))
