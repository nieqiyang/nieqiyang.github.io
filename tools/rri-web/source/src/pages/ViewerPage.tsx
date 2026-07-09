import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid, type AsciiGrid } from '../core/grid.ts'
import { MapView } from '../components/MapView.tsx'
import { LineChart } from '../components/LineChart.tsx'
import { Field, FileSelect, RunButton, ErrorBox, PageHeader, useRunner, TextInput } from '../components/common.tsx'
import type { PaletteName } from '../components/palettes.ts'

/** parse a raw raster body (no header) into Float32Array */
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

export function listOutputFiles(files: string[], prefix: string): string[] {
  const norm = prefix.replace(/^\.\//, '')
  return files
    .filter((f) => f.startsWith(norm) && /\d+\.out$/.test(f))
    .sort((a, b) => a.localeCompare(b))
}

export function ViewerPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [prefix, setPrefix] = useState('out/hs_')
  const [refPath, setRefPath] = useState('topo/adem.txt')
  const [ref, setRef] = useState<AsciiGrid | null>(null)
  const [frames, setFrames] = useState<Float32Array[] | null>(null)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [fps, setFps] = useState(6)
  const [palette, setPalette] = useState<PaletteName>('water')
  const [vmax, setVmax] = useState(3)
  const [cell, setCell] = useState<{ i: number; j: number } | null>(null)
  const timerRef = useRef<number>(0)

  const matched = useMemo(() => listOutputFiles(proj.files, prefix), [proj.files, prefix])

  const load = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    if (matched.length === 0) throw new Error(t('common.needFile'))
    const refGrid = parseAsciiGrid(await proj.readText(refPath))
    const n = refGrid.ncols * refGrid.nrows
    const fs: Float32Array[] = []
    for (const f of matched) {
      fs.push(parseBody(await proj.readText(f), n))
    }
    setRef(refGrid)
    setFrames(fs)
    setFrame(0)
    setCell(null)
  })

  useEffect(() => {
    if (playing && frames) {
      timerRef.current = window.setInterval(() => {
        setFrame((f) => (f + 1) % frames.length)
      }, 1000 / fps)
      return () => window.clearInterval(timerRef.current)
    }
  }, [playing, fps, frames])

  const frameData = frames && ref
    ? Float64Array.from(frames[frame], (v, k) => (ref.data[k] < -100 ? -9999 : v))
    : undefined

  const cellSeries = cell && frames && ref
    ? frames.map((f) => f[(cell.i - 1) * ref.ncols + (cell.j - 1)])
    : null

  return (
    <>
      <PageHeader icon="🎬" title={t('nav.viewer')} desc={t('viewer.desc')} />
      <div className="card">
        <div className="form-grid wide">
          <Field label={t('viewer.prefix')}>
            <TextInput mono value={prefix} onChange={setPrefix} placeholder="out/hs_" />
          </Field>
          <Field label={t('peak.ref')}>
            <FileSelect value={refPath} onChange={setRefPath} />
          </Field>
        </div>
        <div className="btn-row">
          <div className="tabs" style={{ borderBottom: 'none', marginBottom: 0 }}>
            {['out/hs_', 'out/hr_', 'out/qr_'].map((p) => (
              <button key={p} className={prefix === p ? 'active' : ''} onClick={() => setPrefix(p)}>
                {p.slice(4).replace('_', '')}
              </button>
            ))}
          </div>
          <span className="small dim">{t('viewer.found', { n: matched.length })}</span>
          <RunButton onRun={load} running={runner.running} label={t('viewer.loadSeries')} disabled={!proj.root || matched.length === 0} />
        </div>
        <ErrorBox error={runner.error} />
      </div>

      {frames && ref && (
        <div className="card">
          <div className="viewer-toolbar">
            <button className="btn small" onClick={() => setPlaying(!playing)}>
              {playing ? `⏸ ${t('common.pause')}` : `▶ ${t('common.play')}`}
            </button>
            <input type="range" min={0} max={frames.length - 1} value={frame}
              onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)) }} style={{ width: 280 }} />
            <span className="mono small">{String(frame + 1).padStart(6, '0')} / {frames.length}</span>
            <span className="small dim">{t('common.speed')}</span>
            <input type="range" min={1} max={20} value={fps} onChange={(e) => setFps(Number(e.target.value))} style={{ width: 90 }} />
            <span className="small dim">{t('common.palette')}</span>
            <select value={palette} onChange={(e) => setPalette(e.target.value as PaletteName)}>
              {(['water', 'viridis', 'rain', 'terrain'] as const).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <span className="small dim">{t('common.max')}</span>
            <input type="number" value={vmax} step={0.5} style={{ width: 70 }}
              onChange={(e) => setVmax(Number(e.target.value))} />
          </div>
          <MapView
            grid={ref}
            frame={frameData}
            palette={palette}
            min={0}
            max={vmax}
            transparentBelow={0.001}
            onCellClick={(i, j) => setCell({ i, j })}
            height={480}
          />
          <div style={{ marginTop: 12 }}>
            {cellSeries && cell ? (
              <>
                <h3>{t('viewer.cellSeries', { i: cell.i, j: cell.j })}</h3>
                <LineChart
                  height={220}
                  series={[{
                    name: prefix.replace(/^out\//, '').replace(/_$/, ''),
                    color: '#3585c8',
                    t: cellSeries.map((_, k) => k + 1),
                    v: cellSeries as unknown as number[],
                  }]}
                  xFormatter={(v) => String(Math.round(v))}
                  xLabel={t('common.step')}
                />
              </>
            ) : (
              <span className="dim small">{t('viewer.clickCell')}</span>
            )}
          </div>
        </div>
      )}
    </>
  )
}
