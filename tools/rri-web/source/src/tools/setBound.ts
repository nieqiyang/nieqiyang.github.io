// Boundary-condition helpers (manual §8.8).
// 1D format read by RRI (bound flag 1):
//   L1: number of points
//   L2: "loc_i" i1 i2 ...
//   L3: "loc_j" j1 j2 ...
//   L4..: <time_sec> v1 v2 ...   [m3/s for discharge, m for water level]

export interface BoundaryPoint {
  name: string
  i: number // 1-based row
  j: number // 1-based col
}

export interface BoundaryData {
  points: BoundaryPoint[]
  times: number[]
  /** values[t][p] */
  values: number[][]
}

export function parseBoundary1D(text: string): BoundaryData {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 4) throw new Error('Boundary file too short')
  const num = Number(lines[0].trim().split(/[\s,]+/)[0])
  const iRow = lines[1].trim().split(/[\s,]+/).slice(1, 1 + num).map(Number)
  const jRow = lines[2].trim().split(/[\s,]+/).slice(1, 1 + num).map(Number)
  const times: number[] = []
  const values: number[][] = []
  for (let li = 3; li < lines.length; li++) {
    const parts = lines[li].trim().split(/[\s,]+/).map(Number)
    if (parts.length < num + 1 || !Number.isFinite(parts[0])) continue
    times.push(parts[0])
    values.push(parts.slice(1, 1 + num))
  }
  return {
    points: iRow.map((i, k) => ({ name: `P${k + 1}`, i, j: jRow[k] })),
    times,
    values,
  }
}

export function serializeBoundary1D(b: BoundaryData): string {
  const lines: string[] = []
  lines.push(String(b.points.length))
  lines.push('loc_i ' + b.points.map((p) => p.i).join(' '))
  lines.push('loc_j ' + b.points.map((p) => p.j).join(' '))
  for (let t = 0; t < b.times.length; t++) {
    lines.push(`${b.times[t]} ` + b.values[t].map((v) => String(v)).join(' '))
  }
  return lines.join('\n') + '\n'
}

/**
 * Parse pasted spreadsheet data (TSV/CSV): first column time [s], one column per point.
 * An optional header row is ignored.
 */
export function parsePastedSeries(text: string, numPoints: number): { times: number[]; values: number[][] } {
  const times: number[] = []
  const values: number[][] = []
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim()
    if (s === '') continue
    const parts = s.split(/[\s,;\t]+/).map(Number)
    if (parts.length < 1 + numPoints || parts.some((v) => !Number.isFinite(v))) continue
    times.push(parts[0])
    values.push(parts.slice(1, 1 + numPoints))
  }
  return { times, values }
}
