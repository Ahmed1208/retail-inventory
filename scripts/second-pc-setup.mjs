/**
 * Second PC / shop — standalone setup (no cloud env required).
 * Windows / macOS / Linux: Start StockPilot (.bat / .command / .sh) calls this.
 *
 * Usage (from repo root):
 *   npm run second-pc:setup
 *   npm run second-pc:setup -- --no-seed
 *   npm run second-pc:setup -- --no-build
 *   npm run second-pc:setup -- --fresh     # wipe local DB first, then setup
 *
 * Always auto-cleans this folder’s Docker stack + leftover shop containers from
 * old unzip folders so you do not need a separate cleanup step.
 *
 * Prerequisites: Docker + Node on PATH.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { cleanShopDocker, parseEnv } from './lib/secondPcDocker.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const noSeed = args.has('--no-seed')
const withSeed = !noSeed
const noBuild = args.has('--no-build')
const fresh = args.has('--fresh')

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...opts,
  })
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
  return r
}

function runAllowFail(cmd, argv) {
  return spawnSync(cmd, argv, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  })
}

function needFile(rel, hint) {
  const p = join(root, rel)
  if (!existsSync(p)) {
    console.error(`\nMissing ${rel}. ${hint}\n`)
    process.exit(1)
  }
}

process.chdir(root)

needFile('docker-compose.yml', 'Run from the retail-inventory repo root.')
needFile('package.json', '')

console.log('\n=== 0a/5 Auto-clean Docker leftovers (safe to re-run) ===\n')
console.log(
  '[info] Removes this folder’s stack, other old sp-retail-inventory-* downloads,\n' +
    '       and hash_supabase-* rename leftovers. Does not touch a healthy\n' +
    '       `npx supabase start` stack unless you pass --fresh with purge later.\n',
)
cleanShopDocker({
  root,
  wipeDb: fresh,
  allStockpilot: true,
  purgeHashOrphans: true,
  purgeOrphanSupabase: false,
})
if (fresh) {
  console.log('[info] --fresh: local volumes/db/data was wiped.\n')
}

console.log('\n=== 0b/5 Generate local env if needed ===\n')
run('npm', ['run', 'generate:docker-env'])

needFile(
  '.env',
  'Env generation failed — run `npm run generate:docker-env` and check .env.docker.example.',
)

let dockerEnv = parseEnv(readFileSync(join(root, '.env'), 'utf8'))
const uiPort = (dockerEnv.STOCKPILOT_UI_PORT || '8080').trim() || '8080'
const kongPort = (dockerEnv.KONG_HTTP_PORT || '8000').trim() || '8000'
const projectName = (dockerEnv.COMPOSE_PROJECT_NAME || 'stockpilot').trim()

if (!existsSync(join(root, '.env.production.local'))) {
  console.warn(
    '\n[warn] No .env.production.local after generate — Vite build may miss VITE_SUPABASE_*.\n',
  )
}

if (!existsSync(join(root, '.env.cloud.local'))) {
  console.log(
    '\n[info] No .env.cloud.local — fine for standalone. Add it later only if you want Admin → Data sync with hosted cloud (see docs/SECOND_PC.md Part B).\n',
  )
}

console.log(`\n[info] Isolated Compose project: ${projectName}\n`)

function composeUp(forceRecreate) {
  const argv = ['compose', 'up', '-d']
  if (forceRecreate) argv.push('--force-recreate')
  return runAllowFail('docker', argv)
}

console.log('\n=== 1/5 Docker Compose up ===\n')
{
  let up = composeUp(false)
  if (up.status !== 0) {
    console.warn(
      '\n[warn] Compose up failed — reassigning free ports and retrying…\n',
    )
    run('npm', ['run', 'generate:docker-env'])
    up = composeUp(true)
  }
  if (up.status !== 0) {
    console.warn(
      '\n[warn] Compose still failing — wiping local DB data once and retrying (keeps .env).\n' +
        '        Next time you can skip straight to: npm run second-pc:fresh\n',
    )
    cleanShopDocker({
      root,
      wipeDb: true,
      allStockpilot: true,
      purgeHashOrphans: true,
      purgeOrphanSupabase: false,
    })
    run('npm', ['run', 'generate:docker-env'])
    up = composeUp(true)
  }
  if (up.status !== 0) {
    console.error(
      '\n[error] Docker Compose could not start.\n' +
        'Try: npm run second-pc:fresh\n' +
        'Or cleanup with --purge-orphan-supabase if old supabase-* names block you\n' +
        '(only if you do not need `npx supabase start` on this machine).\n',
    )
    process.exit(up.status ?? 1)
  }
}

dockerEnv = parseEnv(readFileSync(join(root, '.env'), 'utf8'))
const uiPortFinal = (dockerEnv.STOCKPILOT_UI_PORT || uiPort).trim() || uiPort
const kongPortFinal = (dockerEnv.KONG_HTTP_PORT || kongPort).trim() || kongPort
const projectNameFinal =
  (dockerEnv.COMPOSE_PROJECT_NAME || projectName).trim() || projectName

console.log('\n=== 2/5 npm install ===\n')
run('npm', ['install'])

console.log('\n=== 3/5 Database migrations (StockPilot) ===\n')
run('npm', ['run', 'db:push:docker-compose'])

console.log('\n=== 4/5 Edge Functions → volumes + restart ===\n')
run('npm', ['run', 'functions:sync:docker'])
run('docker', ['compose', 'restart', 'functions'])

if (withSeed) {
  console.log('\n=== Seed local admin (seed.sql) ===\n')
  const seed = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      '-',
    ],
    {
      cwd: root,
      input: readFileSync(join(root, 'supabase', 'seed.sql')),
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  )
  if (seed.status !== 0) process.exit(seed.status ?? 1)

  console.log('\n=== Verify seeded admin (profiles.is_admin) ===\n')
  const verify = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-tAc',
      `SELECT CASE WHEN EXISTS (
         SELECT 1
         FROM public.profiles p
         JOIN auth.users u ON u.id = p.id
         WHERE lower(u.email::text) = lower('admin@members.stockpilot.local')
           AND p.is_admin = true
           AND lower(p.username) = 'admin'
       ) THEN 'ok' ELSE 'missing' END`,
    ],
    { cwd: root, encoding: 'utf8' },
  )
  const verifyOut = String(verify.stdout || '').trim()
  if (verify.status !== 0 || verifyOut !== 'ok') {
    console.error(
      '\n[error] Seeded admin profile missing or is_admin=false.\n' +
        'Control / Admin / Notifications / Data sync will not appear until profiles.is_admin is true.\n' +
        'Try: npm run second-pc:fresh\n',
    )
    process.exit(1)
  }
  console.log('Admin profile OK (username admin, is_admin=true).')
} else {
  console.log('\n=== Skipping seed (--no-seed) ===\n')
}

if (!noBuild) {
  console.log('\n=== 5/5 Production build (Vite) ===\n')
  run('npm', ['run', 'build'])
} else {
  console.log('\n=== Skipping build (--no-build) ===\n')
}

try {
  writeFileSync(
    join(root, '.stockpilot-ready'),
    `${new Date().toISOString()}\nproject=${projectNameFinal}\nkong=${kongPortFinal}\nui=${uiPortFinal}\n`,
  )
} catch {
  /* ignore */
}

console.log(`
=== Done (standalone, isolated stack) ===

Compose project: ${projectNameFinal}

Open the app:
  npx serve -s dist -l ${uiPortFinal}
Then browser: http://localhost:${uiPortFinal}

API (Kong): http://127.0.0.1:${kongPortFinal}

Sign in: admin / devpass123

Remember only one command next time (it auto-cleans leftovers):
  npm run second-pc:setup

Full reset if something is broken:
  npm run second-pc:fresh

Optional cloud: docs/SECOND_PC.md Part B
`)
