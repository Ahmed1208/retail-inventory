/**
 * Second PC / shop — standalone setup (no cloud env required).
 * Windows / macOS / Linux: Start StockPilot (.bat / .command / .sh) calls this.
 *
 * Usage (from repo root):
 *   npm run second-pc:setup
 *   npm run second-pc:setup -- --no-seed
 *   npm run second-pc:setup -- --no-build
 *   npm run second-pc:setup -- --fresh     # wipe local DB first, then setup
 *   npm run second-pc:setup -- --shop      # confirm a git clone really is a shop PC
 *
 * Always auto-cleans this folder’s Docker stack + leftover shop containers from
 * old unzip folders so you do not need a separate cleanup step.
 *
 * Prerequisites: Docker + Node on PATH.
 */
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  cleanShopDocker,
  findStockpilotInstalls,
  hasLocalDbData,
  isConfiguredShopFolder,
  isDevCheckout,
  parseEnv,
} from './lib/secondPcDocker.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const noSeed = args.has('--no-seed')
const withSeed = !noSeed
const noBuild = args.has('--no-build')
const fresh = args.has('--fresh')
const forceShop = args.has('--shop')

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...opts,
  })
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
  return r
}

function runAllowFail(cmd, argv) {
  return spawnSync(cmd, argv, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  })
}

function needFile(rel, hint) {
  const p = join(root, rel)
  if (!existsSync(p)) {
    console.error(`\nMissing ${rel}. ${hint}\n`)
    process.exit(1)
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** `docker compose …` inside another install folder, so it uses that folder's .env. */
function composeIn(dir, argv, opts = {}) {
  return spawnSync('docker', ['compose', ...argv], {
    cwd: dir,
    stdio: 'inherit',
    shell: false,
    ...opts,
  })
}

function waitForDb(dir, seconds = 90) {
  for (let i = 0; i < seconds; i++) {
    const ready = spawnSync(
      'docker',
      ['compose', 'exec', '-T', 'db', 'pg_isready', '-U', 'postgres'],
      { cwd: dir, encoding: 'utf8' },
    )
    if (ready.status === 0) return true
    sleepSync(1000)
  }
  return false
}

/**
 * Dump another install's database straight to a file (streamed, so a large shop
 * database never has to fit in memory). Only reads the source folder.
 */
function dumpDatabaseFrom(sourceDir, destFile) {
  console.log(`\n[migrate] Starting the database in ${sourceDir}…\n`)
  if (composeIn(sourceDir, ['up', '-d', 'db']).status !== 0) return false
  if (!waitForDb(sourceDir)) {
    console.error('[migrate] The previous database did not become ready in time.')
    return false
  }

  console.log('\n[migrate] Copying your data out…\n')
  const fd = openSync(destFile, 'w')
  try {
    const dump = spawnSync(
      'docker',
      [
        'compose',
        'exec',
        '-T',
        'db',
        'pg_dump',
        '-U',
        'postgres',
        '--clean',
        '--if-exists',
        '-d',
        'postgres',
      ],
      { cwd: sourceDir, stdio: ['ignore', fd, 'inherit'] },
    )
    if (dump.status !== 0) return false
  } finally {
    closeSync(fd)
  }

  let bytes = 0
  try {
    bytes = statSync(destFile).size
  } catch {
    /* handled below */
  }
  if (bytes < 1024) {
    console.error('[migrate] The copy looks empty — leaving the previous install alone.')
    return false
  }
  console.log(`[migrate] Saved ${Math.round(bytes / 1024)} KB to ${destFile}\n`)
  return true
}

function restoreDatabaseInto(targetDir, dumpFile, logFile) {
  console.log('\n[migrate] Restoring your data into this folder…\n')
  const errFd = openSync(logFile, 'w')
  try {
    const restore = spawnSync(
      'docker',
      ['compose', 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'postgres', '-f', '-'],
      {
        cwd: targetDir,
        input: readFileSync(dumpFile),
        stdio: ['pipe', 'ignore', errFd],
        maxBuffer: 1024 * 1024 * 1024,
      },
    )
    return restore.status === 0
  } finally {
    closeSync(errFd)
  }
}

function psqlValue(dir, sql) {
  const r = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql],
    { cwd: dir, encoding: 'utf8' },
  )
  return r.status === 0 ? String(r.stdout || '').trim() : ''
}

