/** Stable synthetic email domain for username-based operator sign-in (Supabase Auth). */
export const MEMBER_EMAIL_DOMAIN = 'members.stockpilot.local'

/** Map UI username to Auth email (normalized local part). */
export function usernameToMemberEmail(username: string): string {
  const trimmed = username.trim().toLowerCase()
  const local = trimmed.replace(/[^a-z0-9._-]/g, '') || 'user'
  return `${local}@${MEMBER_EMAIL_DOMAIN}`
}
