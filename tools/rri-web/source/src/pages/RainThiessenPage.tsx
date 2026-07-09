import { useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid, serializeAsciiGrid } from '../core/grid.ts'
import { serializeRain } from '../core/rain.ts'
import { parseGaugeFile, parseGaugeCsv, rainThiessen, type ThiessenResult, type GaugeData } from '../tools/rainThiessen.ts'
import { MapView } from '../components/MapView.tsx'
import { LineChart } from '../components/LineChart.tsx'
import { Field, FileSelect, NumInput, RunButton, SaveRow, ErrorBox, PageHeader, useRunner, TextInput } from '../components/common.tsx'

export function RainThiessenPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [gaugePath, setGaugePath] = useState('rain/gauge_1d.txt')
  const [divide, setDivide] = useState(24)
  const [method, setMethod] = useState<'thiessen' | 'idw'>('thiessen')
  const [ncols, setNcols] = useState(336)
  const [nrows, setNrows] = useState(204)
  const [xll, setXll] = useState(110.2)
  const [yll, setYll] = useState(-8.3)
  const [cellsize, setCellsize] = useState(0.0083333333333333)
  const [demPath, setDemPath] = useState('topo/dem.txt')
  const [outRain, setOutRain] = useState('rain/rain.dat')
  const [outMap, setOutMap] = useState('rain/gauge_map.txt')

  const [result, setResult] = useState<(ThiessenResult & { gauge: GaugeData }) | null>(null)
  const [frame, setFrame] = useState(0)

  const copyHeader = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const dem = parseAsciiGrid(await proj.readText(demPath))
    setNcols(dem.ncols)
    setNrows(dem.nrows)
    setXll(dem.xllcorner)
    setYll(dem.yllcorner)
    setCellsize(dem.cellsize)
  })

  const run = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const text = await proj.readText(gaugePath)
    const gauge = gaugePath.toLowerCase().endsWith('.csv') ? parseGaugeCsv(text) : parseGaugeFile(text)
    const r = rainThiessen(gauge, { divide, ncols, nrows, xll, yll, cellsize, method })
    setResult({ ...r, gauge })
    setFrame(0)
  })

  const rainGrid = result
    ? {
        ncols: result.rain.ncols, nrows: result.rain.nrows,
        xllcorner: xll, yllcorner: yll, cellsize, nodata: -9999,
        data: result.rain.frames[frame],
      }
    : null

  // basin-average preview series
  const avgSeries = result
    ? result.rain.times.map((_, tt) => {
        const f = result.rain.frames[tt]
        let s = 0
        for (let k = 0; k < f.length; k++) s += f[k]
        return s / f.length
      })
    : []

  return (
    <>
      <PageHeader icon="🌧️" title={t('nav.thiessen')} desc={t('thiessen.desc')} />
      <div className="card">
        <h3>{t('common.inputs')}</h3>
        <div className="form-grid wide">
          <Field label={t('thiessen.gauge')}>
            <FileSelect value={gaugePath} onChange={setGaugePath} filter={(p) => /\.(txt|csv|dat)$/i.test(p)} />
          </Field>
          <Field label={t('thiessen.divide')}>
            <select value={divide} onChange={(e) => setDivide(Number(e.target.value))}>
              <option value={1}>{t('thiessen.divide.h')}</option>
              <option value={24}>{t('thiessen.divide.d')}</option>
            </select>
          </Field>
          <Field label={t('thiessen.method')}>
            <select value={method} onChange={(e) => setMethod(e.target.value as 'thiessen' | 'idw')}>
              <option value="thiessen">Thiessen</option>
              <option value="idw">IDW (1/d²)</option>
            </select>
          </Field>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('common.parameters')}
          <span className="hint">{t('thiessen.rememberXll')}</span>
        </h3>
        <div className="form-grid">
          <Field label="ncols"><NumInput value={ncols} onChange={setNcols} /></Field>
          <Field label="nrows"><NumInput value={nrows} onChange={setNrows} /></Field>
          <Field label="xllcorner"><NumInput value={xll} onChange={setXll} /></Field>
          <Field label="yllcorner"><NumInput value={yll} onChange={setYll} /></Field>
          <Field label="cellsize"><NumInput value={cellsize} onChange={setCellsize} /></Field>
          <Field label={t('thiessen.copyHeader')}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}><FileSelect value={demPath} onChange={setDemPath} /></div>
              <button className="btn small secondary" onClick={copyHeader}>←</button>
            </div>
          </Field>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('common.outputs')}</h3>
        <div className="form-grid wide">
          <Field label={t('thiessen.outRain')}><TextInput mono value={outRain} onChange={setOutRain} /></Field>
          <Field label={t('thiessen.outMap')}><TextInput mono value={outMap} onChange={setOutMap} /></Field>
        </div>
        <div className="btn-row">
          <RunButton onRun={run} running={runner.running} disabled={!proj.root} />
        </div>
        <ErrorBox error={runner.error} />
      </div>

      {result && rainGrid && (
        <>
          <div className="card">
            <h3>{t('common.results')}
              <span className="hint">
                {t('thiessen.gauges', { n: result.gauge.lat.length, t: result.rain.times.length })}
                {result.outOfRange.length > 0 && ` · ⚠ ${t('thiessen.outWarn', { n: result.outOfRange.length })}`}
              </span>
            </h3>
            <div className="viewer-toolbar">
              <span className="small dim">{t('common.step')}</span>
              <input type="range" min={0} max={result.rain.times.length - 1} value={frame}
                onChange={(e) => setFrame(Number(e.target.value))} style={{ width: 260 }} />
              <span className="mono small">t = {result.rain.times[frame]} s ({(result.rain.times[frame] / 3600).toFixed(0)} h)</span>
            </div>
            <MapView grid={rainGrid} palette="rain" min={0} decimals={2} />
            <div className="btn-row">
              <SaveRow path={outRain} content={() => serializeRain(result.rain)} />
              <span className="mono small dim">{outRain}</span>
            </div>
            <div className="btn-row">
              <SaveRow path={outMap} content={() => serializeAsciiGrid(result.map, { decimals: 'int' })} />
              <span className="mono small dim">{outMap}</span>
            </div>
          </div>
          <div className="card">
            <h3>{t('rainbasin.hyeto')} ({t('common.preview')})</h3>
            <LineChart
              height={200}
              invertY
              series={[{
                name: 'mm/h', color: '#3585c8', bars: true,
                t: result.rain.times.map((s) => s / 3600), v: avgSeries,
              }]}
              xFormatter={(v) => `${v.toFixed(0)}h`}
              yLabel="mm/h"
            />
          </div>
        </>
      )}
    </>
  )
}
