import { supabase } from '@/lib/supabase'
import type { OperatorProfile } from '@/types/profile'

export async function fetchOperatorProfile(
  userId: string
): Promise<OperatorProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, is_admin, feature_overrides, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  const fo = data.feature_overrides
  return {
    id: data.id,
    username: data.username,
    is_admin: data.is_admin,
    feature_overrides:
      fo && typeof fo === 'object' && !Array.isArray(fo)
        ? (fo as Record<string, boolean>)
        : {},
    created_at: data.created_at,
  }
}
