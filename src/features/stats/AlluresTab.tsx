import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { card, muted } from '../../lib/ui'
import { fetchPaceModel, type Allure } from '../calendar/api'
import { allureHrBand, allureLabel, allurePaceBand } from '../calendar/labels'

const ORDER: Allure[] = ['LENTE', 'EF', 'COURSE', 'SEUIL60', 'SEUIL30', 'VMA', 'SPRINT']

/**
 * The athlete's current pace and HR band per run type — derived at display
 * time from the fitted model, so the table follows fitness in both
 * directions without anyone maintaining it.
 */
export function AlluresTab() {
  const { t } = useTranslation('stats')
  const query = useQuery({ queryKey: ['pace-model'], queryFn: fetchPaceModel, staleTime: 5 * 60_000 })
  const pace = query.data

  if (!pace) return null

  return (
    <section className={card}>
      <h2 className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
        {t('paceTable.title')}
      </h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`text-xs ${muted}`}>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">
                {t('paceTable.type')}
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                {t('paceTable.pace')}
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                {t('paceTable.hr')}
              </th>
            </tr>
          </thead>
          <tbody>
            {ORDER.map((allure) => {
              const band = allurePaceBand(pace, allure)
              const hr = allureHrBand(pace, allure)
              return (
                <tr key={allure} className="border-t border-moss-200 dark:border-moss-750">
                  <td className="px-2 py-1.5 font-medium">{allureLabel(allure)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{band?.label ?? '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{hr ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className={`mt-3 space-y-1 text-xs ${muted}`}>
        <p>
          {pace.personal
            ? t('paceTable.fitted', { count: pace.sampleSize })
            : t('paceTable.coldStart')}
          {pace.thresholdAnchored && <> · {t('paceTable.thresholdAnchored')}</>}
        </p>
        {pace.lthr != null ? (
          <p>{t('paceTable.lthrAnchor', { hr: pace.lthr })}</p>
        ) : (
          pace.maxHr != null && (
            <p>
              {t('paceTable.maxHr', { hr: pace.maxHr })}{' '}
              {pace.maxHrFromProfile ? t('paceTable.maxHrProfile') : t('paceTable.maxHrObserved')}
            </p>
          )
        )}
        <p>{t('paceTable.climbCost', { cost: Math.round(pace.climbSecPerMeter * 10) })}</p>
      </div>
    </section>
  )
}
