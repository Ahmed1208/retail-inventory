import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Read on each call so `npm run dev` picks up `.env.development` without stale module state. */
function getSyncCloudUrl(): string | undefined {
  const v = import.meta.env.VITE_SYNC_CLOUD_URL as string | undefined
  const t = v?.trim()
  return t && t.startsWith('http') ? t : undefined
}

function getSyncCloudAnon(): string | undefined {
  const v = import.meta.env.VITE_SYNC_CLOUD_ANON_KEY as string | undefined
  const t = v?.trim()
  return t || undefined
}

/** Valid URL/key placeholders only so `createClient` never receives empty strings (SDK throws). */
const PLACEHOLDER_SYNC_URL = 'http://127.0.0.1:1'
const PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

let placeholderClient: SupabaseClient | null = null

export function isSyncCloudConfigured(): boolean {
  return Boolean(getSyncCloudUrl() && getSyncCloudAnon())
}

/**
 * Second Supabase client (hosted project) for Admin data sync only.
 * Do not use for normal app traffic — keep sessions scoped to the sync page.
 */
export function createCloudSupabaseClient(): SupabaseClient {
  const url = getSyncCloudUrl()
  const anon = getSyncCloudAnon()
  if (!url || !anon) {
    if (!placeholderClient) {
      placeholderClient = createClient(PLACEHOLDER_SYNC_URL, PLACEHOLDER_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    }
    return placeholderClient
  }
  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
