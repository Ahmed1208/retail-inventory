import type { SupabaseClient } from '@supabase/supabase-js'

export type SyncRunRow = {
  started_at: string
  completed_at: string
  status: 'success' | 'error' | 'cancelled'
  initiator_user_id: string | null
  device_label: string | null
  mode: string
  summary: Record<string, unknown>
  error_message: string | null
}

function deviceLabel(): string | null {
  if (typeof navigator === 'undefined') return null
  try {
    return navigator.userAgent.slice(0, 240)
  } catch {
    return null
  }
}

/** Writes one audit row per database (local + cloud when provided). */
export async function recordSyncRuns({
  localClient,
  cloudClient,
  localUserId,
  cloudUserId,
  startedAt,
  status,
  mode,
  summary,
  errorMessage,
}: {
  localClient: SupabaseClient
  cloudClient: SupabaseClient | null
  localUserId: string | null
  cloudUserId: string | null
  startedAt: string
  status: 'success' | 'error' | 'cancelled'
  mode: string
  summary: Record<string, unknown>
  errorMessage: string | null
}): Promise<void> {
  const completedAt = new Date().toISOString()
  const label = deviceLabel()

  const localRow: SyncRunRow = {
    started_at: startedAt,
    completed_at: completedAt,
    status,
    initiator_user_id: localUserId,
    device_label: label,
    mode,
    summary,
    error_message: errorMessage,
  }

  await localClient.from('sync_runs').insert(localRow)

  if (cloudClient) {
    const cloudRow: SyncRunRow = {
      ...localRow,
      initiator_user_id: cloudUserId,
    }
    await cloudClient.from('sync_runs').insert(cloudRow)
  }
}

export async function listSyncRuns(
  client: SupabaseClient,
  limit = 50
): Promise<
  {
    id: string
    started_at: string
    completed_at: string | null
    status: string
    mode: string
    summary: Record<string, unknown>
    error_message: string | null
  }[]
> {
  const { data, error } = await client
    .from('sync_runs')
    .select('id, started_at, completed_at, status, mode, summary, error_message')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id as string,
    started_at: r.started_at as string,
    completed_at: (r.completed_at as string) ?? null,
    status: r.status as string,
    mode: r.mode as string,
    summary:
      r.summary && typeof r.summary === 'object' && !Array.isArray(r.summary)
        ? (r.summary as Record<string, unknown>)
        : {},
    error_message: (r.error_message as string) ?? null,
  }))
}
