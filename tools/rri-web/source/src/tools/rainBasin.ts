// Port of rainBasin.f90 (v1.0): basin-average hyetograph, total rainfall
// distribution map and cumulative rainfall from an RRI-format rainfall file.

import type { AsciiGrid } from '../core/grid.ts'
import type { RainData } from '../core/rain.ts'

export interface RainBasinParams {
  xllRain: number
  yllRain: number
  cellsizeRainX: number
  cellsizeRainY: number
}

export interface RainBasinResult {
  /** hyetograph: time [s] / basin-average intensity [mm/h] */
  times: number[]
  hyeto: number[]
  /** cumulative basin rainfall [mm] at each time */
  cum: number[]
  /** total rainfall distribution [mm] on the topography grid */
  dist: AsciiGrid
  numCells: number
}

export function rainBasin(rain: RainData, mask: AsciiGrid, p: RainBasinParams): RainBasinResult {
  const { ncols: nx, nrows: ny } = mask
  const nxRain = rain.ncols
  const nyRain = rain.nrows

  // domain: mask cells > -10
  const domain = new Uint8Array(ny * nx)
  let numCells = 0
  for (let k = 0; k < domain.length; k++) {
    if (mask.data[k] > -10.0) { domain[k] = 1; numCells++ }
  }

  // rainfall cell index for each topo row/col (1-based like Fortran, 0 = outside)
  const rainJ = new Int32Array(nx)
  const rainI = new Int32Array(ny)
  for (let j = 1; j <= nx; j++) {
    rainJ[j - 1] = Math.floor((mask.xllcorner + (j - 0.5) * mask.cellsize - p.xllRain) / p.cellsizeRainX) + 1
  }
  for (let i = 1; i <= ny; i++) {
    rainI[i - 1] = nyRain - Math.floor((mask.yllcorner + (ny - i + 0.5) * mask.cellsize - p.yllRain) / p.cellsizeRainY)
  }

  const maxt = rain.times.length
  const hyeto: number[] = new Array(maxt).fill(0)
  const cum: number[] = new Array(maxt).fill(0)
  const dist = new Float64Array(ny * nx)

  for (let t = 0; t < maxt; t++) {
    const frame = rain.frames[t]
    let sum = 0
    const dtSec = t > 0 ? rain.times[t] - rain.times[t - 1] : 0
    for (let i = 0; i < ny; i++) {
      const ri = rainI[i]
      const inI = ri >= 1 && ri <= nyRain
      for (let j = 0; j < nx; j++) {
        const cell = i * nx + j
        if (domain[cell] === 0) continue
        const rj = rainJ[j]
        let v = 0
        if (inI && rj >= 1 && rj <= nxRain) v = frame[(ri - 1) * nxRain + (rj - 1)]
        sum += v
        if (t > 0) dist[cell] += (v / 3600) * dtSec
      }
    }
    hyeto[t] = numCells > 0 ? sum / numCells : 0
    cum[t] = t > 0 ? cum[t - 1] + (hyeto[t] / 3600) * dtSec : 0
  }

  for (let k = 0; k < dist.length; k++) {
    if (domain[k] !== 1) dist[k] = mask.nodata
  }

  return {
    times: rain.times.slice(),
    hyeto,
    cum,
    dist: { ...mask, data: dist },
    numCells,
  }
}
