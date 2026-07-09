// Port of evalPeak.f90: fit index between simulated and observed inundation extent
//   fit = |S ∩ O| / |S ∪ O|
// The original hardcodes sim >= 1.0 m and obs >= 0.0 as "inundated";
// both thresholds are parameters here.

import type { AsciiGrid } from '../core/grid.ts'

export interface EvalPeakParams {
  imin: number // 1-based rows, inclusive
  imax: number
  jmin: number
  jmax: number
  ishift: number
  jshift: number
  simThresh: number // default 1.0
  obsThresh: number // default 0.0
}

export interface EvalPeakResult {
  intersection: number
  union: number
  fit: number
  simOnly: number
  obsOnly: number
  /** 0 none, 1 sim only, 2 obs only, 3 both — for map display */
  classes: AsciiGrid
}

export function evalPeak(sim: AsciiGrid, obs: AsciiGrid, p: EvalPeakParams): EvalPeakResult {
  const nx = sim.ncols
  const ny = sim.nrows
  const imin = Math.max(1, p.imin)
  const imax = Math.min(ny, p.imax)
  const jmin = Math.max(1, p.jmin)
  const jmax = Math.min(nx, p.jmax)

  let both = 0, either = 0, simOnly = 0, obsOnly = 0
  const cls = new Float64Array(ny * nx).fill(-9999)

  for (let i = imin; i <= imax; i++) {
    for (let j = jmin; j <= jmax; j++) {
      const sv = sim.data[(i - 1) * nx + (j - 1)]
      if (sv < 0) continue
      const oi = i - p.ishift
      const oj = j - p.jshift
      if (oi < 1 || oi > ny || oj < 1 || oj > nx) continue
      const ov = obs.data[(oi - 1) * nx + (oj - 1)]
      if (ov < 0) continue
      const isSim = sv >= p.simThresh
      const isObs = ov >= p.obsThresh
      const cell = (i - 1) * nx + (j - 1)
      cls[cell] = 0
      if (isSim || isObs) either++
      if (isSim && isObs) { both++; cls[cell] = 3 }
      else if (isSim) { simOnly++; cls[cell] = 1 }
      else if (isObs) { obsOnly++; cls[cell] = 2 }
    }
  }

  return {
    intersection: both,
    union: either,
    fit: either > 0 ? both / either : NaN,
    simOnly, obsOnly,
    classes: { ...sim, nodata: -9999, data: cls },
  }
}
