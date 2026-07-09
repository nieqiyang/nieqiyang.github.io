// Port of makeRiver3.f90: derive river width / depth / embankment-height grids
// from flow accumulation using W = Cw*A^Sw, D = Cd*A^Sd (A: upstream area [km2]).
// Parameters normally come from RRI_Input.txt L38-L44; here they are explicit.

import type { AsciiGrid } from '../core/grid.ts'
import { cellSizeMeters } from '../core/geo.ts'

export interface MakeRiverParams {
  utm: boolean
  thresh: number // riv_thresh: acc value above which a cell is a river
  widthC: number
  widthS: number
  depthC: number
  depthS: number
  heightParam: number
  heightLimit: number // acc value above which height_param is applied
  /** optional caps (used in practice in makeRiver2.f90 case studies) */
  widthMax?: number
  depthMax?: number
}

export interface MakeRiverResult {
  width: AsciiGrid
  depth: AsciiGrid
  height: AsciiGrid
  riv: AsciiGrid // 100 river / 0 outlet / -1 land / -9999 outside
  area: AsciiGrid // upstream area [km2]
  unitArea: number
}

export function makeRiver(dem: AsciiGrid, dir: AsciiGrid, acc: AsciiGrid, p: MakeRiverParams): MakeRiverResult {
  const { ncols: nx, nrows: ny } = dem
  const { dx, dy } = cellSizeMeters(nx, ny, dem.xllcorner, dem.yllcorner, dem.cellsize, p.utm)
  const unitArea = (dx / 1000) * (dy / 1000) // [km2]

  const width = new Float64Array(ny * nx).fill(-9999)
  const depth = new Float64Array(ny * nx).fill(-9999)
  const height = new Float64Array(ny * nx).fill(-9999)
  const riv = new Float64Array(ny * nx).fill(-9999)
  const area = new Float64Array(ny * nx).fill(-9999)

  for (let k = 0; k < ny * nx; k++) {
    if (dem.data[k] <= -100) continue
    riv[k] = -1
    area[k] = acc.data[k] * unitArea
    if (acc.data[k] <= p.thresh) continue
    riv[k] = dir.data[k] === 0 ? 0 : 100
    let w = p.widthC * Math.pow(area[k], p.widthS)
    let d = p.depthC * Math.pow(area[k], p.depthS)
    if (p.widthMax !== undefined && w > p.widthMax) w = p.widthMax
    if (p.depthMax !== undefined && d > p.depthMax) d = p.depthMax
    width[k] = w
    depth[k] = d
    if (acc.data[k] > p.heightLimit) height[k] = p.heightParam
  }

  const mk = (data: Float64Array): AsciiGrid => ({ ...dem, nodata: -9999, data })
  return {
    width: mk(width), depth: mk(depth), height: mk(height),
    riv: mk(riv), area: mk(area), unitArea,
  }
}
