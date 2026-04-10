import { FunctionsHttpError } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export type CreateMemberPayload = {
  username: string
  password: string
  feature_overrides: Record<string, boolean>
}

async function messageFromInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response
    try {
      const text = await res.clone().text()
      const parsed = JSON.parse(text) as { error?: string }
      if (typeof parsed?.error === 'string' && parsed.error.length > 0) {
        return `${parsed.error} (HTTP ${res.status})`
      }
    } catch {
      /* ignore parse errors */
    }
    if (res.status === 401) {
      return (
        'Unauthorized (HTTP 401). Your session may have expired — sign out, sign in again, then retry. ' +
        'If this persists, confirm VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY match the same Supabase project.'
      )
    }
    return `${error.message} (HTTP ${res.status})`
  }
  if (error instanceof Error) return error.message
  return String(error)
}

/** User JWT for Edge Functions (never the anon key). */
async function getUserAccessTokenForEdge(): Promise<string | null> {
  const {
    data: { session: s0 },
  } = await supabase.auth.getSession()
  if (!s0?.access_token) return null

  const { data, error } = await supabase.auth.refreshSession()
  if (!error && data.session?.access_token) {
    return data.session.access_token
  }
  return s0.access_token
}

async function invokeEdgeFunction(
  name: string,
  body: object
): Promise<{ data: unknown; invokeError: unknown; notSignedIn: boolean }> {
  const accessToken = await getUserAccessTokenForEdge()
  if (!accessToken) {
    return {
      data: null,
      invokeError: null,
      notSignedIn: true,
    }
  }

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(anonKey ? { apikey: anonKey } : {}),
    },
  })

  return { data, invokeError: error, notSignedIn: false }
}

export async function createMemberViaEdge(
  payload: CreateMemberPayload
): Promise<{ user_id: string | null; error: string | null }> {
  const { data, invokeError, notSignedIn } = await invokeEdgeFunction(
    'create-member',
    payload
  )

  if (notSignedIn) {
    return {
      user_id: null,
      error:
        'Not signed in (no access token). Open /login, sign in as an admin, then try again.',
    }
  }

  if (invokeError) {
    return { user_id: null, error: await messageFromInvokeError(invokeError) }
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

export async function updateMemberPasswordViaEdge(
  userId: string,
  password: string
): Promise<{ error: string | null }> {
  const { data, invokeError, notSignedIn } = await invokeEdgeFunction(
    'update-member',
    { user_id: userId, password }
  )

  if (notSignedIn) {
    return {
      error:
        'Not signed in (no access token). Open /login, sign in as an admin, then try again.',
    }
  }

  if (invokeError) {
    return { error: await messageFromInvokeError(invokeError) }
  }

  const body = data as { ok?: boolean; error?: string } | null
  if (body && typeof body.error === 'string') {
    return { error: body.error }
  }
  return { error: null }
}
