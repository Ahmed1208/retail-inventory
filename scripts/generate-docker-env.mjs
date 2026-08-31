/**
 * Generate Docker Compose `.env` + `.env.production.local` for a standalone shop PC.
 *
 * Usage (from repo root):
 *   npm run generate:docker-env
 *
 * Creates `.env` / `.env.production.local` when missing.
 * If `.env` already exists but host ports are taken (common when another
 * Supabase/Docker stack uses 8000), reassigns free host ports and updates
 * Kong URLs — secrets and COMPOSE_PROJECT_NAME are kept.
 * Does not create cloud / mirror-auth env files.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const envPath = join(root, '.env')
const templatePath = join(root, '.env.docker.example')
const productionLocalPath = join(root, '.env.production.local')
const APP_TARGET_LINE = 'VITE_APP_TARGET=shop'

const HOST_PORT_KEYS = [
  'KONG_HTTP_PORT',
  'KONG_HTTPS_PORT',
  'POSTGRES_HOST_PORT',
  'POOLER_HOST_PORT_TRANSACTION',
  'STOCKPILOT_UI_PORT',
]

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
  return `sp-${base}-${hash}`
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
  const kongHttp = await findFreePort(8000, used, dockerTaken)
  const kongHttps = await findFreePort(8443, used, dockerTaken)
  const postgresHost = await findFreePort(5432, used, dockerTaken)
  const poolerTxnHost = await findFreePort(6543, used, dockerTaken)
  const ui = await findFreePort(8080, used, dockerTaken)
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
  console.log(`[generate:docker-env] Compose project: ${project}`)
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

function writeProductionLocal(dockerEnv, { force = false } = {}) {
  const anon = (dockerEnv.ANON_KEY || '').trim()
  if (!anon) {
    console.error(
      '[generate:docker-env] .env has no ANON_KEY — cannot write .env.production.local.',
    )
    process.exit(1)
  }

  const kongPort = (dockerEnv.KONG_HTTP_PORT || '8000').trim()
  const localKong = kongUrl(kongPort)

  if (existsSync(productionLocalPath) && !force) {
    const text = readFileSync(productionLocalPath, 'utf8')
    const existing = parseEnv(text)
    const url = (existing.VITE_SUPABASE_URL || '').trim()
    if (url === localKong && (existing.VITE_SUPABASE_ANON_KEY || '').trim()) {
      if ((existing.VITE_APP_TARGET || '').trim() === 'shop') {
        console.log(
          '[generate:docker-env] .env.production.local already exists — leaving unchanged.',
        )
      } else {
        // Installs created before VITE_APP_TARGET existed: append rather than
        // rewrite, so hand-added keys (e.g. VITE_SYNC_CLOUD_*) survive.
        writeFileSync(
          productionLocalPath,
          `${text.endsWith('\n') ? text : `${text}\n`}${APP_TARGET_LINE}\n`,
        )
        console.log(
          '[generate:docker-env] Added VITE_APP_TARGET=shop to .env.production.local.',
        )
      }
      return
    }
    // URL drifted from Kong port (or empty) — refresh SPA env.
  }

  const body = `# Auto-generated for standalone second PC / shop build.
# Points the SPA at this folder's Docker Kong. Do not commit.
# Do not copy this file between project folders — each stack has its own ports/keys.
VITE_SUPABASE_URL=${localKong}
VITE_SUPABASE_ANON_KEY=${anon}
# Marks this as a shop build: "/" goes straight to sign-in instead of the
# public landing page. The hosted (Vercel) build leaves this unset.
${APP_TARGET_LINE}
`
  const existed = existsSync(productionLocalPath)
  writeFileSync(productionLocalPath, body)
  console.log(
    `[generate:docker-env] ${existed || force ? 'Updated' : 'Created'} .env.production.local (VITE_SUPABASE_* → ${localKong}).`,
  )
}

async function reallocateHostPorts(existing) {
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

  console.log(
    '[generate:docker-env] Host ports in .env are in use — assigning free ports (secrets kept).',
  )
  for (const [key, value] of Object.entries(updates)) {
    text = setEnvValue(text, key, value)
  }
  writeFileSync(envPath, text)
  const next = { ...existing, ...updates }
  logIsolation(next)
  return next
}

async function ensureDockerEnv() {
  if (existsSync(envPath)) {
    const existing = parseEnv(readFileSync(envPath, 'utf8'))
    if (await hostPortsNeedRealloc(existing)) {
      return reallocateHostPorts(existing)
    }
    console.log('[generate:docker-env] .env already exists — leaving unchanged.')
    logIsolation(existing)
    return existing
  }

  if (!existsSync(templatePath)) {
    console.error(`Missing ${templatePath}`)
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
    `[generate:docker-env] Created .env with generated secrets (Kong ${localKong}).`,
  )
  logIsolation(dockerEnv)
  return dockerEnv
}

process.chdir(root)
const dockerEnv = await ensureDockerEnv()
const kongPort = (dockerEnv.KONG_HTTP_PORT || '8000').trim()
const forceProd =
  existsSync(productionLocalPath) &&
  parseEnv(readFileSync(productionLocalPath, 'utf8')).VITE_SUPABASE_URL?.trim() !==
    kongUrl(kongPort)
writeProductionLocal(dockerEnv, { force: forceProd })
console.log(
  '[generate:docker-env] Done. This folder is an isolated stack; cloud env files were not created (optional later).',
)
