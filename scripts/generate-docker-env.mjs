/**
 * Generate the Docker Compose env plus the matching SPA env for this folder.
 *
 * Usage (from repo root):
 *   npm run generate:docker-env
 *   npm run generate:docker-env -- --shop-env   # second, shop stack in a checkout
 *
 * Runs on every `npm run dev`, so it must be idempotent: it creates the files
 * when missing and otherwise only repairs them. If the Compose env exists but
 * its host ports are taken (common when another Supabase stack uses 8000), it
 * reassigns free ports and updates both the Kong URLs and the SPA env so the
 * two never drift apart — secrets and COMPOSE_PROJECT_NAME are kept.
 *
 * Which files, by role:
 *   developer checkout  → `.env` + `.env.local`        (dev stack, `dev-…` ports)
 *   `--shop-env`        → `.env.docker.shop` + `.env.shop.local`  (shop mode)
 *   standalone shop PC  → `.env` + `.env.production.local`
 *
 * A checkout gets its own port block and is never marked as a shop build, so
 * the repo and a shop install can run side by side on one machine. The shop
 * stack keeps a separate database directory so the two never share PGDATA.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasLocalDbData, isDevCheckout } from './lib/secondPcDocker.mjs'

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const templatePath = join(root, '.env.docker.example')
const APP_TARGET_LINE = 'VITE_APP_TARGET=shop'

/**
 * The shop half of a checkout's pair. Named `.env.docker.shop` rather than
 * `.env.shop` because Vite already claims `.env.shop` for `--mode shop`.
 */
const shopEnv = process.argv.slice(2).includes('--shop-env')

/**
 * `npm run dev` passes this: create the env when missing, then get out of the
 * way. Without it the script also repairs host ports, which is right for an
 * install but wrong on every dev start — Docker Desktop keeps listening on a
 * stopped stack's ports, so a routine start would read its own ports as taken
 * and walk the whole stack one port higher each time.
 */
const ensureOnly = process.argv.slice(2).includes('--ensure')

if (shopEnv && !isDevCheckout(root)) {
  console.error(
    '\n--shop-env adds a second stack to a developer checkout. This folder is' +
      '\nalready a shop install, so its shop environment is the normal `.env`.\n',
  )
  process.exit(1)
}

// The shop stack is a shop even though it lives in a checkout, so it takes the
// shop project prefix, the shop port block and the shop build marker.
const isDev = !shopEnv && isDevCheckout(root)

const envPath = join(root, shopEnv ? '.env.docker.shop' : '.env')
/**
 * A developer checkout keeps its single SPA environment in `.env.local`, which
 * Vite loads in every mode. Writing a mode file such as `.env.production.local`
 * here would outrank it and silently point builds at a different backend.
 */
const productionLocalPath = join(
  root,
  shopEnv ? '.env.shop.local' : isDev ? '.env.local' : '.env.production.local',
)
const envName = basename(envPath)
const prodName = basename(productionLocalPath)

/**
 * Only set for the in-checkout shop stack. Two Postgres containers sharing one
 * PGDATA would corrupt it, so these must never be missing from that file.
 */
const SHOP_DATA_DIRS = {
  DB_DATA_DIR: './volumes-shop/db/data',
  STORAGE_DIR: './volumes-shop/storage',
}

const HOST_PORT_KEYS = [
  'KONG_HTTP_PORT',
  'KONG_HTTPS_PORT',
  'POSTGRES_HOST_PORT',
  'POOLER_HOST_PORT_TRANSACTION',
  'STOCKPILOT_UI_PORT',
]

/**
 * A shop takes the familiar ports; a developer checkout takes the same numbers
 * plus 10000. Allocation only ever searches 200 ports up from its own base, so
 * the two blocks can never meet: a shop can be installed while the dev stack is
 * stopped and still not take the ports it will want on next start.
 */
