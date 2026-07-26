/**
 * Shared Docker cleanup helpers for second-PC / shop installs.
 */
import { existsSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

export function parseEnv(text) {
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

function run(cwd, cmd, argv) {
  return spawnSync(cmd, argv, { cwd, stdio: 'inherit', shell: false })
}

function runCapture(cwd, cmd, argv) {
  return spawnSync(cmd, argv, { cwd, encoding: 'utf8', shell: false })
}

function listContainerNames(cwd) {
  const r = runCapture(cwd, 'docker', ['ps', '-a', '--format', '{{.Names}}'])
  if (r.status !== 0 || !r.stdout) return []
  return r.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

function removeContainers(cwd, names) {
  if (names.length === 0) return 0
  console.log(`Removing ${names.length} container(s):`)
  for (const n of names) console.log(`  - ${n}`)
  run(cwd, 'docker', ['rm', '-f', ...names])
  return names.length
}

/**
 * @param {object} opts
 * @param {string} opts.root
 * @param {boolean} [opts.wipeDb]
 * @param {boolean} [opts.allStockpilot] remove other sp-retail-inventory-* stacks
 * @param {boolean} [opts.purgeHashOrphans] remove 224f…_supabase-* rename leftovers
 * @param {boolean} [opts.purgeOrphanSupabase] remove fixed supabase-* names (dangerous w/ CLI)
 * @param {boolean} [opts.quiet]
 */
export function cleanShopDocker(opts) {
  const {
    root,
    wipeDb = false,
    allStockpilot = false,
    purgeHashOrphans = false,
    purgeOrphanSupabase = false,
    quiet = false,
  } = opts

  const envPath = join(root, '.env')
  const project =
    (existsSync(envPath)
      ? parseEnv(readFileSync(envPath, 'utf8')).COMPOSE_PROJECT_NAME
      : '') || 'stockpilot'

  if (!quiet) {
    console.log(`\n[cleanup] Compose project: ${project}\n`)
  }

  if (existsSync(join(root, 'docker-compose.yml'))) {
    run(root, 'docker', ['compose', 'down', '--remove-orphans'])
  }

  {
    const labeled = runCapture(root, 'docker', [
      'ps',
      '-aq',
      '--filter',
      `label=com.docker.compose.project=${project}`,
    ])
    const ids = (labeled.stdout || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids.length) {
      if (!quiet) {
        console.log(
          `[cleanup] Removing ${ids.length} leftover container(s) for ${project}…`,
        )
      }
      run(root, 'docker', ['rm', '-f', ...ids])
    }
  }

  const names = listContainerNames(root)

  if (allStockpilot) {
    const stock = names.filter(
      (n) =>
        n.startsWith('sp-retail-inventory') ||
        n.startsWith('realtime-dev.sp-retail-inventory') ||
        (n.startsWith('realtime-dev.sp-') && n.includes('retail')),
    )
    if (stock.length && !quiet) {
      console.log('\n[cleanup] Other old shop-folder stacks…\n')
    }
    removeContainers(root, stock)
  }

  if (purgeHashOrphans) {
    const hashOrphans = names.filter(
      (n) =>
        /^[0-9a-f]{6,12}_supabase-/.test(n) ||
        /^[0-9a-f]{6,12}_realtime-dev\./.test(n),
    )
    if (hashOrphans.length && !quiet) {
      console.log('\n[cleanup] Renamed leftover containers (hash_supabase-*)…\n')
    }
    removeContainers(root, hashOrphans)
  }

  if (purgeOrphanSupabase) {
    const fixed = new Set([
      'supabase-studio',
      'supabase-kong',
      'supabase-auth',
      'supabase-rest',
      'supabase-storage',
      'supabase-imgproxy',
      'supabase-meta',
      'supabase-edge-functions',
      'supabase-analytics',
      'supabase-db',
      'supabase-vector',
      'supabase-pooler',
      'realtime-dev.supabase-realtime',
    ])
    const orphans = names.filter((n) => fixed.has(n))
    if (orphans.length && !quiet) {
      console.log(
        '\n[cleanup] Fixed-name supabase-* leftovers (may affect `npx supabase start`)…\n',
      )
    }
    removeContainers(root, orphans)
  }

  if (wipeDb) {
    const dataDir = join(root, 'volumes', 'db', 'data')
    if (existsSync(dataDir)) {
      if (!quiet) console.log('\n[cleanup] Wiping volumes/db/data…\n')
      rmSync(dataDir, { recursive: true, force: true })
    }
  }

  run(root, 'docker', ['network', 'prune', '-f'])
  return { project }
}
