/**
 * Creates a local auth.users row with a fixed id (mirrored from hosted) so profile sync can apply.
 * Callable only by a local operator admin. Used during Admin → Data sync (pull from cloud).
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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
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
    email?: string
    user_metadata?: Record<string, unknown>
  }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const userId = String(body.user_id ?? '').trim()
  if (!isUuid(userId)) {
    return json(400, { error: 'Invalid user_id' })
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

  const { error: createErr } = await adminClient.auth.admin.createUser({
    id: userId,
    email,
    password: tempPassword,
    email_confirm: true,
    ban_duration: 'none',
    user_metadata,
  })

  if (createErr) {
    return json(400, { error: createErr.message })
  }

  return json(200, { ok: true, created: true })
})
