/**
 * One-click shop update: refresh app code in this folder, keep data/env, re-setup.
 *
 *   npm run second-pc:update
 *
 * Prefers `git pull` when this folder is a git clone; otherwise downloads the
 * develop zip and merges code over this folder (never touches volumes/ or .env*).
 * Then runs `second-pc:setup -- --no-seed` when .env already exists.
 */
import {
  createWriteStream,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { isDevCheckout } from './lib/secondPcDocker.mjs'

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const ZIP_URL =
  'https://github.com/Ahmed1208/retail-inventory/archive/refs/heads/develop.zip'

/** Top-level names that must never be overwritten or deleted by an update. */
const PRESERVE_TOP = new Set([
  'volumes',
  'node_modules',
  '.env',
  '.env.local',
  '.env.production.local',
  '.stockpilot-ready',
  '.stockpilot-superseded',
  '.stockpilot-migration',
  '.stockpilot-update-tmp',
  '.git',
])

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...opts,
  })
  return r.status ?? 1
}

function runCapture(cmd, argv, cwd = root) {
  return spawnSync(cmd, argv, {
    cwd,
    encoding: 'utf8',
    shell: false,
  })
}

function tryGitPull() {
  if (!existsSync(join(root, '.git'))) return false
  console.log('\n[update] Git repo detected — pulling latest develop…\n')
  const fetch = run('git', ['fetch', 'origin', 'develop'])
  if (fetch !== 0) {
    console.warn('[update] git fetch failed — will try zip download instead.')
    return false
  }
  const pull = run('git', ['pull', '--ff-only', 'origin', 'develop'])
  if (pull !== 0) {
    console.warn(
      '[update] git pull --ff-only failed — will try zip download instead.',
    )
    return false
  }
  return true
}

async function downloadZip(destFile) {
  console.log('\n[update] Downloading latest develop zip…\n')
  const res = await fetch(ZIP_URL, { redirect: 'follow' })
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (HTTP ${res.status}). Is the repo public / reachable?`)
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destFile))
}

function extractZip(zipFile, destDir) {
  mkdirSync(destDir, { recursive: true })
  if (process.platform === 'win32') {
    const ps = runCapture(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${zipFile.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      destDir,
    )
    if (ps.status !== 0) {
      throw new Error(ps.stderr || 'Expand-Archive failed')
    }
    return
  }
  const uz = runCapture('unzip', ['-q', '-o', zipFile, '-d', destDir], destDir)
  if (uz.status !== 0) {
    throw new Error(uz.stderr || 'unzip failed — install unzip or use git clone')
  }
}

function findExtractedRoot(destDir) {
  const kids = readdirSync(destDir).filter((n) => !n.startsWith('.'))
  for (const name of kids) {
    const p = join(destDir, name)
    if (statSync(p).isDirectory() && existsSync(join(p, 'package.json'))) {
      return p
    }
  }
  if (existsSync(join(destDir, 'package.json'))) return destDir
  throw new Error('Could not find package.json in downloaded zip')
}

function shouldPreserveName(name) {
  if (PRESERVE_TOP.has(name)) return true
  if (name.startsWith('.env')) return true
  if (name === 'node_modules') return true
  return false
}

function mergeCode(fromDir, toDir) {
  console.log('\n[update] Applying new code (keeping your data and settings)…\n')
  const entries = readdirSync(fromDir)
  for (const name of entries) {
    if (shouldPreserveName(name)) continue
    const src = join(fromDir, name)
    const dest = join(toDir, name)
    // Remove existing destination file/dir (except preserve list) then copy
    if (existsSync(dest)) {
      rmSync(dest, { recursive: true, force: true })
    }
    cpSync(src, dest, { recursive: true })
    console.log(`  + ${name}`)
  }
}

async function updateViaZip() {
  const work = mkdtempSync(join(tmpdir(), 'stockpilot-update-'))
  const zipFile = join(work, 'develop.zip')
  try {
    await downloadZip(zipFile)
    const extractDir = join(work, 'extracted')
    extractZip(zipFile, extractDir)
    const srcRoot = findExtractedRoot(extractDir)
    mergeCode(srcRoot, root)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

process.chdir(root)

console.log(`
=== StockPilot Update ===
Folder: ${root}

This keeps your database (volumes/) and settings (.env files).
`)

if (!existsSync(join(root, 'package.json'))) {
  console.error('Run this from the StockPilot project folder (package.json missing).')
  process.exit(1)
}

// Checked before any git command: on a developer checkout this would pull
// `develop` over whatever branch is in progress.
if (isDevCheckout(root)) {
  console.error(`
This folder is a developer checkout of the repo, not a shop install, so the
shop updater will not run here — it would pull develop over your branch.

Update the repo the normal way:
  git pull

If this really is a shop PC installed with \`git clone\`, set it up as a shop
once, then updates work from then on:
  npm run second-pc:setup -- --shop
`)
  process.exit(1)
}

let ok = false
try {
  ok = tryGitPull()
  if (!ok) await updateViaZip()
  else console.log('\n[update] Code updated via git.\n')
} catch (e) {
  console.error('\n[update] Failed:', e instanceof Error ? e.message : e)
  process.exit(1)
}

const hasEnv = existsSync(join(root, '.env'))
console.log(
  `\n[update] Running setup${hasEnv ? ' (keeping existing data, --no-seed)' : ''}…\n`,
)
const setupArgs = [
  'run',
  'second-pc:setup',
  ...(hasEnv ? ['--', '--no-seed'] : []),
]
const setupStatus = run('npm', setupArgs)
if (setupStatus !== 0) process.exit(setupStatus)

console.log(`
=== Update finished ===

Next: run Start StockPilot (.bat / .command / .sh) or serve dist, then sign in as usual.
Your local data was kept.
`)
