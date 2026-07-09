// Shared raster -> canvas rendering, plus Web-Mercator row warping so grids in
// geographic coordinates overlay exactly on tiled basemaps (Esri World Imagery).
import type { AsciiGrid } from '../core/grid.ts'
import { paletteColor, type PaletteName } from './palettes.ts'

export interface RenderOptions {
  palette: PaletteName
  vmin: number
  vmax: number
  nodata: number
  transparentBelow?: number
  categorical?: boolean
  /** overlay alpha 0-255 for opaque cells (default 255) */
  alpha?: number
}

/** Render grid values into a canvas at native grid resolution (row 0 = top). */
export function renderGridImage(
  ncols: number, nrows: number, data: ArrayLike<number>, opts: RenderOptions,
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = ncols
  c.height = nrows
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(ncols, nrows)
  const px = img.data
  const { palette, vmin, vmax, nodata } = opts
  const alpha = opts.alpha ?? 255
  const span = vmax - vmin || 1
  for (let k = 0; k < ncols * nrows; k++) {
    const v = data[k]
    const o = k * 4
    if (v < -100 || v === nodata || !Number.isFinite(v) ||
        (opts.transparentBelow !== undefined && v <= opts.transparentBelow)) {
      px[o + 3] = 0
      continue
    }
    const t = opts.categorical ? v : (v - vmin) / span
    const [r, g, b] = paletteColor(opts.categorical ? 'category' : palette, t)
    px[o] = r
    px[o + 1] = g
    px[o + 2] = b
    px[o + 3] = alpha
  }
  ctx.putImageData(img, 0, 0)
  return c
}

function mercY(latDeg: number): number {
  const lat = Math.max(-85.0511, Math.min(85.0511, latDeg))
  const r = (lat * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + r / 2))
}

/**
 * Warp a lat/lon-regular raster into Web-Mercator row spacing so that a Leaflet
 * ImageOverlay (which stretches linearly in projected space) is georeferenced
 * exactly. Rows are duplicated/dropped by nearest-neighbour in latitude.
 */
export function warpToMercator(flat: HTMLCanvasElement, grid: AsciiGrid): HTMLCanvasElement {
  const { ncols, nrows, yllcorner, cellsize } = grid
  const latTop = yllcorner + nrows * cellsize
  const latBot = yllcorner
  const yTop = mercY(latTop)
  const yBot = mercY(latBot)
  const outH = Math.min(4096, Math.max(nrows, Math.round(nrows * 2)))
  const out = document.createElement('canvas')
  out.width = ncols
  out.height = outH
  const sctx = flat.getContext('2d')!
  const src = sctx.getImageData(0, 0, ncols, nrows)
  const octx = out.getContext('2d')!
  const dst = octx.createImageData(ncols, outH)
  const rowBytes = ncols * 4
  for (let yo = 0; yo < outH; yo++) {
    const ym = yTop + ((yo + 0.5) / outH) * (yBot - yTop)
    const lat = ((2 * Math.atan(Math.exp(ym)) - Math.PI / 2) * 180) / Math.PI
    let i = Math.floor((latTop - lat) / cellsize)
    if (i < 0) i = 0
    if (i >= nrows) i = nrows - 1
    dst.data.set(src.data.subarray(i * rowBytes, (i + 1) * rowBytes), yo * rowBytes)
  }
  octx.putImageData(dst, 0, 0)
  return out
}

/** Heuristic: does this grid look like geographic (lat/lon degree) coordinates? */
export function isGeographic(g: AsciiGrid): boolean {
  const xmax = g.xllcorner + g.ncols * g.cellsize
  const ymax = g.yllcorner + g.nrows * g.cellsize
  return g.cellsize < 1 &&
    g.xllcorner >= -180 && xmax <= 360 &&
    g.yllcorner >= -90 && ymax <= 90
}

/** min/max over displayable values (ignoring nodata) */
export function displayRange(data: ArrayLike<number>, nodata: number): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (let k = 0; k < data.length; k++) {
    const v = data[k]
    if (v < -100 || v === nodata || !Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min === Infinity) { min = 0; max = 1 }
  return { min, max }
}
