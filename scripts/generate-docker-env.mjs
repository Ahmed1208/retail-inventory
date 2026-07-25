/**
 * Generate Docker Compose `.env` + `.env.production.local` for a standalone shop PC.
 *
 * Usage (from repo root):
 *   npm run generate:docker-env
 *
 * Never overwrites an existing `.env` or `.env.production.local`.
 * Does not create cloud / mirror-auth env files.
 */
import { createHmac, randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')
const templatePath = join(root, '.env.docker.example')
const productionLocalPath = join(root, '.env.production.local')

const LOCAL_KONG = 'http://127.0.0.1:8000'

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

function ensureDockerEnv() {
  if (existsSync(envPath)) {
    console.log('[generate:docker-env] .env already exists — leaving unchanged.')
    return parseEnv(readFileSync(envPath, 'utf8'))
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

  const replacements = {
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
    SUPABASE_PUBLIC_URL: LOCAL_KONG,
    API_EXTERNAL_URL: LOCAL_KONG,
    SITE_URL: LOCAL_KONG,
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
  console.log('[generate:docker-env] Created .env with generated secrets (localhost Kong).')
  return parseEnv(text)
}

function ensureProductionLocal(dockerEnv) {
  if (existsSync(productionLocalPath)) {
    console.log(
      '[generate:docker-env] .env.production.local already exists — leaving unchanged.',
    )
    return
  }

  const anon = (dockerEnv.ANON_KEY || '').trim()
  if (!anon) {
    console.error(
      '[generate:docker-env] .env has no ANON_KEY — cannot write .env.production.local.',
    )
    process.exit(1)
  }

  const body = `# Auto-generated for standalone second PC / shop build.
# Points the SPA at this machine's Docker Kong. Do not commit.
VITE_SUPABASE_URL=${LOCAL_KONG}
VITE_SUPABASE_ANON_KEY=${anon}
`
  writeFileSync(productionLocalPath, body)
  console.log(
    '[generate:docker-env] Created .env.production.local (VITE_SUPABASE_* → 127.0.0.1:8000).',
  )
}

process.chdir(root)
const dockerEnv = ensureDockerEnv()
ensureProductionLocal(dockerEnv)
console.log('[generate:docker-env] Done. Cloud env files were not created (optional later).')
