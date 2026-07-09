import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject, downloadBlob } from '../state/project.tsx'
import { parseAsciiGrid } from '../core/grid.ts'
import { buildKml, buildZip, type ZipEntry } from '../tools/kml.ts'
import { paletteColor } from '../components/palettes.ts'
import { listOutputFiles } from './ViewerPage.tsx'
import { Field, FileSelect, NumInput, RunButton, ErrorBox, PageHeader, useRunner, TextInput } from '../components/common.tsx'

function parseBody(text: string, n: number): Float32Array {
  const out = new Float32Array(n)
  let k = 0
  const len = text.length
  let i = 0
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
    out[k++] = Number(text.slice(start, i))
  }
  return out
}

export function KmzPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [prefix, setPrefix] = useState('out/hs_')
  const [refPath, setRefPath] = useState('topo/adem.txt')
  const [start, setStart] = useState('2020-01-01T00:00')
  const [stepH, setStepH] = useState(3.75)
  const [minDepth, setMinDepth] = useState(0.1)
  const [maxDepth, setMaxDepth] = useState(3)
  const [opacity, setOpacity] = useState(0.75)
  const [progress, setProgress] = useState<{ t: number; n: number } | null>(null)
  const [done, setDone] = useState(false)

  const matched = useMemo(() => listOutputFiles(proj.files, prefix), [proj.files, prefix])

  const run = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    if (matched.length === 0) throw new Error(t('common.needFile'))
    setDone(false)
    const ref = parseAsciiGrid(await proj.readText(refPath))
    const n = ref.ncols * ref.nrows

    // render frames as transparent PNGs (upscale small grids for crisper overlay)
    const scale = Math.max(1, Math.min(4, Math.floor(1400 / Math.max(ref.ncols, ref.nrows))))
    const canvas = document.createElement('canvas')
    canvas.width = ref.ncols
    canvas.height = ref.nrows
    const ctx = canvas.getContext('2d')!
    const big = document.createElement('canvas')
    big.width = ref.ncols * scale
    big.height = ref.nrows * scale
    const bctx = big.getContext('2d')!
    bctx.imageSmoothingEnabled = false

    const entries: ZipEntry[] = []
    const frameNames: string[] = []
    const alpha = Math.round(opacity * 255)

    for (let ti = 0; ti < matched.length; ti++) {
      setProgress({ t: ti + 1, n: matched.length })
      await new Promise((r) => setTimeout(r)) // let UI paint
      const body = parseBody(await proj.readText(matched[ti]), n)
      const img = ctx.createImageData(ref.ncols, ref.nrows)
      const px = img.data
      for (let k = 0; k < n; k++) {
        const v = body[k]
        const o = k * 4
        if (ref.data[k] < -100 || v < minDepth) { px[o + 3] = 0; continue }
        const [r, g, b] = paletteColor('water', (v - minDepth) / Math.max(1e-6, maxDepth - minDepth))
        px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = alpha
      }
      ctx.putImageData(img, 0, 0)
      bctx.clearRect(0, 0, big.width, big.height)
      bctx.drawImage(canvas, 0, 0, big.width, big.height)
      const blob = await new Promise<Blob>((resolve) => big.toBlob((b) => resolve(b!), 'image/png'))
      const name = `frames/hs_${String(ti + 1).padStart(6, '0')}.png`
      entries.push({ name, data: new Uint8Array(await blob.arrayBuffer()) })
      frameNames.push(name)
    }

    const kml = buildKml(frameNames, {
      start: new Date(start + ':00Z'),
      stepHours: stepH,
      north: ref.yllcorner + ref.nrows * ref.cellsize,
      south: ref.yllcorner,
      east: ref.xllcorner + ref.ncols * ref.cellsize,
      west: ref.xllcorner,
      name: `RRI ${prefix}`,
    })
    entries.unshift({ name: 'doc.kml', data: new TextEncoder().encode(kml) })
    downloadBlob('rri_inundation.kmz', buildZip(entries))
    setProgress(null)
    setDone(true)
  })

  return (
    <>
      <PageHeader icon="🌍" title={t('nav.kmz')} desc={t('kmz.desc')} />
      <div className="card">
        <div className="form-grid wide">
          <Field label={t('viewer.prefix')}><TextInput mono value={prefix} onChange={setPrefix} /></Field>
          <Field label={t('peak.ref')}><FileSelect value={refPath} onChange={setRefPath} /></Field>
        </div>
        <div className="form-grid" style={{ marginTop: 10 }}>
          <Field label={t('kmz.start')}>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label={t('kmz.stepH')} unit="h"><NumInput value={stepH} onChange={setStepH} /></Field>
          <Field label={t('kmz.minDepth')} unit="m"><NumInput value={minDepth} onChange={setMinDepth} /></Field>
          <Field label={t('kmz.maxDepth')} unit="m"><NumInput value={maxDepth} onChange={setMaxDepth} /></Field>
          <Field label="Opacity"><NumInput value={opacity} onChange={setOpacity} min={0} max={1} /></Field>
        </div>
        <div className="btn-row">
          <span className="small dim">{t('viewer.found', { n: matched.length })}</span>
          <RunButton onRun={run} running={runner.running} label={t('kmz.export')} disabled={!proj.root || matched.length === 0} />
          {done && <span className="alert ok small" style={{ margin: 0 }}>✓ rri_inundation.kmz</span>}
        </div>
        {progress && (
          <>
            <div className="progress-bar"><div style={{ width: `${(progress.t / progress.n) * 100}%` }} /></div>
            <span className="small dim">{t('kmz.rendering', { t: progress.t, n: progress.n })}</span>
          </>
        )}
        <ErrorBox error={runner.error} />
      </div>
    </>
  )
}
