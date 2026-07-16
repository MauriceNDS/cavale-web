/**
 * Catalogue of well-known running-shoe brands. Each brand is shown as an
 * original monogram badge in its signature colour — deliberately NOT a copy of
 * any official logo artwork, just a recognizable, consistent brand chip.
 */
export interface Brand {
  /** Canonical name, stored on the shoe and matched case-insensitively. */
  name: string
  /** Signature colour (also the default suggested shoe colour). */
  color: string
  /** 2-letter monogram shown in the badge. */
  mark: string
}

export const BRANDS: Brand[] = [
  { name: 'Nike', color: '#111111', mark: 'NK' },
  { name: 'Adidas', color: '#1A1A1A', mark: 'AD' },
  { name: 'ASICS', color: '#0A2A9A', mark: 'AS' },
  { name: 'Hoka', color: '#12B2C6', mark: 'HK' },
  { name: 'Salomon', color: '#D0021B', mark: 'SL' },
  { name: 'Brooks', color: '#0B5CB5', mark: 'BR' },
  { name: 'Saucony', color: '#E4002B', mark: 'SY' },
  { name: 'New Balance', color: '#CF0A2C', mark: 'NB' },
  { name: 'On', color: '#0B0B0B', mark: 'ON' },
  { name: 'Altra', color: '#ED1C24', mark: 'AL' },
  { name: 'La Sportiva', color: '#F5A800', mark: 'LS' },
  { name: 'Mizuno', color: '#002E6D', mark: 'MZ' },
  { name: 'Puma', color: '#1A1A1A', mark: 'PM' },
  { name: 'Under Armour', color: '#1D1D1D', mark: 'UA' },
  { name: 'Scott', color: '#F39200', mark: 'ST' },
  { name: 'Merrell', color: '#5F7138', mark: 'MR' },
]

/** Common shoe colours offered as swatches (hex, matched to the API pattern). */
export const SHOE_COLORS = [
  '#111827', '#6B7280', '#F3F4F6', '#EF4444', '#F97316', '#FACC15',
  '#22C55E', '#14B8A6', '#3B82F6', '#6366F1', '#EC4899',
]

export function findBrand(name?: string | null): Brand | undefined {
  if (!name) return undefined
  const key = name.trim().toLowerCase()
  return BRANDS.find((b) => b.name.toLowerCase() === key)
}

/** The brand's monogram chip, or a neutral fallback for an unknown/blank brand. */
export function BrandBadge({
  brand,
  size = 'md',
}: {
  brand?: string | null
  size?: 'sm' | 'md'
}) {
  const found = findBrand(brand)
  const dims = size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-9 w-9 text-[11px]'
  const label = found?.mark ?? (brand ? brand.trim().slice(0, 2).toUpperCase() : '—')
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-md font-bold tracking-tight text-white ${dims}`}
      style={{ backgroundColor: found?.color ?? '#94A3B8' }}
    >
      {label}
    </span>
  )
}
