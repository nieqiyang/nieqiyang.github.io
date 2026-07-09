// Port of rainThiessen.f90 (v1.1): Thiessen-polygon (nearest gauge) interpolation
// of gauged rainfall onto a regular grid in RRI rainfall format.
// Adds an optional IDW mode as a modern alternative.

import type { AsciiGrid } from '../core/grid.ts'
import type { RainData } from '../core/rain.ts'

export interface GaugeData {
  names: string[] // optional station names (empty strings if unknown)
  lat: number[]
  lon: number[]
  times: number[] // seconds, first must be 0
  /** values[t][k] rainfall of gauge k at time t; negative = missing */
  values: number[][]
}

/**
 * Parse the classic rainThiessen gauge file:
 *   L1: number of gauges
 *   L2: <label> lat1 lat2 ...
 *   L3: <label> lon1 lon2 ...
 *   L4..: <time_sec> v1 v2 ...
 */
export function parseGaugeFile(text: string): GaugeData {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 4) throw new Error('Gauge file too short')
  const num = Number(lines[0].trim().split(/[\s,]+/)[0])
  const parseRow = (line: string) => line.trim().split(/[\s,]+/).slice(1, 1 + num).map(Number)
  const lat = parseRow(lines[1])
  const lon = parseRow(lines[2])
  if (lat.length < num || lon.length < num) throw new Error('Gauge file: lat/lon rows shorter than gauge count')
  const times: number[] = []
  const values: number[][] = []
  for (let li = 3; li < lines.length; li++) {
    const parts = lines[li].trim().split(/[\s,]+/).map(Number)
    if (parts.length < num + 1 || !Number.isFinite(parts[0])) continue
    times.push(parts[0])
    values.push(parts.slice(1, 1 + num))
  }
  return { names: new Array(num).fill(''), lat, lon, times, values }
}

