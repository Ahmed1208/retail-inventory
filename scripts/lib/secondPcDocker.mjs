/**
 * Shared Docker discovery + cleanup helpers for second-PC / shop installs.
 */
import {
  existsSync,
  readdirSync,
  realpathSync,
  rmSync,
  readFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'

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

/** Resolve symlinks (macOS /tmp → /private/tmp) so path comparison is reliable. */
export function canonicalPath(p) {
  try {
    return realpathSync(resolve(p))
  } catch {
    return resolve(p)
  }
}

/** True when a folder holds a Postgres data directory with something in it. */
export function hasLocalDbData(dir) {
  const dataDir = join(dir, 'volumes', 'db', 'data')
  try {
    return readdirSync(dataDir).length > 0
  } catch {
    return false
  }
}

/**
 * A folder that generate-docker-env.mjs has already set up as a shop. The
 * `sp-` project prefix is written by nothing else, so it is the durable answer
 * to "has this folder been through shop setup".
 */
export function isConfiguredShopFolder(dir) {
  return projectNameOf(dir).startsWith('sp-')
}

/**
 * A developer working copy rather than a shop install. Clients install from the
 * zip, which carries no `.git`. A shop that was installed with `git clone`
 * stops looking like a checkout once shop setup has written its `.env`.
 */
export function isDevCheckout(dir) {
  return existsSync(join(dir, '.git')) && !isConfiguredShopFolder(dir)
}

/** Compose names containers `<project>-<service>-<n>`; used to confirm a real stack. */
const SUPABASE_SERVICE_RE =
  /-(kong|db|auth|rest|studio|storage|meta|analytics|vector|imgproxy|functions|pooler|supavisor)-\d+$/

/**
 * Upstream's fixed container names. Downloads made before the `sp-` naming ran
 * under Compose's default project, so their leftovers still look like this.
 */
const LEGACY_SERVICE_RE =
  /^supabase-(kong|db|auth|rest|studio|storage|meta|analytics|vector|imgproxy|edge-functions|pooler)$/

/** Compose's default project name for the upstream stack — not ours by itself. */
const LEGACY_PROJECT = 'supabase'

/**
 * A folder that is one of our installs rather than a bare upstream Supabase
 * checkout, which ships a `docker-compose.yml` but no app.
 */
export function isStockpilotFolder(dir) {
  return (
    existsSync(join(dir, 'package.json')) &&
    existsSync(join(dir, 'supabase', 'migrations'))
  )
}

/** Project names this repo generates (`sp-<folder>-<hash>`) plus the Compose default. */
function looksLikeStockpilotProject(project, containers) {
  if (!project) return false
  if (project === LEGACY_PROJECT) {
    return containers.some((n) => LEGACY_SERVICE_RE.test(n))
  }
  if (!project.startsWith('sp-') && project !== 'stockpilot') return false
  return containers.some((n) => SUPABASE_SERVICE_RE.test(n))
}

/** Tab-separated `docker ps` rows this module asks for. */
export const INSTALL_PS_FORMAT =
  '{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.project.working_dir"}}\t{{.Names}}'

/**
 * Classify `docker ps` output against `root`. Pure apart from filesystem checks,
 * so it can be exercised without Docker.
 *
 * `orphan` means the folder Compose ran from is gone (a deleted download), so
 * its containers are genuinely unused. `liveElsewhere` is another real install
 * and must never be removed without telling the user — that folder still holds
 * their database under `volumes/db/data`. `devCheckout` is someone's working
 * copy of the repo: not a shop, so it is never warned about, copied from, or
 * cleaned up. Leftovers under Compose's default `supabase` project are reported
 * only while their folder still exists, and never become removable.
 *
 * @param {string} psOutput rows in INSTALL_PS_FORMAT
 * @param {string} root this install's folder
 * @returns {{project: string, workingDir: string|null, kind: 'thisFolder'|'liveElsewhere'|'devCheckout'|'orphan', containers: string[], hasData: boolean}[]}
 */
export function classifyDockerInstalls(psOutput, root) {
  const here = canonicalPath(root)
  const byProject = new Map()

  for (const line of String(psOutput || '').split('\n')) {
    if (!line.trim()) continue
    const [project = '', workingDir = '', name = ''] = line.split('\t')
    if (!project.trim() || !name.trim()) continue
    const entry = byProject.get(project) || {
      project,
      workingDir: workingDir.trim() || null,
      containers: [],
    }
    entry.containers.push(name.trim())
    if (!entry.workingDir && workingDir.trim()) entry.workingDir = workingDir.trim()
    byProject.set(project, entry)
  }

  const installs = []
  for (const entry of byProject.values()) {
    if (!looksLikeStockpilotProject(entry.project, entry.containers)) continue

    // Compose < 2.x did not write working_dir. Unknown folder means we cannot
    // prove it is unused, so treat it as a live install and only warn.
    if (!entry.workingDir) {
      installs.push({ ...entry, kind: 'liveElsewhere', hasData: false })
      continue
    }

    const dir = canonicalPath(entry.workingDir)
    if (dir === here) {
      installs.push({
        ...entry,
        workingDir: dir,
        kind: 'thisFolder',
        hasData: hasLocalDbData(dir),
      })
      continue
    }

    const alive = existsSync(join(dir, 'docker-compose.yml'))

    // `supabase` is upstream's own project name, so a missing folder is no
    // proof the containers are ours. Report these only when the folder is still
    // there and is one of our installs; never let them become removable.
    if (entry.project === LEGACY_PROJECT && !(alive && isStockpilotFolder(dir))) {
      continue
    }

    let kind = 'orphan'
    if (alive) kind = isDevCheckout(dir) ? 'devCheckout' : 'liveElsewhere'
    installs.push({
      ...entry,
      workingDir: dir,
      kind,
      hasData: alive ? hasLocalDbData(dir) : false,
    })
  }

  return installs
}

/**
 * Every StockPilot install on this machine, from Docker plus a scan of folders
 * beside this one.
 *
 * @param {string} root this install's folder
 */
export function findStockpilotInstalls(root) {
  const r = runCapture(root, 'docker', ['ps', '-a', '--format', INSTALL_PS_FORMAT])
  const installs = classifyDockerInstalls(r.stdout || '', root)

  const seenDirs = new Set([canonicalPath(root)])
  for (const i of installs) {
    if (i.workingDir) seenDirs.add(i.workingDir)
  }

  // Docker forgets installs whose containers were pruned, so also look beside
  // this folder — clients unzip copies into the same Downloads directory.
  for (const dir of siblingInstallDirs(root)) {
    if (seenDirs.has(dir)) continue
    seenDirs.add(dir)
    installs.push({
      project: projectNameOf(dir) || '(not started)',
      workingDir: dir,
      kind: 'liveElsewhere',
      containers: [],
      hasData: hasLocalDbData(dir),
    })
  }

  return installs
}

function projectNameOf(dir) {
  try {
    return parseEnv(readFileSync(join(dir, '.env'), 'utf8')).COMPOSE_PROJECT_NAME || ''
  } catch {
    return ''
  }
}

/**
 * Folders next to `root` that were set up by this repo. `COMPOSE_PROJECT_NAME=sp-…`
 * is only ever written by generate-docker-env.mjs, so it is a precise marker
 * rather than a guess.
 */
function siblingInstallDirs(root) {
  const here = canonicalPath(root)
  const parent = dirname(here)
  /** @type {string[]} */
  const found = []
  let entries = []
  try {
    entries = readdirSync(parent, { withFileTypes: true })
  } catch (err) {
    // macOS guards Downloads/Desktop/Documents. Staying silent here would let
    // setup claim there are no other installs when it was never able to look,
    // and the shop would think a folder holding their data had vanished.
    if (err?.code === 'EPERM' || err?.code === 'EACCES') {
      console.warn(
        `\n[warn] Cannot read ${parent} to check for other StockPilot folders.` +
          '\n[warn] Grant your terminal access to that folder if you have another install beside this one.\n',
      )
    }
    return found
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const dir = canonicalPath(join(parent, entry.name))
    if (dir === here) continue
    if (!existsSync(join(dir, 'docker-compose.yml'))) continue
    if (!projectNameOf(dir).startsWith('sp-')) continue
    if (!hasLocalDbData(dir)) continue
    found.push(dir)
  }
  return found
}

/**
 * @param {object} opts
 * @param {string} opts.root
 * @param {boolean} [opts.wipeDb]
 * @param {string[]} [opts.orphanProjects] Compose projects whose folder is gone — safe to remove
 * @param {boolean} [opts.purgeHashOrphans] remove 224f…_supabase-* rename leftovers
 * @param {boolean} [opts.purgeOrphanSupabase] remove fixed supabase-* names (dangerous w/ CLI)
 * @param {boolean} [opts.quiet]
 */
export function cleanShopDocker(opts) {
  const {
    root,
    wipeDb = false,
    orphanProjects = [],
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

  for (const orphan of orphanProjects) {
    if (!orphan || orphan === project) continue
    if (!quiet) {
      console.log(`\n[cleanup] Deleted download “${orphan}” — removing its unused resources…\n`)
    }
    const ids = runCapture(root, 'docker', [
      'ps',
      '-aq',
      '--filter',
      `label=com.docker.compose.project=${orphan}`,
    ])
      .stdout?.split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids?.length) run(root, 'docker', ['rm', '-f', ...ids])

    // The database is a bind mount inside the deleted folder, so the only
    // volumes left here are caches and config — nothing the user can lose.
    const vols = runCapture(root, 'docker', [
      'volume',
      'ls',
      '-q',
      '--filter',
      `label=com.docker.compose.project=${orphan}`,
    ])
      .stdout?.split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (vols?.length) run(root, 'docker', ['volume', 'rm', '-f', ...vols])
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
