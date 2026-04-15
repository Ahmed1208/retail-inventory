/**
 * Loads .env.local and runs `supabase db push` against the remote Postgres.
 * Set either DATABASE_URL (full URI from Dashboard → Database) or
 * SUPABASE_DB_PASSWORD (with existing VITE_SUPABASE_URL).
 *
 * Optional: SUPABASE_POOLER_REGION=eu-west-1 (exact region from Dashboard → Connect)
 * to try that region’s poolers first.
 *
 * Tries both shared pooler stacks (aws-1 then aws-0) × region × session (5432) / transaction (6543).
 * Many EU projects use aws-1-* only; aws-0-* can return “Tenant or user not found”.
 *
 * Best reliability: set DATABASE_URL to the “Session pooler” URI from the dashboard (copy-paste).
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.local')

/** Shared pooler regions to try if direct connection fails (order: common first). */
const POOLER_REGIONS = [
  'eu-west-1',
  'eu-central-1',
  'eu-north-1',
  'us-east-1',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
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

const POOLER_STACKS = ['aws-1', 'aws-0']

function poolerSessionUrl(ref, pass, stack, region) {
  return ensureSslmode(
    `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@${stack}-${region}.pooler.supabase.com:5432/postgres`,
  )
}

/** Supavisor transaction mode (IPv4-friendly); same user as session pooler. */
function poolerTransactionUrl(ref, pass, stack, region) {
  return ensureSslmode(
    `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@${stack}-${region}.pooler.supabase.com:6543/postgres`,
  )
}

function pushPoolerCandidates(ref, pass, region) {
  const out = []
  for (const stack of POOLER_STACKS) {
    out.push(poolerSessionUrl(ref, pass, stack, region))
    out.push(poolerTransactionUrl(ref, pass, stack, region))
  }
  return out
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
  return spawnSync(
    'npx',
    ['supabase', 'db', 'push', '--yes', '--db-url', dbUrl],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env },
    }
  )
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
    candidates.push(...pushPoolerCandidates(ref, pass, poolerRegion))
    candidates.push(directUrl(ref, pass))
  } else {
    // Prefer Supavisor poolers first: direct db.* often resolves to IPv6-only and fails on many networks.
    for (const r of POOLER_REGIONS) {
      candidates.push(...pushPoolerCandidates(ref, pass, r))
    }
    candidates.push(directUrl(ref, pass))
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
