/**
 * Copies each function folder from `supabase/functions/` into `volumes/functions/`
 * so the self-hosted `edge-runtime` container (see root `docker-compose.yml`) can
 * serve them. The router lives in `volumes/functions/main` (from Supabase docker);
 * do not replace it.
 *
 * After syncing: `docker compose restart functions`
 *
 * Invoke: `npm run functions:sync:docker`
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = join(root, 'supabase', 'functions')
const destRoot = join(root, 'volumes', 'functions')

const SKIP = new Set(['main'])

function hasEntryPoint(dir) {
  return existsSync(join(dir, 'index.ts')) || existsSync(join(dir, 'index.tsx'))
}

if (!existsSync(srcRoot)) {
  console.error(`Missing ${srcRoot}`)
  process.exit(1)
}
if (!existsSync(destRoot)) {
  console.error(`Missing ${destRoot} — copy the official Supabase docker/volumes tree first.`)
  process.exit(1)
}

let n = 0
for (const name of readdirSync(srcRoot)) {
  if (SKIP.has(name)) continue
  const src = join(srcRoot, name)
  if (!statSync(src).isDirectory() || !hasEntryPoint(src)) continue
  const dest = join(destRoot, name)
  cpSync(src, dest, { recursive: true, force: true })
  console.log(`synced ${name} -> volumes/functions/${name}`)
  n++
}
if (n === 0) {
  console.log('No function folders with index.ts found under supabase/functions/')
} else {
  console.log(`\nDone (${n}). Restart edge runtime: docker compose restart functions`)
}
