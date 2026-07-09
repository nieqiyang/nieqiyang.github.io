import { useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid, serializeAsciiGrid, gridStats } from '../core/grid.ts'
import { calcTc, type CalcTcResult } from '../tools/calcTc.ts'
import { MapView } from '../components/MapView.tsx'
import { Field, FileSelect, NumInput, RunButton, SaveRow, ErrorBox, PageHeader, useRunner, TextInput } from '../components/common.tsx'

export function CalcTcPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [demPath, setDemPath] = useState('topo/adem.txt')
  const [dirPath, setDirPath] = useState('topo/adir.txt')
  const [accPath, setAccPath] = useState('topo/acc.txt')
  const [useWidth, setUseWidth] = useState(false)
  const [widthPath, setWidthPath] = useState('riv/width.txt')
  const [utm, setUtm] = useState(false)
  const [manning, setManning] = useState(true)
  const [rain, setRain] = useState(10)
  const [nr, setNr] = useState(0.03)
  const [ns, setNs] = useState(0.3)
  const [ka, setKa] = useState(0.1)
  const [outPath, setOutPath] = useState('tc_dist.txt')
  const [result, setResult] = useState<CalcTcResult | null>(null)

  const run = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const dem = parseAsciiGrid(await proj.readText(demPath))
    const dir = parseAsciiGrid(await proj.readText(dirPath))
    const acc = parseAsciiGrid(await proj.readText(accPath))
    const width = useWidth ? parseAsciiGrid(await proj.readText(widthPath)) : null
    setResult(calcTc(dem, dir, acc, width, { utm, manning, rain, nr, ns, ka }))
  })

  const maxTc = result ? gridStats(result.tc).max : 0

  return (
    <>
      <PageHeader icon="⏱️" title={t('nav.tc')} desc={t('tc.desc')} />
      <div className="card">
        <h3>{t('common.inputs')}</h3>
        <div className="form-grid wide">
          <Field label="DEM"><FileSelect value={demPath} onChange={setDemPath} /></Field>
          <Field label="DIR"><FileSelect value={dirPath} onChange={setDirPath} /></Field>
          <Field label="ACC"><FileSelect value={accPath} onChange={setAccPath} /></Field>
          <Field label={t('tc.width')}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={useWidth} onChange={(e) => setUseWidth(e.target.checked)} />
              <div style={{ flex: 1 }}>
                {useWidth ? <FileSelect value={widthPath} onChange={setWidthPath} /> : <span className="dim small">{t('common.none')}</span>}
              </div>
            </div>
          </Field>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('common.parameters')}</h3>
        <div className="form-grid">
          <Field label={t('tc.rain')} unit="mm/h"><NumInput value={rain} onChange={setRain} /></Field>
          <Field label={t('tc.mode')}>
            <select value={manning ? 1 : 0} onChange={(e) => setManning(e.target.value === '1')}>
              <option value={1}>{t('tc.manning')}</option>
              <option value={0}>{t('tc.darcy')}</option>
            </select>
          </Field>
          <Field label="n (river)"><NumInput value={nr} onChange={setNr} /></Field>
          <Field label="n (slope)"><NumInput value={ns} onChange={setNs} /></Field>
          <Field label="ka" unit="m/s"><NumInput value={ka} onChange={setKa} /></Field>
          <Field label="UTM">
            <label className="checkbox-row">
              <input type="checkbox" checked={utm} onChange={(e) => setUtm(e.target.checked)} /> UTM
            </label>
          </Field>
        </div>
        <div className="form-grid wide" style={{ marginTop: 12 }}>
          <Field label={t('common.outputs')}><TextInput mono value={outPath} onChange={setOutPath} /></Field>
        </div>
        <div className="btn-row">
          <RunButton onRun={run} running={runner.running} disabled={!proj.root} />
        </div>
        <ErrorBox error={runner.error} />
      </div>

      {result && (
        <div className="card">
          <h3>{t('common.results')}
            <span className="hint">{t('tc.maxTc', { v: maxTc.toFixed(1) })}</span>
          </h3>
          <MapView grid={result.tc} palette="viridis" min={0} decimals={1} height={460} />
          <div className="btn-row">
            <SaveRow path={outPath} content={() => serializeAsciiGrid(result.tc, { decimals: 3 })} />
            <span className="mono small dim">{outPath}</span>
          </div>
        </div>
      )}
    </>
  )
}
