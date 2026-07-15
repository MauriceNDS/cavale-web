import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Locale } from 'date-fns'
import { enUS, fr as frDateFns } from 'date-fns/locale'
import en from './locales/en'
import fr from './locales/fr'

/*
 * Interface languages. The source of truth is the user's profile
 * (preferredLanguage — also read by the MCP coach to generate content);
 * localStorage mirrors it so signed-out pages and the first paint after a
 * reload already use the right language.
 */

export type Language = 'fr' | 'en'

const LANG_KEY = 'cavale.lang'

export function storedLanguage(): Language {
  return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'fr'
}

export function applyLanguage(lang: Language) {
  localStorage.setItem(LANG_KEY, lang)
  document.documentElement.lang = lang
  if (i18n.language !== lang) void i18n.changeLanguage(lang)
}

/** date-fns locale matching the active UI language — pass to every format(). */
export function dateLocale(): Locale {
  return i18n.language === 'en' ? enUS : frDateFns
}

/** BCP-47 tag for Number#toLocaleString and friends. */
export function numberLocale(): string {
  return i18n.language === 'en' ? 'en-US' : 'fr-FR'
}

void i18n.use(initReactI18next).init({
  resources: { fr, en },
  lng: storedLanguage(),
  fallbackLng: 'fr',
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
})

document.documentElement.lang = storedLanguage()

export default i18n
