/**
 * Loads .env.local and runs `supabase db push` against the remote Postgres.
 * Set either DATABASE_URL (full URI from Dashboard → Database) or
 * SUPABASE_DB_PASSWORD (with existing VITE_SUPABASE_URL).
 *
 * Optional: SUPABASE_POOLER_REGION=eu-central-1 (from Dashboard → Database)
 * to use the session pooler directly. The script also tries pooler hosts if
 * the direct db.*.supabase.co connection fails (e.g. IPv6-only DNS).
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.local')

/** Session pooler regions to try if direct connection fails */
const POOLER_REGIONS = [
  'eu-west-1',
  'eu-central-1',
  'us-east-1',
  'us-west-1',
  'us-west-2',
  'ap-south-1',
  'ap-southeast-1',
  'sa-east-1',
]

function loadDotEnv(path) {
  if (!existsSync(path)) {
    console.error(`Missing ${path}`)
    process.exit(1)
  }
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

function ensureSslmode(url) {
  if (url.includes('sslmode=')) return url
  return url + (url.includes('?') ? '&' : '?') + 'sslmode=require'
}

function directUrl(ref, pass) {
  return ensureSslmode(
    `postgresql://postgres:${encodeURIComponent(pass)}@db.${ref}.supabase.co:5432/postgres`,
  )
}

function poolerSessionUrl(ref, pass, region) {
  return ensureSslmode(
    `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
  )
}

function describeUrl(dbUrl) {
  try {
    const u = new URL(dbUrl.replace(/^postgresql:/, 'http:'))
    return `${u.hostname}:${u.port || '5432'}`
  } catch {
    return '(hidden)'
  }
}

function runPush(dbUrl) {
  return spawnSync('npx', ['supabase', 'db', 'push', '--db-url', dbUrl], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env },
  })
}

const env = loadDotEnv(envPath)
const customUrl = env.DATABASE_URL?.trim()
const pass = env.SUPABASE_DB_PASSWORD?.trim()
const base = env.VITE_SUPABASE_URL?.trim()
const refMatch = base?.match(/https:\/\/([^.]+)\.supabase\.co/)
const ref = refMatch?.[1]
const poolerRegion = env.SUPABASE_POOLER_REGION?.trim()

/** @type {string[]} */
const candidates = []

if (customUrl) {
  candidates.push(ensureSslmode(customUrl))
} else if (ref && pass) {
  if (poolerRegion) {
    candidates.push(poolerSessionUrl(ref, pass, poolerRegion))
    candidates.push(directUrl(ref, pass))
  } else {
    candidates.push(directUrl(ref, pass))
    for (const r of POOLER_REGIONS) {
      candidates.push(poolerSessionUrl(ref, pass, r))
    }
  }
} else {
  console.error(
    'Configure one of:\n' +
      '  • DATABASE_URL=postgresql://... in .env.local, or\n' +
      '  • SUPABASE_DB_PASSWORD=... with VITE_SUPABASE_URL (already set).\n' +
      'Get the password: Supabase Dashboard → Project Settings → Database.\n' +
      'Optional: SUPABASE_POOLER_REGION=eu-central-1 (shown next to pooler URI in the dashboard).',
  )
  process.exit(1)
}

let lastOut = ''
for (let i = 0; i < candidates.length; i++) {
  const dbUrl = candidates[i]
  console.error(`Connecting via ${describeUrl(dbUrl)} …`)
  const r = runPush(dbUrl)
  lastOut = `${r.stdout || ''}${r.stderr || ''}`
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)

  if (r.status === 0) {
    process.exit(0)
  }

  if (/password authentication failed|FATAL:\s*password/i.test(lastOut)) {
    process.exit(r.status ?? 1)
  }

  if (i < candidates.length - 1) {
    console.error('\n--- Retrying alternate database host… ---\n')
  }
}

process.exit(1)
