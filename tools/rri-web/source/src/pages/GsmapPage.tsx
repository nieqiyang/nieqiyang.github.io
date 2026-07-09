import { useRef, useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid } from '../core/grid.ts'
import { serializeRain, type RainData } from '../core/rain.ts'
import { gsmapWindow, decodeGsmapFrame, gsmapToRain, type GsmapProduct, type GsmapWindow } from '../tools/gsmap.ts'
import { MapView } from '../components/MapView.tsx'
import { Field, FileSelect, RunButton, SaveRow, ErrorBox, PageHeader, useRunner, TextInput } from '../components/common.tsx'

export function GsmapPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()
  const fileInput = useRef<HTMLInputElement>(null)

  const [refPath, setRefPath] = useState('topo/dem.txt')
  const [product, setProduct] = useState<'hourly' | 'daily'>('hourly')
  const [files, setFiles] = useState<File[]>([])
  const [outRain, setOutRain] = useState('rain/rain_gsmap.dat')
  const [result, setResult] = useState<{ rain: RainData; win: GsmapWindow } | null>(null)
  const [frame, setFrame] = useState(0)

  const prod: GsmapProduct = product === 'hourly'
    ? { resolution: 0.1, hoursPerStep: 1 }
    : { resolution: 0.25, hoursPerStep: 24 }

  const run = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    if (files.length === 0) throw new Error(t('common.needFile'))
    const ref = parseAsciiGrid(await proj.readText(refPath))
    const win = gsmapWindow(ref, prod)
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))
    const frames: Float64Array[] = []
    for (const f of sorted) {
      frames.push(decodeGsmapFrame(await f.arrayBuffer(), prod, win))
    }
    setResult({ rain: gsmapToRain(frames, prod, win), win })
    setFrame(0)
  })

  const rainGrid = result
    ? {
        ncols: result.win.ncols, nrows: result.win.nrows,
        xllcorner: result.win.xllcornerRain, yllcorner: result.win.yllcornerRain,
        cellsize: result.win.cellsizeRain, nodata: -9999,
        data: result.rain.frames[frame],
      }
    : null

  return (
    <>
      <PageHeader icon="🛰️" title={t('nav.gsmap')} desc={t('gsmap.desc')} />
      <div className="card">
        <h3>{t('common.inputs')}</h3>
        <div className="form-grid wide">
          <Field label={t('gsmap.refGrid')}><FileSelect value={refPath} onChange={setRefPath} /></Field>
          <Field label={t('gsmap.product')}>
            <select value={product} onChange={(e) => setProduct(e.target.value as 'hourly' | 'daily')}>
              <option value="hourly">{t('gsmap.hourly')}</option>
              <option value="daily">{t('gsmap.daily')}</option>
            </select>
          </Field>
          <Field label={t('gsmap.files')}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn small secondary" onClick={() => fileInput.current?.click()}>
                {t('gsmap.pickFiles')}
              </button>
              <span className="small dim">{files.length} {t('common.file').toLowerCase()}(s)</span>
              <input
                ref={fileInput}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </div>
          </Field>
        </div>
        <div className="form-grid wide" style={{ marginTop: 12 }}>
          <Field label={t('common.outputs')}><TextInput mono value={outRain} onChange={setOutRain} /></Field>
        </div>
        <div className="btn-row">
          <RunButton onRun={run} running={runner.running} disabled={!proj.root || files.length === 0} />
        </div>
        <ErrorBox error={runner.error} />
      </div>

      {result && rainGrid && (
        <div className="card">
          <h3>{t('common.results')}
            <span className="hint">{t('gsmap.window', {
              j1: result.win.jleft, j2: result.win.jright,
              i1: result.win.itop, i2: result.win.ibottom,
              c: result.win.ncols, r: result.win.nrows,
            })}</span>
          </h3>
          <div className="alert info small">
            {t('gsmap.georefNote', {
              x: result.win.xllcornerRain.toFixed(4),
              y: result.win.yllcornerRain.toFixed(4),
              s: result.win.cellsizeRain,
            })}
          </div>
          <div className="viewer-toolbar">
            <span className="small dim">{t('common.step')}</span>
            <input type="range" min={0} max={result.rain.times.length - 1} value={frame}
              onChange={(e) => setFrame(Number(e.target.value))} style={{ width: 260 }} />
            <span className="mono small">t = {result.rain.times[frame]} s</span>
          </div>
          <MapView grid={rainGrid} palette="rain" min={0} decimals={2} height={340} />
          <div className="btn-row">
            <SaveRow path={outRain} content={() => serializeRain(result.rain, 2)} />
            <span className="mono small dim">{outRain}</span>
          </div>
        </div>
      )}
    </>
  )
}
