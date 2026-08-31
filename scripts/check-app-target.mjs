/**
 * Exercises writeProductionLocal() in generate-docker-env.mjs against a throwaway
 * project root, so the real .env / .env.production.local are never touched.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const sandbox = join(repo, '.tmp', 'gen-sandbox')
const KONG = 8931
const URL = `http://127.0.0.1:${KONG}`

rmSync(sandbox, { recursive: true, force: true })
mkdirSync(join(sandbox, 'scripts'), { recursive: true })
cpSync(
  join(repo, 'scripts', 'generate-docker-env.mjs'),
  join(sandbox, 'scripts', 'generate-docker-env.mjs'),
)
cpSync(join(repo, '.env.docker.example'), join(sandbox, '.env.docker.example'))
writeFileSync(
  join(sandbox, '.env'),
  [
    'COMPOSE_PROJECT_NAME=sandboxproj',
    'ANON_KEY=sandbox-anon-key',
    `KONG_HTTP_PORT=${KONG}`,
    'KONG_HTTPS_PORT=8932',
    'POSTGRES_HOST_PORT=8933',
    'POOLER_HOST_PORT_TRANSACTION=8934',
    'STOCKPILOT_UI_PORT=8935',
  ].join('\n') + '\n',
)

const prodLocal = join(sandbox, '.env.production.local')
const run = () => {
  const r = spawnSync(
    process.execPath,
    [join(sandbox, 'scripts', 'generate-docker-env.mjs')],
    { encoding: 'utf8' },
  )
  assert.equal(r.status, 0, `script failed:\n${r.stdout}\n${r.stderr}`)
  return r.stdout
}

// 1. Legacy install: file predates VITE_APP_TARGET and carries a hand-added key.
writeFileSync(
  prodLocal,
  `VITE_SUPABASE_URL=${URL}\nVITE_SUPABASE_ANON_KEY=sandbox-anon-key\nVITE_SYNC_CLOUD_URL=https://hand-added.supabase.co\n`,
)
run()
let text = readFileSync(prodLocal, 'utf8')
assert.match(text, /^VITE_APP_TARGET=shop$/m, 'flag must be appended')
assert.match(
  text,
  /VITE_SYNC_CLOUD_URL=https:\/\/hand-added\.supabase\.co/,
  'hand-added keys must survive the migration',
)

// 2. Same file with no trailing newline must not glue lines together.
writeFileSync(
  prodLocal,
  `VITE_SUPABASE_URL=${URL}\nVITE_SUPABASE_ANON_KEY=sandbox-anon-key`,
)
run()
text = readFileSync(prodLocal, 'utf8')
assert.match(text, /^VITE_APP_TARGET=shop$/m, 'flag needs its own line')
assert.match(text, /^VITE_SUPABASE_ANON_KEY=sandbox-anon-key$/m, 'anon key intact')

// 3. Idempotent: a second run must not duplicate the flag.
run()
text = readFileSync(prodLocal, 'utf8')
assert.equal(
  text.match(/^VITE_APP_TARGET=shop$/gm).length,
  1,
  'flag must not be duplicated',
)

// 4. Fresh install: generated from scratch already carries the flag.
rmSync(prodLocal)
run()
text = readFileSync(prodLocal, 'utf8')
assert.match(text, /^VITE_APP_TARGET=shop$/m, 'fresh file must carry the flag')
assert.match(text, new RegExp(`^VITE_SUPABASE_URL=${URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))

rmSync(sandbox, { recursive: true, force: true })
console.log('generate-docker-env VITE_APP_TARGET check OK (4 cases)')
