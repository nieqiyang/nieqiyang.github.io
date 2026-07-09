// Geodesic helpers shared by all tools (port of hubeny_sub.f90 and the dx/dy logic).

/** Hubeny formula: distance in meters between two lon/lat points (WGS84). */
export function hubeny(x1deg: number, y1deg: number, x2deg: number, y2deg: number): number {
  const rad = Math.PI / 180
  const x1 = x1deg * rad, y1 = y1deg * rad, x2 = x2deg * rad, y2 = y2deg * rad
  const dy = y1 - y2
  const dx = x1 - x2
  const mu = (y1 + y2) / 2
  const a = 6378137.0 // semi-major axis
  const b = 6356752.314 // semi-minor axis
  const e2 = (a * a - b * b) / (a * a)
  const W = Math.sqrt(1 - e2 * Math.sin(mu) ** 2)
  const N = a / W
  const M = (a * (1 - e2)) / W ** 3
  return Math.sqrt((dy * M) ** 2 + (dx * N * Math.cos(mu)) ** 2)
}

export interface CellSizeMeters { dx: number; dy: number; length: number }

/**
 * Average grid-cell size in meters, exactly as computed by the Fortran tools:
 * dx = mean(south edge, north edge) / ncols, dy = mean(west edge, east edge) / nrows.
 * For UTM grids (utm=true) dx = dy = cellsize.
 */
export function cellSizeMeters(
  ncols: number, nrows: number, xll: number, yll: number, cellsize: number, utm: boolean,
): CellSizeMeters {
  if (utm) return { dx: cellsize, dy: cellsize, length: cellsize }
  const d1 = hubeny(xll, yll, xll + ncols * cellsize, yll) // south
  const d2 = hubeny(xll, yll + nrows * cellsize, xll + ncols * cellsize, yll + nrows * cellsize) // north
  const d3 = hubeny(xll, yll, xll, yll + nrows * cellsize) // west
  const d4 = hubeny(xll + ncols * cellsize, yll, xll + ncols * cellsize, yll + nrows * cellsize) // east
  const dx = (d1 + d2) / 2 / ncols
  const dy = (d3 + d4) / 2 / nrows
  return { dx, dy, length: (dx + dy) / 2 }
}

/**
 * lon/lat -> 1-based grid coordinate (loc_i from top, loc_j from left).
 * Same convention as coordinate.xlsx / rainThiessen.f90.
 */
export function lonLatToIJ(
  lon: number, lat: number,
  g: { ncols: number; nrows: number; xllcorner: number; yllcorner: number; cellsize: number },
): { i: number; j: number; inside: boolean } {
  const j = Math.floor((lon - g.xllcorner) / g.cellsize) + 1
  const i = g.nrows - Math.floor((lat - g.yllcorner) / g.cellsize)
  const inside = j >= 1 && j <= g.ncols && i >= 1 && i <= g.nrows
  return { i, j, inside }
}

/** 1-based (loc_i, loc_j) -> lon/lat of the cell center. */
export function ijToLonLat(
  i: number, j: number,
  g: { ncols: number; nrows: number; xllcorner: number; yllcorner: number; cellsize: number },
): { lon: number; lat: number } {
  const lon = g.xllcorner + (j - 0.5) * g.cellsize
  const lat = g.yllcorner + (g.nrows - i + 0.5) * g.cellsize
  return { lon, lat }
}