/** Parse CSV variant: header row "time,name1,name2..."?, lat row, lon row, then time rows. Auto-detect. */
export function parseGaugeCsv(text: string): GaugeData {
  // Expected layout (RRI-GUI style):
  //   row1: (blank) name1 name2 ...   [optional]
  //   row: lat, lat1, lat2...
  //   row: lon, lon1, lon2...
  //   rows: <time or datetime>, v1, v2, ...
  const rows = text.split(/\r?\n/).map((l) => l.split(/[,\t]/).map((c) => c.trim())).filter((r) => r.some((c) => c !== ''))
  let names: string[] = []
  let lat: number[] = []
  let lon: number[] = []
  const times: number[] = []
  const values: number[][] = []
  let t0: number | null = null
  for (const r of rows) {
    const key = r[0].toLowerCase()
    const rest = r.slice(1)
    if (key === 'name' || (key === '' && names.length === 0 && rest.some((c) => isNaN(Number(c))))) {
      names = rest
    } else if (key.startsWith('lat')) {
      lat = rest.map(Number)
    } else if (key.startsWith('lon')) {
      lon = rest.map(Number)
    } else {
      // time row: numeric seconds or datetime yyyy/mm/dd h:mm
      let tsec: number
      if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(r[0])) {
        const d = new Date(r[0].replace(/\//g, '-').replace(' ', 'T'))
        if (t0 === null) t0 = d.getTime()
        tsec = Math.round((d.getTime() - t0) / 1000)
      } else {
        tsec = Number(r[0])
        if (!Number.isFinite(tsec)) continue
      }
      times.push(tsec)
      values.push(rest.map((c) => (c === '' ? -999 : Number(c))))
    }
  }
  const num = lat.length
  if (num === 0 || lon.length !== num) throw new Error('CSV gauge file: lat/lon rows not found')
  if (names.length !== num) names = new Array(num).fill('')
  return { names, lat, lon, times, values }
}

export interface ThiessenParams {
  /** divide output by this factor: 1 for mm/h input, 24 for mm/d input */
  divide: number
  ncols: number
  nrows: number
  xll: number
  yll: number
  cellsize: number
  /** 'thiessen' (original) or 'idw' (inverse distance weighted, power 2) */
  method?: 'thiessen' | 'idw'
}

export interface ThiessenResult {
  rain: RainData
  /** gauge index map (1-based station number, ESRI grid) */
  map: AsciiGrid
  outOfRange: number[] // gauge indices (0-based) that fell outside the grid
}

export function rainThiessen(g: GaugeData, p: ThiessenParams): ThiessenResult {
  const num = g.lat.length
  const { ncols, nrows, xll, yll, cellsize } = p
  const method = p.method ?? 'thiessen'

  // STEP 2: gauge position in grid coordinates (1-based, 0 = out of range)
  const locX = new Int32Array(num)
  const locY = new Int32Array(num)
  const outOfRange: number[] = []
  for (let k = 0; k < num; k++) {
    const x = Math.floor((g.lon[k] - xll) / cellsize) + 1
    const y = nrows - Math.floor((g.lat[k] - yll) / cellsize)
    if (x <= 0 || x > ncols || y <= 0 || y > nrows) {
      locX[k] = 0
      locY[k] = 0
      outOfRange.push(k)
    } else {
      locX[k] = x
      locY[k] = y
    }
  }

  // STEP 3: nearest station for each cell (distance in cell units, cell centers at i-0.5)
  const map = new Int32Array(nrows * ncols)
  for (let i = 1; i <= nrows; i++) {
    for (let j = 1; j <= ncols; j++) {
      let disMin = 1e15
      let kmin = 10000
      for (let k = 0; k < num; k++) {
        if (locX[k] === 0) continue
        const dy = locY[k] - (i - 0.5)
        const dx = locX[k] - (j - 0.5)
        const d = dy * dy + dx * dx
        if (d < disMin) { disMin = d; kmin = k }
      }
      map[(i - 1) * ncols + (j - 1)] = kmin
    }
  }

  // STEP 4: interpolation with missing-data fallback
  const maxt = g.times.length
  const frames: Float64Array[] = []
  for (let t = 0; t < maxt; t++) {
    const frame = new Float64Array(nrows * ncols)
    const vals = g.values[t]
    for (let i = 1; i <= nrows; i++) {
      for (let j = 1; j <= ncols; j++) {
        const cell = (i - 1) * ncols + (j - 1)
        if (method === 'idw') {
          let wsum = 0
          let vsum = 0
          let exact = -1
          for (let k = 0; k < num; k++) {
            if (locX[k] === 0 || vals[k] < 0) continue
            const dy = locY[k] - (i - 0.5)
            const dx = locX[k] - (j - 0.5)
            const d2 = dy * dy + dx * dx
            if (d2 < 1e-12) { exact = k; break }
            const w = 1 / d2
            wsum += w
            vsum += w * vals[k]
          }
          frame[cell] = exact >= 0 ? vals[exact] / p.divide : wsum > 0 ? vsum / wsum / p.divide : 0
        } else {
          let k = map[cell]
          if (k < num && vals[k] < 0) {
            // nearest station with valid data
            let disMin = 1e15
            let kmin = 10000
            for (let kk = 0; kk < num; kk++) {
              if (locX[kk] === 0 || vals[kk] < 0) continue
              const dy = locY[kk] - (i - 0.5)
              const dx = locX[kk] - (j - 0.5)
              const d = dy * dy + dx * dx
              if (d < disMin) { disMin = d; kmin = kk }
            }
            k = kmin
          }
          frame[cell] = k < num ? vals[k] / p.divide : 0
        }
      }
    }
    frames.push(frame)
  }

  const mapGrid: AsciiGrid = {
    ncols, nrows, xllcorner: xll, yllcorner: yll, cellsize, nodata: -9999,
    data: Float64Array.from(map, (v) => v + 1), // 1-based station id like Fortran
  }
  return {
    rain: { times: g.times.slice(), ncols, nrows, frames },
    map: mapGrid,
    outOfRange,
  }
}
