// Port of GSMaP tools (calc_area_gsmap.f90 + read_gsmap.f90).
// GSMaP binary products are global grids of float32 rain rate [mm/h]:
//   0.10 deg: 1200 rows x 3600 cols, first cell center (0.05E, 59.95N)
//   0.25 deg: 480 rows x 1440 cols, first cell center (0.125E, 59.875N)
// Rows run north -> south from 60N; columns run east from 0E.
// The web version merges the two Fortran steps: the crop window is computed
// automatically from the target grid header, files are decoded in the browser,
// and the result is emitted in RRI rainfall format.

import type { RainData } from '../core/rain.ts'

export interface GsmapProduct {
  resolution: 0.1 | 0.25
  hoursPerStep: 1 | 24
}

export interface GsmapWindow {
  jleft: number // 1-based, west column
  ibottom: number // 1-based, south row
  jright: number
  itop: number
  xllcornerRain: number
  yllcornerRain: number
  cellsizeRain: number
  ncols: number
  nrows: number
}

/**
 * Find the GSMaP index window covering the target grid (role of calc_area_gsmap.f90).
 * Unlike the original (whose reported xllcorner_rain is offset by one cell from the
 * columns actually extracted), the window here is self-consistent: the returned
 * xllcornerRain/yllcornerRain are exactly the west/south edges of the extracted block.
 * One extra margin cell is included on every side.
 */
export function gsmapWindow(
  target: { ncols: number; nrows: number; xllcorner: number; yllcorner: number; cellsize: number },
  product: GsmapProduct,
): GsmapWindow {
  const res = product.resolution
  const { rows, cols } = gsmapDims(product)
  // grid registration: column j (1-based) spans [(j-1)*res, j*res] east of 0E;
  // row i (1-based) spans [60N - i*res, 60N - (i-1)*res].
  const xll = target.xllcorner
  const yll = target.yllcorner
  const xur = target.xllcorner + target.ncols * target.cellsize
  const yur = target.yllcorner + target.nrows * target.cellsize

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const jleft = clamp(Math.floor(xll / res), 0, cols - 1) // extra margin: floor instead of floor+1
  const jright = clamp(Math.floor(xur / res) + 2, 1, cols)
  const itop = clamp(Math.floor((60 - yur) / res), 0, rows - 1)
  const ibottom = clamp(Math.floor((60 - yll) / res) + 2, 1, rows)

  const ncols = jright - jleft
  const nrows = ibottom - itop
  return {
    jleft: jleft + 1, // 1-based inclusive
    jright,
    itop: itop + 1,
    ibottom,
    xllcornerRain: jleft * res,
    yllcornerRain: 60 - ibottom * res,
    cellsizeRain: res,
    ncols, nrows,
  }
}

export function gsmapDims(product: GsmapProduct): { rows: number; cols: number } {
  return product.resolution === 0.1 ? { rows: 1200, cols: 3600 } : { rows: 480, cols: 1440 }
}

/**
 * Decode one GSMaP binary file and crop to the window.
 * Negative values (missing) are set to 0, as in read_gsmap.f90.
 */
export function decodeGsmapFrame(buf: ArrayBuffer, product: GsmapProduct, w: GsmapWindow): Float64Array {
  const { rows, cols } = gsmapDims(product)
  if (buf.byteLength < rows * cols * 4) {
    throw new Error(`GSMaP file too small: ${buf.byteLength} bytes, expected ${rows * cols * 4}`)
  }
  const f32 = new Float32Array(buf, 0, rows * cols)
  const out = new Float64Array(w.nrows * w.ncols)
  let k = 0
  for (let i = w.itop; i <= w.ibottom; i++) {
    for (let j = w.jleft; j <= w.jright; j++) {
      let jj = j
      // wrap across the antimeridian just in case
      if (jj > cols) jj -= cols
      if (jj < 1) jj += cols
      const v = f32[(i - 1) * cols + (jj - 1)]
      out[k++] = v < 0 || !Number.isFinite(v) ? 0 : v
    }
  }
  return out
}

/** Assemble frames (already sorted by time) into RRI rain data. */
export function gsmapToRain(frames: Float64Array[], product: GsmapProduct, w: GsmapWindow): RainData {
  const tstep = 3600 * product.hoursPerStep
  return {
    times: frames.map((_, t) => t * tstep),
    ncols: w.ncols,
    nrows: w.nrows,
    frames,
  }
}
