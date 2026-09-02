/**
 * Tear down this folder’s Docker stack and optional leftovers.
 *
 * Prefer `npm run second-pc:setup` — it cleans automatically.
 * Use this script only for an explicit teardown.
 *
 *   npm run second-pc:cleanup
 *   npm run second-pc:cleanup -- --wipe-db
 *   npm run second-pc:cleanup -- --all-orphans        # downloads whose folder was deleted
 *   npm run second-pc:cleanup -- --purge-orphan-supabase
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cleanShopDocker,
  findStockpilotInstalls,
} from './lib/secondPcDocker.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))

if (!existsSync(join(root, 'docker-compose.yml'))) {
  console.error('Run from the retail-inventory project root.')
  process.exit(1)
}

const orphanProjects = args.has('--all-orphans')
  ? findStockpilotInstalls(root)
      .filter((i) => i.kind === 'orphan')
      .map((i) => i.project)
  : []

cleanShopDocker({
  root,
  wipeDb: args.has('--wipe-db'),
  orphanProjects,
  purgeHashOrphans: true,
  purgeOrphanSupabase: args.has('--purge-orphan-supabase'),
})

console.log(`
=== Cleanup done ===

Usual next step (also cleans automatically):
  npm run second-pc:setup

Full reset (wipe DB + setup) in one command:
  npm run second-pc:fresh
`)
