// Port of section.f90 (2017-11-08): convert surveyed cross-section coordinates
// (x, z pairs) into the RRI sec_XXXXXX.txt table of depth / wetted perimeter /
// water-surface width / Manning roughness.

export interface SectionParams {
  nsRiver: number
  div: number
  datum: number // floodplain datum level [m]
  startIdx: number // 1-based first point (startx in section.txt)
  endIdx: number // 1-based last point (endx)
}

export interface SectionResult {
  depth: number // channel depth d: datum - min(z)
  height: number // levee height h: min(z_first, z_last) - datum, >= 0
  table: { depth: number; peri: number; width: number; ns: number }[]
  /** normalized profile for plotting (z relative to min) */
  profile: { x: number; z: number }[]
}

export function parseXZ(text: string): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = []
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim()
    if (s === '' || s.startsWith('#') || s.startsWith('!')) continue
    const parts = s.split(/[\s,]+/).map(Number)
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      pts.push({ x: parts[0], z: parts[1] })
    }
  }
  return pts
}

export function section(points: { x: number; z: number }[], p: SectionParams): SectionResult {
  const sel = points.slice(p.startIdx - 1, p.endIdx) // inclusive range, 1-based
  if (sel.length < 2) throw new Error('Cross section needs at least 2 points in [startx, endx]')
  const x = sel.map((q) => q.x)
  const yRaw = sel.map((q) => q.z)
  const ymin = Math.min(...yRaw)

  const depth = p.datum - ymin
  let height = Math.min(yRaw[0], yRaw[yRaw.length - 1]) - p.datum
  if (height <= 0) height = 0

  const y = yRaw.map((v) => v - ymin)
  const ymax = Math.max(...y)
  const dy = ymax / p.div

  const table: { depth: number; peri: number; width: number; ns: number }[] = []
  for (let j = 1; j <= p.div; j++) {
    const level = j * dy
    let peri = 0
    let width = 0
    for (let i = 1; i < y.length; i++) {
      const h1 = level - y[i - 1]
      const h2 = level - y[i]
      const b = x[i] - x[i - 1]
      const len = Math.sqrt((Math.abs(h1 - h2)) ** 2 + b ** 2)
      if (y[i - 1] <= level && y[i] <= level) {
        peri += len
        width += b
      } else if (y[i - 1] <= level) {
        const ratio = h1 / (h1 - h2)
        peri += len * ratio
        width += b * ratio
      } else if (y[i] <= level) {
        const ratio = h2 / (h2 - h1)
        peri += len * ratio
        width += b * ratio
      }
    }
    table.push({ depth: level, peri, width, ns: p.nsRiver })
  }

  return { depth, height, table, profile: sel }
}

export function serializeSection(r: SectionResult, div: number): string {
  const lines: string[] = []
  const f = (v: number) => v.toFixed(5).padStart(13)
  lines.push(`${String(div).padStart(13)}${f(r.depth)}${f(r.height)}`)
  for (const row of r.table) {
    lines.push(`${f(row.depth)}${f(row.peri)}${f(row.width)}${f(row.ns)}`)
  }
  return lines.join('\n') + '\n'
}
