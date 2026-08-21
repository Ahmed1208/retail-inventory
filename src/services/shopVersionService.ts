export type ShopLocaleText = {
  en: string
  ar: string
}

export type ShopLocaleLines = {
  en: string[]
  ar: string[]
}

export type ShopReleaseNotes = {
  title?: ShopLocaleText
  body?: ShopLocaleText
  beforeUpdate?: ShopLocaleLines
  afterUpdate?: ShopLocaleLines
}

export type ShopVersionInfo = {
  version: string
  sha: string
  branch: string
  updatedAt: string
  notes?: ShopReleaseNotes
}

export const SHOP_VERSION_QUERY_KEY = ['shopVersionCheck'] as const
const WHATS_NEW_DISMISSED_KEY = 'stockpilot.shopReleaseNotes.dismissedVersion'

export const SHOP_VERSION_REPO = 'Ahmed1208/retail-inventory'
export const SHOP_VERSION_BRANCH = 'develop'

/** Canonical file on `develop` (updated by GitHub Action). */
export const SHOP_VERSION_REMOTE_URL = `https://raw.githubusercontent.com/${SHOP_VERSION_REPO}/${SHOP_VERSION_BRANCH}/shop-version.json`

/** Fallback when shop-version.json is missing on the branch. */
export const SHOP_COMMITS_API_URL = `https://api.github.com/repos/${SHOP_VERSION_REPO}/commits/${SHOP_VERSION_BRANCH}`

const LOCAL_STORAGE_KEY = 'stockpilot.shopVersion.local'

const FALLBACK_LOCAL: ShopVersionInfo = {
  version: '0.0.0.0',
  sha: '',
  branch: SHOP_VERSION_BRANCH,
  updatedAt: '',
}

function asLocaleText(raw: unknown): ShopLocaleText | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const en = typeof o.en === 'string' ? o.en.trim() : ''
  const ar = typeof o.ar === 'string' ? o.ar.trim() : ''
  if (!en && !ar) return undefined
  return { en: en || ar, ar: ar || en }
}

function asLocaleLines(raw: unknown): ShopLocaleLines | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const en = Array.isArray(o.en)
    ? o.en.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    : []
  const ar = Array.isArray(o.ar)
    ? o.ar.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    : []
  if (en.length === 0 && ar.length === 0) return undefined
  return { en: en.length ? en : ar, ar: ar.length ? ar : en }
}

function asNotes(raw: unknown): ShopReleaseNotes | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const notes: ShopReleaseNotes = {
    title: asLocaleText(o.title),
    body: asLocaleText(o.body),
    beforeUpdate: asLocaleLines(o.beforeUpdate),
    afterUpdate: asLocaleLines(o.afterUpdate),
  }
  if (!notes.title && !notes.body && !notes.beforeUpdate && !notes.afterUpdate) {
    return undefined
  }
  return notes
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
    notes: asNotes(o.notes),
  }
}

export function shopNotesText(
  text: ShopLocaleText | undefined,
  lang: string
): string {
  if (!text) return ''
  return lang.startsWith('ar') ? text.ar || text.en : text.en || text.ar
}

export function shopNotesLines(
  lines: ShopLocaleLines | undefined,
  lang: string
): string[] {
  if (!lines) return []
  return lang.startsWith('ar') ? lines.ar || lines.en : lines.en || lines.ar
}

export function readDismissedWhatsNewVersion(): string | null {
  try {
    return localStorage.getItem(WHATS_NEW_DISMISSED_KEY)
  } catch {
    return null
  }
}

