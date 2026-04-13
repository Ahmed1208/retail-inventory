export type OperatorProfile = {
  id: string
  username: string
  is_admin: boolean
  feature_overrides: Record<string, boolean>
  /** Warehouse IDs this operator may access; empty = none for non-admins (RLS). Admins ignore. */
  allowed_warehouse_ids: number[]
  created_at: string
}
