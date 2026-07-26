import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { ApiError } from '../../lib/api'
import {
  applyProposal,
  dismissProposal,
  fetchInsights,
  type ProposalResponse,
  type WeeklyInsightResponse,
} from './api'

const card =
  'rounded-xl border border-moss-200 bg-moss-25 p-4 md:p-5 dark:border-moss-750 dark:bg-moss-850'

/**
 * The coach's weekly reviews: latest first, each with its prose and the
 * structured proposals the athlete approves or dismisses one by one. Nothing
 * the coach suggests touches the plan until it is applied here.
 */
export function CoachPage() {
  const { t } = useTranslation('coach')
  const insights = useQuery({ queryKey: ['coach-insights'], queryFn: () => fetchInsights() })

  return (
    <div className="mx-auto max-w-3xl space-y-4 pt-6">
      <h1 className="font-display text-2xl font-semibold">{t('title')}</h1>
      {insights.isLoading && (
        <p className="text-sm text-moss-500 dark:text-moss-400">{t('common:loading')}</p>
      )}
      {insights.data?.length === 0 && (
        <section className={card}>
          <p className="text-sm text-moss-500 dark:text-moss-400">{t('empty')}</p>
        </section>
      )}
      {insights.data?.map((insight, index) => (
        <InsightCard key={insight.id} insight={insight} latest={index === 0} />
      ))}
    </div>
  )
}

function InsightCard({ insight, latest }: { insight: WeeklyInsightResponse; latest: boolean }) {
  const { t } = useTranslation('coach')
  return (
    <section className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
          {t('weekOf', {
            date: format(parseISO(insight.weekStart), 'd MMMM', { locale: dateLocale() }),
          })}
        </h2>
        {latest && (
          <span className="rounded-full bg-pine-100 px-2 py-0.5 text-[11px] font-semibold text-pine-700 dark:bg-pine-900 dark:text-pine-300">
            {t('latest')}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm whitespace-pre-line">{insight.prose}</p>
      {insight.proposals.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
            {t('proposals')}
          </p>
          {insight.proposals.map((proposal) => (
            <ProposalRow key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}
    </section>
  )
}

function proposalSummary(
  proposal: ProposalResponse,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const p = proposal.payload
  switch (proposal.kind) {
    case 'MOVE_SESSION':
      return t('kind.move', {
        date: format(parseISO(String(p.date)), 'EEEE d MMMM', { locale: dateLocale() }),
      })
    case 'SKIP_SESSION':
      return t('kind.skip')
    case 'ADD_SESSION':
      return t('kind.add', {
        title: String(p.title ?? ''),
        date: format(parseISO(String(p.date)), 'EEEE d MMMM', { locale: dateLocale() }),
      })
    case 'UPDATE_SESSION': {
      const fields = Object.keys(p).join(', ')
      return t('kind.update', { fields })
    }
  }
}

function ProposalRow({ proposal }: { proposal: ProposalResponse }) {
  const { t } = useTranslation('coach')
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (action: 'apply' | 'dismiss') =>
      action === 'apply' ? applyProposal(proposal.id) : dismissProposal(proposal.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-insights'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['hub'] })
    },
  })

  return (
    <div className="rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-800">
      <p className="text-sm font-medium">{proposalSummary(proposal, t)}</p>
      {proposal.rationale && (
        <p className="mt-0.5 text-xs text-moss-500 dark:text-moss-400">{proposal.rationale}</p>
      )}
      {mutation.error instanceof ApiError && (
        <p role="alert" className="mt-1 text-xs text-clay-500 dark:text-clay-300">
          {mutation.error.message}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        {proposal.status === 'PENDING' ? (
          <>
            <button
              onClick={() => mutation.mutate('apply')}
              disabled={mutation.isPending}
              className="rounded-lg bg-pine-600 px-3 py-1.5 text-xs font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
            >
              {t('apply')}
            </button>
            <button
              onClick={() => mutation.mutate('dismiss')}
              disabled={mutation.isPending}
              className="rounded-lg border border-moss-200 px-3 py-1.5 text-xs font-semibold text-moss-500 transition hover:text-ink dark:border-moss-750 dark:text-moss-400 dark:hover:text-linen"
            >
              {t('dismiss')}
            </button>
          </>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              proposal.status === 'APPLIED'
                ? 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300'
                : 'bg-moss-100 text-moss-500 dark:bg-moss-800 dark:text-moss-400'
            }`}
          >
            {t(`status.${proposal.status}`)}
          </span>
        )}
      </div>
    </div>
  )
}
