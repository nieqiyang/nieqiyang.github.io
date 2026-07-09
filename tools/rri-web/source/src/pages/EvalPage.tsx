import { useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid } from '../core/grid.ts'
import { parseTimeSeries } from '../core/rain.ts'
import { evalHydro, type HydroMetrics } from '../tools/evalHydro.ts'
import { evalPeak, type EvalPeakResult } from '../tools/evalPeak.ts'
import { LineChart } from '../components/LineChart.tsx'
import { MapView } from '../components/MapView.tsx'
import { Field, FileSelect, NumInput, RunButton, ErrorBox, PageHeader, useRunner } from '../components/common.tsx'

export function EvalPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()
  const [tab, setTab] = useState<'hydro' | 'extent'>('hydro')

  // hydro
  const [obsPath, setObsPath] = useState('')
  const [simPath, setSimPath] = useState('')
  const [metrics, setMetrics] = useState<HydroMetrics | null>(null)
  const [series, setSeries] = useState<{ obs: { t: number[]; v: number[] }; sim: { t: number[]; v: number[] } } | null>(null)

  // extent
  const [simPeakPath, setSimPeakPath] = useState('hpeak.txt')
  const [obsPeakPath, setObsPeakPath] = useState('')
  const [simThresh, setSimThresh] = useState(1.0)
  const [obsThresh, setObsThresh] = useState(0.0)
  const [imin, setImin] = useState(1)
  const [imax, setImax] = useState(99999)
  const [jmin, setJmin] = useState(1)
  const [jmax, setJmax] = useState(99999)
  const [extent, setExtent] = useState<EvalPeakResult | null>(null)

  const runHydro = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const obs = parseTimeSeries(await proj.readText(obsPath))
    const sim = parseTimeSeries(await proj.readText(simPath))
    if (obs.v.length === 0 || sim.v.length === 0) throw new Error('empty series')
    setMetrics(evalHydro(obs.v, sim.v))
    setSeries({ obs, sim })
  })

  const runExtent = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const sim = parseAsciiGrid(await proj.readText(simPeakPath))
    const obs = parseAsciiGrid(await proj.readText(obsPeakPath))
    setExtent(evalPeak(sim, obs, {
      imin, imax, jmin, jmax, ishift: 0, jshift: 0, simThresh, obsThresh,
    }))
  })

  const tile = (k: string, v: string, cls = '') => (
    <div className="stat-tile" key={k}>
      <div className="k">{k}</div>
      <div className={`v ${cls}`}>{v}</div>
    </div>
  )

  return (
    <>
      <PageHeader icon="🎯" title={t('nav.eval')} desc={t('eval.desc')} />
      <div className="tabs">
        <button className={tab === 'hydro' ? 'active' : ''} onClick={() => setTab('hydro')}>{t('eval.tab.hydro')}</button>
        <button className={tab === 'extent' ? 'active' : ''} onClick={() => setTab('extent')}>{t('eval.tab.extent')}</button>
      </div>

      {tab === 'hydro' && (
        <>
          <div className="card">
            <div className="form-grid wide">
              <Field label={t('eval.obs')}>
                <FileSelect value={obsPath} onChange={setObsPath} filter={(p) => /\.(txt|dat|data|csv)$/i.test(p)} />
              </Field>
              <Field label={t('eval.sim')}>
                <FileSelect value={simPath} onChange={setSimPath} filter={(p) => /\.(txt|dat|data|csv)$/i.test(p)} />
              </Field>
            </div>
            <div className="btn-row">
              <RunButton onRun={runHydro} running={runner.running} disabled={!proj.root || !obsPath || !simPath} />
            </div>
            <ErrorBox error={runner.error} />
          </div>
          {metrics && series && (
            <div className="card">
              <div className="stat-tiles" style={{ marginBottom: 14 }}>
                {tile('NSE', metrics.nse.toFixed(3), metrics.nse > 0.7 ? 'ok' : metrics.nse > 0.5 ? 'warn' : 'err')}
                {tile('KGE', metrics.kge.toFixed(3), metrics.kge > 0.7 ? 'ok' : metrics.kge > 0.5 ? 'warn' : 'err')}
                {tile('RMSE', metrics.rmse.toFixed(2))}
                {tile('r', metrics.r.toFixed(3))}
                {tile('PBIAS', `${metrics.pbias.toFixed(1)}%`, Math.abs(metrics.pbias) < 10 ? 'ok' : Math.abs(metrics.pbias) < 25 ? 'warn' : 'err')}
                {tile('Peak err', `${metrics.peakErrorPct.toFixed(1)}%`)}
                {tile('Peak lag', `${metrics.peakLagSteps}`)}
                {tile('Vol err', `${metrics.volErrorPct.toFixed(1)}%`)}
              </div>
              <LineChart
                height={300}
                series={[
                  { name: 'obs', color: '#888888', t: series.obs.t, v: series.obs.v },
                  { name: 'sim', color: '#3585c8', t: series.sim.t, v: series.sim.v },
                ]}
                xFormatter={(v) => String(Math.round(v))}
              />
            </div>
          )}
        </>
      )}

      {tab === 'extent' && (
        <>
          <div className="card">
            <div className="form-grid wide">
              <Field label={t('eval.simPeak')}><FileSelect value={simPeakPath} onChange={setSimPeakPath} /></Field>
              <Field label={t('eval.obsPeak')}><FileSelect value={obsPeakPath} onChange={setObsPeakPath} /></Field>
            </div>
            <div className="form-grid" style={{ marginTop: 10 }}>
              <Field label={t('eval.simThresh')} unit="m"><NumInput value={simThresh} onChange={setSimThresh} /></Field>
              <Field label={t('eval.obsThresh')} unit="m"><NumInput value={obsThresh} onChange={setObsThresh} /></Field>
              <Field label={`${t('eval.range')} imin/imax`}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <NumInput value={imin} onChange={setImin} /><NumInput value={imax} onChange={setImax} />
                </div>
              </Field>
              <Field label={`${t('eval.range')} jmin/jmax`}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <NumInput value={jmin} onChange={setJmin} /><NumInput value={jmax} onChange={setJmax} />
                </div>
              </Field>
            </div>
            <div className="btn-row">
              <RunButton onRun={runExtent} running={runner.running} disabled={!proj.root || !obsPeakPath} />
            </div>
            <ErrorBox error={runner.error} />
          </div>
          {extent && (
            <div className="card">
              <div className="stat-tiles" style={{ marginBottom: 14 }}>
                {tile(t('eval.fit'), Number.isFinite(extent.fit) ? extent.fit.toFixed(3) : '-',
                  extent.fit > 0.6 ? 'ok' : extent.fit > 0.4 ? 'warn' : 'err')}
                {tile('∩', String(extent.intersection))}
                {tile('∪', String(extent.union))}
                {tile(t('eval.simOnly'), String(extent.simOnly))}
                {tile(t('eval.obsOnly'), String(extent.obsOnly))}
              </div>
              <div className="small dim" style={{ marginBottom: 6 }}>
                1 = {t('eval.simOnly')} · 2 = {t('eval.obsOnly')} · 3 = {t('eval.both')}
              </div>
              <MapView grid={extent.classes} categorical decimals={0} transparentBelow={0.5} height={440} />
            </div>
          )}
        </>
      )}
    </>
  )
}
