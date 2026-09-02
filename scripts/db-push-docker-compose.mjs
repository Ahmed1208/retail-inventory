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
 * The first run on a machine spends a few minutes pulling the Supabase CLI into
 * the shared `stockpilot-npm-cache` volume; later runs start in seconds.
 *
 * After restoring a database from another install, its migration history can
 * already contain entries that sort *after* files this download still has to
 * apply. The CLI refuses that ordering unless you ask for it:
 *   INCLUDE_ALL=1 npm run db:push:docker-compose
 *
 * Override network if yours differs (`docker network ls`):
 *   SUPABASE_DOCKER_NETWORK=my_network npm run db:push:docker-compose
 *
 * A developer checkout runs two stacks; pick the shop one with:
 *   npm run db:push:docker-compose -- --env-file .env.docker.shop
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Which stack to migrate. A developer checkout runs two, so the shop one is
 * selected with `--env-file .env.docker.shop` (works on every platform) or the
 * `ENV_FILE` variable.
 */
function envFileArg() {
  const argv = process.argv.slice(2)
  const i = argv.indexOf('--env-file')
  if (i !== -1 && argv[i + 1]) return argv[i + 1]
  const inline = argv.find((a) => a.startsWith('--env-file='))
  return inline ? inline.slice('--env-file='.length) : ''
}

const envPath = join(root, envFileArg() || process.env.ENV_FILE || '.env')

function loadEnv(path) {
  if (!existsSync(path)) {
    console.error(`Missing ${path} — run \`npm run generate:docker-env\` to create it.`)
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
const projectName = (env.COMPOSE_PROJECT_NAME || 'stockpilot').trim() || 'stockpilot'
const network =
  process.env.SUPABASE_DOCKER_NETWORK ||
  `${projectName}_default`
const dry = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'
const includeAll =
  process.env.INCLUDE_ALL === '1' || process.env.INCLUDE_ALL === 'true'

console.log(`[db:push:docker-compose] Using Docker network: ${network}`)
if (includeAll) {
  console.log('[db:push:docker-compose] Applying out-of-order migrations (--include-all).')
}

// Shared by every stack on this machine, so a shop install started after a
// developer checkout reuses the CLI the checkout already pulled.
const NPM_CACHE_VOLUME = 'stockpilot-npm-cache'

const flags = ['--db-url "$SUPABASE_MIGRATE_URL"', '--yes']
if (dry) flags.push('--dry-run')
if (includeAll) flags.push('--include-all')
const inner = `npx supabase db push ${flags.join(' ')}`

const r = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--network',
    network,
    '-v',
    `${root}:/wd`,
    // Without this the throwaway container re-downloads ~110MB of Supabase CLI
    // every run. It cannot be the host cache: that holds the darwin/windows
    // build, and this container needs the linux one.
    '-v',
    `${NPM_CACHE_VOLUME}:/root/.npm`,
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
