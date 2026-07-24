import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import topoUrl from '../../assets/topo.svg'
import { LanguageToggle } from '../../components/LanguageToggle'
import { LogoMark } from '../../components/LogoMark'
import { DemoButton } from '../auth/DemoButton'

/*
 * Public landing page — Cavale's shop window while there is no separate
 * portfolio site. Lazy-loaded from the router so `motion` and this whole
 * scene never weigh down the signed-in bundle.
 */

/* ── Motion helpers ────────────────────────────────────────────────── */

const heroContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
}

const heroItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

/** Fade-and-rise once when the block scrolls into view. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

/* ── Icons (same stroke idiom as the app shell) ────────────────────── */

interface IconProps {
  className?: string
}

function iconSvg(paths: ReactNode, className?: string) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths}
    </svg>
  )
}

const IconPlan = ({ className }: IconProps) =>
  iconSvg(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M6.5 17.5 10 13l2.5 3 2-2.5 3 4" />
    </>,
    className,
  )

const IconBolt = ({ className }: IconProps) =>
  iconSvg(<path d="M13 2 5 13.5h5.5L11 22l8-11.5h-5.5L13 2Z" />, className)

const IconDumbbell = ({ className }: IconProps) =>
  iconSvg(
    <path d="M8.5 12h7M5 9v6M8.5 7.5v9M15.5 7.5v9M19 9v6M2.5 10.5v3M21.5 10.5v3" />,
    className,
  )

const IconWatch = ({ className }: IconProps) =>
  iconSvg(
    <>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 9.5V12l1.8 1.8M9 5.5 9.5 2h5L15 5.5M9 18.5 9.5 22h5l.5-3.5" />
    </>,
    className,
  )

const IconChart = ({ className }: IconProps) =>
  iconSvg(<path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />, className)

const IconFlag = ({ className }: IconProps) =>
  iconSvg(<path d="M6 21V4m0 1h11l-2.5 3.5L17 12H6" />, className)

const IconPulse = ({ className }: IconProps) =>
  iconSvg(<path d="M3 12h4l2.5-6 4 12 2.5-6h5" />, className)

/** Official GitHub mark (filled, not our stroke idiom — it's a logo). */
const IconGitHub = ({ className }: IconProps) => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
)

const REPO_URL = 'https://github.com/MauriceNDS/cavale'

/* ── Hero ridge scene ──────────────────────────────────────────────── */

const RIDGE_BACK =
  'M0 250 L110 170 L230 225 L360 130 L470 205 L610 95 L760 195 L900 120 L1040 200 L1180 140 L1320 210 L1440 165 V340 H0 Z'
const RIDGE_MID =
  'M0 285 L150 215 L300 262 L450 185 L610 255 L780 165 L950 245 L1120 195 L1290 260 L1440 215 V340 H0 Z'
const RIDGE_FRONT =
  'M0 316 L180 262 L360 300 L560 240 L740 292 L940 230 L1140 284 L1320 248 L1440 288 V340 H0 Z'
/** The winding trail — echoes the logo mark, drawn in on load. */
const TRAIL =
  'M-20 330 C150 315 240 280 340 262 C440 244 520 258 610 230 C700 202 760 160 830 135 C880 117 906 106 922 99'
const CONTOUR =
  'M0 262 L110 185 L230 238 L360 145 L470 218 L610 110 L760 208 L900 135 L1040 213 L1180 155 L1320 222 L1440 178'

function Chip({
  children,
  dot,
  className,
  delay,
}: {
  children: ReactNode
  dot: string
  className: string
  delay: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={`absolute z-10 ${className}`}
      initial={reduce ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.5, ease: 'easeOut' }}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -7, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay }}
        className="flex items-center gap-1.5 rounded-full border border-moss-200 bg-moss-25/90 px-3 py-1.5 text-xs font-medium text-ink shadow-md backdrop-blur dark:border-moss-750 dark:bg-moss-850/90 dark:text-linen"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        {children}
      </motion.div>
    </motion.div>
  )
}

