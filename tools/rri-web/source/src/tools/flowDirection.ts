// Modern reimplementation of flowDirection.f90 (mesh1v3).
// Computes D8 flow direction + flow accumulation from a DEM using a
// priority-flood sweep (Barnes et al. 2014): cells are resolved from the outlets
// upward in nondecreasing spill elevation, which guarantees an acyclic network
// that fully drains — pits and flats are handled without explicit filling.
//
// Compatible with the original's riv-file seeding:
//   riv == 0    : outlet cell (dir = 0)
//   riv == 100  : river cell whose direction is computed first (rivers resolve
//                 along other river cells before hillslopes attach)
//   riv == 1,2,4,...,128 : predefined direction, kept as-is
// Output conventions match the original: acc counts upstream cells including the
// cell itself; when explicit outlets exist, cells not draining to any outlet are
// masked to nodata.

import type { AsciiGrid } from '../core/grid.ts'
import { offsetToDir, dirOffset } from '../core/d8.ts'

interface Heap {
  push(cell: number, priority: number): void
  pop(): number
  size(): number
}

function makeHeap(capacity: number): Heap {
  // binary min-heap over (priority, seq) — seq keeps pops deterministic
  const cells = new Int32Array(capacity)
  const prios = new Float64Array(capacity)
  const seqs = new Int32Array(capacity)
  let n = 0
  let seqCounter = 0
  const less = (a: number, b: number) =>
    prios[a] < prios[b] || (prios[a] === prios[b] && seqs[a] < seqs[b])
  const swap = (a: number, b: number) => {
    let t = cells[a]; cells[a] = cells[b]; cells[b] = t
    const p = prios[a]; prios[a] = prios[b]; prios[b] = p
    t = seqs[a]; seqs[a] = seqs[b]; seqs[b] = t
  }
  return {
    push(cell, priority) {
      cells[n] = cell
      prios[n] = priority
      seqs[n] = seqCounter++
      let i = n++
      while (i > 0) {
        const parent = (i - 1) >> 1
        if (less(i, parent)) { swap(i, parent); i = parent } else break
      }
    },
    pop() {
      const top = cells[0]
      n--
      if (n > 0) {
        cells[0] = cells[n]; prios[0] = prios[n]; seqs[0] = seqs[n]
        let i = 0
        for (;;) {
          const l = 2 * i + 1, r = l + 1
          let m = i
          if (l < n && less(l, m)) m = l
          if (r < n && less(r, m)) m = r
          if (m === i) break
          swap(i, m)
          i = m
        }
      }
      return top
    },
    size: () => n,
  }
}

export interface FlowDirectionResult {
  dir: AsciiGrid
  acc: AsciiGrid
  outlets: { i: number; j: number }[] // 1-based
  maskedCells: number
}

