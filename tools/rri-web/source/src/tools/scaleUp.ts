// Port of scaleUp.f90 (v1.1): upscale DEM/DIR/ACC grids by an integer factor
// following Masutani et al. (2006). Faithful port including corner masking,
// per-tile max-acc outlet tracking, and the extra-acc correction for basins
// with upstream contributing area outside the domain.

import type { AsciiGrid } from '../core/grid.ts'
import { downstream } from '../core/d8.ts'

export interface ScaleUpResult {
  dem2: AsciiGrid
  dir2: AsciiGrid
  acc2: AsciiGrid
  warnings: string[]
}

export function scaleUp(demG: AsciiGrid, dirG: AsciiGrid, accG: AsciiGrid, ups: number): ScaleUpResult {
  const nx = demG.ncols
  const ny = demG.nrows
  const dem = demG.data
  const dir = Int32Array.from(dirG.data)
  const acc = Float64Array.from(accG.data)
  const warnings: string[] = []

  // STEP 2: setup
  let corner = 0
  if (ups >= 9) corner = 3
  else if (ups >= 6) corner = 2
  else if (ups >= 3) corner = 1

  const nx2 = Math.floor(nx / ups)
  const ny2 = Math.floor(ny / ups)
  if (nx2 < 2 || ny2 < 2) throw new Error('Upscale factor too large for this grid')
  const cellsize2 = demG.cellsize * ups
  const xll2 = demG.xllcorner
  const yll2 = demG.yllcorner + ny * demG.cellsize - ny2 * cellsize2

  const top = (ii: number) => ii * ups // 0-based row range [top, bottom)
  const left = (jj: number) => jj * ups

  // tile mask: 0 = corner-masked cell (excluded from outlet search / dem average)
  const tile = new Uint8Array(ny * nx).fill(1)
  if (corner >= 1) {
    for (let ii = 0; ii < ny2; ii++) {
      for (let jj = 0; jj < nx2; jj++) {
        const t = top(ii), l = left(jj)
        const b = t + ups - 1, r = l + ups - 1
        for (let a = 0; a < corner; a++) {
          for (let bb = 0; bb < corner; bb++) {
            tile[(t + a) * nx + (l + bb)] = 0 // top-left
            tile[(t + a) * nx + (r - bb)] = 0 // top-right
            tile[(b - a) * nx + (l + bb)] = 0 // bottom-left
            tile[(b - a) * nx + (r - bb)] = 0 // bottom-right
          }
        }
      }
    }
  }

  // STEP 3: per-tile max acc cell + average dem
  const n2 = ny2 * nx2
  const accmax = new Float64Array(n2)
  const amI = new Int32Array(n2).fill(-1)
  const amJ = new Int32Array(n2).fill(-1)
  const dem2 = new Float64Array(n2)
  for (let ii = 0; ii < ny2; ii++) {
    for (let jj = 0; jj < nx2; jj++) {
      const k2 = ii * nx2 + jj
      let count = 0
      let sum = 0
      for (let i = top(ii); i < top(ii) + ups; i++) {
        for (let j = left(jj); j < left(jj) + ups; j++) {
          const k = i * nx + j
          if (dem[k] < -100 || tile[k] === 0) continue
          if (acc[k] >= accmax[k2]) {
            accmax[k2] = acc[k]
            amI[k2] = i
            amJ[k2] = j
          }
          sum += dem[k]
          count++
        }
      }
      dem2[k2] = count >= (ups * ups) / 2 ? sum / count : -999.9
    }
  }

  // STEP 4: coarse flow direction — follow the fine network from the tile outlet
  // through corner-masked cells until it exits into an unmasked cell.
  const dir2 = new Int32Array(n2).fill(-999)
  for (let ii = 0; ii < ny2; ii++) {
    for (let jj = 0; jj < nx2; jj++) {
      const k2 = ii * nx2 + jj
      if (dem2[k2] < -100) continue
      let i = amI[k2]
      let j = amJ[k2]
      if (i < 0) continue
      let iNext = i
      let jNext = j
      let guard = 0
      for (;;) {
        if (dir[i * nx + j] <= 0) { iNext = i; jNext = j; break }
        const { ii: di, jj: dj } = downstream(dir, nx, i, j, 1)
        if (di < 0 || dj < 0 || di >= ny || dj >= nx) { iNext = i; jNext = j; break }
        iNext = di
        jNext = dj
        if (tile[di * nx + dj] === 0) { i = di; j = dj } else break
        if (++guard > nx * ny) break
      }
      // coarse tile of the next cell (1-based ceil in Fortran; 0-based floor here)
      let ii2 = Math.floor(iNext / ups)
      let jj2 = Math.floor(jNext / ups)
      if (ii2 >= ny2) ii2 = ny2 - 1
      if (jj2 >= nx2) jj2 = nx2 - 1
      let code = 0
      if (ii2 === ii && jj2 > jj) code = 1
      else if (ii2 > ii && jj2 > jj) code = 2
      else if (ii2 > ii && jj2 === jj) code = 4
      else if (ii2 > ii && jj2 < jj) code = 8
      else if (ii2 === ii && jj2 < jj) code = 16
      else if (ii2 < ii && jj2 < jj) code = 32
      else if (ii2 < ii && jj2 === jj) code = 64
      else if (ii2 < ii && jj2 > jj) code = 128
      if (dem2[ii2 * nx2 + jj2] < -100) code = 0
      dir2[k2] = code
    }
  }

  // STEP 5: acc_dif — inflow from outside-domain upstream areas (basins clipped upstream)
  const accDif = new Float64Array(ny * nx).fill(1)
  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nx; j++) {
      const k = i * nx + j
      if (dem[k] < -100) continue
      const { ii, jj } = downstream(dir, nx, i, j, 1)
      if (ii < 0 || jj < 0 || ii >= ny || jj >= nx) continue
      accDif[ii * nx + jj] += acc[k]
    }
  }
  for (let k = 0; k < ny * nx; k++) {
    accDif[k] = acc[k] - accDif[k]
    if (accDif[k] <= 100) accDif[k] = 0
    if (dem[k] < -100) accDif[k] = 0
  }
  // push acc_dif that landed in tiles outside the coarse domain downstream into the domain
  for (let ii = 0; ii < ny2; ii++) {
    for (let jj = 0; jj < nx2; jj++) {
      const k2 = ii * nx2 + jj
      for (let i = top(ii); i < top(ii) + ups; i++) {
        for (let j = left(jj); j < left(jj) + ups; j++) {
          const k = i * nx + j
          if (accDif[k] > 0 && dem2[k2] < -100) {
            let ci = i, cj = j
            let guard = 0
            for (;;) {
              const { ii: di, jj: dj } = downstream(dir, nx, ci, cj, 1)
              if (di < 0 || dj < 0 || di >= ny || dj >= nx) break
              accDif[di * nx + dj] = accDif[ci * nx + cj]
              accDif[ci * nx + cj] = 0
              ci = di
              cj = dj
              if (dem[ci * nx + cj] >= -100) break
              if (++guard > nx * ny) break
            }
          }
        }
      }
    }
  }

  // upstream cells on coarse grid
  const upstream2 = new Uint8Array(n2).fill(1)
  for (let ii = 0; ii < ny2; ii++) {
    for (let jj = 0; jj < nx2; jj++) {
      const k2 = ii * nx2 + jj
      if (dem2[k2] < -100) { upstream2[k2] = 0; continue }
      const { ii: di, jj: dj } = downstream(dir2, nx2, ii, jj, 1)
      if (di >= 0 && dj >= 0 && di < ny2 && dj < nx2) upstream2[di * nx2 + dj] = 0
    }
  }

  // STEP 6: coarse flow accumulation (with loop repair like the Fortran goto 1111)
  const acc2 = new Float64Array(n2)
  const pass2 = new Uint8Array(n2)
  let redo = true
  let redoGuard = 0
  while (redo && redoGuard++ < 1000) {
    redo = false
    acc2.fill(0)
    pass2.fill(0)
    outer:
    for (let ii = 0; ii < ny2; ii++) {
      for (let jj = 0; jj < nx2; jj++) {
        if (upstream2[ii * nx2 + jj] !== 1) continue
        let ci = ii, cj = jj
        let kAcc = 1
        let count = 0
        for (;;) {
          count++
          pass2[ci * nx2 + cj] = 1
          const { ii: di, jj: dj } = downstream(dir2, nx2, ci, cj, 1)
          if (di < 0 || dj < 0 || di >= ny2 || dj >= nx2) break
          const kn = di * nx2 + dj
          if (dir2[kn] < 0) break
          acc2[kn] += kAcc
          if (pass2[kn] === 0) kAcc++
          ci = di
          cj = dj
          if (dir2[kn] === 0) break
          if (count >= nx2 * ny2) {
            warnings.push(`Loop detected on coarse grid at (${ci + 1},${cj + 1}); dir2 set to 0`)
            dir2[ci * nx2 + cj] = 0
            redo = true
            break outer
          }
        }
      }
    }
  }
  for (let k2 = 0; k2 < n2; k2++) {
    if (dem2[k2] < -100) acc2[k2] = -999
  }

  // STEP 6.1: add external contributing area
  for (let ii = 0; ii < ny2; ii++) {
    for (let jj = 0; jj < nx2; jj++) {
      for (let i = top(ii); i < top(ii) + ups; i++) {
        for (let j = left(jj); j < left(jj) + ups; j++) {
          if (accDif[i * nx + j] >= 100) {
            const kAdd = Math.floor(accDif[i * nx + j] / ups / ups)
            warnings.push(`acc increased by ${kAdd} at coarse cell (${ii + 1},${jj + 1})`)
            let ci = ii, cj = jj
            let guard = 0
            for (;;) {
              acc2[ci * nx2 + cj] += kAdd
              const { ii: di, jj: dj } = downstream(dir2, nx2, ci, cj, 1)
              if (di < 0 || dj < 0 || di >= ny2 || dj >= nx2) break
              ci = di
              cj = dj
              if (dir2[ci * nx2 + cj] === 0) { acc2[ci * nx2 + cj] += kAdd; break }
              if (++guard > n2) break
            }
          }
        }
      }
    }
  }

  const meta = { ncols: nx2, nrows: ny2, xllcorner: xll2, yllcorner: yll2, cellsize: cellsize2 }
  return {
    dem2: { ...meta, nodata: -999.9, data: dem2 },
    dir2: { ...meta, nodata: -999, data: Float64Array.from(dir2) },
    acc2: { ...meta, nodata: -999, data: acc2 },
    warnings,
  }
}
