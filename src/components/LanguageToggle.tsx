import { useTranslation } from 'react-i18next'
import { applyLanguage, type Language } from '../i18n'

/** The switch labels stay in their target language — you always recognise
 *  your own language, whatever the site currently speaks. */
const LANGS: { code: Language; label: string; title: 'lang.toFr' | 'lang.toEn' }[] = [
  { code: 'fr', label: 'FR', title: 'lang.toFr' },
  { code: 'en', label: 'EN', title: 'lang.toEn' },
]

/** Compact FR/EN switch for the signed-out pages. Signed-in users change
 *  language from their profile settings instead (the profile is the source
 *  of truth; this only writes the localStorage mirror). */
export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const active: Language = i18n.language === 'en' ? 'en' : 'fr'

  return (
    <div
      role="group"
      aria-label={t('lang.label')}
      className="flex rounded-lg border border-moss-200 p-0.5 dark:border-moss-750"
    >
      {LANGS.map(({ code, label, title }) => (
        <button
          key={code}
          onClick={() => applyLanguage(code)}
          aria-pressed={active === code}
          title={t(title)}
          className={
            active === code
              ? 'rounded-md bg-moss-100 px-2 py-1 text-xs font-semibold text-ink dark:bg-moss-800 dark:text-linen'
              : 'rounded-md px-2 py-1 text-xs font-medium text-moss-500 transition hover:text-ink dark:text-moss-400 dark:hover:text-linen'
          }
        >
          {label}
        </button>
      ))}
    </div>
  )
}
