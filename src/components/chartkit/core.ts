/**
 * Chart kit — the one SVG chart foundation for every stat surface.
 * Hand-rolled on Massif tokens: components style series with Tailwind
 * `stroke-*`/`fill-*` classes (light + dark variants), never hex.
 */

export interface Pad {
  top: number
  right: number
  bottom: number
  left: number
}

export const DEFAULT_PAD: Pad = { top: 14, right: 14, bottom: 24, left: 44 }

/** Geometry of a measured chart: viewBox size and the inner plot area. */
export interface Frame {
  width: number
  height: number
  pad: Pad
  plotW: number
  plotH: number
}

export function makeFrame(width: number, height: number, pad: Pad): Frame {
  return {
    width,
    height,
    pad,
    plotW: Math.max(1, width - pad.left - pad.right),
    plotH: Math.max(1, height - pad.top - pad.bottom),
  }
}

/** x position of point i when points span the plot edge-to-edge (line charts). */
export function pointX(frame: Frame, count: number): (i: number) => number {
  return (i) =>
    count <= 1 ? frame.pad.left + frame.plotW / 2 : frame.pad.left + (i / (count - 1)) * frame.plotW
}

/** Band geometry for bar charts: left edge, center and width of slot i. */
export function bandX(frame: Frame, count: number) {
  const band = frame.plotW / Math.max(1, count)
  return {
    band,
    left: (i: number) => frame.pad.left + i * band,
    center: (i: number) => frame.pad.left + i * band + band / 2,
  }
}

/** Linear y scale over [lo, hi]; invert for pace-style "up = faster" axes. */
export function linearY(frame: Frame, lo: number, hi: number, invert = false): (v: number) => number {
  const span = hi - lo || 1
  return (v) => {
    const t = (v - lo) / span
    return frame.pad.top + (invert ? t : 1 - t) * frame.plotH
  }
}

/** Rounded ticks from 0 to ~max in 3 steps (bar charts anchored at zero). */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0]
  const raw = max / 3
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s * 3 >= max) ?? raw
  return [0, 1, 2, 3].map((i) => Math.round(i * step))
}

/** Label every Nth slot so x-axis labels keep ~their designed footprint. */
export function labelStep(bandPx: number, minPx = 52): number {
  return Math.max(1, Math.ceil(minPx / bandPx))
}

/** Bar with rounded top corners only — the Massif bar silhouette. */
export function roundedTopBar(x: number, y: number, width: number, height: number): string {
  const r = Math.min(4, width / 2, height)
  const bottom = y + height
  return `M ${x} ${bottom} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + width - r} Q ${x + width} ${y} ${x + width} ${y + r} V ${bottom} Z`
}

/** Polyline path over pointX positions, restarting after null gaps. */
export function gappedLinePath(
  xs: (i: number) => number,
  y: (v: number) => number,
  values: (number | null | undefined)[],
): string {
  let path = ''
  let previousHadValue = false
  values.forEach((v, i) => {
    if (v == null) {
      previousHadValue = false
      return
    }
    path += `${previousHadValue ? ' L' : ' M'} ${xs(i)} ${y(v)}`
    previousHadValue = true
  })
  return path
}
