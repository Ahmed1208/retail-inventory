/**
 * Nuclear reset for a shop folder: wipe DB + clean leftovers + full setup.
 *   npm run second-pc:fresh
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const passthrough = process.argv.slice(2).filter((a) => a !== '--fresh')

console.log('\n=== second-pc:fresh — wipe DB + auto-clean + setup ===\n')

const r = spawnSync(
  process.execPath,
  [join(root, 'scripts', 'second-pc-setup.mjs'), '--fresh', ...passthrough],
  { cwd: root, stdio: 'inherit', shell: false },
)
process.exit(r.status ?? 1)