export function flowDirection(dem: AsciiGrid, riv: AsciiGrid | null): FlowDirectionResult {
  const nx = dem.ncols
  const ny = dem.nrows
  const n = nx * ny
  const z = dem.data
  const inDom = (k: number) => z[k] >= -100

  const dir = new Int32Array(n).fill(-9999)
  const resolved = new Uint8Array(n) // 1 = direction final
  const isRiver = new Uint8Array(n)
  const explicitOutlets: number[] = []

  if (riv) {
    for (let k = 0; k < n; k++) {
      if (!inDom(k)) continue
      const rv = riv.data[k]
      if (rv === 0) {
        dir[k] = 0
        resolved[k] = 1
        isRiver[k] = 1
        explicitOutlets.push(k)
      } else if (rv === 100) {
        isRiver[k] = 1
      } else if (dirOffset(rv) !== null) {
        dir[k] = rv
        isRiver[k] = 1
        // resolved only once its chain terminates inside the domain; treat as fixed:
        resolved[k] = 1
      }
    }
  }

  const heap = makeHeap(n + 8)
  const inQueue = new Uint8Array(n)
  const effPrio = new Float64Array(n) // effective spill elevation when enqueued

  const enqueue = (k: number, p: number) => {
    heap.push(k, p)
    inQueue[k] = 1
    effPrio[k] = p
  }

  const neighborsOf = (k: number, cb: (kn: number, di: number, dj: number) => void) => {
    const i = Math.floor(k / nx)
    const j = k % nx
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (di === 0 && dj === 0) continue
        const ii = i + di
        const jj = j + dj
        if (ii < 0 || jj < 0 || ii >= ny || jj >= nx) continue
        cb(ii * nx + jj, di, dj)
      }
    }
  }

  // Sweep: pop lowest; claim unresolved neighbors (restricted to river cells in phase 1).
  const sweep = (restrictToRiver: boolean) => {
    while (heap.size() > 0) {
      const k = heap.pop()
      if (resolved[k] === 0) {
        // boundary seed popped before being claimed -> it is an outlet
        dir[k] = 0
        resolved[k] = 1
        explicitOutlets.push(k)
      }
      neighborsOf(k, (kn, di, dj) => {
        if (!inDom(kn) || resolved[kn] === 1 || inQueue[kn] === 1) return
        if (restrictToRiver && isRiver[kn] === 0) return
        // neighbor drains INTO k: direction from kn toward k is the opposite offset
        dir[kn] = offsetToDir(-di, -dj)
        resolved[kn] = 1
        enqueue(kn, Math.max(z[kn], effPrio[k]))
      })
    }
  }

  if (riv && explicitOutlets.length + 0 > 0) {
    // Phase 1: resolve river network from explicit outlets / fixed-direction cells
    for (const k of explicitOutlets) enqueue(k, z[k])
    for (let k = 0; k < n; k++) {
      if (resolved[k] === 1 && inQueue[k] === 0 && dir[k] > 0) enqueue(k, z[k])
    }
    sweep(true)
    // Phase 2: hillslopes attach to the resolved network
    inQueue.fill(0)
    for (let k = 0; k < n; k++) {
      if (resolved[k] === 1) enqueue(k, z[k])
    }
    sweep(false)
  } else {
    // No explicit outlets: seed with all domain cells on the boundary
    // (grid edge or adjacent to nodata). Boundary local minima become outlets.
    for (let k = 0; k < n; k++) {
      if (!inDom(k)) continue
      const i = Math.floor(k / nx)
      const j = k % nx
      let isBoundary = i === 0 || j === 0 || i === ny - 1 || j === nx - 1
      if (!isBoundary) {
        neighborsOf(k, (kn) => { if (!inDom(kn)) isBoundary = true })
      }
      if (isBoundary) enqueue(k, z[k])
    }
    sweep(false)
  }

  // Flow accumulation: acc = 1 + sum(acc upstream), computed in topological order.
  const acc = new Float64Array(n)
  const indeg = new Int32Array(n)
  for (let k = 0; k < n; k++) {
    if (!inDom(k) || resolved[k] === 0) continue
    const off = dirOffset(dir[k])
    if (!off) continue
    const i = Math.floor(k / nx) + off.di
    const j = (k % nx) + off.dj
    if (i < 0 || j < 0 || i >= ny || j >= nx) continue
    indeg[i * nx + j]++
  }
  const queue = new Int32Array(n)
  let qh = 0
  let qt = 0
  for (let k = 0; k < n; k++) {
    if (inDom(k) && resolved[k] === 1) {
      acc[k] = 1
      if (indeg[k] === 0) queue[qt++] = k
    }
  }
  while (qh < qt) {
    const k = queue[qh++]
    const off = dirOffset(dir[k])
    if (!off) continue
    const i = Math.floor(k / nx) + off.di
    const j = (k % nx) + off.dj
    if (i < 0 || j < 0 || i >= ny || j >= nx) continue
    const kn = i * nx + j
    if (!inDom(kn)) continue
    acc[kn] += acc[k]
    if (--indeg[kn] === 0) queue[qt++] = kn
  }

  // Mask cells that never resolved (unreachable from any outlet — matches Fortran catch masking)
  let masked = 0
  const dirOut = new Float64Array(n).fill(-9999)
  const accOut = new Float64Array(n).fill(-9999)
  for (let k = 0; k < n; k++) {
    if (!inDom(k) || resolved[k] === 0) {
      if (inDom(k)) masked++
      continue
    }
    dirOut[k] = dir[k]
    accOut[k] = acc[k]
  }

  const outlets = explicitOutlets.map((k) => ({ i: Math.floor(k / nx) + 1, j: (k % nx) + 1 }))
  return {
    dir: { ...dem, nodata: -9999, data: dirOut },
    acc: { ...dem, nodata: -9999, data: accOut },
    outlets,
    maskedCells: masked,
  }
}
