export type OperatorProfile = {
  id: string
  username: string
  is_admin: boolean
  feature_overrides: Record<string, boolean>
  created_at: string
}
