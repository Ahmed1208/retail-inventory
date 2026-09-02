/**
 * Exercises writeProductionLocal() in generate-docker-env.mjs against a throwaway
 * project root, so the real .env / .env.local are never touched.
 *
 * A shop install keeps its SPA env in `.env.production.local`; a developer
 * checkout keeps it in `.env.local`, which Vite loads in every mode.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const sandbox = join(repo, '.tmp', 'gen-sandbox')
const KONG = 8931
const URL = `http://127.0.0.1:${KONG}`

rmSync(sandbox, { recursive: true, force: true })
mkdirSync(join(sandbox, 'scripts', 'lib'), { recursive: true })
cpSync(
  join(repo, 'scripts', 'generate-docker-env.mjs'),
  join(sandbox, 'scripts', 'generate-docker-env.mjs'),
)
cpSync(
  join(repo, 'scripts', 'lib', 'secondPcDocker.mjs'),
  join(sandbox, 'scripts', 'lib', 'secondPcDocker.mjs'),
)
cpSync(join(repo, '.env.docker.example'), join(sandbox, '.env.docker.example'))

const writeEnv = (lines) =>
  writeFileSync(join(sandbox, '.env'), lines.join('\n') + '\n')

writeEnv([
  'COMPOSE_PROJECT_NAME=sandboxproj',
  'ANON_KEY=sandbox-anon-key',
  `KONG_HTTP_PORT=${KONG}`,
  'KONG_HTTPS_PORT=8932',
  'POSTGRES_HOST_PORT=8933',
  'POOLER_HOST_PORT_TRANSACTION=8934',
  'STOCKPILOT_UI_PORT=8935',
])

const prodLocal = join(sandbox, '.env.production.local')
const devLocal = join(sandbox, '.env.local')
const run = (...args) => {
  const r = spawnSync(
    process.execPath,
    [join(sandbox, 'scripts', 'generate-docker-env.mjs'), ...args],
    { encoding: 'utf8' },
  )
  assert.equal(r.status, 0, `script failed:\n${r.stdout}\n${r.stderr}`)
  return r.stdout
}

const readEnvFile = (p) =>
  Object.fromEntries(
    readFileSync(p, 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  )

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

// --- Developer checkouts: same script, opposite outcome ---
mkdirSync(join(sandbox, '.git'), { recursive: true })
const DEV_KONG = 18931
const DEV_URL = `http://127.0.0.1:${DEV_KONG}`
writeEnv([
  'COMPOSE_PROJECT_NAME=dev-sandbox-aaa111',
  'ANON_KEY=sandbox-anon-key',
  `KONG_HTTP_PORT=${DEV_KONG}`,
  'KONG_HTTPS_PORT=18932',
  'POSTGRES_HOST_PORT=18933',
  'POOLER_HOST_PORT_TRANSACTION=18934',
  'STOCKPILOT_UI_PORT=18935',
])

// 5. A fresh checkout must never be marked as a shop build, or `/` would skip
//    the public landing page. It writes `.env.local`, never a mode file.
rmSync(prodLocal, { force: true })
rmSync(devLocal, { force: true })
run()
text = readFileSync(devLocal, 'utf8')
assert.doesNotMatch(text, /^VITE_APP_TARGET=/m, 'a checkout is not a shop build')
assert.match(text, new RegExp(`^VITE_SUPABASE_URL=${DEV_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))
assert.equal(
  existsSync(prodLocal),
  false,
  'a mode file would outrank .env.local and silently change the backend',
)

// 6. A checkout that was once run through shop setup loses the stale marker,
//    and the CLI secrets kept alongside it are not collateral damage.
writeFileSync(
  devLocal,
  `SUPABASE_DB_PASSWORD=keep-me\nVITE_SUPABASE_URL=${DEV_URL}\nVITE_SUPABASE_ANON_KEY=sandbox-anon-key\nVITE_APP_TARGET=shop\n`,
)
run()
text = readFileSync(devLocal, 'utf8')
assert.doesNotMatch(text, /^VITE_APP_TARGET=/m, 'stale shop marker must be removed')
assert.match(
  text,
  /^SUPABASE_DB_PASSWORD=keep-me$/m,
  'removing the marker must not drop other keys',
)

// 7. A checkout still on shop ports is moved into the dev block, so a shop
//    install on the same PC can never take the ports it wants back.
writeEnv([
  'COMPOSE_PROJECT_NAME=stockpilot',
  'ANON_KEY=sandbox-anon-key',
  'KONG_HTTP_PORT=8000',
  'KONG_HTTPS_PORT=8443',
  'POSTGRES_HOST_PORT=5432',
  'POOLER_HOST_PORT_TRANSACTION=6543',
  'STOCKPILOT_UI_PORT=8080',
])
run()
const devEnv = readEnvFile(join(sandbox, '.env'))
assert.match(devEnv.COMPOSE_PROJECT_NAME, /^dev-/, 'checkout needs its own project name')
for (const key of [
  'KONG_HTTP_PORT',
  'KONG_HTTPS_PORT',
  'POSTGRES_HOST_PORT',
  'POOLER_HOST_PORT_TRANSACTION',
  'STOCKPILOT_UI_PORT',
]) {
  assert.ok(
    Number(devEnv[key]) >= 10000,
    `${key}=${devEnv[key]} must be out of the shop range`,
  )
}
assert.equal(devEnv.SITE_URL, `http://127.0.0.1:${devEnv.KONG_HTTP_PORT}`)

// The SPA env must follow that reallocation. `npm run dev` runs this script on
// every start, so a drifting URL would serve a UI pointed at a dead port — and
// rewriting the file must not cost the CLI secrets stored beside it.
text = readFileSync(devLocal, 'utf8')
assert.match(
  text,
  new RegExp(`^VITE_SUPABASE_URL=http://127\\.0\\.0\\.1:${devEnv.KONG_HTTP_PORT}$`, 'm'),
  'the SPA env must follow the reallocated Kong port',
)
assert.match(text, /^SUPABASE_DB_PASSWORD=keep-me$/m, 'a port change must not wipe secrets')

// --- The shop stack a checkout runs beside its dev stack ---
const shopEnvPath = join(sandbox, '.env.docker.shop')
const shopLocal = join(sandbox, '.env.shop.local')
run('--shop-env')
const shopEnv = readEnvFile(shopEnvPath)

// 8. The two stacks must not collide on Compose project or host ports.
assert.match(shopEnv.COMPOSE_PROJECT_NAME, /^sp-/, 'the shop half is a shop')
assert.notEqual(shopEnv.COMPOSE_PROJECT_NAME, devEnv.COMPOSE_PROJECT_NAME)
const PORT_KEYS = [
  'KONG_HTTP_PORT',
  'KONG_HTTPS_PORT',
  'POSTGRES_HOST_PORT',
  'POOLER_HOST_PORT_TRANSACTION',
  'STOCKPILOT_UI_PORT',
]
for (const key of PORT_KEYS) {
  assert.ok(Number(shopEnv[key]) < 10000, `${key}=${shopEnv[key]} belongs to the shop block`)
}
const overlap = PORT_KEYS.map((k) => shopEnv[k]).filter((p) =>
  PORT_KEYS.some((k) => devEnv[k] === p),
)
assert.deepEqual(overlap, [], 'the two stacks must never publish the same host port')

// 9. The important one: two Postgres containers sharing one PGDATA would
//    corrupt it, so the shop stack must point somewhere else entirely.
assert.equal(shopEnv.DB_DATA_DIR, './volumes-shop/db/data')
assert.equal(shopEnv.STORAGE_DIR, './volumes-shop/storage')
assert.notEqual(shopEnv.DB_DATA_DIR, devEnv.DB_DATA_DIR ?? './volumes/db/data')

// 10. Only the shop build is marked as a shop, and the dev build is untouched.
assert.match(readFileSync(shopLocal, 'utf8'), /^VITE_APP_TARGET=shop$/m)
assert.doesNotMatch(readFileSync(devLocal, 'utf8'), /^VITE_APP_TARGET=/m)
assert.match(
  readFileSync(shopLocal, 'utf8'),
  new RegExp(`^VITE_SUPABASE_URL=http://127\\.0\\.0\\.1:${shopEnv.KONG_HTTP_PORT}$`, 'm'),
)
assert.equal(
  readEnvFile(join(sandbox, '.env')).COMPOSE_PROJECT_NAME,
  devEnv.COMPOSE_PROJECT_NAME,
  'generating the shop env must not disturb the dev env',
)

// 11. A shop env file that lost its data dir is repaired rather than left to
//     mount the checkout's own database.
writeFileSync(
  shopEnvPath,
  readFileSync(shopEnvPath, 'utf8').replace(/^DB_DATA_DIR=.*\n/m, ''),
)
run('--shop-env')
assert.equal(
  readEnvFile(shopEnvPath).DB_DATA_DIR,
  './volumes-shop/db/data',
  'a missing DB_DATA_DIR must be restored',
)

// 13. `npm run dev` passes --ensure. Docker Desktop keeps listening on a
//     stopped stack's ports, so without this a routine start would read its own
//     ports as taken and walk the stack one port higher every time.
const beforePorts = readEnvFile(join(sandbox, '.env'))
const blocker = createServer()
await new Promise((res, rej) => {
  blocker.on('error', rej)
  blocker.listen(Number(beforePorts.KONG_HTTP_PORT), '0.0.0.0', res)
})
run('--ensure')
assert.equal(
  readEnvFile(join(sandbox, '.env')).KONG_HTTP_PORT,
  beforePorts.KONG_HTTP_PORT,
  '--ensure must leave a taken port alone and let Compose report the clash',
)
// A deliberate repair run still moves off it.
run()
assert.notEqual(
  readEnvFile(join(sandbox, '.env')).KONG_HTTP_PORT,
  beforePorts.KONG_HTTP_PORT,
  'a repair run must move off a port that is genuinely taken',
)
await new Promise((res) => blocker.close(res))

// 12. `--shop-env` is only for checkouts; a real shop install already is one.
rmSync(join(sandbox, '.git'), { recursive: true, force: true })
const refused = spawnSync(
  process.execPath,
  [join(sandbox, 'scripts', 'generate-docker-env.mjs'), '--shop-env'],
  { encoding: 'utf8' },
)
assert.notEqual(refused.status, 0, '--shop-env must refuse outside a checkout')

rmSync(sandbox, { recursive: true, force: true })
console.log('generate-docker-env VITE_APP_TARGET check OK (13 cases)')
