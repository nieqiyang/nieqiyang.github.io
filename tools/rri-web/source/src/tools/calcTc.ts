// Port of calcTc.f90: time of concentration [h] from every cell to the basin outlet,
// using kinematic-wave celerity per cell (Manning on rivers / Manning or Darcy on slopes)
// under a reference rainfall intensity.
// The Fortran walks the full path from every cell (O(n·L)); this port memoizes
// downstream results so each cell is visited once (O(n)).

import type { AsciiGrid } from '../core/grid.ts'
import { cellSizeMeters } from '../core/geo.ts'
import { downstream } from '../core/d8.ts'

export interface CalcTcParams {
  utm: boolean
  manning: boolean // slope cells: true Manning, false Darcy (ka)
  rain: number // reference rainfall [mm/h]
  nr: number // Manning n river
  ns: number // Manning n slope
  ka: number // lateral hydraulic conductivity [m/s] (Darcy mode)
}

export interface CalcTcResult {
  tc: AsciiGrid // [h]
  travelPerCell: AsciiGrid // t(i,j) [h] per-cell travel time
}

export function calcTc(
  dem: AsciiGrid, dirG: AsciiGrid, acc: AsciiGrid, width: AsciiGrid | null, p: CalcTcParams,
): CalcTcResult {
  const nx = dem.ncols
  const ny = dem.nrows
  const n = nx * ny
  const dir = Int32Array.from(dirG.data)
  const { length } = cellSizeMeters(nx, ny, dem.xllcorner, dem.yllcorner, dem.cellsize, p.utm)

  // STEP 3: per-cell travel time t [h]
  const t = new Float64Array(n).fill(dem.nodata)
  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nx; j++) {
      const k = i * nx + j
      if (dem.data[k] < -100 || dir[k] === 0) continue
      const { ii, jj, dis, wid } = downstream(dir, nx, i, j, length)
      // slope along flow direction (min 0.01, same as Fortran)
      const dif = Math.abs(dem.data[k] - dem.data[ii * nx + jj])
      let slo = dif / Math.sqrt(dif * dif + dis * dis)
      if (slo < 0.01) slo = 0.01

      let alph: number
      let m: number
      let w = wid
      if (p.manning) {
        alph = Math.sqrt(slo) / p.ns
        m = 5 / 3
      } else {
        alph = p.ka * slo
        m = 1
      }
      if (width && width.data[k] > 0) {
        alph = Math.sqrt(slo) / p.nr
        m = 5 / 3
        w = width.data[k]
      }
      const q = (acc.data[k] * length * length * p.rain) / 1000 / 3600 // [m3/s]
      const h = Math.pow(q / w / alph, 1 / m)
      const c = alph * m * Math.pow(h, m - 1)
      t[k] = c > 0 ? length / c / 3600 : 0
    }
  }

  // STEP 4: accumulate travel time downstream, memoized.
  // Fortran: tc(cell) = sum of t along the path, where t of a step is added only
  // while the NEXT cell is still inside/not outlet — i.e. tc = t(cell) + t(next) + ...
  // excluding the step of the last cell before the outlet? Re-reading the loop:
  //   walk from (iii,jjj): down -> (ii,jj); if next is outlet/outside: tc = tl (exit)
  //   else tl += t(i,j); advance.
  // So the step time of the cell whose downstream is the outlet is NOT added.
  // Recurrence: tc(cell) = t(cell) + tc(downstream); tc(cell)=0 when downstream is terminal.
  const tc = new Float64Array(n).fill(dem.nodata)
  const state = new Uint8Array(n) // 0 unvisited, 1 in progress, 2 done
  const stack: number[] = []
  for (let start = 0; start < n; start++) {
    if (dem.data[start] < -100 || dir[start] === 0) continue
    if (state[start] === 2) continue
    // walk down collecting cells until reaching a resolved cell or a terminal downstream
    stack.length = 0
    let i = Math.floor(start / nx)
    let j = start % nx
    let below = 0 // tc of the cell downstream of the stack top
    let stoppedAtTerminal = true
    for (;;) {
      const k = i * nx + j
      if (state[k] === 2) { below = tc[k]; stoppedAtTerminal = false; break }
      stack.push(k)
      state[k] = 1
      const { ii, jj } = downstream(dir, nx, i, j, length)
      if (ii < 0 || jj < 0 || ii >= ny || jj >= nx) break
      const kn = ii * nx + jj
      if (dir[kn] === 0 || dem.data[kn] < -100) break
      if (state[kn] === 1) break // safety: cycle
      i = ii
      j = jj
    }
    for (let s = stack.length - 1; s >= 0; s--) {
      const k = stack[s]
      if (stoppedAtTerminal && s === stack.length - 1) tc[k] = 0
      else tc[k] = t[k] + below
      below = tc[k]
      state[k] = 2
    }
  }

  return {
    tc: { ...dem, data: tc },
    travelPerCell: { ...dem, data: t },
  }
}
