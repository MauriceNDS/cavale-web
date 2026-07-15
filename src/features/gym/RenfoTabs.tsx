import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

/** Renfo sub-navigation: Programmes / Exercices (+ a shortcut to the stats page). */
export function RenfoTabs({ active }: { active: 'programmes' | 'exercices' | 'stats' }) {
  const { t } = useTranslation('gym')
  const base = 'rounded-lg px-3.5 py-1.5 text-sm font-medium transition'
  const on = 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300'
  const off =
    'text-moss-500 hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen'

  return (
    <div className="flex items-center gap-1.5">
      <h1 className="mr-3 hidden font-display text-2xl font-semibold md:block">{t('tabs.title')}</h1>
      <Link to="/renfo" className={`${base} ${active === 'programmes' ? on : off}`}>
        {t('tabs.programs')}
      </Link>
      <Link to="/renfo/exercices" className={`${base} ${active === 'exercices' ? on : off}`}>
        {t('tabs.exercises')}
      </Link>
      <Link to="/stats" search={{ tab: 'renfo' }} className={`${base} ${active === 'stats' ? on : off}`}>
        {t('tabs.stats')}
      </Link>
    </div>
  )
}