export function dismissWhatsNew(version: string): void {
  try {
    localStorage.setItem(WHATS_NEW_DISMISSED_KEY, version)
  } catch {
    /* ignore */
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

function browserIsOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
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

export type ShopConnectivity = {
  /** Real browser offline flag — only this should show the offline banner. */
  browserOnline: boolean
  /** GitHub responded somehow (version file or commits API). */
  githubReachable: boolean
  versionStatus: number | null
  commitsStatus: number | null
}

async function fetchRemoteFromCommitsApi(
  signal?: AbortSignal
): Promise<ShopVersionInfo | null> {
  const res = await fetch(SHOP_COMMITS_API_URL, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json' },
    signal,
  })
  if (!res.ok) return null
  const body = (await res.json()) as {
    sha?: string
    commit?: { committer?: { date?: string } }
  }
  const sha = typeof body.sha === 'string' ? body.sha : ''
  if (!sha) return null
  const updatedAt =
    typeof body.commit?.committer?.date === 'string'
      ? body.commit.committer.date
      : ''
  // Synthetic version from date + short sha so shops can still compare.
  const d = updatedAt ? new Date(updatedAt) : new Date()
  const version = `${d.getUTCFullYear() % 100}.${d.getUTCMonth() + 1}.${d.getUTCDate()}.0`
  return {
    version,
    sha,
    branch: SHOP_VERSION_BRANCH,
    updatedAt,
  }
}

/** Probe connectivity — do not treat a missing version file as “offline”. */
export async function probeShopConnectivity(
  signal?: AbortSignal
): Promise<ShopConnectivity> {
  const browserOnline = browserIsOnline()

  if (!browserOnline) {
    return {
      browserOnline: false,
      githubReachable: false,
      versionStatus: null,
      commitsStatus: null,
    }
  }

  let versionStatus: number | null = null
  let commitsStatus: number | null = null
  let githubReachable = false

  try {
    const res = await fetch(SHOP_VERSION_REMOTE_URL, {
      method: 'GET',
      cache: 'no-store',
      signal,
    })
    versionStatus = res.status
    if (res.ok) githubReachable = true
  } catch {
    versionStatus = null
  }

  if (!githubReachable) {
    try {
      const res = await fetch(SHOP_COMMITS_API_URL, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json' },
        signal,
      })
      commitsStatus = res.status
      if (res.ok) githubReachable = true
    } catch {
      commitsStatus = null
    }
  }

  return {
    browserOnline,
    githubReachable,
    versionStatus,
    commitsStatus,
  }
}

/** @deprecated use probeShopConnectivity — kept for any external callers */
export async function probeShopVersionOnline(
  signal?: AbortSignal
): Promise<boolean> {
  const c = await probeShopConnectivity(signal)
  return c.browserOnline && c.githubReachable
}

export async function fetchRemoteShopVersion(
  signal?: AbortSignal
): Promise<ShopVersionCheckResult> {
  const local = await resolveLocalShopVersion(signal)
  if (!browserIsOnline()) {
    return { ok: false, local, error: 'offline' }
  }
  try {
    const res = await fetch(SHOP_VERSION_REMOTE_URL, {
      method: 'GET',
      cache: 'no-store',
      signal,
    })
    if (res.ok) {
      const remote = asInfo(await res.json())
      if (!remote) return { ok: false, local, error: 'invalid' }
      return {
        ok: true,
        local,
        remote,
        updateAvailable: isShopUpdateAvailable(local, remote),
      }
    }

    // File missing on branch (common before Action/push) — fall back to tip commit.
    const fromCommit = await fetchRemoteFromCommitsApi(signal)
    if (fromCommit) {
      return {
        ok: true,
        local,
        remote: fromCommit,
        updateAvailable: isShopUpdateAvailable(local, fromCommit),
      }
    }
    return { ok: false, local, error: 'fetch_failed' }
  } catch {
    if (!browserIsOnline()) {
      return { ok: false, local, error: 'offline' }
    }
    try {
      const fromCommit = await fetchRemoteFromCommitsApi(signal)
      if (fromCommit) {
        return {
          ok: true,
          local,
          remote: fromCommit,
          updateAvailable: isShopUpdateAvailable(local, fromCommit),
        }
      }
    } catch {
      /* ignore */
    }
    return { ok: false, local, error: 'fetch_failed' }
  }
}

export function shortSha(sha: string): string {
  const t = sha.trim()
  if (!t) return '—'
  return t.length > 7 ? t.slice(0, 7) : t
}
