/**
 * Runs scripts/sql/verify-returns.sql against the Postgres `db` service of the
 * Docker Compose stack. The SQL asserts that confirming a return puts stock back
 * in and that over-returns are rejected; it rolls back, so nothing is left behind.
 *
 * Prereq: stack up (`docker compose up -d`) with migrations applied
 * (`npm run db:push:docker-compose`).
 *
 * Pass --with-migration to prepend 20260902120000_sales_returns.sql inside the same
 * rolled-back transaction. That checks the migration itself against the live schema
 * without applying it, which is useful before a real `db push`.
 *
 * Usage:
 *   node scripts/verify-returns.mjs
 *   node scripts/verify-returns.mjs --with-migration
 *   node scripts/verify-returns.mjs --env-file .env.docker.shop
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function envFileArg() {
  const argv = process.argv.slice(2)
  const i = argv.indexOf('--env-file')
  if (i !== -1 && argv[i + 1]) return argv[i + 1]
  const inline = argv.find((a) => a.startsWith('--env-file='))
  return inline ? inline.slice('--env-file='.length) : ''
}

const envFile = envFileArg() || process.env.ENV_FILE || '.env'
const envPath = join(root, envFile)

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}. Run \`npm run generate:docker-env\` first.`)
  process.exit(1)
}

const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const db = env.POSTGRES_DB || 'postgres'
const checks = readFileSync(
  join(root, 'scripts', 'sql', 'verify-returns.sql'),
  'utf8'
)

// The checks file already opens and rolls back its own transaction; when the migration
// is included it has to run inside that same transaction so it rolls back too.
const sql = process.argv.includes('--with-migration')
  ? [
      'BEGIN;',
      readFileSync(
        join(
          root,
          'supabase',
          'migrations',
          '20260902120000_sales_returns.sql'
        ),
        'utf8'
      ),
      checks.replace(/^BEGIN;$/m, '').replace(/^ROLLBACK;$/m, ''),
      'ROLLBACK;',
    ].join('\n')
  : checks

const result = spawnSync(
  'docker',
  [
    'compose',
    '--env-file',
    envFile,
    'exec',
    '-T',
    'db',
    'psql',
    '-U',
    'postgres',
    '-d',
    db,
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    '-',
  ],
  { cwd: root, input: sql, encoding: 'utf8', env: { ...process.env } }
)

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

if (result.error) {
  console.error('Could not run docker compose. Is Docker running?')
  process.exit(1)
}

if (result.status !== 0) {
  console.error('\nverify-returns FAILED.')
  process.exit(result.status ?? 1)
}

console.log('\nverify-returns passed.')
