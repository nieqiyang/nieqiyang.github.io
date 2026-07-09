// ESRI ASCII raster I/O.
// Grid data is stored row-major with row 0 = northernmost row (same order as the file).

export interface AsciiGrid {
  ncols: number
  nrows: number
  xllcorner: number
  yllcorner: number
  cellsize: number
  nodata: number
  data: Float64Array // length nrows*ncols, index = i*ncols + j (i: row from top, 0-based)
}

export function gridIndex(g: { ncols: number }, i: number, j: number): number {
  return i * g.ncols + j
}

export function createGrid(
  ncols: number, nrows: number, xllcorner: number, yllcorner: number,
  cellsize: number, nodata = -9999, fill = 0,
): AsciiGrid {
  const data = new Float64Array(nrows * ncols)
  if (fill !== 0) data.fill(fill)
  return { ncols, nrows, xllcorner, yllcorner, cellsize, nodata, data }
}

export function cloneGrid(g: AsciiGrid): AsciiGrid {
  return { ...g, data: new Float64Array(g.data) }
}

/** Cells with value < -100 are treated as outside the domain by all RRI tools. */
export function inDomain(v: number): boolean {
  return v >= -100
}

export function parseAsciiGrid(text: string): AsciiGrid {
  // Header: 6 lines of "key value"; keys are case-insensitive and order can vary slightly,
  // but RRI files always use ncols, nrows, xllcorner, yllcorner, cellsize, NODATA_value.
  const header: Record<string, number> = {}
  let pos = 0
  let lineCount = 0
  const len = text.length
  while (lineCount < 6 && pos < len) {
    let eol = text.indexOf('\n', pos)
    if (eol === -1) eol = len
    const line = text.slice(pos, eol).trim()
    pos = eol + 1
    if (line === '') continue
    const m = line.match(/^(\S+)\s+(\S+)/)
    if (!m) throw new Error(`Invalid ASCII grid header line: "${line}"`)
    header[m[1].toLowerCase()] = Number(m[2])
    lineCount++
  }
  const ncols = header['ncols']
  const nrows = header['nrows']
  const xllcorner = header['xllcorner'] ?? header['xllcenter']
  const yllcorner = header['yllcorner'] ?? header['yllcenter']
  const cellsize = header['cellsize']
  const nodata = header['nodata_value'] ?? -9999
  if (!Number.isFinite(ncols) || !Number.isFinite(nrows)) {
    throw new Error('ASCII grid header missing ncols/nrows')
  }
  const n = ncols * nrows
  const data = new Float64Array(n)
  // Fast whitespace-separated number scan over the remainder of the file.
  let k = 0
  let i = pos
  while (i < len && k < n) {
    // skip whitespace
    let c = text.charCodeAt(i)
    while (i < len && (c === 32 || c === 9 || c === 10 || c === 13 || c === 44)) {
      i++
      c = text.charCodeAt(i)
    }
    if (i >= len) break
    let start = i
    while (i < len) {
      c = text.charCodeAt(i)
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 44) break
      i++
    }
    data[k++] = Number(text.slice(start, i))
  }
  if (k < n) throw new Error(`ASCII grid: expected ${n} values, found ${k}`)
  return { ncols, nrows, xllcorner, yllcorner, cellsize, nodata, data }
}

export interface SerializeOptions {
  /** number of decimals; if 'int', write integers */
  decimals?: number | 'int'
  /** value used for NODATA cells on output (defaults to grid.nodata) */
  nodataOut?: number
}

export function serializeAsciiGrid(g: AsciiGrid, opts: SerializeOptions = {}): string {
  const dec = opts.decimals ?? 5
  const parts: string[] = []
  parts.push(`ncols         ${g.ncols}`)
  parts.push(`nrows         ${g.nrows}`)
  parts.push(`xllcorner     ${formatCoord(g.xllcorner)}`)
  parts.push(`yllcorner     ${formatCoord(g.yllcorner)}`)
  parts.push(`cellsize      ${formatCoord(g.cellsize)}`)
  parts.push(`NODATA_value  ${g.nodata}`)
  const row: string[] = new Array(g.ncols)
  for (let i = 0; i < g.nrows; i++) {
    const base = i * g.ncols
    for (let j = 0; j < g.ncols; j++) {
      const v = g.data[base + j]
      row[j] = dec === 'int' ? String(Math.round(v)) : trimNum(v, dec)
    }
    parts.push(row.join(' '))
  }
  return parts.join('\n') + '\n'
}

function trimNum(v: number, dec: number): string {
  if (!Number.isFinite(v)) return '-9999'
  return v.toFixed(dec)
}

function formatCoord(v: number): string {
  // preserve precision without scientific notation
  if (Number.isInteger(v)) return String(v)
  let s = v.toFixed(12)
  s = s.replace(/0+$/, '')
  if (s.endsWith('.')) s = s.slice(0, -1)
  return s
}

/** Grid statistics ignoring nodata (< -100). */
export function gridStats(g: AsciiGrid): { min: number; max: number; mean: number; count: number } {
  let min = Infinity, max = -Infinity, sum = 0, count = 0
  for (let k = 0; k < g.data.length; k++) {
    const v = g.data[k]
    if (!inDomain(v)) continue
    if (v < min) min = v
    if (v > max) max = v
    sum += v
    count++
  }
  return { min, max, mean: count ? sum / count : NaN, count }
}

export function sameShape(a: AsciiGrid, b: AsciiGrid): boolean {
  return a.ncols === b.ncols && a.nrows === b.nrows
}
