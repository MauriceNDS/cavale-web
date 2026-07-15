import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Trans, useTranslation } from 'react-i18next'
import { ThemeModeSelector } from '../../components/ThemeModeSelector'
import { applyLanguage, dateLocale, type Language } from '../../i18n'
import { ApiError } from '../../lib/api'
import { issuePat, updateProfile, type IssuedToken } from '../athlete/api'
import { useAuth } from '../auth/session'
import { ShoesCard } from '../shoes/ShoesCard'
import { disconnectStrava, fetchAuthorizeUrl, fetchStravaStatus } from '../strava/api'

/** App behaviour and integrations — general athlete info lives in Profil. */
export function ParametersPage() {
  const { t } = useTranslation('settings')
  const [banner, setBanner] = useState<'connected' | 'error' | null>(null)

  // Result of the OAuth round-trip (backend redirects here with ?strava=…)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const outcome = params.get('strava')
    if (outcome === 'connected' || outcome === 'error') {
      setBanner(outcome)
      window.history.replaceState(null, '', '/parametres')
    }
  }, [])

  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <h1 className="font-display text-2xl font-semibold">{t('parameters.title')}</h1>

      {banner === 'connected' && (
        <div role="status" className="mt-4 rounded-lg bg-pine-100 p-3 text-sm text-pine-700 dark:bg-pine-900 dark:text-pine-300">
          {t('parameters.stravaConnected')}
        </div>
      )}
      {banner === 'error' && (
        <div role="alert" className="mt-4 rounded-lg bg-clay-100 p-3 text-sm text-clay-600 dark:bg-clay-900 dark:text-clay-300">
          {t('parameters.stravaError')}
        </div>
      )}

      <UsageCard />
      <LanguageCard />
      <ThemeCard />
      <ShoesCard />
      <StravaCard />
      <McpCard />
    </div>
  )
}

/** Running only ⇄ running + strength — pure UI gating, data stays intact. */
function UsageCard() {
  const { t } = useTranslation('settings')
  const { user, refresh } = useAuth()
  const mutation = useMutation({
    mutationFn: (gymEnabled: boolean) =>
      updateProfile({ displayName: user!.displayName, weightKg: user!.weightKg,
        heightCm: user!.heightCm, birthDate: user!.birthDate, maxHr: user!.maxHr,
        restingHr: user!.restingHr, gymEnabled }),
    onSuccess: () => void refresh(),
  })
  if (!user) return null

  const cls = (active: boolean) =>
    `flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold transition disabled:opacity-50 sm:flex-none ${
      active
        ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
        : 'border border-moss-200 text-moss-500 hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800'
    }`

  return (
    <section className="mt-6 rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850">
      <h2 className="font-display text-lg font-semibold">{t('parameters.usage.title')}</h2>
      <p className="mt-0.5 text-sm text-moss-500 dark:text-moss-400">{t('parameters.usage.intro')}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => mutation.mutate(false)}
          disabled={mutation.isPending}
          aria-pressed={!user.gymEnabled}
          className={cls(!user.gymEnabled)}
        >
          {t('parameters.usage.runningOnly')}
        </button>
        <button
          onClick={() => mutation.mutate(true)}
          disabled={mutation.isPending}
          aria-pressed={user.gymEnabled}
          className={cls(user.gymEnabled)}
        >
          {t('parameters.usage.runningAndGym')}
        </button>
      </div>
    </section>
  )
}

