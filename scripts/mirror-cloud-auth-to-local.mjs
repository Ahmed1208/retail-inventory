/**
 * Wipes ALL users on **local** Supabase Auth, then recreates them from the **hosted**
 * project with the **same user ids** (so Admin → Data sync can apply `public.profiles`).
 *
 * - Requires **service_role** keys (never commit them). Put variables in a gitignored file
 *   such as `.env.mirror-auth.local` (see `.env.example`).
 * - Hosted passwords are **not** copied. Every mirrored user gets `MIRROR_LOCAL_PASSWORD`
 *   (default `devpass123`).
 * - Destructive: set `I_CONFIRM_WIPE_LOCAL_AUTH=YES` or use `--dry-run` only.
 *
 * Usage (bash/zsh):
 *   I_CONFIRM_WIPE_LOCAL_AUTH=YES npm run mirror:cloud-auth-to-local
 *   npm run mirror:cloud-auth-to-local -- --dry-run
 *
 * Usage (Windows PowerShell):
 *   $env:I_CONFIRM_WIPE_LOCAL_AUTH="YES"; npm run mirror:cloud-auth-to-local
 *
 * Afterward: run **Admin → Data sync** once to refresh `profiles` and business data from cloud.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

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

function merge(...objs) {
  return objs.reduce((a, b) => ({ ...a, ...b }), {})
}

function normalizeUrl(u) {
  return String(u || '')
    .trim()
    .replace(/\/$/, '')
}

function isLocalSupabaseUrl(url) {
  try {
    const u = new URL(url)
    return (
      u.hostname === '127.0.0.1' ||
      u.hostname === 'localhost' ||
      u.hostname.endsWith('.local')
    )
  } catch {
    return false
  }
}

function syntheticEmailForUser(user) {
  const id = String(user.id || '').replace(/-/g, '').slice(0, 16)
  return `mirror-${id || 'user'}@members.stockpilot.local`
}

/** Decode Supabase JWT payload (no verify) to read `role`. */
function jwtPayloadRole(jwt) {
  const parts = String(jwt || '').split('.')
  if (parts.length < 2) return null
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4
    if (pad) b64 += '='.repeat(4 - pad)
    const json = Buffer.from(b64, 'base64').toString('utf8')
    const p = JSON.parse(json)
    return typeof p.role === 'string' ? p.role : null
  } catch {
    return null
  }
}

function assertServiceRoleKey(label, secret) {
  const role = jwtPayloadRole(secret)
  if (role === 'service_role') return
  if (role === 'anon' || role === 'authenticated') {
    console.error(
      `${label}: JWT role is "${role}", not "service_role".\n` +
        `  Admin Auth APIs need the **service_role** key from Supabase Dashboard → Settings → API.\n` +
        `  Do not use the anon (public) key for ${label}.`,
    )
    process.exit(1)
  }
  console.error(
    `${label}: could not read JWT role (wrong key format?). Use the **service_role** secret from Dashboard → Settings → API.`,
  )
  process.exit(1)
}

function hintHtmlAuthResponse(errMsg) {
  const m = String(errMsg)
  if (!m.includes('DOCTYPE') && !m.includes('not valid JSON')) return m
  return (
    `${m}\n\n` +
    'Usually this means the request got an **HTML error page** instead of JSON:\n' +
    '  • Use **service_role** keys (not anon) for both cloud and local — see assert errors above.\n' +
    '  • Confirm MIRROR_CLOUD_SUPABASE_URL is the project API URL (…supabase.co), with no extra path.\n' +
    '  • If the hosted project is paused or blocked, fix that in the Supabase dashboard first.'
  )
}

async function listAllAuthUsers(adminClient, label) {
  const users = []
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`${label} listUsers(page ${page}): ${hintHtmlAuthResponse(error.message)}`)
    const batch = data.users ?? []
    users.push(...batch)
    if (batch.length < perPage) break
    page += 1
    if (page > 5000) throw new Error('Too many Auth list pages')
  }
  return users
}

const dryRun = process.argv.includes('--dry-run')
const confirm = process.env.I_CONFIRM_WIPE_LOCAL_AUTH === 'YES'

if (!dryRun && !confirm) {
  console.error(
    'Refusing to run: this deletes every local Auth user.\n' +
      '  Dry run:  npm run mirror:cloud-auth-to-local -- --dry-run\n' +
      '  Apply:    I_CONFIRM_WIPE_LOCAL_AUTH=YES npm run mirror:cloud-auth-to-local',
  )
  process.exit(1)
}

const env = merge(
  loadDotEnv(join(root, '.env.development')),
  loadDotEnv(join(root, '.env.development.local')),
  loadDotEnv(join(root, '.env.mirror-auth.local')),
  loadDotEnv(join(root, '.env.local')),
  process.env,
)

