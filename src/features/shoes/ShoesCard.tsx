import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { numberLocale } from '../../i18n'
import { ApiError } from '../../lib/api'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import {
  createShoe,
  deleteShoe,
  fetchShoes,
  updateShoe,
  type ShoePayload,
  type ShoePurpose,
  type ShoeResponse,
} from './api'
import { BRANDS, BrandBadge, findBrand, SHOE_COLORS } from './brands'
import { ShoeSwatch } from './ShoeSwatch'

const PURPOSES: ShoePurpose[] = ['ROAD', 'TRAIL', 'RACE']

const PURPOSE_BADGE: Record<ShoePurpose, string> = {
  ROAD: 'bg-lake-600/15 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300',
  TRAIL: 'bg-copper-600/15 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300',
  RACE: 'bg-gold-600/15 text-gold-600 dark:bg-gold-300/15 dark:text-gold-300',
}

const fieldClass =
  'mt-0.5 w-full rounded-lg border border-moss-200 bg-moss-100 px-2.5 py-1.5 text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

function toPayload(shoe: ShoeResponse): ShoePayload {
  return {
    name: shoe.name,
    brand: shoe.brand,
    color: shoe.color,
    colorSecondary: shoe.colorSecondary,
    purpose: shoe.purpose,
    retirementKm: shoe.retirementKm,
    retired: shoe.retired,
    isDefault: shoe.isDefault,
  }
}