/** A restore that reports success but left no users is worse than a clean failure. */
function restoredDataLooksSane(dir) {
  const users = Number(psqlValue(dir, 'SELECT count(*) FROM auth.users'))
  const admins = Number(
    psqlValue(dir, 'SELECT count(*) FROM public.profiles WHERE is_admin = true'),
  )
  return Number.isFinite(users) && users > 0 && Number.isFinite(admins) && admins > 0
}

function markSuperseded(oldDir, newDir) {
  try {
    writeFileSync(
      join(oldDir, '.stockpilot-superseded'),
      `${new Date().toISOString()}\nmoved-to=${newDir}\n` +
        'Your data was copied to the folder above. This copy is an old snapshot.\n',
    )
  } catch {
    /* a missing marker only costs a warning later */
  }
}

process.chdir(root)

needFile('docker-compose.yml', 'Run from the retail-inventory repo root.')
needFile('package.json', '')

// Shop setup builds a shop stack and can wipe its database, so it must not run
// against a developer working copy. Clients install from the zip, which has no
// `.git`; a shop installed by `git clone` says so once and is then remembered
// through the `sp-` project name in its generated `.env`.
if (isDevCheckout(root) && !forceShop) {
  console.error(`
This folder is a developer checkout of the repo (it has a .git folder), not a
shop install, so shop setup will not run here.

To work on the repo, start it the normal way:
  npm run docker:dev
  npm run dev

To also run a shop stack beside it, on its own ports and its own database:
  npm run shop:up
  npm run build:shop

If this really is a shop PC that was installed with \`git clone\`, confirm once:
  npm run second-pc:setup -- --shop

After that this folder is remembered as a shop install, and Start StockPilot /
Update StockPilot work normally.
`)
  process.exit(1)
}

if (forceShop && !isConfiguredShopFolder(root)) {
  console.log(
    '\n[info] --shop: treating this git clone as a shop PC. Only needed once.\n',
  )
}

console.log('\n=== 0a/5 Check this PC for other StockPilot folders ===\n')

if (existsSync(join(root, '.stockpilot-superseded'))) {
  console.warn(
    '\n[warning] This copy was replaced by a newer folder — see .stockpilot-superseded.\n' +
      '          The data here is an old snapshot. Close this and use the newer folder\n' +
      '          unless you know you want this one.\n',
  )
}

const installs = findStockpilotInstalls(root)
const orphanProjects = installs
  .filter((i) => i.kind === 'orphan')
  .map((i) => i.project)
const otherInstalls = installs.filter((i) => i.kind === 'liveElsewhere')

/** Newest by database activity — the folder the shop has actually been using. */
function lastUsed(dir) {
  try {
    return statSync(join(dir, 'volumes', 'db', 'data')).mtimeMs
  } catch {
    return 0
  }
}

let migrationSource = null

if (otherInstalls.length > 0) {
  console.warn('\n' + '='.repeat(68))
  console.warn('  StockPilot is already installed on this PC')
  console.warn('='.repeat(68) + '\n')
  for (const other of otherInstalls) {
    console.warn(
      `  • ${other.workingDir || '(folder unknown)'}${other.hasData ? '  — has your data' : '  — no data yet'}`,
    )
  }
  console.warn('\n  You do not need a second copy. Each folder keeps its own database.\n')

  const candidates = otherInstalls
    .filter((i) => i.hasData && i.workingDir)
    .sort((a, b) => lastUsed(b.workingDir) - lastUsed(a.workingDir))

  if (fresh) {
    console.warn(
      '  --fresh was requested, so this folder starts empty and the other\n' +
        '  folder is left exactly as it is.\n',
    )
  } else if (hasLocalDbData(root)) {
    console.warn(
      '  This folder already has its own data, so nothing is copied or removed.\n' +
        '  Two databases are never merged automatically — pick one folder and\n' +
        '  keep using it.\n',
    )
  } else if (candidates.length > 0) {
    migrationSource = candidates[0]
    console.warn(
      `  This folder is empty, so your data will be copied here from:\n` +
        `    ${migrationSource.workingDir}\n\n` +
        '  That folder is only read — its database stays there as a fallback.\n',
    )
  } else {
    console.warn('  The other folder has no data yet, so there is nothing to copy.\n')
  }
}

let migrationDump = null

