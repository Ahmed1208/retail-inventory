import { supabase } from '@/lib/supabase'

export type CreateMemberPayload = {
  username: string
  password: string
  feature_overrides: Record<string, boolean>
}

export async function createMemberViaEdge(
  payload: CreateMemberPayload
): Promise<{ user_id: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('create-member', {
    body: payload,
  })

  if (error) {
    return { user_id: null, error: error.message }
  }

  const body = data as { user_id?: string; error?: string } | null
  if (body && typeof body.error === 'string') {
    return { user_id: null, error: body.error }
  }
  return {
    user_id: body?.user_id ?? null,
    error: null,
  }
}
