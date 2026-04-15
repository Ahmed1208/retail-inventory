/**
 * Runs `supabase db push` against the Postgres `db` service from the official
 * self-hosted Docker Compose stack (root `docker-compose.yml` + `.env`).
 *
 * Why not `127.0.0.1:5432`? That port is Supavisor (pooler). With the default
 * `POOLER_TENANT_ID=your-tenant-id` you get "Tenant or user not found". The
 * pooler is for app traffic; migrations should hit Postgres directly (`db:5432`
 * on the compose network).
 *
 * Prereqs: Docker stack up (`docker compose up -d`). Optional dry-run:
 *   DRY_RUN=1 npm run db:push:docker-compose
 *
 * Override network if yours differs (`docker network ls`):
 *   SUPABASE_DOCKER_NETWORK=my_network npm run db:push:docker-compose
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')

function loadEnv(path) {
  if (!existsSync(path)) {
    console.error(`Missing ${path} (copy from Supabase docker .env.example and run generate-keys).`)
    process.exit(1)
  }
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

const env = loadEnv(envPath)
const password = env.POSTGRES_PASSWORD
if (!password) {
  console.error('.env must define POSTGRES_PASSWORD')
  process.exit(1)
}

const db = env.POSTGRES_DB || 'postgres'
const dbUrl = `postgresql://postgres:${encodeURIComponent(password)}@db:5432/${db}`
const network = process.env.SUPABASE_DOCKER_NETWORK || 'supabase_default'
const dry = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

const inner = dry
  ? 'npx supabase db push --db-url "$SUPABASE_MIGRATE_URL" --dry-run --yes'
  : 'npx supabase db push --db-url "$SUPABASE_MIGRATE_URL" --yes'

const r = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--network',
    network,
    '-v',
    `${root}:/wd`,
    '-w',
    '/wd',
    '-e',
    'PGSSLMODE=disable',
    '-e',
    `SUPABASE_MIGRATE_URL=${dbUrl}`,
    'node:22-bookworm-slim',
    'bash',
    '-lc',
    inner,
  ],
  { stdio: 'inherit', encoding: 'utf8' },
)

process.exit(r.status ?? 1)
