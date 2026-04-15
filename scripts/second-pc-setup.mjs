/**
 * Second PC / shop — one command after you copy the repo + env files.
 *
 * Usage (from repo root):
 *   npm run second-pc:setup
 *   npm run second-pc:setup -- --with-seed
 *   npm run second-pc:setup -- --no-build
 *
 * Prerequisites: Docker + Node on PATH; `.env` next to `docker-compose.yml`.
 * Recommended: `.env.cloud.local` (sync), `.env.production.local` (VITE_SUPABASE_* for this PC).
 */
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const withSeed = args.has('--with-seed')
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
needFile('.env', 'Copy root .env from your first PC or generate from Supabase docker .env.example + utils/generate-keys.sh.')
needFile('package.json', '')

if (!existsSync(join(root, '.env.production.local'))) {
  console.warn(
    '\n[warn] No .env.production.local — copy .env.shop.example → .env.production.local and set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (Kong on this PC).\n',
  )
}
if (!existsSync(join(root, '.env.cloud.local'))) {
  console.warn(
    '\n[warn] No .env.cloud.local — Admin → Data sync will not work until you add hosted VITE_SUPABASE_* (see .env.cloud.example).\n',
  )
}

console.log('\n=== 1/5 Docker Compose up ===\n')
run('docker', ['compose', 'up', '-d'])

console.log('\n=== 2/5 npm install ===\n')
run('npm', ['install'])

console.log('\n=== 3/5 Database migrations (StockPilot) ===\n')
run('npm', ['run', 'db:push:docker-compose'])

console.log('\n=== 4/5 Edge Functions → volumes + restart ===\n')
run('npm', ['run', 'functions:sync:docker'])
run('docker', ['compose', 'restart', 'functions'])

if (withSeed) {
  console.log('\n=== Optional seed.sql ===\n')
  const seed = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '-'],
    {
      cwd: root,
      input: readFileSync(join(root, 'supabase', 'seed.sql')),
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  )
  if (seed.status !== 0) process.exit(seed.status ?? 1)
}

if (!noBuild) {
  console.log('\n=== 5/5 Production build (Vite) ===\n')
  run('npm', ['run', 'build'])
}

console.log(`
=== Done ===

If operators must match hosted Auth (same user ids), configure .env.mirror-auth.local then run:
  npm run mirror:cloud-auth-to-local -- --dry-run
  I_CONFIRM_WIPE_LOCAL_AUTH=YES npm run mirror:cloud-auth-to-local
Then Admin → Data sync once. See docs/SECOND_PC.md

Open the app:
  npx serve -s dist -l 8080
Then browser: http://localhost:8080  (or http://THIS-PC-LAN-IP:8080 from other devices)

Firewall: allow ports 8080 (UI) and 8000 (API) if needed.

More detail: docs/SECOND_PC.md
`)