const DEV_PORT_OFFSET = 10000
const PORT_BASE = {
  kongHttp: 8000,
  kongHttps: 8443,
  postgres: 5432,
  pooler: 6543,
  ui: 8080,
}
const portBase = (name) => PORT_BASE[name] + (isDev ? DEV_PORT_OFFSET : 0)
/** Every dev port is above this; every shop port is below it. */
const DEV_PORT_FLOOR = DEV_PORT_OFFSET

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

/** HS256 JWT matching Supabase self-hosted generate-keys.sh payload shape. */
function signHs256Jwt(role, secret) {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 60 * 60 * 24 * 365 * 5 // ~5 years
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(
    `{"role":"${role}","iss":"supabase","iat":${iat},"exp":${exp}}`,
  )
  const data = `${header}.${payload}`
  const sig = b64url(createHmac('sha256', secret).update(data).digest())
  return `${data}.${sig}`
}

function genHex(bytes) {
  return randomBytes(bytes).toString('hex')
}

function genBase64(bytes) {
  return randomBytes(bytes).toString('base64')
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

function setEnvValue(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm')
  if (re.test(text)) {
    return text.replace(re, `${key}=${value}`)
  }
  return `${text.replace(/\s*$/, '')}\n${key}=${value}\n`
}

/** Compose-safe project name unique per absolute folder path. */
function composeProjectNameForRoot() {
  const base = basename(root)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'stockpilot'
  const hash = createHash('sha256').update(root).digest('hex').slice(0, 6)
  return `${isDev ? 'dev' : 'sp'}-${base}-${hash}`
}

/**
 * Probe like Docker host binds (`0.0.0.0`). Checking only 127.0.0.1 misses
 * ports already taken by other containers (e.g. supabase-kong on :8000).
 */
function canBindPort(port) {
  return new Promise((resolvePromise) => {
    const server = createServer()
    server.unref()
    server.on('error', () => resolvePromise(false))
    server.listen(port, '0.0.0.0', () => {
      server.close(() => resolvePromise(true))
    })
  })
}

/** Ports already published by any Docker container on this host. */
function dockerPublishedHostPorts() {
  /** @type {Set<number>} */
  const taken = new Set()
  const r = spawnSync('docker', ['ps', '--format', '{{.Ports}}'], {
    encoding: 'utf8',
  })
  if (r.status !== 0 || !r.stdout) return taken
  for (const line of r.stdout.split('\n')) {
    for (const m of line.matchAll(/(?:0\.0\.0\.0|\[::\]):(\d+)->/g)) {
      taken.add(Number(m[1]))
    }
  }
  return taken
}

async function isPortFree(port, dockerTaken) {
  if (dockerTaken.has(port)) return false
  return canBindPort(port)
}

async function findFreePort(preferred, used, dockerTaken) {
  for (let p = preferred; p < preferred + 200; p++) {
    if (used.has(p)) continue
    if (await isPortFree(p, dockerTaken)) {
      used.add(p)
      return p
    }
  }
  throw new Error(`Could not find a free port near ${preferred}`)
}

async function allocatePorts() {
  const used = new Set()
  const dockerTaken = dockerPublishedHostPorts()
  const kongHttp = await findFreePort(portBase('kongHttp'), used, dockerTaken)
  const kongHttps = await findFreePort(portBase('kongHttps'), used, dockerTaken)
  const postgresHost = await findFreePort(portBase('postgres'), used, dockerTaken)
  const poolerTxnHost = await findFreePort(portBase('pooler'), used, dockerTaken)
  const ui = await findFreePort(portBase('ui'), used, dockerTaken)
  return {
    KONG_HTTP_PORT: kongHttp,
    KONG_HTTPS_PORT: kongHttps,
    POSTGRES_HOST_PORT: postgresHost,
    POOLER_HOST_PORT_TRANSACTION: poolerTxnHost,
    STOCKPILOT_UI_PORT: ui,
  }
}

function kongUrl(port) {
  return `http://127.0.0.1:${port}`
}

function logIsolation(env) {
  const project = env.COMPOSE_PROJECT_NAME || 'stockpilot'
  const kong = env.KONG_HTTP_PORT || '8000'
  const ui = env.STOCKPILOT_UI_PORT || '8080'
  const role = isDev
    ? 'developer checkout'
    : shopEnv
      ? 'shop stack inside a checkout'
      : 'shop install'
  console.log(`[generate:docker-env] Role: ${role} (${envName})`)
  console.log(`[generate:docker-env] Compose project: ${project}`)
  if (shopEnv) {
    console.log(`[generate:docker-env] Database dir: ${SHOP_DATA_DIRS.DB_DATA_DIR}`)
  }
  console.log(
    `[generate:docker-env] Ports — Kong HTTP: ${kong}, Kong HTTPS: ${env.KONG_HTTPS_PORT || '8443'}, Postgres host: ${env.POSTGRES_HOST_PORT || '5432'}, UI: ${ui}`,
  )
  console.log(`[generate:docker-env] API URL: ${kongUrl(kong)}`)
}

/** Host ports already published by this Compose project (safe to keep). */
function publishedHostPortsForProject(projectName) {
  /** @type {Set<number>} */
  const owned = new Set()
  if (!projectName) return owned
  const r = spawnSync(
    'docker',
    [
      'ps',
      '--filter',
      `label=com.docker.compose.project=${projectName}`,
      '--format',
      '{{.Ports}}',
    ],
    { encoding: 'utf8' },
  )
  if (r.status !== 0 || !r.stdout) return owned
  for (const line of r.stdout.split('\n')) {
    for (const m of line.matchAll(/(?:0\.0\.0\.0|\[::\]):(\d+)->/g)) {
      owned.add(Number(m[1]))
    }
  }
  return owned
}

async function hostPortsNeedRealloc(env) {
  const project = (env.COMPOSE_PROJECT_NAME || '').trim()
  const owned = publishedHostPortsForProject(project)
  const dockerTaken = dockerPublishedHostPorts()
  for (const key of HOST_PORT_KEYS) {
    const raw = (env[key] || '').trim()
    if (!raw) continue
    const port = Number(raw)
    if (!Number.isFinite(port) || port <= 0) continue
    if (owned.has(port)) continue
    if (!(await isPortFree(port, dockerTaken))) return true
  }
  return false
}

function writeProductionLocal(dockerEnv) {
  const anon = (dockerEnv.ANON_KEY || '').trim()
  if (!anon) {
    console.error(
      `[generate:docker-env] ${envName} has no ANON_KEY — cannot write ${prodName}.`,
    )
    process.exit(1)
  }

  const kongPort = (dockerEnv.KONG_HTTP_PORT || '8000').trim()
  const localKong = kongUrl(kongPort)

  if (existsSync(productionLocalPath)) {
    // Update the keys we own and leave the rest of the file alone: in a
    // developer checkout this is `.env.local`, which also holds CLI secrets.
    const before = readFileSync(productionLocalPath, 'utf8')
    let text = setEnvValue(before, 'VITE_SUPABASE_URL', localKong)
    text = setEnvValue(text, 'VITE_SUPABASE_ANON_KEY', anon)
    if (isDev) {
      // A checkout that was once run through shop setup would otherwise keep
      // building the shop SPA, which skips the public landing page.
      text = text.replace(/^VITE_APP_TARGET=.*\n?/m, '')
    } else {
      text = setEnvValue(text, 'VITE_APP_TARGET', 'shop')
    }
    if (text === before) {
      console.log(
        `[generate:docker-env] ${prodName} already points at ${localKong} — leaving unchanged.`,
      )
    } else {
      writeFileSync(productionLocalPath, text)
      console.log(
        `[generate:docker-env] Updated ${prodName} (VITE_SUPABASE_* → ${localKong}).`,
      )
    }
    return
  }

  const shopMarker = isDev
    ? ''
    : `# Marks this as a shop build: "/" goes straight to sign-in instead of the
# public landing page. The hosted (Vercel) build leaves this unset.
${APP_TARGET_LINE}
`
  const body = `# Auto-generated for ${isDev ? 'a developer checkout' : 'standalone second PC / shop build'}.
# Points the SPA at this folder's Docker Kong. Do not commit.
# Do not copy this file between project folders — each stack has its own ports/keys.
VITE_SUPABASE_URL=${localKong}
VITE_SUPABASE_ANON_KEY=${anon}
${shopMarker}`
  writeFileSync(productionLocalPath, body)
  console.log(
    `[generate:docker-env] Created ${prodName} (VITE_SUPABASE_* → ${localKong}).`,
  )
}

async function reallocateHostPorts(existing, reason) {
  const ports = await allocatePorts()
  let text = readFileSync(envPath, 'utf8')
  const localKong = kongUrl(ports.KONG_HTTP_PORT)

  const updates = {
    KONG_HTTP_PORT: String(ports.KONG_HTTP_PORT),
    KONG_HTTPS_PORT: String(ports.KONG_HTTPS_PORT),
    POSTGRES_HOST_PORT: String(ports.POSTGRES_HOST_PORT),
    POOLER_HOST_PORT_TRANSACTION: String(ports.POOLER_HOST_PORT_TRANSACTION),
    STOCKPILOT_UI_PORT: String(ports.STOCKPILOT_UI_PORT),
    SUPABASE_PUBLIC_URL: localKong,
    API_EXTERNAL_URL: localKong,
    SITE_URL: localKong,
  }
  // A checkout that predates this naming ran under Compose's fallback project
  // name, which is indistinguishable from a shop stack.
  if (isDev && !(existing.COMPOSE_PROJECT_NAME || '').startsWith('dev-')) {
    updates.COMPOSE_PROJECT_NAME = composeProjectNameForRoot()
  }

  console.log(`[generate:docker-env] ${reason} (secrets kept).`)
  for (const [key, value] of Object.entries(updates)) {
    text = setEnvValue(text, key, value)
  }
  writeFileSync(envPath, text)
  const next = { ...existing, ...updates }
  logIsolation(next)
  return next
}

/** Write the shop data dirs into an existing file that is missing them. */
function ensureShopDataDirs(existing) {
  const missing = Object.entries(SHOP_DATA_DIRS).filter(
    ([key, value]) => (existing[key] || '').trim() !== value,
  )
  if (missing.length === 0) return false
  let text = readFileSync(envPath, 'utf8')
  for (const [key, value] of missing) text = setEnvValue(text, key, value)
  writeFileSync(envPath, text)
  console.log(
    `[generate:docker-env] Set ${missing.map(([k]) => k).join(', ')} in ${envName} — the shop stack needs its own database directory.`,
  )
  return true
}

/** A checkout whose `.env` still sits in the shop block, or has no identity. */
function devIdentityMissing(env) {
  if (!(env.COMPOSE_PROJECT_NAME || '').startsWith('dev-')) return true
  return HOST_PORT_KEYS.some(
    (key) => Number((env[key] || '').trim()) < DEV_PORT_FLOOR,
  )
}

async function ensureDockerEnv() {
  if (existsSync(envPath)) {
    const existing = parseEnv(readFileSync(envPath, 'utf8'))
    if (ensureOnly) {
      // Docker Compose reports a genuine clash itself, and loudly.
      return existing
    }
    if (isDev && devIdentityMissing(existing)) {
      return reallocateHostPorts(
        existing,
        'Developer checkout on shop ports — moving it to the dev port block',
      )
    }
    // Repair before anything else: without these the shop stack would mount the
    // checkout's own PGDATA and two Postgres servers would share one directory.
    if (shopEnv && ensureShopDataDirs(existing)) {
      Object.assign(existing, SHOP_DATA_DIRS)
    }
    if (await hostPortsNeedRealloc(existing)) {
      return reallocateHostPorts(
        existing,
        `Host ports in ${envName} are in use — assigning free ports`,
      )
    }
    console.log(`[generate:docker-env] ${envName} already exists — leaving unchanged.`)
    logIsolation(existing)
    return existing
  }

  if (!existsSync(templatePath)) {
    console.error(`Missing ${templatePath}`)
    process.exit(1)
  }

  // Minting fresh secrets next to a database that already exists locks it away:
  // its roles were created from the old POSTGRES_PASSWORD, which is gone with
  // the env file, and Postgres never re-reads it from PGDATA.
  const dataDir = join(root, shopEnv ? 'volumes-shop' : 'volumes', 'db', 'data')
  if (hasLocalDbData(root, dataDir)) {
    console.error(
      `\n${envName} is missing, but this stack's database directory still holds data:` +
        `\n  ${dataDir}` +
        `\n\nNew secrets would not match it, so nothing could connect. Either restore` +
        `\n${envName} from a backup, or delete the database and start over with:` +
        `\n  npm run ${shopEnv ? 'shop:fresh' : 'fresh'}\n`,
    )
    process.exit(1)
  }

  copyFileSync(templatePath, envPath)
  let text = readFileSync(envPath, 'utf8')

  const jwtSecret = genHex(32)
  const anonKey = signHs256Jwt('anon', jwtSecret)
  const serviceRoleKey = signHs256Jwt('service_role', jwtSecret)
  const projectName = composeProjectNameForRoot()
  const ports = await allocatePorts()
  const localKong = kongUrl(ports.KONG_HTTP_PORT)

  const replacements = {
    COMPOSE_PROJECT_NAME: projectName,
    POSTGRES_PASSWORD: genHex(16),
    JWT_SECRET: jwtSecret,
    ANON_KEY: anonKey,
    SERVICE_ROLE_KEY: serviceRoleKey,
    DASHBOARD_PASSWORD: genHex(12),
    SECRET_KEY_BASE: genBase64(48),
    VAULT_ENC_KEY: genHex(16),
    PG_META_CRYPTO_KEY: genHex(16),
    LOGFLARE_PUBLIC_ACCESS_TOKEN: genHex(32),
    LOGFLARE_PRIVATE_ACCESS_TOKEN: genHex(32),
    MINIO_ROOT_PASSWORD: genHex(16),
    S3_PROTOCOL_ACCESS_KEY_ID: genHex(16),
    S3_PROTOCOL_ACCESS_KEY_SECRET: genHex(32),
    SMTP_PASS: genHex(8),
    ...(shopEnv ? SHOP_DATA_DIRS : {}),
    POSTGRES_PORT: '5432',
    POSTGRES_HOST_PORT: String(ports.POSTGRES_HOST_PORT),
    POOLER_PROXY_PORT_TRANSACTION: '6543',
    POOLER_HOST_PORT_TRANSACTION: String(ports.POOLER_HOST_PORT_TRANSACTION),
    KONG_HTTP_PORT: String(ports.KONG_HTTP_PORT),
    KONG_HTTPS_PORT: String(ports.KONG_HTTPS_PORT),
    STOCKPILOT_UI_PORT: String(ports.STOCKPILOT_UI_PORT),
    SUPABASE_PUBLIC_URL: localKong,
    API_EXTERNAL_URL: localKong,
    SITE_URL: localKong,
    ENABLE_EMAIL_AUTOCONFIRM: 'true',
    // Leave asymmetric / opaque keys empty (legacy HS256 keys are enough for this stack).
    SUPABASE_PUBLISHABLE_KEY: '',
    SUPABASE_SECRET_KEY: '',
    JWT_KEYS: '',
    JWT_JWKS: '',
    ANON_KEY_ASYMMETRIC: '',
    SERVICE_ROLE_KEY_ASYMMETRIC: '',
    OPENAI_API_KEY: '',
  }

  for (const [key, value] of Object.entries(replacements)) {
    text = setEnvValue(text, key, value)
  }

  writeFileSync(envPath, text)
  const dockerEnv = parseEnv(text)
  console.log(
    `[generate:docker-env] Created ${envName} with generated secrets (Kong ${localKong}).`,
  )
  logIsolation(dockerEnv)
  return dockerEnv
}

process.chdir(root)
const dockerEnv = await ensureDockerEnv()
writeProductionLocal(dockerEnv)
console.log('[generate:docker-env] Done. This folder is an isolated stack.')
