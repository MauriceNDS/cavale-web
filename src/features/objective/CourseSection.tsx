import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { numberLocale } from '../../i18n'
import { ApiError } from '../../lib/api'
import { card, muted } from '../../lib/ui'
import {
  deleteCourse,
  deleteCourseWaypoint,
  fetchCourse,
  importCourse,
  type CourseResponse,
} from './api'

/** Race times the runner's way: "8h25", "45 min". */
function formatChrono(sec: number | null): string {
  if (sec == null) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h === 0 ? `${m} min` : `${h}h${String(m).padStart(2, '0')}`
}

/** GPX course + grade-adjusted pacing for a (trail) objective. */
export function CourseSection({ objectiveId }: { objectiveId: string }) {
  const { t } = useTranslation('objective')
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['course', objectiveId],
    queryFn: () => fetchCourse(objectiveId),
    retry: false,
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['course', objectiveId] })

  const importMutation = useMutation({
    mutationFn: ({ gpx, name }: { gpx: string; name?: string }) => importCourse(objectiveId, gpx, name),
    onSuccess: invalidate,
  })
  const removeMutation = useMutation({ mutationFn: () => deleteCourse(objectiveId), onSuccess: invalidate })

  if (query.isLoading) return null

  return (
    <section className={card}>
      <h2 className="font-display text-lg font-semibold">{t('course.title')}</h2>
      {query.data ? (
        <CourseView
          course={query.data}
          objectiveId={objectiveId}
          onReplace={(gpx) => importMutation.mutate({ gpx })}
          onRemove={() => removeMutation.mutate()}
          onWaypoints={invalidate}
          pending={importMutation.isPending || removeMutation.isPending}
        />
      ) : (
        <CourseUpload
          onImport={(gpx) => importMutation.mutate({ gpx })}
          pending={importMutation.isPending}
          error={importMutation.error}
        />
      )}
    </section>
  )
}

function CourseUpload({
  onImport,
  pending,
  error,
}: {
  onImport: (gpx: string) => void
  pending: boolean
  error: unknown
}) {
  const { t } = useTranslation('objective')
  const [fileError, setFileError] = useState<string | null>(null)

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setFileError(t('course.notGpx'))
      return
    }
    setFileError(null)
    onImport(await file.text())
    event.target.value = ''
  }

  return (
    <div className="mt-2">
      <p className={`text-sm ${muted}`}>{t('course.uploadIntro')}</p>
      <label className="mt-3 inline-block cursor-pointer rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300">
        {pending ? t('course.importing') : t('course.upload')}
        <input type="file" accept=".gpx,application/gpx+xml" onChange={handleFile} disabled={pending} className="hidden" />
      </label>
      {(fileError || error instanceof ApiError) && (
        <p role="alert" className="mt-2 text-sm text-clay-500 dark:text-clay-300">
          {fileError ?? (error as ApiError).message}
        </p>
      )}
    </div>
  )
}

function CourseView({
  course,
  objectiveId,
  onReplace,
  onRemove,
  onWaypoints,
  pending,
}: {
  course: CourseResponse
  objectiveId: string
  onReplace: (gpx: string) => void
  onRemove: () => void
  onWaypoints: () => void
  pending: boolean
}) {
  const { t } = useTranslation('objective')

  async function replace(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) onReplace(await file.text())
    event.target.value = ''
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{course.name}</p>
          <p className={`mt-0.5 text-sm ${muted}`}>
            {course.distanceKm} km · {course.elevationGainM.toLocaleString(numberLocale())} m D+
            {course.elevationLossM > 0 && ` · ${course.elevationLossM.toLocaleString(numberLocale())} m D−`}
            {' · '}
            {course.kmEffort} km-effort
          </p>
        </div>
        {course.finishMidSec != null ? (
          <div className="text-right">
            <p className="font-display text-2xl font-semibold text-copper-600 dark:text-copper-300">
              {formatChrono(course.finishMidSec)}
            </p>
            <p className={`text-xs ${muted}`}>
              {formatChrono(course.finishLowSec)} – {formatChrono(course.finishHighSec)}
              {course.paceSampleRuns != null && ` · ${t('course.basis', { count: course.paceSampleRuns })}`}
            </p>
          </div>
        ) : (
          <p className={`max-w-52 text-right text-xs ${muted}`}>{t('course.noPace')}</p>
        )}
      </div>

      <ElevationProfile course={course} />

      {course.waypoints.length > 0 && (
        <AidStations course={course} objectiveId={objectiveId} onChange={onWaypoints} />
      )}

      <SplitsTable course={course} />

      <div className="mt-4 flex flex-wrap gap-2 border-t border-moss-200 pt-3 dark:border-moss-750">
        <label className="cursor-pointer rounded-lg border border-moss-200 px-3 py-1.5 text-sm font-medium transition hover:bg-moss-100 dark:border-moss-750 dark:hover:bg-moss-800">
          {t('course.replace')}
          <input type="file" accept=".gpx,application/gpx+xml" onChange={replace} disabled={pending} className="hidden" />
        </label>
        <button
          onClick={onRemove}
          disabled={pending}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-clay-500 transition hover:text-clay-600 disabled:opacity-50 dark:text-clay-300"
        >
          {t('course.remove')}
        </button>
      </div>
    </div>
  )
}

/* ── Elevation profile ─────────────────────────────────────────────── */

