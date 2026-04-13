import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const MEMBER_DOMAIN = 'members.stockpilot.local'

function slugUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.toLowerCase().startsWith('bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const jwt = authHeader.slice(7).trim()

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
  if (userErr || !userData.user) {
    const detail =
      userErr?.message ||
      (jwt.length < 20 ? 'Missing or invalid bearer token' : 'Invalid or expired session')
    return new Response(JSON.stringify({ error: detail }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    return new Response(
      JSON.stringify({ error: `Profile lookup failed: ${profErr.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  const metaAdmin =
    userData.user.user_metadata?.is_admin === true ||
    userData.user.user_metadata?.is_admin === 'true'

  const isCallerAdmin =
    profile?.is_admin === true || (profile === null && metaAdmin)

  if (!isCallerAdmin) {
    return new Response(
      JSON.stringify({
        error:
          'Forbidden: only admins can create members. Set public.profiles.is_admin = true for your user (and ensure a profiles row exists), or set user_metadata.is_admin in Auth and sign in again.',
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  let body: {
    username?: string
    password?: string
    feature_overrides?: Record<string, boolean>
    allowed_warehouse_ids?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const username = slugUsername(body.username ?? '')
  const password = body.password ?? ''
  const feature_overrides =
    body.feature_overrides && typeof body.feature_overrides === 'object'
      ? body.feature_overrides
      : {}

  const rawWh = body.allowed_warehouse_ids
  const allowedWarehouseIds: number[] = Array.isArray(rawWh)
    ? rawWh
        .map((x) => (typeof x === 'number' ? x : Number(String(x))))
        .filter((n) => Number.isFinite(n) && n > 0)
    : []

  if (allowedWarehouseIds.length === 0) {
    return new Response(
      JSON.stringify({
        error:
          'allowed_warehouse_ids must include at least one warehouse id for the new member.',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  if (username.length < 2 || username.length > 64) {
    return new Response(JSON.stringify({ error: 'Invalid username' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'Password too short' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const email = `${username}@${MEMBER_DOMAIN}`

  const { data: created, error: createErr } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        is_admin: false,
        feature_overrides,
        allowed_warehouse_ids: allowedWarehouseIds,
      },
    })

  if (createErr) {
    return new Response(JSON.stringify({ error: createErr.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({ user_id: created.user?.id ?? null }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
