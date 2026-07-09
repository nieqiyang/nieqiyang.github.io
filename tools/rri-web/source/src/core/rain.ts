// RRI rainfall (and evapotranspiration / 2D boundary) file format:
// repeated blocks of  "<time_sec> <ncols> <nrows>" followed by nrows lines of ncols values [mm/h].
// The georeference (xllcorner_rain, yllcorner_rain, cellsize_rain) lives in RRI_Input.txt.

export interface RainData {
  times: number[] // seconds, one per block
  ncols: number
  nrows: number
  /** frames[t] is a Float64Array of nrows*ncols values (row 0 = top) */
  frames: Float64Array[]
}

export function parseRain(text: string): RainData {
  const tokens = tokenize(text)
  const times: number[] = []
  const frames: Float64Array[] = []
  let ncols = 0
  let nrows = 0
  let p = 0
  while (p + 2 < tokens.length) {
    const t = tokens[p], nc = tokens[p + 1] | 0, nr = tokens[p + 2] | 0
    p += 3
    if (nc <= 0 || nr <= 0) throw new Error(`Invalid rain block header at token ${p - 3}`)
    if (ncols === 0) { ncols = nc; nrows = nr }
    else if (nc !== ncols || nr !== nrows) throw new Error('Rain blocks with inconsistent grid size')
    const n = nc * nr
    if (p + n > tokens.length) throw new Error('Rain file truncated')
    const frame = new Float64Array(tokens.buffer, p * 8, n).slice()
    p += n
    times.push(t)
    frames.push(frame)
  }
  if (frames.length === 0) throw new Error('No rainfall blocks found')
  return { times, ncols, nrows, frames }
}

export function serializeRain(rain: RainData, decimals = 3): string {
  const parts: string[] = []
  const row: string[] = new Array(rain.ncols)
  for (let t = 0; t < rain.times.length; t++) {
    parts.push(`${String(rain.times[t]).padStart(15)} ${String(rain.ncols).padStart(5)} ${String(rain.nrows).padStart(5)}`)
    const f = rain.frames[t]
    for (let i = 0; i < rain.nrows; i++) {
      const base = i * rain.ncols
      for (let j = 0; j < rain.ncols; j++) row[j] = f[base + j].toFixed(decimals)
      parts.push(row.join(' '))
    }
  }
  return parts.join('\n') + '\n'
}

function tokenize(text: string): Float64Array {
  // whitespace-separated numbers; returns Float64Array for speed
  const out: number[] = []
  const len = text.length
  let i = 0
  while (i < len) {
    let c = text.charCodeAt(i)
    while (i < len && (c === 32 || c === 9 || c === 10 || c === 13 || c === 44)) { i++; c = text.charCodeAt(i) }
    if (i >= len) break
    const start = i
    while (i < len) {
      c = text.charCodeAt(i)
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 44) break
      i++
    }
    out.push(Number(text.slice(start, i)))
  }
  return Float64Array.from(out)
}

/** Simple time-series text: lines of "<time> <value>" (calcHydro / rainBasin output style). */
export function parseTimeSeries(text: string): { t: number[]; v: number[] } {
  const t: number[] = []
  const v: number[] = []
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim()
    if (s === '') continue
    const parts = s.split(/[\s,]+/)
    if (parts.length < 2) continue
    const tv = Number(parts[0])
    const vv = Number(parts[1])
    if (Number.isFinite(tv) && Number.isFinite(vv)) { t.push(tv); v.push(vv) }
  }
  return { t, v }
}

export function serializeTimeSeries(t: number[], v: number[], opts: { exp?: boolean } = {}): string {
  const lines: string[] = []
  for (let k = 0; k < t.length; k++) {
    const val = opts.exp ? v[k].toExponential(8) : v[k].toFixed(5)
    lines.push(`${String(t[k]).padStart(5)} ${val.padStart(17)}`)
  }
  return lines.join('\n') + '\n'
}
