import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  dismissWhatsNew,
  shopNotesLines,
  shopNotesText,
  type ShopVersionInfo,
} from '@/services/shopVersionService'

type ShopUpdateNoticeProps = {
  remote: ShopVersionInfo
  updateAvailable: boolean
  onDismissWhatsNew?: () => void
  compact?: boolean
}

export function ShopUpdateNotice({
  remote,
  updateAvailable,
  onDismissWhatsNew,
  compact = false,
}: ShopUpdateNoticeProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const notes = remote.notes
  const title = shopNotesText(notes?.title, lang)
  const body = shopNotesText(notes?.body, lang)
  const steps = shopNotesLines(
    updateAvailable ? notes?.beforeUpdate : notes?.afterUpdate,
    lang
  )

  if (!title && !body && steps.length === 0 && !updateAvailable) return null

  return (
    <div
      role="status"
      className={cn(
        'space-y-3 rounded-lg border px-4 py-3 text-sm',
        updateAvailable
          ? 'border-primary/30 bg-primary/5'
          : 'border-teal-500/30 bg-teal-500/10'
      )}
    >
      <p className="font-medium">
        {updateAvailable
          ? t('adminUpdates.updateAvailable', { version: remote.version })
          : t('adminUpdates.whatsNewTitle')}
      </p>
      {title ? <p className="font-medium">{title}</p> : null}
      {body ? <p className="text-muted-foreground">{body}</p> : null}
      {steps.length > 0 ? (
        <ol className="list-decimal space-y-1 ps-5 text-muted-foreground">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      ) : updateAvailable ? (
        <>
          <p className="font-medium">{t('adminUpdates.updateHowTitle')}</p>
          <ol className="list-decimal space-y-1 ps-5 text-muted-foreground">
            <li>{t('adminUpdates.updateStep1')}</li>
            <li>{t('adminUpdates.updateStep2')}</li>
          </ol>
        </>
      ) : null}
      {!compact && !updateAvailable ? (
        <div className="flex flex-wrap gap-2">
          <Link
            to="/people?migrationImport=1"
            className={buttonVariants({ size: 'sm' })}
          >
            {t('adminUpdates.openPeopleImport')}
          </Link>
          <Link
            to="/admin/migration"
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
          >
            {t('adminUpdates.openMigration')}
          </Link>
          {onDismissWhatsNew ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                dismissWhatsNew(remote.version)
                onDismissWhatsNew()
              }}
            >
              {t('adminUpdates.dismissWhatsNew')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
