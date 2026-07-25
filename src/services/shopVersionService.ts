export type ShopVersionInfo = {
  version: string
  sha: string
  branch: string
  updatedAt: string
}

export const SHOP_VERSION_REPO = 'Ahmed1208/retail-inventory'
export const SHOP_VERSION_BRANCH = 'develop'

/** Canonical file on `develop` (updated by GitHub Action). */
export const SHOP_VERSION_REMOTE_URL = `https://raw.githubusercontent.com/${SHOP_VERSION_REPO}/${SHOP_VERSION_BRANCH}/shop-version.json`

export const SHOP_DEVELOP_ZIP_URL = `https://github.com/${SHOP_VERSION_REPO}/archive/refs/heads/${SHOP_VERSION_BRANCH}.zip`

const LOCAL_STORAGE_KEY = 'stockpilot.shopVersion.local'

const FALLBACK_LOCAL: ShopVersionInfo = {
  version: '0.0.0.0',
  sha: '',
  branch: SHOP_VERSION_BRANCH,
  updatedAt: '',
}

function asInfo(raw: unknown): ShopVersionInfo | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const version = typeof o.version === 'string' ? o.version.trim() : ''
  if (!version) return null
  return {
    version,
    sha: typeof o.sha === 'string' ? o.sha : '',
    branch: typeof o.branch === 'string' ? o.branch : SHOP_VERSION_BRANCH,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : '',
  }
}

function readStoredLocal(): ShopVersionInfo | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return null
    return asInfo(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

/** Version from this install’s `public/shop-version.json` (served with the app). */
export async function fetchInstalledShopVersion(
  signal?: AbortSignal
): Promise<ShopVersionInfo> {
  const base = import.meta.env.BASE_URL || '/'
  const url = `${base.endsWith('/') ? base : `${base}/`}shop-version.json`
  try {
    const res = await fetch(url, { cache: 'no-store', signal })
    if (!res.ok) return FALLBACK_LOCAL
    return asInfo(await res.json()) ?? FALLBACK_LOCAL
  } catch {
    return FALLBACK_LOCAL
  }
}

/**
 * Effective local version: optional override after “mark applied”, else installed file.
 */
export async function resolveLocalShopVersion(
  signal?: AbortSignal
): Promise<ShopVersionInfo> {
  const installed = await fetchInstalledShopVersion(signal)
  const stored = readStoredLocal()
  if (!stored) return installed
  // Prefer stored only when it is newer or equal (operator confirmed an update).
  if (compareShopVersions(stored.version, installed.version) >= 0) {
    return stored
  }
  return installed
}

export function setLocalShopVersion(info: ShopVersionInfo): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(info))
}

/** Compare dotted numeric versions (e.g. 26.7.26.12). Negative if a < b. */
export function compareShopVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => {
    const v = Number.parseInt(n, 10)
    return Number.isFinite(v) ? v : 0
  })
  const pb = b.split('.').map((n) => {
    const v = Number.parseInt(n, 10)
    return Number.isFinite(v) ? v : 0
  })
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da < db ? -1 : 1
  }
  return 0
}

export function isShopUpdateAvailable(
  local: ShopVersionInfo,
  remote: ShopVersionInfo
): boolean {
  const byVersion = compareShopVersions(local.version, remote.version)
  if (byVersion < 0) return true
  if (byVersion > 0) return false
  if (local.sha && remote.sha && local.sha !== remote.sha) return true
  return false
}

export type ShopVersionCheckResult =
  | {
      ok: true
      local: ShopVersionInfo
      remote: ShopVersionInfo
      updateAvailable: boolean
    }
  | {
      ok: false
      local: ShopVersionInfo
      error: 'offline' | 'fetch_failed' | 'invalid'
    }

/** Lightweight probe: browser online + reachable shop-version on GitHub. */
export async function probeShopVersionOnline(
  signal?: AbortSignal
): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  try {
    const res = await fetch(SHOP_VERSION_REMOTE_URL, {
      method: 'GET',
      cache: 'no-store',
      signal,
    })
    return res.ok
  } catch {
    return false
  }
}

export async function fetchRemoteShopVersion(
  signal?: AbortSignal
): Promise<ShopVersionCheckResult> {
  const local = await resolveLocalShopVersion(signal)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, local, error: 'offline' }
  }
  try {
    const res = await fetch(SHOP_VERSION_REMOTE_URL, {
      method: 'GET',
      cache: 'no-store',
      signal,
    })
    if (!res.ok) return { ok: false, local, error: 'fetch_failed' }
    const remote = asInfo(await res.json())
    if (!remote) return { ok: false, local, error: 'invalid' }
    return {
      ok: true,
      local,
      remote,
      updateAvailable: isShopUpdateAvailable(local, remote),
    }
  } catch {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { ok: false, local, error: 'offline' }
    }
    return { ok: false, local, error: 'fetch_failed' }
  }
}

export function shortSha(sha: string): string {
  const t = sha.trim()
  if (!t) return '—'
  return t.length > 7 ? t.slice(0, 7) : t
}
