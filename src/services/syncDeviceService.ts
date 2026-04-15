import { supabase } from '@/lib/supabase'
import { getDeviceId } from '@/lib/deviceId'

/** Registers this device for cross-device sync queue fan-out (best-effort). */
export async function touchSyncDevice(): Promise<void> {
  const id = getDeviceId()
  if (!id || id === 'ssr') return
  const { error } = await supabase.rpc('touch_sync_device', { p_device_id: id })
  if (error) {
    if (error.code === '42883' || error.message?.includes('touch_sync_device')) {
      return
    }
    throw error
  }
}
