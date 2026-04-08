import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { ControlPanel } from '@/components/control/ControlPanel'

export function Control() {
  const { t } = useTranslation()

  useEffect(() => {
    document.title = t('control.pageTitle')
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  return (
    <div className="space-y-6">
      <ControlPanel />
    </div>
  )
}
