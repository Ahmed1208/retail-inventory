/**
 * Creates an auth.users row with a **fixed id** (mirrored from the other environment) when the
 * profile row exists but Auth does not — so `upsert_profile_for_data_sync` can apply.
 * Deploy this function on **each** Supabase project (local and hosted). Admin Data sync invokes it
 * via `profileMirrorAuthClient`: local client when pulling into local, cloud client when pushing to cloud.
 *
 * Callable only by an operator admin on that project. Same temp password pattern for sign-in after mirror.
 *
 * Secrets: SUPABASE_* are injected by the platform. Optional OPERATOR_MIRROR_TEMP_PASSWORD (min 8).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const MEMBER_DOMAIN = 'members.stockpilot.local'

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isUuid(s: string): boolean {
  // Accept any 8-4-4-4-12 hex UUID (v1–v8 / RFC 9562). Strict RFC4122 v1–v5-only
  // checks rejected valid modern ids and produced opaque "Invalid user_id" on sync.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: 'Server misconfigured' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.toLowerCase().startsWith('bearer ')) {
    return json(401, { error: 'Missing authorization' })
  }

  const jwt = authHeader.slice(7).trim()

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
  if (userErr || !userData.user) {
    return json(401, {
      error:
        userErr?.message ||
        (jwt.length < 20 ? 'Missing or invalid bearer token' : 'Invalid or expired session'),
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile, error: profErr } = await adminClient
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profErr) {
    return json(500, { error: `Profile lookup failed: ${profErr.message}` })
  }

  const metaAdmin =
    userData.user.user_metadata?.is_admin === true ||
    userData.user.user_metadata?.is_admin === 'true'

  const isCallerAdmin = profile?.is_admin === true || (profile === null && metaAdmin)

  if (!isCallerAdmin) {
    return json(403, {
      error: 'Forbidden: only operator admins can provision mirrored Auth users.',
    })
  }

  let body: {
    user_id?: string
    userId?: string
    id?: string
    email?: string
    user_metadata?: Record<string, unknown>
  }
  try {
    let raw: unknown = await req.json()
    // Some clients/gateways double-encode JSON as a string.
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw)
      } catch {
        return json(400, { error: 'Invalid JSON string body' })
      }
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return json(400, {
        error: `Invalid body type=${raw === null ? 'null' : typeof raw}`,
      })
    }
    body = raw as typeof body
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const userId = String(body.user_id ?? body.userId ?? body.id ?? '').trim()
  if (!isUuid(userId)) {
    const keys = Object.keys(body)
    return json(400, {
      error: `Invalid user_id (len=${userId.length} keys=${keys.join(',') || 'none'} preview=${JSON.stringify(userId).slice(0, 80)})`,
    })
  }

  let email = String(body.email ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return json(400, { error: 'Invalid email' })
  }
  if (!email.endsWith(`@${MEMBER_DOMAIN}`)) {
    return json(400, {
      error: `Email must use @${MEMBER_DOMAIN} (operator namespace).`,
    })
  }

  const user_metadata =
    body.user_metadata && typeof body.user_metadata === 'object'
      ? { ...body.user_metadata }
      : {}

  const { data: existing, error: getErr } = await adminClient.auth.admin.getUserById(userId)
  if (existing?.user) {
    return json(200, { ok: true, already_existed: true })
  }
  // Missing user returns { user: null, error } from the JS client (e.g. 404) — that is OK; we create below.
  if (getErr) {
    const st = (getErr as { status?: number }).status
    const code = String((getErr as { code?: string }).code ?? '')
    const msg = String((getErr as { message?: string }).message ?? '')
    const userMissing =
      st === 404 ||
      code === 'user_not_found' ||
      /user not found|no user found|not found/i.test(msg)
    if (!userMissing) {
      return json(400, { error: `getUserById: ${msg}` })
    }
  }

  const tempPassword =
    (Deno.env.get('OPERATOR_MIRROR_TEMP_PASSWORD') ?? 'devpass123').trim()
  if (tempPassword.length < 8) {
    return json(500, {
      error: 'OPERATOR_MIRROR_TEMP_PASSWORD must be at least 8 characters.',
    })
  }

  async function findUserIdByEmail(targetEmail: string): Promise<string | null> {
    let page = 1
    for (;;) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 200,
      })
      if (error) throw new Error(`listUsers: ${error.message}`)
      const users = data?.users ?? []
      const hit = users.find(
        (u) => (u.email ?? '').toLowerCase() === targetEmail.toLowerCase(),
      )
      if (hit) return hit.id
      if (users.length < 200) return null
      page += 1
      if (page > 50) return null
    }
  }

  const createPayload = {
    id: userId,
    email,
    password: tempPassword,
    email_confirm: true,
    ban_duration: 'none' as const,
    user_metadata,
  }

  let { error: createErr } = await adminClient.auth.admin.createUser(createPayload)

  if (createErr && /already.*(registered|exists|been)/i.test(String(createErr.message))) {
    // Seeded local admin (or a stale mirror) often holds the operator email under a
    // different id. Reclaim the email so sync can create the hosted id on this DB.
    let conflictId: string | null = null
    try {
      conflictId = await findUserIdByEmail(email)
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      return json(400, { error: `email conflict lookup failed: ${m}` })
    }
    if (conflictId === userId) {
      return json(200, { ok: true, already_existed: true })
    }
    if (conflictId) {
      const { error: delErr } = await adminClient.auth.admin.deleteUser(conflictId)
      if (delErr) {
        return json(409, {
          error:
            `Email ${email} is held by auth user ${conflictId} (wanted ${userId}); ` +
            `could not delete conflict: ${delErr.message}. ` +
            'On Windows PowerShell: $env:I_CONFIRM_WIPE_LOCAL_AUTH="YES"; npm run mirror:cloud-auth-to-local',
        })
      }
      const retry = await adminClient.auth.admin.createUser(createPayload)
      if (retry.error) {
        return json(400, {
          error: `createUser after reclaiming email: ${retry.error.message}`,
        })
      }
      return json(200, {
        ok: true,
        created: true,
        replaced_email_conflict: true,
        previous_id: conflictId,
      })
    }
    return json(409, {
      error:
        `${createErr.message} (email=${email}, requested_id=${userId}). ` +
        'On Windows PowerShell: $env:I_CONFIRM_WIPE_LOCAL_AUTH="YES"; npm run mirror:cloud-auth-to-local',
    })
  }

  if (createErr) {
    return json(400, {
      error: `createUser: ${String(createErr.message ?? 'createUser failed')}`,
    })
  }

  return json(200, { ok: true, created: true })
})