if (migrationSource) {
  console.log('\n=== 0a/5 Bringing your data into this folder ===\n')
  const migrationDir = join(root, '.stockpilot-migration')
  mkdirSync(migrationDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dumpFile = join(migrationDir, `backup-${stamp}.sql`)

  if (!dumpDatabaseFrom(migrationSource.workingDir, dumpFile)) {
    console.error(
      '\n[error] Could not copy the data from your existing folder.\n' +
        'Nothing was changed and that folder still works.\n\n' +
        `Open it and run Start StockPilot there:\n  ${migrationSource.workingDir}\n`,
    )
    process.exit(1)
  }

  // The previous install keeps running for now. It is only retired once this
  // folder is proven to work, so a failure anywhere below leaves the shop with
  // a working install to go back to.
  migrationDump = dumpFile
}

console.log('\n=== 0a/5 Auto-clean Docker leftovers (safe to re-run) ===\n')
console.log(
  '[info] Removes this folder’s stack, downloads whose folder was deleted, and\n' +
    '       hash_supabase-* rename leftovers. Folders that still exist are never\n' +
    '       removed — they are listed above instead.\n',
)
cleanShopDocker({
  root,
  wipeDb: fresh,
  orphanProjects,
  purgeHashOrphans: true,
  purgeOrphanSupabase: false,
})
if (fresh) {
  console.log('[info] --fresh: local volumes/db/data was wiped.\n')
}

console.log('\n=== 0b/5 Generate local env if needed ===\n')
run('npm', ['run', 'generate:docker-env'])

needFile(
  '.env',
  'Env generation failed — run `npm run generate:docker-env` and check .env.docker.example.',
)

let dockerEnv = parseEnv(readFileSync(join(root, '.env'), 'utf8'))
const uiPort = (dockerEnv.STOCKPILOT_UI_PORT || '8080').trim() || '8080'
const kongPort = (dockerEnv.KONG_HTTP_PORT || '8000').trim() || '8000'
const projectName = (dockerEnv.COMPOSE_PROJECT_NAME || 'stockpilot').trim()

if (!existsSync(join(root, '.env.production.local'))) {
  console.warn(
    '\n[warn] No .env.production.local after generate — Vite build may miss VITE_SUPABASE_*.\n',
  )
}

console.log(`\n[info] Isolated Compose project: ${projectName}\n`)

function composeUp(forceRecreate) {
  const argv = ['compose', 'up', '-d']
  if (forceRecreate) argv.push('--force-recreate')
  return runAllowFail('docker', argv)
}

console.log('\n=== 1/5 Docker Compose up ===\n')
{
  let up = composeUp(false)
  if (up.status !== 0) {
    console.warn(
      '\n[warn] Compose up failed — reassigning free ports and retrying…\n',
    )
    run('npm', ['run', 'generate:docker-env'])
    up = composeUp(true)
  }
  if (up.status !== 0) {
    console.warn(
      '\n[warn] Compose still failing — wiping local DB data once and retrying (keeps .env).\n' +
        '        Next time you can skip straight to: npm run second-pc:fresh\n',
    )
    cleanShopDocker({
      root,
      wipeDb: true,
      orphanProjects,
      purgeHashOrphans: true,
      purgeOrphanSupabase: false,
    })
    run('npm', ['run', 'generate:docker-env'])
    up = composeUp(true)
  }
  if (up.status !== 0) {
    console.error(
      '\n[error] Docker Compose could not start.\n' +
        'Try: npm run second-pc:fresh\n' +
        'Or cleanup with --purge-orphan-supabase if old supabase-* names block you\n' +
        '(only if you do not need `npx supabase start` on this machine).\n',
    )
    process.exit(up.status ?? 1)
  }
}

dockerEnv = parseEnv(readFileSync(join(root, '.env'), 'utf8'))
const uiPortFinal = (dockerEnv.STOCKPILOT_UI_PORT || uiPort).trim() || uiPort
const kongPortFinal = (dockerEnv.KONG_HTTP_PORT || kongPort).trim() || kongPort
const projectNameFinal =
  (dockerEnv.COMPOSE_PROJECT_NAME || projectName).trim() || projectName

console.log('\n=== 2/5 npm install ===\n')
run('npm', ['install'])

if (migrationDump) {
  if (!waitForDb(root)) {
    console.error('\n[error] The database in this folder did not become ready.\n')
    process.exit(1)
  }
  const restoreLog = `${migrationDump.replace(/\.sql$/, '')}-restore.log`
  const ok =
    restoreDatabaseInto(root, migrationDump, restoreLog) && restoredDataLooksSane(root)
  if (!ok) {
    console.error(
      '\n[error] Your data could not be restored into this folder.\n' +
        `Details: ${restoreLog}\n` +
        `A copy of your data is saved at:\n  ${migrationDump}\n\n` +
        'Your previous folder still has its own database and can be started again\n' +
        'by running Start StockPilot there.\n',
    )
    process.exit(1)
  }
  console.log('[migrate] Data restored. Your sign-in details are unchanged.\n')
}

console.log('\n=== 3/5 Database migrations (StockPilot) ===\n')
run('npm', ['run', 'db:push:docker-compose'], {
  // A restored database carries the other install's migration history, which
  // can already list migrations that sort after files this download still
  // needs. Without this the CLI stops and nothing is applied.
  env: migrationDump ? { ...process.env, INCLUDE_ALL: '1' } : process.env,
})

console.log('\n=== 4/5 Edge Functions → volumes + restart ===\n')
run('npm', ['run', 'functions:sync:docker'])
run('docker', ['compose', 'restart', 'functions'])

if (migrationDump) {
  // PostgREST caches the schema; the restore replaced it underneath the running
  // container, so it must reload before the app can read the restored tables.
  runAllowFail('docker', ['compose', 'restart', 'rest'])
}

if (migrationDump) {
  console.log(
    '\n=== Skipping seed — this folder now holds your real data and operators ===\n',
  )
} else if (withSeed) {
  console.log('\n=== Seed local admin (seed.sql) ===\n')
  const seed = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      '-',
    ],
    {
      cwd: root,
      input: readFileSync(join(root, 'supabase', 'seed.sql')),
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  )
  if (seed.status !== 0) process.exit(seed.status ?? 1)

  console.log('\n=== Verify seeded admin (profiles.is_admin) ===\n')
  const verify = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-tAc',
      `SELECT CASE WHEN EXISTS (
         SELECT 1
         FROM public.profiles p
         JOIN auth.users u ON u.id = p.id
         WHERE lower(u.email::text) = lower('admin@members.stockpilot.local')
           AND p.is_admin = true
           AND lower(p.username) = 'admin'
       ) THEN 'ok' ELSE 'missing' END`,
    ],
    { cwd: root, encoding: 'utf8' },
  )
  const verifyOut = String(verify.stdout || '').trim()
  if (verify.status !== 0 || verifyOut !== 'ok') {
    console.error(
      '\n[error] Seeded admin profile missing or is_admin=false.\n' +
        'Control / Admin / Notifications / Data sync will not appear until profiles.is_admin is true.\n' +
        'Try: npm run second-pc:fresh\n',
    )
    process.exit(1)
  }
  console.log('Admin profile OK (username admin, is_admin=true).')
} else {
  console.log('\n=== Skipping seed (--no-seed) ===\n')
}

