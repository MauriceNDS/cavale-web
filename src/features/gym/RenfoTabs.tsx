import { Link } from '@tanstack/react-router'

/** Renfo sub-navigation: Programmes / Exercices / Stats. */
export function RenfoTabs({ active }: { active: 'programmes' | 'exercices' | 'stats' }) {
  const base = 'rounded-lg px-3.5 py-1.5 text-sm font-medium transition'
  const on = 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300'
  const off =
    'text-moss-500 hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen'

  return (
    <div className="flex items-center gap-1.5">
      <h1 className="mr-3 hidden font-display text-2xl font-semibold md:block">Renfo</h1>
      <Link to="/renfo" className={`${base} ${active === 'programmes' ? on : off}`}>
        Programmes
      </Link>
      <Link to="/renfo/exercices" className={`${base} ${active === 'exercices' ? on : off}`}>
        Exercices
      </Link>
      <Link to="/renfo/stats" className={`${base} ${active === 'stats' ? on : off}`}>
        Stats
      </Link>
    </div>
  )
}
