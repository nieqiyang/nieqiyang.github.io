// Port of calcHydro.f90: extract time series at listed locations from a sequence
// of RRI output rasters (out/qr_000001.out, ...).
// The web version receives the already-loaded file texts (sorted by time step).

export interface HydroLocation {
  name: string
  i: number // loc_i: row from top, 1-based
  j: number // loc_j: col from left, 1-based
}

export function parseLocationFile(text: string): HydroLocation[] {
  const out: HydroLocation[] = []
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim()
    if (s === '' || s.startsWith('#')) continue
    const parts = s.split(/[\s,]+/)
    if (parts.length < 3) continue
    const i = Number(parts[1])
    const j = Number(parts[2])
    if (Number.isFinite(i) && Number.isFinite(j)) out.push({ name: parts[0], i, j })
  }
  return out
}

export function serializeLocationFile(locs: HydroLocation[]): string {
  return locs.map((l) => `${l.name} ${l.i} ${l.j}`).join('\n') + '\n'
}

/**
 * Extract values at locations from one raw RRI output raster body (no header,
 * whitespace-separated, row-major). Only scans as far as the deepest requested row.
 */
export function extractAtLocations(text: string, ncols: number, locs: HydroLocation[]): number[] {
  const maxRow = Math.max(...locs.map((l) => l.i))
  const need = maxRow * ncols
  const vals = new Float64Array(need)
  let k = 0
  const len = text.length
  let i = 0
  while (i < len && k < need) {
    let c = text.charCodeAt(i)
    while (i < len && (c === 32 || c === 9 || c === 10 || c === 13 || c === 44)) { i++; c = text.charCodeAt(i) }
    if (i >= len) break
    const start = i
    while (i < len) {
      c = text.charCodeAt(i)
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 44) break
      i++
    }
    vals[k++] = Number(text.slice(start, i))
  }
  return locs.map((l) => vals[(l.i - 1) * ncols + (l.j - 1)])
}

export interface HydroResult {
  names: string[]
  steps: number[] // 1-based output step numbers
  /** series[loc][t] */
  series: number[][]
}

/** files: texts of out rasters in time order. */
export function calcHydro(files: string[], ncols: number, locs: HydroLocation[]): HydroResult {
  const series: number[][] = locs.map(() => [])
  const steps: number[] = []
  for (let t = 0; t < files.length; t++) {
    const vals = extractAtLocations(files[t], ncols, locs)
    for (let l = 0; l < locs.length; l++) series[l].push(vals[l])
    steps.push(t + 1)
  }
  return { names: locs.map((l) => l.name), steps, series }
}
