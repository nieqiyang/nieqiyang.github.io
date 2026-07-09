// D8 flow-direction helpers (ESRI encoding: 1 E, 2 SE, 4 S, 8 SW, 16 W, 32 NW, 64 N, 128 NE).

export const DIR_CODES = [1, 2, 4, 8, 16, 32, 64, 128] as const

/** row offset (di) and col offset (dj) for each direction code */
export function dirOffset(code: number): { di: number; dj: number; diag: boolean } | null {
  switch (code) {
    case 1: return { di: 0, dj: 1, diag: false }
    case 2: return { di: 1, dj: 1, diag: true }
    case 4: return { di: 1, dj: 0, diag: false }
    case 8: return { di: 1, dj: -1, diag: true }
    case 16: return { di: 0, dj: -1, diag: false }
    case 32: return { di: -1, dj: -1, diag: true }
    case 64: return { di: -1, dj: 0, diag: false }
    case 128: return { di: -1, dj: 1, diag: true }
    default: return null
  }
}

/** direction code from cell (i,j) to neighbor (ii,jj); 0 if same cell */
export function offsetToDir(di: number, dj: number): number {
  if (di === 0 && dj === 1) return 1
  if (di === 1 && dj === 1) return 2
  if (di === 1 && dj === 0) return 4
  if (di === 1 && dj === -1) return 8
  if (di === 0 && dj === -1) return 16
  if (di === -1 && dj === -1) return 32
  if (di === -1 && dj === 0) return 64
  if (di === -1 && dj === 1) return 128
  return 0
}

/**
 * Downstream cell of (i, j) following dir. Mirrors subroutine down():
 * for dir 0 (outlet) or invalid codes returns the same cell with dis = length.
 * Returned dis is the travel distance, wid the flow width (calcTc convention).
 */
export function downstream(
  dir: Int32Array, ncols: number, i: number, j: number, length: number,
): { ii: number; jj: number; dis: number; wid: number } {
  const code = dir[i * ncols + j]
  const off = dirOffset(code)
  if (!off) return { ii: i, jj: j, dis: length, wid: length }
  const f = off.diag ? Math.SQRT2 : 1
  return { ii: i + off.di, jj: j + off.dj, dis: length * f, wid: off.diag ? length / Math.SQRT2 : length }
}

/**
 * Mark most-upstream cells (no inflow), following demAdjust2 STEP 5:
 * cells outside domain / dir==0 / below accThresh are excluded, and every
 * downstream target of a valid cell is cleared.
 */
export function findUpstreamCells(
  dir: Int32Array, dem: Float64Array, acc: Int32Array | Float64Array | null,
  ncols: number, nrows: number, accThresh = 0,
): Uint8Array {
  const up = new Uint8Array(nrows * ncols).fill(1)
  for (let i = 0; i < nrows; i++) {
    for (let j = 0; j < ncols; j++) {
      const k = i * ncols + j
      if (dem[k] < -100 || dir[k] === 0 || (acc !== null && acc[k] < accThresh)) {
        up[k] = 0
        continue
      }
      const { ii, jj } = downstream(dir, ncols, i, j, 1)
      if (ii >= 0 && ii < nrows && jj >= 0 && jj < ncols) up[ii * ncols + jj] = 0
    }
  }
  return up
}
