import { useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid, serializeAsciiGrid } from '../core/grid.ts'
import { parseRain } from '../core/rain.ts'
import { parseRriInput } from '../core/rriInput.ts'
import { rainBasin, type RainBasinResult } from '../tools/rainBasin.ts'
import { MapView } from '../components/MapView.tsx'
import { LineChart } from '../components/LineChart.tsx'
import { Field, FileSelect, NumInput, RunButton, SaveRow, ErrorBox, PageHeader, useRunner } from '../components/common.tsx'

export function RainBasinPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [rainPath, setRainPath] = useState('rain/rain.dat')
  const [maskPath, setMaskPath] = useState('topo/adem.txt')
  const [xllRain, setXllRain] = useState(110.2)
  const [yllRain, setYllRain] = useState(-8.3)
  const [csx, setCsx] = useState(0.00833333)
  const [csy, setCsy] = useState(0.00833333)
  const [result, setResult] = useState<RainBasinResult | null>(null)

  const fromRri = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const r = parseRriInput(await proj.readText('RRI_Input.txt'))
    setRainPath(r.rainfile)
    setMaskPath(r.demfile)
    setXllRain(r.xllcornerRain)
    setYllRain(r.yllcornerRain)
    setCsx(r.cellsizeRainX)
    setCsy(r.cellsizeRainY)
  })

  const run = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const rain = parseRain(await proj.readText(rainPath))
    const mask = parseAsciiGrid(await proj.readText(maskPath))
    setResult(rainBasin(rain, mask, { xllRain, yllRain, cellsizeRainX: csx, cellsizeRainY: csy }))
  })

  const total = result ? result.cum[result.cum.length - 1] : 0

  return (
    <>
      <PageHeader icon="💧" title={t('nav.rainbasin')} desc={t('rainbasin.desc')} />
      <div className="card">
        <h3>{t('common.inputs')}
          <span className="hint">
            <button className="btn small secondary" onClick={fromRri}>{t('rainbasin.fromRri')}</button>
          </span>
        </h3>
        <div className="form-grid wide">
          <Field label={t('rainbasin.rain')}>
            <FileSelect value={rainPath} onChange={setRainPath} filter={(p) => /\.(dat|txt|data)$/i.test(p)} />
          </Field>
          <Field label={t('rainbasin.mask')}><FileSelect value={maskPath} onChange={setMaskPath} /></Field>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('rainbasin.georef')}</h3>
        <div className="form-grid">
          <Field label="xllcorner_rain"><NumInput value={xllRain} onChange={setXllRain} /></Field>
          <Field label="yllcorner_rain"><NumInput value={yllRain} onChange={setYllRain} /></Field>
          <Field label="cellsize x"><NumInput value={csx} onChange={setCsx} /></Field>
          <Field label="cellsize y"><NumInput value={csy} onChange={setCsy} /></Field>
        </div>
        <div className="btn-row">
          <RunButton onRun={run} running={runner.running} disabled={!proj.root} />
        </div>
        <ErrorBox error={runner.error} />
      </div>

      {result && (
        <>
          <div className="card">
            <h3>{t('rainbasin.hyeto')}
              <span className="hint">{t('rainbasin.total', { v: total.toFixed(1), n: result.numCells })}</span>
            </h3>
            <LineChart
              height={230}
              series={[
                { name: 'mm/h', color: '#3585c8', bars: true, t: result.times.map((s) => s / 3600), v: result.hyeto },
              ]}
              invertY
              xFormatter={(v) => `${v.toFixed(0)}h`}
              yLabel="mm/h"
            />
            <h3 style={{ marginTop: 14 }}>{t('rainbasin.cum')}</h3>
            <LineChart
              height={200}
              series={[
                { name: 'mm', color: '#178a50', t: result.times.map((s) => s / 3600), v: result.cum },
              ]}
              xFormatter={(v) => `${v.toFixed(0)}h`}
              yLabel="mm"
            />
            <div className="btn-row">
              <SaveRow path="rain/rain_hyeto.txt" content={() =>
                result.times.map((tt, k) => `${tt} ${result.hyeto[k].toFixed(6)}`).join('\n') + '\n'} />
              <span className="mono small dim">rain/rain_hyeto.txt</span>
            </div>
            <div className="btn-row">
              <SaveRow path="rain/rain_cum.txt" content={() =>
                result.times.map((tt, k) => `${tt} ${result.cum[k].toFixed(6)}`).join('\n') + '\n'} />
              <span className="mono small dim">rain/rain_cum.txt</span>
            </div>
          </div>
          <div className="card">
            <h3>{t('rainbasin.dist')}</h3>
            <MapView grid={result.dist} palette="rain" min={0} decimals={1} />
            <div className="btn-row">
              <SaveRow path="rain/rain_dist.txt" content={() => serializeAsciiGrid(result.dist, { decimals: 5 })} />
              <span className="mono small dim">rain/rain_dist.txt</span>
            </div>
          </div>
        </>
      )}
    </>
  )
}