function HeroRidge() {
  const { t } = useTranslation('landing')
  const reduce = useReducedMotion()

  return (
    <div className="relative h-52 sm:h-64 md:h-80" aria-hidden="true">
      <Chip dot="bg-lake-600 dark:bg-lake-300" className="left-[6%] top-[6%]" delay={1.0}>
        {t('chips.long')}
      </Chip>
      <Chip dot="bg-pine-600 dark:bg-pine-350" className="left-1/2 top-0 hidden -translate-x-1/2 sm:block" delay={1.25}>
        {t('chips.vert')}
      </Chip>
      <Chip dot="bg-clay-500 dark:bg-clay-300" className="right-[6%] top-[12%] hidden md:block" delay={1.5}>
        {t('chips.shock')}
      </Chip>

      <svg viewBox="0 0 1440 340" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <path d={RIDGE_BACK} className="fill-moss-200 dark:fill-moss-800" />
        <path
          d={CONTOUR}
          fill="none"
          strokeWidth="1.5"
          strokeDasharray="4 7"
          className="stroke-moss-400/50 dark:stroke-moss-700"
        />
        <path d={RIDGE_MID} className="fill-moss-300/60 dark:fill-moss-750" />
        <path d={RIDGE_FRONT} className="fill-pine-600/20 dark:fill-pine-900" />
        <motion.path
          d={TRAIL}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-pine-600 dark:stroke-pine-350"
          initial={reduce ? undefined : { pathLength: 0 }}
          animate={reduce ? undefined : { pathLength: 1 }}
          transition={{ duration: 2.2, delay: 0.5, ease: 'easeInOut' }}
        />
        <motion.circle
          cx="922"
          cy="99"
          r="6"
          className="fill-pine-600 dark:fill-pine-350"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: reduce ? 0 : 2.5, duration: 0.35, ease: 'easeOut' }}
        />
      </svg>
    </div>
  )
}

/* ── Product mockups (decorative, hand-drawn with the app's tokens) ── */

const cardFrame =
  'rounded-2xl border border-moss-200 bg-moss-25 p-5 shadow-xl shadow-moss-950/5 dark:border-moss-750 dark:bg-moss-850 dark:shadow-black/25'

