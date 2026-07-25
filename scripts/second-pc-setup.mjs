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

console.log('\n=== 0/5 Generate local env if needed ===\n')
run('npm', ['run', 'generate:docker-env'])

needFile(
  '.env',
  'Env generation failed — run `npm run generate:docker-env` and check .env.docker.example.',
)

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
=== Done (standalone) ===

Open the app:
  npx serve -s dist -l 8080
Then browser: http://localhost:8080  (or http://THIS-PC-LAN-IP:8080 from other devices)

Sign in (after seed): username admin · password devpass123

Optional — connect this PC to hosted cloud later (mirror Auth + Data sync):
  see docs/SECOND_PC.md Part B

Firewall: allow ports 8080 (UI) and 8000 (API) if needed.
`)