/** The shoe rotation — brand, colour, mileage and a default pair for validation. */
export function ShoesCard() {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const shoesQuery = useQuery({ queryKey: ['shoes'], queryFn: fetchShoes })
  const navigate = useNavigate()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ShoeResponse | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['shoes'] })
  const close = () => {
    refresh()
    setEditing(null)
  }
  const createMut = useMutation({ mutationFn: createShoe, onSuccess: close })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ShoePayload }) => updateShoe(id, body),
    onSuccess: close,
  })
  const deleteMut = useMutation({
    mutationFn: deleteShoe,
    onSuccess: () => {
      setDeleting(null)
      refresh()
    },
  })

  const shoes = shoesQuery.data ?? []
  const editingShoe = shoes.find((s) => s.id === editing) ?? null
  const error = createMut.error ?? updateMut.error ?? deleteMut.error

  return (
    <section className="mt-6 rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{t('parameters.shoes.title')}</h2>
          <Link
            to="/chaussures"
            className="text-sm font-medium text-pine-700 hover:underline dark:text-pine-300"
          >
            {t('parameters.shoes.statsPageLink')} →
          </Link>
          <p className="mt-0.5 text-sm text-moss-500 dark:text-moss-400">{t('parameters.shoes.intro')}</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="shrink-0 rounded-lg bg-pine-600 px-3 py-1.5 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          {t('common:add')}
        </button>
      </div>

      {error instanceof ApiError && (
        <p role="alert" className="mt-2 text-sm text-clay-500 dark:text-clay-300">
          {error.message}
        </p>
      )}

      {shoes.length === 0 && (
        <p className="mt-4 text-sm text-moss-500 dark:text-moss-400">{t('parameters.shoes.empty')}</p>
      )}

      <ul className="mt-3 space-y-2">
        {shoes.map((shoe) => (
          <li
            key={shoe.id}
            className={`rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900 ${
              shoe.retired ? 'opacity-60' : ''
            }`}
          >
            <ShoeRow
              shoe={shoe}
              onStats={() => navigate({ to: '/chaussures' })}
              onEdit={() => setEditing(shoe.id)}
              onDelete={() => setDeleting(shoe)}
              onToggleRetired={() =>
                updateMut.mutate({
                  id: shoe.id,
                  body: { ...toPayload(shoe), retired: !shoe.retired, isDefault: false },
                })
              }
              onMakeDefault={() =>
                updateMut.mutate({ id: shoe.id, body: { ...toPayload(shoe), isDefault: true } })
              }
            />
          </li>
        ))}
      </ul>

      {editing === 'new' && (
        <Modal title={t('parameters.shoes.addTitle')} onClose={() => setEditing(null)}>
          <ShoeForm
            pending={createMut.isPending}
            onSubmit={(body) => createMut.mutate(body)}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
      {editingShoe && (
        <Modal
          title={t('parameters.shoes.editTitle', { name: editingShoe.name })}
          onClose={() => setEditing(null)}
        >
          <ShoeForm
            shoe={editingShoe}
            pending={updateMut.isPending}
            onSubmit={(body) => updateMut.mutate({ id: editingShoe.id, body })}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title={t('common:delete')}
          message={t('parameters.shoes.deleteConfirm', { name: deleting.name })}
          confirmLabel={t('common:delete')}
          danger
          busy={deleteMut.isPending}
          onConfirm={() => deleteMut.mutate(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  )
}

function ShoeRow({
  shoe,
  onStats,
  onEdit,
  onDelete,
  onToggleRetired,
  onMakeDefault,
}: {
  shoe: ShoeResponse
  onStats: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleRetired: () => void
  onMakeDefault: () => void
}) {
  const { t } = useTranslation('settings')
  const wear = shoe.retirementKm ? Math.min(shoe.mileageKm / shoe.retirementKm, 1) : null

  return (
    <div className="flex gap-3">
      <button
        onClick={onStats}
        aria-label={t('parameters.shoes.statsAria', { name: shoe.name })}
        className="flex items-center gap-2 self-start transition hover:opacity-80"
      >
        <ShoeSwatch color={shoe.color} colorSecondary={shoe.colorSecondary} size="lg" />
        <BrandBadge brand={shoe.brand} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onStats} className="font-medium underline-offset-2 hover:underline">
              {shoe.name}
            </button>
            {shoe.brand && <span className="text-sm text-moss-500 dark:text-moss-400">{shoe.brand}</span>}
            {shoe.isDefault && (
              <span className="rounded-full bg-pine-100 px-2 py-0.5 text-[11px] font-semibold text-pine-700 dark:bg-pine-900 dark:text-pine-300">
                {t('parameters.shoes.defaultBadge')}
              </span>
            )}
            {shoe.purpose && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PURPOSE_BADGE[shoe.purpose]}`}>
                {t(`parameters.shoes.purposes.${shoe.purpose}`)}
              </span>
            )}
            {shoe.retired && (
              <span className="rounded-full bg-moss-100 px-2 py-0.5 text-[11px] font-medium text-moss-500 dark:bg-moss-800 dark:text-moss-400">
                {t('parameters.shoes.retiredBadge')}
              </span>
            )}
            {shoe.needsRetirement && (
              <span className="rounded-full bg-clay-100 px-2 py-0.5 text-[11px] font-semibold text-clay-600 dark:bg-clay-900 dark:text-clay-300">
                {t('parameters.shoes.replaceBadge')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            <button onClick={onStats} className="rounded-lg px-2.5 py-1 text-sm font-medium text-pine-700 transition hover:bg-pine-100 dark:text-pine-300 dark:hover:bg-pine-900">
              {t('parameters.shoes.statsButton')}
            </button>
            {!shoe.isDefault && !shoe.retired && (
              <button onClick={onMakeDefault} className="rounded-lg px-2.5 py-1 text-sm font-medium text-moss-500 transition hover:text-ink dark:text-moss-400 dark:hover:text-linen">
                {t('parameters.shoes.makeDefault')}
              </button>
            )}
            <button onClick={onEdit} className="rounded-lg px-2.5 py-1 text-sm font-medium text-moss-500 transition hover:text-ink dark:text-moss-400 dark:hover:text-linen">
              {t('common:edit')}
            </button>
            <button onClick={onToggleRetired} className="rounded-lg px-2.5 py-1 text-sm font-medium text-moss-500 transition hover:text-ink dark:text-moss-400 dark:hover:text-linen">
              {shoe.retired ? t('parameters.shoes.reactivate') : t('parameters.shoes.retire')}
            </button>
            <button onClick={onDelete} className="rounded-lg px-2.5 py-1 text-sm font-medium text-clay-500 transition hover:text-clay-600 dark:text-clay-300">
              {t('common:delete')}
            </button>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-sm">
          <span className="font-semibold tabular-nums">
            {Math.round(shoe.mileageKm).toLocaleString(numberLocale())} km
          </span>
          {shoe.retirementKm && (
            <>
              <span className="text-xs text-moss-500 dark:text-moss-400">
                / {shoe.retirementKm.toLocaleString(numberLocale())} km
              </span>
              <span className="h-1.5 max-w-40 flex-1 overflow-hidden rounded-full bg-moss-200 dark:bg-moss-800">
                <span
                  className={`block h-full rounded-full ${
                    shoe.needsRetirement ? 'bg-clay-500 dark:bg-clay-300' : 'bg-pine-600 dark:bg-pine-350'
                  }`}
                  style={{ width: `${(wear ?? 0) * 100}%` }}
                />
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * One colour: preset swatches for the common cases, the native colour picker
 * for the exact shade (great on phones), tap-again or the clear link to unset.
 */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation('settings')
  return (
    <div className="block text-xs text-moss-500 sm:col-span-2 dark:text-moss-400">
      {label}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {SHOE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(value === c ? '' : c)}
            aria-label={c}
            aria-pressed={value === c}
            className={`h-6 w-6 rounded-full border transition ${
              value === c
                ? 'border-ink ring-2 ring-pine-600/40 dark:border-linen'
                : 'border-moss-300 dark:border-moss-700'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <input
          type="color"
          // The native input demands a valid hex — show neutral grey until a pick.
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#888888'}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t('parameters.shoes.colorCustom')}
          title={t('parameters.shoes.colorCustom')}
          className="ml-1 h-7 w-10 cursor-pointer rounded-md border border-moss-300 bg-transparent p-0.5 dark:border-moss-700"
        />
        {value && <span className="tabular-nums">{value.toUpperCase()}</span>}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="font-medium underline underline-offset-2 hover:text-ink dark:hover:text-linen"
          >
            {t('parameters.shoes.colorNone')}
          </button>
        )}
      </div>
    </div>
  )
}

function ShoeForm({
  shoe,
  pending,
  onSubmit,
  onCancel,
}: {
  shoe?: ShoeResponse
  pending: boolean
  onSubmit: (body: ShoePayload) => void
  onCancel: () => void
}) {
  const { t } = useTranslation('settings')
  const initialBrand = shoe?.brand ?? ''
  const knownBrand = findBrand(initialBrand)
  const [brandChoice, setBrandChoice] = useState(
    initialBrand === '' ? '' : knownBrand ? knownBrand.name : '__other__',
  )
  const [customBrand, setCustomBrand] = useState(knownBrand || initialBrand === '' ? '' : initialBrand)
  const [color, setColor] = useState(shoe?.color ?? '')
  const [colorSecondary, setColorSecondary] = useState(shoe?.colorSecondary ?? '')
  const [isDefault, setIsDefault] = useState(shoe?.isDefault ?? false)

  const brand = brandChoice === '__other__' ? customBrand.trim() : brandChoice

  function pickBrand(value: string) {
    setBrandChoice(value)
    // Suggest the brand's signature colour when none is chosen yet.
    if (value && value !== '__other__' && !color) {
      const b = findBrand(value)
      if (b) setColor(b.color)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = (data.get('name') as string).trim()
    if (!name) return
    onSubmit({
      name,
      brand: brand || null,
      color: color || null,
      colorSecondary: colorSecondary || null,
      purpose: (data.get('purpose') as ShoePurpose) || null,
      retirementKm: data.get('retirementKm') ? Number(data.get('retirementKm')) : null,
      retired: shoe?.retired ?? false,
      isDefault,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs text-moss-500 sm:col-span-2 dark:text-moss-400">
        {t('parameters.shoes.name')}
        <div className="mt-0.5 flex items-center gap-2">
          {/* Live colourway preview — what the pair will look like everywhere. */}
          <ShoeSwatch color={color || null} colorSecondary={colorSecondary || null} size="lg" />
          <input
            name="name"
            defaultValue={shoe?.name}
            required
            maxLength={100}
            className={`${fieldClass} mt-0`}
          />
        </div>
      </label>

      <label className="block text-xs text-moss-500 dark:text-moss-400">
        {t('parameters.shoes.brand')}
        <div className="mt-0.5 flex items-center gap-2">
          <BrandBadge brand={brand} size="sm" />
          <select value={brandChoice} onChange={(e) => pickBrand(e.target.value)} className={`${fieldClass} mt-0`}>
            <option value="">{t('parameters.shoes.brandNone')}</option>
            {BRANDS.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
            <option value="__other__">{t('parameters.shoes.brandOther')}</option>
          </select>
        </div>
        {brandChoice === '__other__' && (
          <input
            value={customBrand}
            onChange={(e) => setCustomBrand(e.target.value)}
            maxLength={60}
            className={`${fieldClass} mt-2`}
          />
        )}
      </label>

      <label className="block text-xs text-moss-500 dark:text-moss-400">
        {t('parameters.shoes.purpose')}
        <select name="purpose" defaultValue={shoe?.purpose ?? ''} className={fieldClass}>
          <option value="">{t('parameters.shoes.purposeNone')}</option>
          {PURPOSES.map((p) => (
            <option key={p} value={p}>
              {t(`parameters.shoes.purposes.${p}`)}
            </option>
          ))}
        </select>
      </label>

      <ColorField label={t('parameters.shoes.color')} value={color} onChange={setColor} />
      <ColorField
        label={t('parameters.shoes.colorSecondary')}
        value={colorSecondary}
        onChange={setColorSecondary}
      />

      <label className="block text-xs text-moss-500 dark:text-moss-400">
        {t('parameters.shoes.retirementKm')}
        <input
          name="retirementKm"
          type="number"
          min="1"
          defaultValue={shoe?.retirementKm ?? ''}
          placeholder="800"
          className={fieldClass}
        />
      </label>

      <label className="flex items-center gap-2 self-end text-sm text-ink sm:col-span-1 dark:text-linen">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="h-4 w-4 rounded border-moss-300 accent-pine-600 dark:border-moss-700 dark:accent-pine-350"
        />
        {t('parameters.shoes.setDefault')}
      </label>

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          {t('common:save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-moss-500 transition hover:text-ink dark:text-moss-400 dark:hover:text-linen"
        >
          {t('common:cancel')}
        </button>
      </div>
    </form>
  )
}