if (!noBuild) {
  console.log('\n=== 5/5 Production build (Vite) ===\n')
  run('npm', ['run', 'build'])
} else {
  console.log('\n=== Skipping build (--no-build) ===\n')
}

if (migrationDump) {
  console.log('\n=== Retiring the previous install ===\n')
  composeIn(migrationSource.workingDir, ['down', '--remove-orphans'])
  markSuperseded(migrationSource.workingDir, root)
  console.log(`[migrate] ${migrationSource.workingDir} is stopped and marked as replaced.\n`)
}

try {
  writeFileSync(
    join(root, '.stockpilot-ready'),
    `${new Date().toISOString()}\nproject=${projectNameFinal}\nkong=${kongPortFinal}\nui=${uiPortFinal}\n`,
  )
} catch {
  /* ignore */
}

console.log(`
=== Done (standalone, isolated stack) ===

Compose project: ${projectNameFinal}

Open the app:
  npx serve -s dist -l ${uiPortFinal}
Then browser: http://localhost:${uiPortFinal}

API (Kong): http://127.0.0.1:${kongPortFinal}

${
  migrationDump
    ? `Your data was moved here from:\n  ${migrationSource.workingDir}\nSign in with the same username and password you already use.\nThat older folder is now marked as replaced — do not work in it again.`
    : 'Sign in: admin / devpass123'
}

Remember only one command next time (it auto-cleans leftovers):
  npm run second-pc:setup

Full reset if something is broken:
  npm run second-pc:fresh

Optional cloud: docs/SECOND_PC.md Part B
`)
