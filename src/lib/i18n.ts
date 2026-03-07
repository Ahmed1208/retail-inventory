import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enTranslation from '@/locales/en/translation.json'
import arTranslation from '@/locales/ar/translation.json'

const STORAGE_KEY = 'retail-inventory-lang'

function applyLanguageToDocument(lng: string) {
  const lang = (lng?.split('-')[0] ?? 'en') as 'en' | 'ar'
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('data-font', lang === 'ar' ? 'cairo' : 'dm-sans')
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      ar: { translation: arTranslation },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  })

i18n.on('languageChanged', applyLanguageToDocument)
i18n.on('initialized', () => applyLanguageToDocument(i18n.language))

export default i18n
