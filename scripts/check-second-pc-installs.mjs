/**
 * Exercises classifyDockerInstalls() against throwaway folders and fake
 * `docker ps` rows, so the duplicate-install rules can be checked without Docker.
 *
 * The rules that matter: a folder that still exists is someone's live install
 * and must never be classified as removable, and a developer checkout is not a
 * shop at all.
 */
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canonicalPath,
  classifyDockerInstalls,
  isConfiguredShopFolder,
  isDevCheckout,
} from './lib/secondPcDocker.mjs'

const repo = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const sandbox = join(repo, '.tmp', 'installs-sandbox')

rmSync(sandbox, { recursive: true, force: true })

const here = join(sandbox, 'download-1')
const other = join(sandbox, 'download-2')
const deleted = join(sandbox, 'download-3-deleted')
const devRepo = join(sandbox, 'dev-checkout')
const clonedShop = join(sandbox, 'cloned-shop')

/** A folder that looks like a real install: compose file plus a database. */
function makeInstall(
  dir,
  { withData = true, git = false, project = '', bare = false } = {},
) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'docker-compose.yml'), 'services: {}\n')
  // `bare` mimics an upstream supabase/docker checkout: a compose file, no app.
  if (!bare) {
    writeFileSync(join(dir, 'package.json'), '{"name":"retail-inventory"}\n')
    mkdirSync(join(dir, 'supabase', 'migrations'), { recursive: true })
  }
  if (withData) {
    mkdirSync(join(dir, 'volumes', 'db', 'data'), { recursive: true })
    writeFileSync(join(dir, 'volumes', 'db', 'data', 'PG_VERSION'), '15\n')
  }
  if (git) mkdirSync(join(dir, '.git'), { recursive: true })
  if (project) writeFileSync(join(dir, '.env'), `COMPOSE_PROJECT_NAME=${project}\n`)
}

const legacyInstall = join(sandbox, 'legacy-download')
const upstreamSupabase = join(sandbox, 'upstream-supabase-docker')

makeInstall(here, { withData: false })
makeInstall(other)
makeInstall(devRepo, { git: true })
makeInstall(clonedShop, { git: true, project: 'sp-cloned-shop-fff666' })
makeInstall(legacyInstall, { project: 'sp-legacy-download-ccc999' })
makeInstall(upstreamSupabase, { bare: true })

const row = (project, dir, name) => `${project}\t${dir}\t${name}`
const ps = [
  row('sp-download-1-aaa111', here, 'sp-download-1-aaa111-db-1'),
  row('sp-download-1-aaa111', here, 'sp-download-1-aaa111-kong-1'),
  row('sp-download-2-bbb222', other, 'sp-download-2-bbb222-db-1'),
  row('sp-download-3-ccc333', deleted, 'sp-download-3-ccc333-db-1'),
  row('some-other-app', join(sandbox, 'unrelated'), 'some-other-app-web-1'),
  row('sp-not-supabase-ddd444', join(sandbox, 'nope'), 'sp-not-supabase-ddd444-web-1'),
  // A developer running `docker compose up` with no COMPOSE_PROJECT_NAME gets
  // the compose fallback name, which otherwise looks exactly like a shop.
  row('stockpilot', devRepo, 'stockpilot-db-1'),
  row('sp-cloned-shop-fff666', clonedShop, 'sp-cloned-shop-fff666-db-1'),
  // Downloaded before the `sp-` naming: upstream's fixed names under Compose's
  // default project, so neither the project nor the container names match the
  // current scheme.
  row('supabase', legacyInstall, 'supabase-kong'),
  row('supabase', legacyInstall, 'supabase-db'),
].join('\n')

const installs = classifyDockerInstalls(ps, here)
const byProject = new Map(installs.map((i) => [i.project, i]))

// 1. Unrelated Compose projects are ignored, and an `sp-` project without any
//    Supabase service is not ours either.
assert.equal(installs.length, 6, `expected 6 StockPilot installs, got ${installs.length}`)
assert.ok(!byProject.has('some-other-app'), 'must ignore other apps')
assert.ok(!byProject.has('sp-not-supabase-ddd444'), 'must ignore non-Supabase sp-* projects')

