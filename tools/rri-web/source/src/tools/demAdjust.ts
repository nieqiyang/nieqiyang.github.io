// Port of demAdjust2.f90 (v2.1).
// Removes negative slopes along D8 flow paths by lifting / carving / incremental
// lift-and-carve, and zeroes the flow direction at outlet cells.
// Semantics identical to the Fortran original; the repeated goto-restart walks are
// replaced by scans over a precomputed path array (the flow path never changes).

import type { AsciiGrid } from '../core/grid.ts'
import { cloneGrid } from '../core/grid.ts'
import { cellSizeMeters } from '../core/geo.ts'
import { downstream } from '../core/d8.ts'

export interface DemAdjustParams {
  utm?: boolean
  lift?: number // [m] default 500
  carve?: number // [m] default 5
  increment?: number // [m] default 0.01
  accThresh?: number // default 0
}

export interface DemAdjustResult {
  adem: AsciiGrid
  adir: AsciiGrid
  log: string[]
}

export type ProgressFn = (phase: string, done: number, total: number) => void

export function demAdjust(
  demIn: AsciiGrid, dirIn: AsciiGrid, accIn: AsciiGrid,
  params: DemAdjustParams = {}, onProgress?: ProgressFn,
): DemAdjustResult {
  const { utm = false, lift = 500, carve = 5, increment = 0.01, accThresh = 0 } = params
  const ncols = demIn.ncols
  const nrows = demIn.nrows
  const n = ncols * nrows
  const log: string[] = []

  const dem = Float64Array.from(demIn.data)
  const dir = Int32Array.from(dirIn.data)
  const acc = Float64Array.from(accIn.data)
  const nodata = demIn.nodata

  // STEP 2: cell size
  const { length } = cellSizeMeters(ncols, nrows, demIn.xllcorner, demIn.yllcorner, demIn.cellsize, utm)

  // STEP 3: set dir = 0 at outlets / boundary-crossing cells
  for (let i = 0; i < nrows; i++) {
    for (let j = 0; j < ncols; j++) {
      const k = i * ncols + j
      if (dem[k] < -100) continue
      if (dir[k] <= -1) {
        log.push(`dir(${i + 1},${j + 1}) < 0 detected; dem set to nodata, dir set to 0`)
        dem[k] = nodata
        dir[k] = 0
      }
      const { ii, jj } = downstream(dir, ncols, i, j, length)
      if (ii < 0 || jj < 0 || ii >= nrows || jj >= ncols) {
        dir[k] = 0
        continue
      }
      if (dem[ii * ncols + jj] < -100) dir[k] = 0
    }
  }

  // STEP 5: most-upstream cells (no inflow)
  const upstream = new Uint8Array(n).fill(1)
  for (let i = 0; i < nrows; i++) {
    for (let j = 0; j < ncols; j++) {
      const k = i * ncols + j
      if (dem[k] < -100 || dir[k] === 0 || acc[k] < accThresh) {
        upstream[k] = 0
        continue
      }
      const { ii, jj } = downstream(dir, ncols, i, j, length)
      upstream[ii * ncols + jj] = 0
    }
  }
  const heads: number[] = []
  for (let k = 0; k < n; k++) if (upstream[k] === 1) heads.push(k)

  // STEP 6: total flow-path length from each upstream cell
  const totalLength = new Float64Array(heads.length)
  for (let h = 0; h < heads.length; h++) {
    let i = Math.floor(heads[h] / ncols)
    let j = heads[h] % ncols
    let tl = 0
    let guard = 0
    for (;;) {
      const { ii, jj, dis } = downstream(dir, ncols, i, j, length)
      tl += dis
      if (dir[ii * ncols + jj] === 0) break
      i = ii
      j = jj
      if (++guard > n) throw new Error(`Flow path loop detected near cell (${i + 1},${j + 1})`)
    }
    totalLength[h] = tl
  }

  // STEP 7: order paths by total length, longest first.
  // Fortran tie-break: among equal lengths the LAST index is picked first.
  const order = heads.map((_, idx) => idx)
  order.sort((a, b) => (totalLength[b] - totalLength[a]) || (b - a))

  // Precompute each path as an array of cell indices (head .. cell whose dir target is the outlet cell).
  // The walk in Fortran stops when dir(downstream)==0, i.e. the downstream outlet cell itself
  // is *reached* by down() but the loop exits before advancing into it — however lifting/carving
  // DO modify adem(ii,jj) where (ii,jj) can be the outlet cell. So store the full visited chain
  // including the final downstream cell.
  const buildPath = (head: number): Int32Array => {
    const cells: number[] = [head]
    let i = Math.floor(head / ncols)
    let j = head % ncols
    let guard = 0
    for (;;) {
      const { ii, jj } = downstream(dir, ncols, i, j, length)
      cells.push(ii * ncols + jj)
      if (dir[ii * ncols + jj] === 0) break
      i = ii
      j = jj
      if (++guard > n) break
    }
    return Int32Array.from(cells)
  }

  // STEP 8: adjust DEM
  const adem = Float64Array.from(dem)
  for (let k = 0; k < n; k++) {
    if (adem[k] > -50 && adem[k] <= 0) adem[k] = 0
  }

  const total = heads.length * 3
  let doneCount = 0
  const report = () => {
    if (onProgress && (doneCount & 0x3f) === 0) onProgress('adjust', doneCount, total)
  }

  // --- lifting ---
  // Fortran: walk (i,j) -> (ii,jj) -> (iii,jjj); exit when dir(ii,jj)==0 (checked BEFORE the
  // lift test); if adem(i)-adem(ii) > lift AND adem(iii)-adem(ii) > lift: adem(ii)=adem(i), restart.
  for (const oidx of order) {
    const path = buildPath(heads[oidx])
    // path[p] = i, path[p+1] = ii, path[p+2] = iii
    let restart = true
    while (restart) {
      restart = false
      for (let p = 0; p + 2 < path.length; p++) {
        const a = path[p], b = path[p + 1], c = path[p + 2]
        if (dir[b] === 0) break
        if (adem[a] - adem[b] > lift && adem[c] - adem[b] > lift) {
          adem[b] = adem[a]
          restart = true
          break
        }
      }
      // The last path cell always has dir==0, so the p+2 bound never skips a testable pair.
    }
    doneCount++
    report()
  }

  // --- carving ---
  // Fortran: if adem(i) < adem(ii) - carve: adem(ii) = adem(i), restart; exit AFTER the test
  // when dir(ii)==0.
  for (const oidx of order) {
    const path = buildPath(heads[oidx])
    let restart = true
    while (restart) {
      restart = false
      for (let p = 0; p + 1 < path.length; p++) {
        const a = path[p], b = path[p + 1]
        if (adem[a] < adem[b] - carve) {
          adem[b] = adem[a]
          restart = true
          break
        }
        if (dir[b] === 0) break
      }
    }
    doneCount++
    report()
  }

  // --- lifting and carving ---
  // Find first cell L where downstream is higher, then first later cell H where downstream
  // is lower; raise L and lower H by increment; restart the path scan.
  for (const oidx of order) {
    const path = buildPath(heads[oidx])
    let restart = true
    while (restart) {
      restart = false
      let sw = 0
      let s1 = -1
      let s2 = -1
      for (let p = 0; p + 1 < path.length; p++) {
        const a = path[p], b = path[p + 1]
        if (sw === 0 && adem[a] < adem[b]) { s1 = a; sw = 1 }
        if (sw === 1 && adem[a] > adem[b]) { s2 = a; sw = 2 }
        if (sw === 2) {
          adem[s1] += increment
          adem[s2] -= increment
          restart = true
          break
        }
        if (dir[b] === 0) break
      }
    }
    doneCount++
    report()
  }
  if (onProgress) onProgress('adjust', total, total)

  const ademGrid: AsciiGrid = { ...cloneGrid(demIn), data: adem }
  const adirGrid: AsciiGrid = {
    ncols, nrows,
    xllcorner: dirIn.xllcorner, yllcorner: dirIn.yllcorner,
    cellsize: dirIn.cellsize, nodata: dirIn.nodata,
    data: Float64Array.from(dir),
  }
  return { adem: ademGrid, adir: adirGrid, log }
}