const cloudUrl = normalizeUrl(
  env.MIRROR_CLOUD_SUPABASE_URL || env.VITE_SYNC_CLOUD_URL || '',
)
const cloudKey = String(
  env.MIRROR_CLOUD_SERVICE_ROLE_KEY || env.SUPABASE_CLOUD_SERVICE_ROLE_KEY || '',
).trim()

const localUrl = normalizeUrl(
  env.MIRROR_LOCAL_SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    '',
)
const localKey = String(
  env.MIRROR_LOCAL_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SERVICE_ROLE_KEY ||
    '',
).trim()

const mirrorPassword = String(env.MIRROR_LOCAL_PASSWORD || 'devpass123').trim()
if (mirrorPassword.length < 8) {
  console.error('MIRROR_LOCAL_PASSWORD must be at least 8 characters (GoTrue default).')
  process.exit(1)
}

if (!cloudUrl || !cloudKey) {
  console.error(
    'Missing MIRROR_CLOUD_SUPABASE_URL (or VITE_SYNC_CLOUD_URL) or MIRROR_CLOUD_SERVICE_ROLE_KEY.\n' +
      'Add them to `.env.mirror-auth.local` (gitignored). Hosted service role: Dashboard → Settings → API.',
  )
  process.exit(1)
}

if (!localUrl || !localKey) {
  console.error(
    'Missing MIRROR_LOCAL_SUPABASE_URL (or VITE_SUPABASE_URL) or MIRROR_LOCAL_SERVICE_ROLE_KEY.\n' +
      'Local service role: `npx supabase status -o env` → SERVICE_ROLE_KEY.',
  )
  process.exit(1)
}

if (!isLocalSupabaseUrl(localUrl)) {
  console.error(
    `Refusing: MIRROR_LOCAL_SUPABASE_URL must be local (127.0.0.1 / localhost / *.local). Got: ${localUrl}`,
  )
  process.exit(1)
}

if (normalizeUrl(cloudUrl) === normalizeUrl(localUrl)) {
  console.error('Refusing: cloud and local URLs are the same.')
  process.exit(1)
}

assertServiceRoleKey('MIRROR_CLOUD_SERVICE_ROLE_KEY', cloudKey)
assertServiceRoleKey('MIRROR_LOCAL_SERVICE_ROLE_KEY', localKey)

const cloudAdmin = createClient(cloudUrl, cloudKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const localAdmin = createClient(localUrl, localKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log(`Cloud: ${cloudUrl}`)
console.log(`Local: ${localUrl}`)
console.log(dryRun ? 'Mode: DRY RUN (no deletes or creates)\n' : 'Mode: APPLY\n')

const cloudUsers = await listAllAuthUsers(cloudAdmin, 'Cloud')
const localUsers = await listAllAuthUsers(localAdmin, 'Local')

console.log(`Hosted Auth users: ${cloudUsers.length}`)
console.log(`Local Auth users (before): ${localUsers.length}`)

if (dryRun) {
  console.log('\nDry run complete. Re-run with I_CONFIRM_WIPE_LOCAL_AUTH=YES to wipe local and mirror hosted users.')
  process.exit(0)
}

let deleted = 0
for (const u of localUsers) {
  const { error } = await localAdmin.auth.admin.deleteUser(u.id)
  if (error) {
    console.error(`deleteUser ${u.id}: ${error.message}`)
    process.exit(1)
  }
  deleted += 1
}
console.log(`Deleted ${deleted} local user(s).`)

let created = 0
let failed = 0
for (const u of cloudUsers) {
  const emailRaw = u.email != null ? String(u.email).trim() : ''
  const email = emailRaw || syntheticEmailForUser(u)
  const meta =
    u.user_metadata && typeof u.user_metadata === 'object' ? { ...u.user_metadata } : {}

  const { error } = await localAdmin.auth.admin.createUser({
    id: u.id,
    email,
    password: mirrorPassword,
    email_confirm: true,
    ban_duration: 'none',
    user_metadata: meta,
  })

  if (error) {
    console.error(`createUser ${u.id} (${email}): ${error.message}`)
    failed += 1
    continue
  }
  created += 1
}

console.log(`Created ${created} local user(s) from hosted (same ids).`)
if (failed > 0) {
  console.error(`Failed: ${failed} (see errors above).`)
  process.exit(1)
}

console.log(
  '\nDone. Sign in locally with each user’s email (or synthetic mirror-*@members.stockpilot.local) ' +
    'using the password you set as MIRROR_LOCAL_PASSWORD (default devpass123).',
)
console.log('Then run **Admin → Data sync** to pull `profiles` and inventory from the host if needed.')
