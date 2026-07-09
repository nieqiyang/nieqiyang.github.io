import { useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid, serializeAsciiGrid, type AsciiGrid } from '../core/grid.ts'
import { demAdjust, type DemAdjustResult } from '../tools/demAdjust.ts'
import { MapView } from '../components/MapView.tsx'
import { Field, FileSelect, NumInput, RunButton, SaveRow, ErrorBox, PageHeader, useRunner, TextInput } from '../components/common.tsx'

export function DemAdjustPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [demPath, setDemPath] = useState('topo/dem.txt')
  const [dirPath, setDirPath] = useState('topo/dir.txt')
  const [accPath, setAccPath] = useState('topo/acc.txt')
  const [outAdem, setOutAdem] = useState('topo/adem.txt')
  const [outAdir, setOutAdir] = useState('topo/adir.txt')
  const [lift, setLift] = useState(500)
  const [carve, setCarve] = useState(5)
  const [increment, setIncrement] = useState(0.01)
  const [utm, setUtm] = useState(false)

  const [result, setResult] = useState<(DemAdjustResult & { dem: AsciiGrid; changed: number; maxChange: number }) | null>(null)
  const [view, setView] = useState<'adem' | 'diff'>('adem')

  const run = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const dem = parseAsciiGrid(await proj.readText(demPath))
    const dir = parseAsciiGrid(await proj.readText(dirPath))
    const acc = parseAsciiGrid(await proj.readText(accPath))
    const r = demAdjust(dem, dir, acc, { utm, lift, carve, increment })
    let changed = 0
    let maxChange = 0
    for (let k = 0; k < dem.data.length; k++) {
      if (dem.data[k] < -100) continue
      const d = Math.abs(r.adem.data[k] - dem.data[k])
      if (d > 1e-9) { changed++; if (d > maxChange) maxChange = d }
    }
    setResult({ ...r, dem, changed, maxChange })
  })

  const diffGrid = result
    ? {
        ...result.adem,
        data: Float64Array.from(result.adem.data, (v, k) =>
          result.dem.data[k] < -100 ? -9999 : v - result.dem.data[k]),
      }
    : null

  return (
    <>
      <PageHeader icon="⛰️" title={t('nav.demadjust')} desc={t('demadj.desc')} />
      <div className="card">
        <h3>{t('common.inputs')}</h3>
        <div className="form-grid wide">
          <Field label="DEM"><FileSelect value={demPath} onChange={setDemPath} /></Field>
          <Field label="DIR"><FileSelect value={dirPath} onChange={setDirPath} /></Field>
          <Field label="ACC"><FileSelect value={accPath} onChange={setAccPath} /></Field>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('common.parameters')}</h3>
        <div className="form-grid">
          <Field label={t('demadj.lift')} unit="m"><NumInput value={lift} onChange={setLift} /></Field>
          <Field label={t('demadj.carve')} unit="m"><NumInput value={carve} onChange={setCarve} /></Field>
          <Field label={t('demadj.increment')} unit="m"><NumInput value={increment} onChange={setIncrement} /></Field>
          <Field label="UTM">
            <label className="checkbox-row">
              <input type="checkbox" checked={utm} onChange={(e) => setUtm(e.target.checked)} /> UTM
            </label>
          </Field>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('common.outputs')}</h3>
        <div className="form-grid wide">
          <Field label={t('demadj.outAdem')}><TextInput mono value={outAdem} onChange={setOutAdem} /></Field>
          <Field label={t('demadj.outAdir')}><TextInput mono value={outAdir} onChange={setOutAdir} /></Field>
        </div>
        <div className="btn-row">
          <RunButton onRun={run} running={runner.running} disabled={!proj.root} />
          {!proj.root && <span className="dim small">{t('common.noProject')}</span>}
        </div>
        <ErrorBox error={runner.error} />
      </div>

      {result && (
        <div className="card">
          <h3>{t('common.results')}
            <span className="hint">{t('demadj.changed', { n: result.changed, d: result.maxChange.toFixed(2) })}</span>
          </h3>
          <div className="viewer-toolbar">
            <div className="tabs" style={{ borderBottom: 'none', marginBottom: 0 }}>
              <button className={view === 'adem' ? 'active' : ''} onClick={() => setView('adem')}>adem</button>
              <button className={view === 'diff' ? 'active' : ''} onClick={() => setView('diff')}>Δ (adem − dem)</button>
            </div>
          </div>
          {view === 'adem'
            ? <MapView grid={result.adem} palette="terrain" decimals={1} />
            : <MapView grid={diffGrid!} palette="diff" min={-Math.max(1, result.maxChange)} max={Math.max(1, result.maxChange)} decimals={2} />}
          <div className="btn-row">
            <SaveRow path={outAdem} content={() => serializeAsciiGrid(result.adem, { decimals: 5 })} />
            <span className="mono small dim">{outAdem}</span>
          </div>
          <div className="btn-row">
            <SaveRow path={outAdir} content={() => serializeAsciiGrid(result.adir, { decimals: 'int' })} />
            <span className="mono small dim">{outAdir}</span>
          </div>
        </div>
      )}
    </>
  )
}
