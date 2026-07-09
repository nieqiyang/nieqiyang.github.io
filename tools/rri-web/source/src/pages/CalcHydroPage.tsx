import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject, downloadText } from '../state/project.tsx'
import { parseAsciiGrid } from '../core/grid.ts'
import { parseTimeSeries, serializeTimeSeries } from '../core/rain.ts'
import { parseLocationFile, calcHydro, type HydroResult } from '../tools/calcHydro.ts'
import { listOutputFiles } from './ViewerPage.tsx'
import { LineChart } from '../components/LineChart.tsx'
import { Field, FileSelect, RunButton, ErrorBox, PageHeader, useRunner, TextInput } from '../components/common.tsx'

const COLORS = ['#3585c8', '#e0483b', '#178a50', '#b26a00', '#8a5fbf', '#0d8a8a', '#c2588f', '#6b7687']

export function CalcHydroPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [locPath, setLocPath] = useState('location.txt')
  const [prefix, setPrefix] = useState('out/qr_')
  const [refPath, setRefPath] = useState('topo/adem.txt')
  const [outPrefix, setOutPrefix] = useState('disc_')
  const [result, setResult] = useState<HydroResult | null>(null)
  const [selected, setSelected] = useState(0)
  const [obsPath, setObsPath] = useState('')
  const [obs, setObs] = useState<{ t: number[]; v: number[] } | null>(null)
  const [saveMsg, setSaveMsg] = useState('')

  const matched = useMemo(() => listOutputFiles(proj.files, prefix), [proj.files, prefix])

  const run = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const locs = parseLocationFile(await proj.readText(locPath))
    if (locs.length === 0) throw new Error('location file has no entries')
    if (matched.length === 0) throw new Error(t('common.needFile'))
    const ref = parseAsciiGrid(await proj.readText(refPath))
    const files: string[] = []
    for (const f of matched) files.push(await proj.readText(f))
    setResult(calcHydro(files, ref.ncols, locs))
    setSelected(0)
  })

  const loadObs = () => runner.run(async () => {
    if (!proj.root || !obsPath) return
    setObs(parseTimeSeries(await proj.readText(obsPath)))
  })

  const saveAll = () => runner.run(async () => {
    if (!proj.root || !result) return
    for (let l = 0; l < result.names.length; l++) {
      await proj.writeText(`${outPrefix}${result.names[l]}.txt`,
        serializeTimeSeries(result.steps, result.series[l], { exp: true }))
    }
    await proj.refresh()
    setSaveMsg(t('common.saved', { file: `${outPrefix}*.txt (${result.names.length})` }))
  })

  const exportCsv = () => {
    if (!result) return
    const lines = ['step,' + result.names.join(',')]
    for (let k = 0; k < result.steps.length; k++) {
      lines.push(`${result.steps[k]},` + result.series.map((s) => s[k]).join(','))
    }
    downloadText('hydrographs.csv', lines.join('\n'))
  }

  const chartSeries = result
    ? [
        {
          name: result.names[selected],
          color: COLORS[selected % COLORS.length],
          t: result.steps as number[],
          v: result.series[selected],
        },
        ...(obs
          ? [{ name: 'obs', color: '#888888', t: obs.t, v: obs.v }]
          : []),
      ]
    : []

  return (
    <>
      <PageHeader icon="📈" title={t('nav.hydro')} desc={t('hydro.desc')} />
      <div className="card">
        <div className="form-grid wide">
          <Field label={t('hydro.locfile')}><FileSelect value={locPath} onChange={setLocPath} /></Field>
          <Field label={t('hydro.outprefix')}>
            <TextInput mono value={prefix} onChange={setPrefix} />
          </Field>
          <Field label={t('peak.ref')}><FileSelect value={refPath} onChange={setRefPath} /></Field>
          <Field label={t('hydro.outfileprefix')}>
            <TextInput mono value={outPrefix} onChange={setOutPrefix} />
          </Field>
        </div>
        <div className="btn-row">
          <span className="small dim">{t('viewer.found', { n: matched.length })}</span>
          <RunButton onRun={run} running={runner.running} disabled={!proj.root || matched.length === 0} />
        </div>
        <ErrorBox error={runner.error} />
      </div>

      {result && (
        <div className="card">
          <h3>{t('common.results')}
            <span className="hint">{t('hydro.extracted', { n: result.names.length, t: result.steps.length })}</span>
          </h3>
          <div className="viewer-toolbar">
            <select value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
              {result.names.map((n, k) => <option key={k} value={k}>{n}</option>)}
            </select>
            <span className="small dim">obs ({t('common.optional')}):</span>
            <div style={{ minWidth: 220 }}>
              <FileSelect value={obsPath} onChange={setObsPath} filter={(p) => /\.(txt|dat|data|csv)$/i.test(p)} />
            </div>
            <button className="btn small secondary" onClick={loadObs} disabled={!obsPath}>{t('common.load')}</button>
          </div>
          <LineChart
            height={300}
            series={chartSeries}
            xFormatter={(v) => String(Math.round(v))}
            xLabel={t('common.step')}
            yLabel="m³/s"
          />
          <div className="btn-row">
            <button className="btn small" onClick={saveAll}>{t('common.save')} ({outPrefix}*)</button>
            <button className="btn small secondary" onClick={exportCsv}>{t('common.csv')}</button>
            {saveMsg && <span className="small dim">{saveMsg}</span>}
          </div>
        </div>
      )}
    </>
  )
}
