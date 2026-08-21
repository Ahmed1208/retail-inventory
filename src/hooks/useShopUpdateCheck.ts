import { useQuery } from '@tanstack/react-query'

import {
  SHOP_VERSION_QUERY_KEY,
  fetchRemoteShopVersion,
} from '@/services/shopVersionService'

export function useShopUpdateCheck(enabled: boolean) {
  return useQuery({
    queryKey: SHOP_VERSION_QUERY_KEY,
    queryFn: () => fetchRemoteShopVersion(),
    enabled,
    staleTime: 60_000,
    refetchInterval: 15 * 60 * 1000,
    retry: 1,
  })
}