const WEEK_PILLS = [
  { key: 'ef', cls: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300' },
  { key: 'vma', cls: 'bg-rowan-600/10 text-rowan-600 dark:bg-rowan-300/15 dark:text-rowan-300' },
  { key: 'gym', cls: 'bg-copper-600/10 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300' },
  { key: 'threshold', cls: 'bg-gold-600/10 text-gold-600 dark:bg-gold-300/15 dark:text-gold-300' },
  { key: 'rest', cls: 'border border-dashed border-moss-300 text-moss-400 dark:border-moss-700 dark:text-moss-500' },
  { key: 'hills', cls: 'bg-teal-600/10 text-teal-600 dark:bg-teal-300/15 dark:text-teal-300' },
  { key: 'long', cls: 'bg-lake-600/10 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300' },
] as const

const WEEK_LOAD = [45, 70, 30, 60, 12, 48, 95]

function WeekMockup() {
  const { t } = useTranslation('landing')
  const days = t('showcase.week.days').split(' ')

  return (
    <motion.div style={{ rotate: -1.2 }} whileHover={{ rotate: 0, y: -6 }} className={cardFrame} aria-hidden="true">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t('showcase.week.header')}</p>
        <span className="rounded-full bg-clay-100 px-2.5 py-0.5 text-xs font-semibold text-clay-600 dark:bg-clay-900 dark:text-clay-300">
          {t('showcase.week.badge')}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {WEEK_PILLS.map((pill, i) => (
          <div key={pill.key} className="min-w-0">
            <p className="text-center text-[10px] font-medium text-moss-400 dark:text-moss-500">{days[i]}</p>
            <div className={`mt-1 flex h-14 items-end justify-center rounded-lg px-0.5 pb-1.5 ${pill.cls}`}>
              <span className="text-center text-[9px] font-semibold leading-tight break-words">
                {t(`showcase.week.sessions.${pill.key}`)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-moss-400 dark:text-moss-500">
          {t('showcase.week.load')}
        </p>
        <div className="mt-1.5 flex h-8 items-end gap-1">
          {WEEK_LOAD.map((h, i) => (
            <div
              key={i}
              style={{ height: `${h}%` }}
              className={`flex-1 rounded-sm ${
                i === WEEK_LOAD.length - 1
                  ? 'bg-pine-600 dark:bg-pine-350'
                  : 'bg-pine-600/25 dark:bg-pine-350/25'
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function ActivityMockup() {
  const { t } = useTranslation('landing')

  return (
    <motion.div style={{ rotate: 1.2 }} whileHover={{ rotate: 0, y: -6 }} className={cardFrame} aria-hidden="true">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{t('showcase.activity.title')}</p>
          <p className="text-xs text-moss-400 dark:text-moss-500">{t('showcase.activity.date')}</p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lake-600/10 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300">
          <IconPulse className="h-4.5 w-4.5" />
        </span>
      </div>

      <svg viewBox="0 0 300 90" className="mt-4 w-full">
        <path
          d="M0 78 L30 62 L60 68 L95 40 L125 52 L160 24 L195 44 L230 18 L265 38 L300 30 V90 H0 Z"
          className="fill-lake-600/15 dark:fill-lake-300/10"
        />
        <path
          d="M0 78 L30 62 L60 68 L95 40 L125 52 L160 24 L195 44 L230 18 L265 38 L300 30"
          fill="none"
          strokeWidth="2"
          strokeLinejoin="round"
          className="stroke-lake-600 dark:stroke-lake-300"
        />
        <path
          d="M0 60 C40 58 60 50 90 52 C130 55 150 40 180 42 C220 45 250 32 300 36"
          fill="none"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          className="stroke-clay-500/70 dark:stroke-clay-300/70"
        />
      </svg>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-moss-200 pt-3 dark:border-moss-750">
        {(['km', 'vert', 'time'] as const).map((k) => (
          <div key={k}>
            <p className="text-[10px] uppercase tracking-wide text-moss-400 dark:text-moss-500">
              {t(`showcase.activity.${k}Label`)}
            </p>
            <p className="text-sm font-semibold tabular-nums">{t(`showcase.activity.${k}`)}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/* ── Sections ──────────────────────────────────────────────────────── */

const primaryCta =
  'w-full rounded-xl bg-pine-600 px-8 py-3.5 text-base font-semibold text-moss-25 shadow-lg shadow-pine-600/25 transition hover:bg-pine-700 disabled:opacity-50 sm:w-auto dark:bg-pine-350 dark:text-moss-950 dark:shadow-pine-350/15 dark:hover:bg-pine-300'

const secondaryCta =
  'w-full rounded-xl border border-moss-200 bg-moss-25 px-8 py-3.5 text-center text-base font-semibold text-ink transition hover:border-pine-600/50 hover:text-pine-700 sm:w-auto dark:border-moss-750 dark:bg-moss-850 dark:text-linen dark:hover:border-pine-350/50 dark:hover:text-pine-300'

function Hero() {
  const { t } = useTranslation('landing')
  const reduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden">
      <motion.div
        variants={heroContainer}
        initial={reduce ? false : 'hidden'}
        animate="show"
        className="mx-auto max-w-6xl px-4 pt-14 pb-4 text-center md:pt-24"
      >
        <motion.p
          variants={heroItem}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-pine-600 dark:text-pine-350"
        >
          {t('hero.eyebrow')}
        </motion.p>
        <motion.h1
          variants={heroItem}
          className="mx-auto mt-4 max-w-3xl font-display text-5xl font-semibold text-balance md:text-7xl"
        >
          {t('hero.titlePre')}
          <em className="italic text-pine-600 dark:text-pine-350">{t('hero.titleAccent')}</em>
          {t('hero.titlePost')}
        </motion.h1>
        <motion.p
          variants={heroItem}
          className="mx-auto mt-5 max-w-2xl text-lg text-balance text-moss-500 dark:text-moss-400"
        >
          {t('hero.subtitle')}
        </motion.p>
        <motion.div
          variants={heroItem}
          className="mx-auto mt-9 flex max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center"
        >
          <DemoButton className={primaryCta} />
          <Link to="/register" className={secondaryCta}>
            {t('hero.register')}
          </Link>
        </motion.div>
        <motion.p variants={heroItem} className="mt-3 text-xs text-moss-400 dark:text-moss-500">
          {t('hero.demoHint')}
        </motion.p>
      </motion.div>
      <HeroRidge />
    </section>
  )
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <h2 className="font-display text-3xl font-semibold text-balance md:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-balance text-moss-500 md:text-lg dark:text-moss-400">{subtitle}</p>}
    </Reveal>
  )
}

function Showcase() {
  const { t } = useTranslation('landing')
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <SectionHeading title={t('showcase.title')} subtitle={t('showcase.subtitle')} />
      <div className="mt-10 grid gap-6 md:mt-16 md:grid-cols-2 md:gap-10">
        <Reveal delay={0.05}>
          <WeekMockup />
        </Reveal>
        <Reveal delay={0.15}>
          <ActivityMockup />
        </Reveal>
      </div>
    </section>
  )
}

const FEATURES = [
  { key: 'plan', icon: IconPlan, tile: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300' },
  { key: 'strava', icon: IconBolt, tile: 'bg-clay-100 text-clay-600 dark:bg-clay-900 dark:text-clay-300' },
  { key: 'gym', icon: IconDumbbell, tile: 'bg-copper-600/10 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300' },
  { key: 'watch', icon: IconWatch, tile: 'bg-lake-600/10 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300' },
  { key: 'stats', icon: IconChart, tile: 'bg-teal-600/10 text-teal-600 dark:bg-teal-300/15 dark:text-teal-300' },
  { key: 'objective', icon: IconFlag, tile: 'bg-gold-600/10 text-gold-600 dark:bg-gold-300/15 dark:text-gold-300' },
] as const

function Features() {
  const { t } = useTranslation('landing')
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <SectionHeading title={t('features.title')} subtitle={t('features.subtitle')} />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 md:mt-14 lg:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <Reveal key={feature.key} delay={i * 0.06}>
            <div className="h-full rounded-2xl border border-moss-200 bg-moss-25 p-6 transition hover:border-pine-600/40 dark:border-moss-750 dark:bg-moss-850 dark:hover:border-pine-350/40">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${feature.tile}`}>
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{t(`features.${feature.key}.title`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-moss-500 dark:text-moss-400">
                {t(`features.${feature.key}.body`)}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function HowItWorks() {
  const { t } = useTranslation('landing')
  const steps = ['one', 'two', 'three'] as const

  return (
    <section className="border-y border-moss-200 bg-moss-25/60 dark:border-moss-750 dark:bg-moss-850/40">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <SectionHeading title={t('how.title')} />
        <div className="mt-10 grid gap-10 md:mt-14 md:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step} delay={i * 0.1}>
              <p className="font-display text-6xl font-semibold leading-none text-pine-600/20 dark:text-pine-350/20">
                0{i + 1}
              </p>
              <h3 className="mt-3 font-display text-xl font-semibold">{t(`how.${step}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-moss-500 dark:text-moss-400">{t(`how.${step}.body`)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Deliberately dark in both themes — the "night ridge" panel. */
function McpPanel() {
  const { t } = useTranslation('landing')
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-moss-950 px-6 py-10 text-linen md:px-12 md:py-14 dark:ring-1 dark:ring-moss-750/80">
          <div
            className="pointer-events-none absolute inset-0 bg-pine-350 opacity-[0.06]"
            style={{
              maskImage: `url(${topoUrl})`,
              maskSize: '600px',
              maskRepeat: 'repeat',
              WebkitMaskImage: `url(${topoUrl})`,
              WebkitMaskSize: '600px',
              WebkitMaskRepeat: 'repeat',
            }}
            aria-hidden="true"
          />
          <div className="relative grid items-center gap-10 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pine-300">{t('mcp.eyebrow')}</p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-balance md:text-4xl">{t('mcp.title')}</h2>
              <p className="mt-4 leading-relaxed text-moss-300">{t('mcp.body')}</p>
            </div>
            <div className="rounded-2xl border border-moss-750 bg-moss-900/80 p-4" aria-hidden="true">
              <div className="flex items-center gap-2 border-b border-moss-750 pb-3">
                <span className="h-2 w-2 rounded-full bg-pine-350 motion-safe:animate-pulse" />
                <span className="font-mono text-xs text-moss-400">{t('mcp.status')}</span>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="ml-8 rounded-xl rounded-br-sm bg-pine-900 px-3.5 py-2.5 text-pine-100">
                  {t('mcp.user')}
                </div>
                <div className="mr-8 rounded-xl rounded-bl-sm border border-moss-750 bg-moss-850 px-3.5 py-2.5 text-moss-300">
                  {t('mcp.assistant')}
                </div>
                <p className="font-mono text-xs text-pine-300">{t('mcp.action')}</p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

const TECH_BADGES = [
  'Java 26',
  'Spring Boot 4',
  'PostgreSQL',
  'Flyway',
  'React 19',
  'TypeScript',
  'Tailwind CSS 4',
  'TanStack',
  'MCP',
  'CI/CD',
]

function TechStrip() {
  const { t } = useTranslation('landing')
  return (
    <section className="mx-auto max-w-4xl px-4 pb-16 text-center md:pb-24">
      <Reveal>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pine-600 dark:text-pine-350">
          {t('tech.eyebrow')}
        </p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-balance md:text-3xl">{t('tech.title')}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-balance text-moss-500 dark:text-moss-400">{t('tech.body')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {TECH_BADGES.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-moss-200 px-3.5 py-1.5 font-mono text-xs text-moss-500 dark:border-moss-750 dark:text-moss-400"
            >
              {badge}
            </span>
          ))}
        </div>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-8 inline-flex items-center gap-2.5 rounded-xl border border-moss-200 bg-moss-25 px-6 py-3 text-sm font-semibold text-ink transition hover:border-pine-600/50 hover:text-pine-700 dark:border-moss-750 dark:bg-moss-850 dark:text-linen dark:hover:border-pine-350/50 dark:hover:text-pine-300"
        >
          <IconGitHub className="h-4.5 w-4.5" />
          {t('tech.github')}
        </a>
      </Reveal>
    </section>
  )
}

function FinalCta() {
  const { t } = useTranslation('landing')
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 text-center md:pb-28">
      <Reveal>
        <h2 className="font-display text-4xl font-semibold text-balance md:text-5xl">{t('cta.title')}</h2>
        <p className="mx-auto mt-4 max-w-xl text-balance text-moss-500 md:text-lg dark:text-moss-400">
          {t('cta.body')}
        </p>
        <div className="mx-auto mt-8 max-w-md sm:max-w-xs">
          <DemoButton className={primaryCta.replace('sm:w-auto', '')} />
        </div>
        <p className="mt-4 text-sm">
          <Link
            to="/register"
            className="font-medium text-pine-700 underline-offset-4 hover:underline dark:text-pine-300"
          >
            {t('cta.register')}
          </Link>
        </p>
      </Reveal>
    </section>
  )
}

function Footer() {
  const { t } = useTranslation('landing')
  return (
    <footer className="border-t border-moss-200 dark:border-moss-750">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-pine-700 dark:text-pine-300">
            <LogoMark className="h-4 w-auto" />
            Cavale
          </p>
          <p className="mt-1 text-sm text-moss-500 dark:text-moss-400">
            <span className="font-display italic">cavale</span> {t('footer.dict')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <Link
            to="/login"
            className="font-medium text-moss-500 transition hover:text-ink dark:text-moss-400 dark:hover:text-linen"
          >
            {t('footer.signIn')}
          </Link>
          <Link
            to="/register"
            className="font-medium text-moss-500 transition hover:text-ink dark:text-moss-400 dark:hover:text-linen"
          >
            {t('footer.register')}
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 font-medium text-moss-500 transition hover:text-ink dark:text-moss-400 dark:hover:text-linen"
          >
            <IconGitHub className="h-4 w-4" />
            GitHub
          </a>
          <LanguageToggle />
        </div>
      </div>
      <p className="px-4 pb-8 text-center text-xs text-moss-400 dark:text-moss-500">
        {t('footer.rights', { year: new Date().getFullYear() })}
      </p>
    </footer>
  )
}

export function LandingPage() {
  return (
    <div className="overflow-x-clip">
      <Hero />
      <Showcase />
      <Features />
      <HowItWorks />
      <McpPanel />
      <TechStrip />
      <FinalCta />
      <Footer />
    </div>
  )
}