const W = 640
const H = 170
const PAD = { left: 6, right: 6, top: 10, bottom: 16 }

function ElevationProfile({ course }: { course: CourseResponse }) {
  const { t } = useTranslation('objective')
  const points = course.profile
  if (points.length < 2) return null
  const maxDist = points[points.length - 1][0] || 1
  const eles = points.map((p) => p[1])
  const lo = Math.min(...eles)
  const hi = Math.max(...eles)
  const range = hi - lo || 1
  const x = (d: number) => PAD.left + (d / maxDist) * (W - PAD.left - PAD.right)
  const y = (e: number) => PAD.top + (1 - (e - lo) / range) * (H - PAD.top - PAD.bottom)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ')
  const area = `${line} L ${x(maxDist).toFixed(1)} ${H - PAD.bottom} L ${x(0).toFixed(1)} ${H - PAD.bottom} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={t('course.profileAria')}>
      <path d={area} className="fill-pine-600/10 dark:fill-pine-350/10" />
      <path d={line} fill="none" strokeWidth={1.5} className="stroke-pine-600 dark:stroke-pine-350" />
      {course.waypoints.map((w) => (
        <g key={w.id}>
          <line x1={x(w.distanceKm * 1000)} x2={x(w.distanceKm * 1000)} y1={PAD.top} y2={H - PAD.bottom}
            strokeWidth={1} strokeDasharray="3 3" className="stroke-copper-600/60 dark:stroke-copper-300/60" />
          <circle cx={x(w.distanceKm * 1000)} cy={y(w.elevationM ?? lo)} r={2.5}
            className="fill-copper-600 dark:fill-copper-300" />
        </g>
      ))}
      <text x={x(0)} y={H - 4} className="fill-moss-500 text-[10px] dark:fill-moss-400">0 km</text>
      <text x={x(maxDist)} y={H - 4} textAnchor="end" className="fill-moss-500 text-[10px] dark:fill-moss-400">
        {Math.round(maxDist / 1000)} km
      </text>
      <text x={PAD.left + 2} y={y(hi) + 8} className="fill-moss-400 text-[9px] dark:fill-moss-500">
        {Math.round(hi)} m
      </text>
    </svg>
  )
}

/* ── Aid stations ──────────────────────────────────────────────────── */

function AidStations({
  course,
  objectiveId,
  onChange,
}: {
  course: CourseResponse
  objectiveId: string
  onChange: () => void
}) {
  const { t } = useTranslation('objective')
  const removeMutation = useMutation({
    mutationFn: (waypointId: string) => deleteCourseWaypoint(objectiveId, waypointId),
    onSuccess: onChange,
  })

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold">{t('course.aidStations')}</h3>
      <ul className="mt-2 space-y-1.5">
        {course.waypoints.map((w) => (
          <li
            key={w.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-moss-200 bg-moss-50 px-3 py-2 text-sm dark:border-moss-750 dark:bg-moss-900"
          >
            <div>
              <span className="font-medium">{w.name}</span>
              <span className={`ml-2 text-xs ${muted}`}>
                {t('course.kmMark', { km: w.distanceKm })}
                {w.elevationM != null && ` · ${w.elevationM.toLocaleString(numberLocale())} m`}
                {` · ${w.climbToM.toLocaleString(numberLocale())} m D+`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {w.midSec != null && (
                <span className="font-semibold tabular-nums text-copper-600 dark:text-copper-300">
                  {formatChrono(w.midSec)}
                  <span className={`ml-1 text-xs font-normal ${muted}`}>
                    ({formatChrono(w.lowSec)}–{formatChrono(w.highSec)})
                  </span>
                </span>
              )}
              <button
                onClick={() => removeMutation.mutate(w.id)}
                aria-label={t('course.removeAid')}
                className="rounded p-1 text-xs text-moss-400 transition hover:text-clay-500 dark:text-moss-500"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Splits ────────────────────────────────────────────────────────── */

function SplitsTable({ course }: { course: CourseResponse }) {
  const { t } = useTranslation('objective')
  const hasPace = course.finishMidSec != null
  return (
    <details className="mt-4">
      <summary className={`cursor-pointer text-sm ${muted} transition hover:text-ink dark:hover:text-linen`}>
        {t('course.showSplits')}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-md text-sm">
          <thead>
            <tr className={`border-b border-moss-200 text-left text-xs uppercase dark:border-moss-750 ${muted}`}>
              <th className="py-1.5 pr-2 font-semibold">{t('course.colSegment')}</th>
              <th className="py-1.5 pr-2 text-right font-semibold">{t('course.colClimb')}</th>
              {hasPace && <th className="py-1.5 pr-2 text-right font-semibold">{t('course.colSplit')}</th>}
              {hasPace && <th className="py-1.5 text-right font-semibold">{t('course.colArrival')}</th>}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {course.splits.map((s) => (
              <tr key={`${s.fromKm}-${s.toKm}`} className="border-b border-moss-200/60 dark:border-moss-750/60">
                <td className="py-1.5 pr-2">
                  {s.fromKm}–{s.toKm} km
                </td>
                <td className="py-1.5 pr-2 text-right">{s.climbM.toLocaleString(numberLocale())} m</td>
                {hasPace && <td className="py-1.5 pr-2 text-right">{formatChrono(s.segmentSec)}</td>}
                {hasPace && <td className="py-1.5 text-right font-medium">{formatChrono(s.cumulativeSec)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
