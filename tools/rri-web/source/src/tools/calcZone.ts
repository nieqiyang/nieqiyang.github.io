// Port of calcZone.f90: divide the basin into `div` zones of equal cell count,
// ranked by effective flow-path distance to the outlet (river distance shortened
// by riv_ratio). Used for T-SAS analysis.
// The Fortran computes distance per cell by full path walks (O(n·L)) and ranks with
// repeated maxloc (O(n^2)); this port memoizes distances and sorts (O(n log n)).

import type { AsciiGrid } from '../core/grid.ts'
import { cellSizeMeters } from '../core/geo.ts'
import { downstream } from '../core/d8.ts'

export interface CalcZoneParams {
  utm: boolean
  div: number // number of zones
  accThresh: number // acc >= thresh treated as river
  rivRatio: number // effective distance multiplier along rivers
}

export interface CalcZoneResult {
  zone: AsciiGrid // 1..div
  len: AsciiGrid // effective distance to outlet [m]
}

export function calcZone(dem: AsciiGrid, dirG: AsciiGrid, acc: AsciiGrid, p: CalcZoneParams): CalcZoneResult {
  const nx = dem.ncols
  const ny = dem.nrows
  const n = nx * ny
  const dir = Int32Array.from(dirG.data)
  const { length } = cellSizeMeters(nx, ny, dem.xllcorner, dem.yllcorner, dem.cellsize, p.utm)

  // Effective distance to outlet.
  // Fortran per-cell walk: dis of the step from cell k to its downstream is scaled by
  // rivRatio when the DOWNSTREAM cell is a river (acc(next) >= thresh), and the step of
  // the last cell (whose downstream is terminal) is NOT added.
  // Recurrence: len(k) = stepdis(k→next)*(river?ratio:1) + len(next), len(last)=0.
  const len = new Float64Array(n).fill(dem.nodata)
  const state = new Uint8Array(n)
  const stack: number[] = []
  for (let start = 0; start < n; start++) {
    if (dem.data[start] < -100 || dir[start] === 0) continue
    if (state[start] === 2) continue
    stack.length = 0
    let i = Math.floor(start / nx)
    let j = start % nx
    let below = 0
    let stoppedAtTerminal = true
    for (;;) {
      const k = i * nx + j
      if (state[k] === 2) { below = len[k]; stoppedAtTerminal = false; break }
      stack.push(k)
      state[k] = 1
      const { ii, jj } = downstream(dir, nx, i, j, length)
      if (ii < 0 || jj < 0 || ii >= ny || jj >= nx) break
      const kn = ii * nx + jj
      if (dir[kn] === 0 || dem.data[kn] < -100) break
      if (state[kn] === 1) break
      i = ii
      j = jj
    }
    for (let s = stack.length - 1; s >= 0; s--) {
      const k = stack[s]
      if (stoppedAtTerminal && s === stack.length - 1) {
        len[k] = 0
      } else {
        const ki = Math.floor(k / nx)
        const kj = k % nx
        const { ii, jj, dis } = downstream(dir, nx, ki, kj, length)
        const kn = ii * nx + jj
        const step = acc.data[kn] >= p.accThresh ? dis * p.rivRatio : dis
        len[k] = step + below
      }
      below = len[k]
      state[k] = 2
    }
  }

  // Rank cells by distance descending; zone = rank-based quantile 1..div
  const valid: number[] = []
  for (let k = 0; k < n; k++) {
    if (dem.data[k] >= -100 && dir[k] !== 0) valid.push(k)
  }
  valid.sort((a, b) => len[b] - len[a])
  const zone = new Float64Array(n).fill(-9999)
  const num = valid.length
  for (let r = 0; r < num; r++) {
    // Fortran: j = real(i)/real(num)*div + 1 with i = 1-based rank; clamp div+1 -> div
    let z = Math.floor(((r + 1) / num) * p.div) + 1
    if (z > p.div) z = p.div
    zone[valid[r]] = z
  }

  return {
    zone: { ...dem, nodata: -9999, data: zone },
    len: { ...dem, data: len },
  }
}