// 2. This folder is recognised as itself, not as a stranger to clean up.
assert.equal(byProject.get('sp-download-1-aaa111').kind, 'thisFolder')
assert.equal(byProject.get('sp-download-1-aaa111').hasData, false, 'no data seeded yet')

// 3. A folder that still exists is live, carries data, and is never an orphan.
const live = byProject.get('sp-download-2-bbb222')
assert.equal(live.kind, 'liveElsewhere', 'existing folder must not be removable')
assert.equal(live.hasData, true, 'must notice the database in that folder')

// 4. A folder the user deleted is the only thing safe to remove.
assert.equal(byProject.get('sp-download-3-ccc333').kind, 'orphan')

// 5. Containers of one project are grouped, not reported one per container.
assert.equal(byProject.get('sp-download-1-aaa111').containers.length, 2)

// 6. Old Compose wrote no working_dir. Unknown must fail safe as live.
const unknown = classifyDockerInstalls(
  row('sp-legacy-eee555', '', 'sp-legacy-eee555-db-1'),
  here,
)
assert.equal(unknown[0].kind, 'liveElsewhere', 'unknown folder must never be an orphan')

// 7. Symlinked paths must still match this folder (macOS /tmp → /private/tmp).
const viaSymlink = classifyDockerInstalls(
  row('sp-download-1-aaa111', canonicalPath(here), 'sp-download-1-aaa111-db-1'),
  here,
)
assert.equal(viaSymlink[0].kind, 'thisFolder')

// 8. No Docker at all must not crash or invent installs.
assert.deepEqual(classifyDockerInstalls('', here), [])

// 9. A developer checkout is never a shop: it must not be warned about,
//    copied from, or cleaned up, even under the `stockpilot` fallback name.
const dev = byProject.get('stockpilot')
assert.equal(dev.kind, 'devCheckout', 'a .git folder means a working copy, not a shop')
assert.notEqual(dev.kind, 'liveElsewhere', 'dev repo must not trigger the duplicate warning')
assert.notEqual(dev.kind, 'orphan', 'dev repo must never be cleaned up')
assert.equal(isDevCheckout(devRepo), true)

// 10. A shop installed by `git clone` stops counting as a checkout once shop
//     setup has written its `sp-` project name, so its updates keep working.
assert.equal(isConfiguredShopFolder(clonedShop), true)
assert.equal(isDevCheckout(clonedShop), false, '--shop must be a one-time confirmation')
assert.equal(byProject.get('sp-cloned-shop-fff666').kind, 'liveElsewhere')

// 11. Selecting installs the way setup does must see the real shops besides
//     this folder, with the dev repo excluded.
const others = installs.filter((i) => i.kind === 'liveElsewhere')
assert.deepEqual(
  others.map((i) => i.project).sort(),
  ['sp-cloned-shop-fff666', 'sp-download-2-bbb222', 'supabase'],
)
assert.deepEqual(
  installs.filter((i) => i.kind === 'orphan').map((i) => i.project),
  ['sp-download-3-ccc333'],
)

// 12. A download made before the `sp-` naming is still someone's shop: it must
//     be warned about and offered as a data source, not silently ignored.
const legacy = byProject.get('supabase')
assert.equal(legacy.kind, 'liveElsewhere')
assert.equal(legacy.hasData, true, 'its database must be visible to migration')

// 13. `supabase` is upstream's default project name, so it is only ours when
//     the folder proves it. A bare supabase/docker checkout is left alone.
assert.deepEqual(
  classifyDockerInstalls(row('supabase', upstreamSupabase, 'supabase-kong'), here),
  [],
  "someone else's Supabase stack is not ours to touch",
)

// 14. And with the folder gone there is no proof at all, so it must never be
//     classified as removable.
assert.deepEqual(
  classifyDockerInstalls(
    row('supabase', join(sandbox, 'vanished'), 'supabase-kong'),
    here,
  ),
  [],
  'a vanished `supabase` project must never become an orphan to delete',
)

rmSync(sandbox, { recursive: true, force: true })
console.log('second-pc install classification check OK (14 cases)')
