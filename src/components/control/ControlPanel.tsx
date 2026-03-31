import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { FEATURE_CONTROL_REGISTRY } from '@/config/featureControls'
import { useFeatureControlContext } from '@/context/FeatureControlContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ControlPanel() {
  const { t } = useTranslation()
  const { state, setEnabled, resetToDefaults } = useFeatureControlContext()
  const headingId = useId()

  return (
    <section
      id="control-panel"
      role="region"
      aria-labelledby={headingId}
      className="space-y-6 rounded-xl border border-border bg-card/40 p-4 md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2
            id={headingId}
            className="text-lg font-semibold text-foreground"
          >
            {t('control.title')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t('control.intro')}
          </p>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">
            {t('control.securityNote')}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={resetToDefaults}>
          {t('control.resetDefaults')}
        </Button>
      </div>

      <div className="space-y-10">
        {FEATURE_CONTROL_REGISTRY.map((area) => (
          <div key={area.titleKey}>
            <h3 className="text-base font-semibold text-foreground">
              {t(area.titleKey)}
            </h3>
            <div className="mt-4 space-y-8 border-s-2 border-muted ps-4">
              {area.groups.map((group) => (
                <div key={group.titleKey}>
                  <h4 className="text-sm font-medium text-muted-foreground">
                    {t(group.titleKey)}
                  </h4>
                  <ul className="mt-3 space-y-4">
                    {group.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex gap-3 rounded-lg border border-border/80 bg-background/60 p-3"
                      >
                        <input
                          id={`fc-${item.id}`}
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0 rounded border-input"
                          checked={state[item.id]}
                          onChange={(e) => setEnabled(item.id, e.target.checked)}
                        />
                        <label
                          htmlFor={`fc-${item.id}`}
                          className={cn(
                            'min-w-0 flex-1 cursor-pointer',
                            !state[item.id] && 'text-muted-foreground'
                          )}
                        >
                          <span className="font-medium text-foreground">
                            {t(item.titleKey)}
                          </span>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t(item.descriptionKey)}
                          </p>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