/** Interface language — also what the MCP coach writes generated content in. */
function LanguageCard() {
  const { t } = useTranslation('settings')
  const { user, refresh } = useAuth()
  const mutation = useMutation({
    mutationFn: (preferredLanguage: Language) =>
      updateProfile({ displayName: user!.displayName, weightKg: user!.weightKg,
        heightCm: user!.heightCm, birthDate: user!.birthDate, maxHr: user!.maxHr,
        restingHr: user!.restingHr, preferredLanguage }),
    onSuccess: (updated) => {
      applyLanguage(updated.preferredLanguage)
      void refresh()
    },
  })
  if (!user) return null

  // Language names stay in their own language — never translated.
  const options: { value: Language; label: string }[] = [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
  ]

  return (
    <section className="mt-6 rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850">
      <h2 className="font-display text-lg font-semibold">{t('parameters.language.title')}</h2>
      <p className="mt-0.5 text-sm text-moss-500 dark:text-moss-400">{t('parameters.language.intro')}</p>
      <div className="mt-3 flex gap-2" role="radiogroup" aria-label={t('parameters.language.title')}>
        {options.map(({ value, label }) => (
          <button
            key={value}
            role="radio"
            aria-checked={user.preferredLanguage === value}
            onClick={() => mutation.mutate(value)}
            disabled={mutation.isPending}
            className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold transition disabled:opacity-50 sm:flex-none ${
              user.preferredLanguage === value
                ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
                : 'border border-moss-200 text-moss-500 hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mutation.error instanceof ApiError && (
        <p role="alert" className="mt-2 text-sm text-clay-500 dark:text-clay-300">
          {mutation.error.message}
        </p>
      )}
    </section>
  )
}

function ThemeCard() {
  const { t } = useTranslation('settings')
  return (
    <section className="mt-6 rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850">
      <h2 className="font-display text-lg font-semibold">{t('parameters.theme.title')}</h2>
      <p className="mt-0.5 text-sm text-moss-500 dark:text-moss-400">{t('parameters.theme.intro')}</p>
      <div className="mt-3 max-w-xs">
        <ThemeModeSelector />
      </div>
    </section>
  )
}

function StravaCard() {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const status = useQuery({ queryKey: ['strava-status'], queryFn: fetchStravaStatus })

  const connect = useMutation({
    mutationFn: fetchAuthorizeUrl,
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })

  const disconnect = useMutation({
    mutationFn: disconnectStrava,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['strava-status'] }),
  })

  const data = status.data

  return (
    <section className="mt-6 rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{t('parameters.strava.title')}</h2>
          <p className="mt-0.5 text-sm text-moss-500 dark:text-moss-400">{t('parameters.strava.intro')}</p>
        </div>
        {data?.connected && (
          <span className="rounded-full bg-pine-100 px-2.5 py-0.5 text-xs font-semibold text-pine-700 dark:bg-pine-900 dark:text-pine-300">
            {t('parameters.strava.connected')}
          </span>
        )}
      </div>

      {status.isLoading && <p className="mt-4 text-sm text-moss-500 dark:text-moss-400">{t('common:loading')}</p>}

      {data && !data.configured && (
        <div className="mt-4 rounded-lg bg-moss-100 p-3 text-sm text-moss-500 dark:bg-moss-800 dark:text-moss-400">
          <p className="font-medium text-ink dark:text-linen">{t('parameters.strava.configTitle')}</p>
          <ol className="mt-1 list-inside list-decimal space-y-0.5">
            <li>
              <Trans
                t={t}
                i18nKey="parameters.strava.configStep1"
                components={[
                  <a
                    key="link"
                    href="https://www.strava.com/settings/api"
                    target="_blank"
                    rel="noreferrer"
                    className="text-pine-700 underline dark:text-pine-300"
                  />,
                  <code key="code" />,
                ]}
              />
            </li>
            <li>
              <Trans t={t} i18nKey="parameters.strava.configStep2" components={[<code key="code" />]} />
            </li>
          </ol>
        </div>
      )}

      {data?.configured && !data.connected && (
        <button
          onClick={() => connect.mutate()}
          disabled={connect.isPending}
          className="mt-4 rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e04502] disabled:opacity-50"
        >
          {connect.isPending ? t('parameters.strava.connecting') : t('parameters.strava.connect')}
        </button>
      )}

      {data?.connected && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-moss-500 tabular-nums dark:text-moss-400">
            {t('parameters.strava.athleteId', { id: data.athleteId })}
          </p>
          <button
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
          >
            {t('parameters.strava.disconnect')}
          </button>
        </div>
      )}
    </section>
  )
}

/** MCP credential: connect the owner's Claude as the coach. Token shown once. */
function McpCard() {
  const { t } = useTranslation('settings')
  const [issued, setIssued] = useState<IssuedToken | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: issuePat,
    onSuccess: (token) => {
      setIssued(token)
      setCopied(null)
    },
  })

  const mcpUrl = `${window.location.protocol}//${window.location.hostname}:8080/mcp`
  const claudeCommand = issued
    ? `claude mcp add --transport http cavale ${mcpUrl} --header "Authorization: Bearer ${issued.token}"`
    : ''

  function copy(text: string, what: string) {
    void navigator.clipboard.writeText(text).then(() => setCopied(what))
  }

  const copyButton = (text: string, what: string) => (
    <button
      type="button"
      onClick={() => copy(text, what)}
      className="shrink-0 rounded-lg border border-moss-200 px-3 py-1.5 text-sm font-medium transition hover:bg-moss-100 dark:border-moss-750 dark:hover:bg-moss-800"
    >
      {copied === what ? t('common:copied') : t('common:copy')}
    </button>
  )

  return (
    <section className="mt-6 rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850">
      <h2 className="font-display text-lg font-semibold">{t('parameters.mcp.title')}</h2>
      <p className="mt-0.5 text-sm text-moss-500 dark:text-moss-400">{t('parameters.mcp.intro')}</p>

      {!issued && (
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="mt-4 rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          {mutation.isPending ? t('parameters.mcp.generating') : t('parameters.mcp.generate')}
        </button>
      )}
      {mutation.error instanceof ApiError && (
        <p role="alert" className="mt-2 text-sm text-clay-500 dark:text-clay-300">
          {mutation.error.message}
        </p>
      )}

      {issued && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-moss-500 dark:text-moss-400">
            {t('parameters.mcp.validUntil', {
              date: format(parseISO(issued.expiresAt), 'd MMMM yyyy', { locale: dateLocale() }),
            })}
          </p>
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 rounded-lg bg-moss-100 p-2.5 text-xs break-all dark:bg-moss-800">
              {issued.token}
            </code>
            {copyButton(issued.token, 'token')}
          </div>
          <p className="text-sm font-medium">{t('parameters.mcp.claudeCode')}</p>
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 rounded-lg bg-moss-100 p-2.5 text-xs break-all dark:bg-moss-800">
              {claudeCommand}
            </code>
            {copyButton(claudeCommand, 'command')}
          </div>
          <p className="text-xs text-moss-500 dark:text-moss-400">
            <Trans
              t={t}
              i18nKey="parameters.mcp.desktop"
              values={{ url: mcpUrl }}
              components={[<code key="url" />, <code key="header" />]}
            />
          </p>
        </div>
      )}
    </section>
  )
}
