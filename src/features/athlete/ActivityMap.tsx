import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTranslation } from 'react-i18next'

/** Google encoded-polyline → [lat, lng] pairs (precision 1e-5). */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let lat = 0
  let lng = 0
  let i = 0
  while (i < encoded.length) {
    for (const which of [0, 1] as const) {
      let result = 0
      let shift = 0
      let byte: number
      do {
        byte = encoded.charCodeAt(i++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)
      const value = result & 1 ? ~(result >> 1) : result >> 1
      if (which === 0) lat += value
      else lng += value
    }
    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}

/**
 * The activity's route on a topo map. OpenTopoMap (contours, relief) is the
 * default layer — this is a mountain app — with standard OSM as a toggle.
 * `hoverFraction` (0–1 along the run) drives the synced cursor marker.
 */
export function ActivityMap({
  polyline,
  hoverFraction,
}: {
  polyline: string
  hoverFraction: number | null
}) {
  const { t } = useTranslation('athlete')
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const points = useMemo(() => decodePolyline(polyline), [polyline])

  useEffect(() => {
    if (!containerRef.current || points.length < 2 || mapRef.current) return

    // Massif tokens resolved at runtime — Leaflet needs concrete colors.
    const css = getComputedStyle(document.documentElement)
    const pine = css.getPropertyValue('--color-pine-600').trim() || '#3d6b4f'
    const clay = css.getPropertyValue('--color-clay-500').trim() || '#c25c2e'

    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    })
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })

    const map = L.map(containerRef.current, {
      layers: [topo],
      scrollWheelZoom: false, // page scroll must win; zoom via buttons/pinch
    })
    L.control.layers({ [t('activityDetail.mapTopo')]: topo, [t('activityDetail.mapStreet')]: osm }).addTo(map)

    const track = L.polyline(points, { color: pine, weight: 3, opacity: 0.9 })
    track.addTo(map)
    L.circleMarker(points[0], { radius: 5, color: pine, fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(map)
    L.circleMarker(points[points.length - 1], { radius: 5, color: clay, fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(map)
    map.fitBounds(track.getBounds(), { padding: [16, 16] })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  // Cursor marker: approximate position by fraction of the trace.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (hoverFraction == null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    const index = Math.round(Math.min(1, Math.max(0, hoverFraction)) * (points.length - 1))
    const at = points[index]
    if (!markerRef.current) {
      const pine = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-pine-600').trim() || '#3d6b4f'
      markerRef.current = L.circleMarker(at, {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: pine,
        fillOpacity: 1,
      }).addTo(map)
    } else {
      markerRef.current.setLatLng(at)
    }
  }, [hoverFraction, points])

  if (points.length < 2) return null

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-moss-200 dark:border-moss-750">
      <div ref={containerRef} className="h-72 w-full sm:h-96" aria-label={t('activityDetail.mapAria')} />
    </div>
  )
}
