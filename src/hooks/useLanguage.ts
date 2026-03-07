import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'retail-inventory-lang'

export type Language = 'en' | 'ar'

export function useLanguage() {
  const { i18n } = useTranslation()

  const currentLanguage = (i18n.language?.split('-')[0] ?? 'en') as Language
  const isRTL = currentLanguage === 'ar'

  const toggleLanguage = useCallback(() => {
    const next: Language = currentLanguage === 'en' ? 'ar' : 'en'
    i18n.changeLanguage(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [currentLanguage, i18n])

  return { currentLanguage, toggleLanguage, isRTL }
}
