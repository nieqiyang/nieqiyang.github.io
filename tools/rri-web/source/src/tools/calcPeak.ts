// Port of calcPeak.f90: cell-wise maximum over a sequence of RRI output rasters.
// Streaming version: feed frames one by one to keep memory flat.

import type { AsciiGrid } from '../core/grid.ts'

export class PeakAccumulator {
  private peak: Float64Array
  private ncols: number
  private nrows: number
  count = 0

  constructor(private ref: AsciiGrid) {
    this.ncols = ref.ncols
    this.nrows = ref.nrows
    this.peak = new Float64Array(this.ncols * this.nrows).fill(-1e6)
  }

  /** add one raw raster body (no header) */
  addFrameText(text: string): void {
    const n = this.ncols * this.nrows
    let k = 0
    const len = text.length
    let i = 0
    const peak = this.peak
    while (i < len && k < n) {
      let c = text.charCodeAt(i)
      while (i < len && (c === 32 || c === 9 || c === 10 || c === 13 || c === 44)) { i++; c = text.charCodeAt(i) }
      if (i >= len) break
      const start = i
      while (i < len) {
        c = text.charCodeAt(i)
        if (c === 32 || c === 9 || c === 10 || c === 13 || c === 44) break
        i++
      }
      const v = Number(text.slice(start, i))
      if (v > peak[k]) peak[k] = v
      k++
    }
    if (k < n) throw new Error(`Output raster has ${k} values, expected ${n}`)
    this.count++
  }

  /** finalize: cells never above 0 become nodata (same as Fortran) */
  result(): AsciiGrid {
    const data = Float64Array.from(this.peak)
    for (let k = 0; k < data.length; k++) {
      if (data[k] < 0) data[k] = this.ref.nodata
    }
    return { ...this.ref, data }
  }
}
