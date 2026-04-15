/**
 * Checks that local GoTrue accepts the seeded operator (admin / devpass123).
 * Loads VITE_SUPABASE_* from `.env.development` and optional `.env.development.local`.
 *
 * Usage: npm run verify:local-login
 * Requires: `npx supabase start` and (for the seeded user) `npm run db:reset` once.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadDotEnv(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function merge(a, b) {
  return { ...a, ...b }
}

const dev = loadDotEnv(join(root, '.env.development'))
const local = loadDotEnv(join(root, '.env.development.local'))
const env = merge(dev, local)

const url = (env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')
const anon = (env.VITE_SUPABASE_ANON_KEY || '').trim()

if (!url || !anon) {
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.development (or .env.development.local).',
  )
  process.exit(1)
}

const isLocal =
  url.includes('127.0.0.1') || url.includes('localhost') || url.includes('kong')

if (!isLocal) {
  console.warn(
    `VITE_SUPABASE_URL is not local (${url.slice(0, 48)}…). This check is meant for Docker Supabase.`,
  )
}

const tokenUrl = `${url}/auth/v1/token?grant_type=password`
const body = JSON.stringify({
  email: 'admin@members.stockpilot.local',
  password: 'devpass123',
})

try {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      apikey: anon,
      'Content-Type': 'application/json',
    },
    body,
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }

  if (!res.ok) {
    console.error(`HTTP ${res.status} from ${tokenUrl}`)
    console.error(json ? JSON.stringify(json, null, 2) : text.slice(0, 500))
    console.error('\nFix: run `npx supabase start`, then `npm run db:reset` (applies migrations + seed.sql).')
    console.error(
      'If keys changed, run `npx supabase status -o env` and update VITE_SUPABASE_* in .env.development.',
    )
    process.exit(1)
  }

  if (json?.access_token) {
    console.log('OK — local GoTrue accepted admin@members.stockpilot.local / devpass123.')
    console.log('Use `npm run dev` (not dev:cloud) and username `admin` on the login screen.')
    process.exit(0)
  }

  console.error('Unexpected response:', text.slice(0, 400))
  process.exit(1)
} catch (e) {
  console.error('Request failed (is Supabase running?)', e)
  console.error('Start stack: npx supabase start')
  process.exit(1)
}
