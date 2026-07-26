/**
 * Second PC / shop — standalone setup (no cloud env required).
 *
 * Usage (from repo root):
 *   npm run second-pc:setup
 *   npm run second-pc:setup -- --no-seed
 *   npm run second-pc:setup -- --no-build
 *   npm run second-pc:setup -- --with-seed   # alias (seed is default)
 *
 * Prerequisites: Docker + Node on PATH.
 * If `.env` / `.env.production.local` are missing, they are generated automatically.
 * Cloud sync (`.env.cloud.local`, mirror-auth) is optional — see docs/SECOND_PC.md.
 */
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const noSeed = args.has('--no-seed')
const withSeed = !noSeed // default on; --with-seed kept as explicit alias
const noBuild = args.has('--no-build')

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

function parseEnv(text) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    out[t.slice(0, i).trim()] = t.slice(i + 1)
  }
  return out
}

process.chdir(root)

needFile('docker-compose.yml', 'Run from the retail-inventory repo root.')
needFile('package.json', '')

console.log('\n=== 0/5 Generate local env if needed ===\n')
run('npm', ['run', 'generate:docker-env'])

needFile(
  '.env',
  'Env generation failed — run `npm run generate:docker-env` and check .env.docker.example.',
)

const dockerEnv = parseEnv(readFileSync(join(root, '.env'), 'utf8'))
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

console.log('\n=== 1/5 Docker Compose up ===\n')
{
  let up = runAllowFail('docker', ['compose', 'up', '-d'])
  if (up.status !== 0) {
    console.warn(
      '\n[warn] Compose up failed (host port or container-name conflict). Reassigning free ports and retrying once.\n' +
        'If this persists, ensure docker-compose.yml has no fixed container_name values like supabase-imgproxy,\n' +
        'and that name: uses COMPOSE_PROJECT_NAME (see docs/SECOND_PC.md).\n',
    )
    run('npm', ['run', 'generate:docker-env'])
    up = runAllowFail('docker', [
      'compose',
      'up',
      '-d',
      '--force-recreate',
    ])
  }
  if (up.status !== 0) process.exit(up.status ?? 1)
}

// Re-read after possible port reassignment
const dockerEnvAfter = parseEnv(readFileSync(join(root, '.env'), 'utf8'))
const uiPortFinal = (dockerEnvAfter.STOCKPILOT_UI_PORT || uiPort).trim() || uiPort
const kongPortFinal =
  (dockerEnvAfter.KONG_HTTP_PORT || kongPort).trim() || kongPort
const projectNameFinal =
  (dockerEnvAfter.COMPOSE_PROJECT_NAME || projectName).trim() || projectName

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
        'Re-run seed or check migrations landed on this Compose project’s database.\n',
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

console.log(`
=== Done (standalone, isolated stack) ===

Compose project: ${projectNameFinal}
(Do not copy .env between folders — each download gets its own project name, ports, and DB.)

Open the app:
  npx serve -s dist -l ${uiPortFinal}
Then browser: http://localhost:${uiPortFinal}  (or http://THIS-PC-LAN-IP:${uiPortFinal} from other devices)

API (Kong): http://127.0.0.1:${kongPortFinal}

Sign in as username admin · password devpass123
(That admin account unlocks Control, Admin, Notifications, and Data sync in the sidebar.
 Members do not see those links. Data sync actions need Part B cloud env later.)

Optional — connect this PC to hosted cloud later (mirror Auth + Data sync):
  see docs/SECOND_PC.md Part B

Stop only this stack (from this folder): docker compose down

Firewall: allow ports ${uiPortFinal} (UI) and ${kongPortFinal} (API) if needed.
`)
