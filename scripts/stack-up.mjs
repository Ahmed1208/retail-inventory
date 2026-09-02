/**
 * Bring a stack up from nothing: env files, containers, schema, Edge Functions
 * and the local admin.
 *
 *   node scripts/stack-up.mjs           # development mode (`npm run dev`)
 *   node scripts/stack-up.mjs --shop    # shop mode        (`npm run shop:up`)
 *
 * Both modes are the same flow against a different env file, so a fresh clone on
 * any machine becomes a working app with one command and nothing to fill in by
 * hand. Ports and secrets are generated per folder, so nothing here is tied to a
 * particular machine and two checkouts can run side by side.
 *
 * Every step is idempotent, and the slow ones (migrations, functions, seed) run
 * only when the database has no schema yet, so a normal start stays fast.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from './lib/secondPcDocker.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

const shop = process.argv.slice(2).includes('--shop')
const label = shop ? 'shop:up' : 'dev:up'
const envFile = shop ? '.env.docker.shop' : '.env'
/** Every `docker compose` call must name the stack's env file, or it reads `.env`. */
const compose = shop ? ['compose', '--env-file', envFile] : ['compose']
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { stdio: 'inherit', shell: false })
  if (r.status !== 0) {
    console.error(`\n[${label}] Failed: ${cmd} ${argv.join(' ')}\n`)
    process.exit(r.status ?? 1)
  }
}

const tryRun = (cmd, argv) => spawnSync(cmd, argv, { stdio: 'inherit', shell: false })
const capture = (cmd, argv) => spawnSync(cmd, argv, { encoding: 'utf8' })
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

if (capture('docker', ['info']).status !== 0) {
  console.error(
    `\n[${label}] Docker is not running. Start Docker Desktop, then run this again.\n`,
  )
  process.exit(1)
}

// `--ensure` creates the env files when missing and otherwise leaves the ports
// alone: Docker keeps listening on a stopped stack's ports, so repairing them on
// every start would walk the whole stack one port higher each time.
run(npm, [
  'run',
  'generate:docker-env',
  '--',
  ...(shop ? ['--shop-env', '--ensure'] : ['--ensure']),
])

console.log(`\n[${label}] Starting containers…\n`)
if (tryRun('docker', [...compose, 'up', '-d']).status !== 0) {
  console.log(`\n[${label}] Compose failed — reassigning free host ports, retrying…\n`)
  run(npm, ['run', 'generate:docker-env', '--', ...(shop ? ['--shop-env'] : [])])
  run('docker', [...compose, 'up', '-d', '--force-recreate'])
}

process.stdout.write(`[${label}] Waiting for the database`)
let ready = false
for (let i = 0; i < 90 && !ready; i++) {
  ready =
    capture('docker', [...compose, 'exec', '-T', 'db', 'pg_isready', '-U', 'postgres'])
      .status === 0
  if (!ready) {
    process.stdout.write('.')
    sleep(1000)
  }
}
console.log(ready ? ' ready.' : '')
if (!ready) {
  console.error(
    `\n[${label}] The database did not become ready. Check: docker ${compose.join(' ')} logs db\n`,
  )
  process.exit(1)
}

const psql = (...argv) =>
  capture('docker', [...compose, 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'postgres', ...argv])

const hasSchema =
  psql('-tAc', "select to_regclass('public.profiles') is not null").stdout?.trim() === 't'

if (!hasSchema) {
  console.log(`\n[${label}] Empty database — applying migrations (first run is slow)…\n`)
  run(npm, [
    'run',
    'db:push:docker-compose',
    ...(shop ? ['--', '--env-file', envFile] : []),
  ])

  // Both stacks mount ./volumes/functions, so this serves either one.
  console.log(`\n[${label}] Syncing Edge Functions into volumes/…\n`)
  run(npm, ['run', 'functions:sync:docker'])
  tryRun('docker', [...compose, 'restart', 'functions'])

  console.log(`\n[${label}] Seeding the local admin…\n`)
  const seed = spawnSync(
    'docker',
    [...compose, 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'postgres',
     '-v', 'ON_ERROR_STOP=1', '-f', '-'],
    {
      input: readFileSync(join(root, 'supabase', 'seed.sql')),
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  )
  if (seed.status !== 0) {
    console.error(`\n[${label}] Seeding failed.\n`)
    process.exit(seed.status ?? 1)
  }
}

const env = existsSync(join(root, envFile))
  ? parseEnv(readFileSync(join(root, envFile), 'utf8'))
  : {}
console.log(`\n[${label}] Supabase API: http://127.0.0.1:${env.KONG_HTTP_PORT || '8000'}`)
if (!hasSchema) {
  console.log(`[${label}] Sign in with username \`admin\` and password \`devpass123\`.`)
}
if (shop) {
  console.log(`[${label}] Build the shop SPA with: npm run build:shop`)
}
console.log('')
