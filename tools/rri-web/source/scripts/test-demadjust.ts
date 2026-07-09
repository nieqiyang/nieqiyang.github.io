// Validation: run the TS port of demAdjust2 on Project/solo30s and compare
// with the reference outputs (adem.txt / adir.txt) produced by the Fortran tool.
import { readFileSync } from 'node:fs'
import { parseAsciiGrid } from '../src/core/grid.ts'
import { demAdjust } from '../src/tools/demAdjust.ts'

const base = new URL('../../RRI-CUI/Project/solo30s/topo/', import.meta.url)
const read = (name: string) => readFileSync(new URL(name, base), 'utf8')

const dem = parseAsciiGrid(read('dem.txt'))
const dir = parseAsciiGrid(read('dir.txt'))
const acc = parseAsciiGrid(read('acc.txt'))
const refAdem = parseAsciiGrid(read('adem.txt'))
const refAdir = parseAsciiGrid(read('adir.txt'))

console.time('demAdjust')
const { adem, adir } = demAdjust(dem, dir, acc)
console.timeEnd('demAdjust')

let ademBad = 0
let maxDiff = 0
let firstBad = ''
for (let k = 0; k < adem.data.length; k++) {
  const a = adem.data[k]
  const b = refAdem.data[k]
  if (b < -100 && a < -100) continue
  const d = Math.abs(a - b)
  if (d > maxDiff) maxDiff = d
  if (d > 1e-3) {
    ademBad++
    if (!firstBad) firstBad = `cell ${Math.floor(k / adem.ncols) + 1},${(k % adem.ncols) + 1}: got ${a}, ref ${b}`
  }
}
let adirBad = 0
let firstDirBad = ''
for (let k = 0; k < adir.data.length; k++) {
  if (adir.data[k] !== refAdir.data[k]) {
    adirBad++
    if (!firstDirBad) firstDirBad = `cell ${Math.floor(k / adir.ncols) + 1},${(k % adir.ncols) + 1}: got ${adir.data[k]}, ref ${refAdir.data[k]}`
  }
}
console.log(`adem: ${ademBad} cells differ > 1e-3 (max diff ${maxDiff.toExponential(3)}) ${firstBad}`)
console.log(`adir: ${adirBad} cells differ ${firstDirBad}`)
if (ademBad === 0 && adirBad === 0) console.log('PASS: demAdjust matches Fortran reference')
else { console.log('FAIL'); process.exit(1) }
