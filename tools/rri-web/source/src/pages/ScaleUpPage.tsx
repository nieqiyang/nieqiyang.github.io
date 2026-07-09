import { useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid, serializeAsciiGrid } from '../core/grid.ts'
import { scaleUp, type ScaleUpResult } from '../tools/scaleUp.ts'
import { MapView } from '../components/MapView.tsx'
import { Field, FileSelect, NumInput, RunButton, SaveRow, ErrorBox, PageHeader, useRunner, TextInput } from '../components/common.tsx'

export function ScaleUpPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [demPath, setDemPath] = useState('topo/dem.txt')
  const [dirPath, setDirPath] = useState('topo/dir.txt')
  const [accPath, setAccPath] = useState('topo/acc.txt')
  const [ups, setUps] = useState(3)
  const [outDem, setOutDem] = useState('topo/dem_up.txt')
  const [outDir, setOutDir] = useState('topo/dir_up.txt')
  const [outAcc, setOutAcc] = useState('topo/acc_up.txt')
  const [result, setResult] = useState<ScaleUpResult | null>(null)
  const [view, setView] = useState<'dem' | 'acc'>('dem')

  const run = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const dem = parseAsciiGrid(await proj.readText(demPath))
    const dir = parseAsciiGrid(await proj.readText(dirPath))
    const acc = parseAsciiGrid(await proj.readText(accPath))
    setResult(scaleUp(dem, dir, acc, Math.max(2, Math.round(ups))))
  })

  const accView = result
    ? { ...result.acc2, data: Float64Array.from(result.acc2.data, (v) => (v < 0 ? -9999 : Math.log10(v + 1))) }
    : null

  return (
    <>
      <PageHeader icon="🔍" title={t('nav.scaleup')} desc={t('scaleup.desc')} />
      <div className="card">
        <h3>{t('common.inputs')}</h3>
        <div className="form-grid wide">
          <Field label="DEM"><FileSelect value={demPath} onChange={setDemPath} /></Field>
          <Field label="DIR"><FileSelect value={dirPath} onChange={setDirPath} /></Field>
          <Field label="ACC"><FileSelect value={accPath} onChange={setAccPath} /></Field>
        </div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <Field label={t('scaleup.factor')}><NumInput value={ups} onChange={setUps} min={2} /></Field>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('common.outputs')}</h3>
        <div className="form-grid wide">
          <Field label="DEM"><TextInput mono value={outDem} onChange={setOutDem} /></Field>
          <Field label="DIR"><TextInput mono value={outDir} onChange={setOutDir} /></Field>
          <Field label="ACC"><TextInput mono value={outAcc} onChange={setOutAcc} /></Field>
        </div>
        <div className="btn-row">
          <RunButton onRun={run} running={runner.running} disabled={!proj.root} />
        </div>
        <ErrorBox error={runner.error} />
      </div>

      {result && (
        <div className="card">
          <h3>{t('common.results')}
            <span className="hint">
              {t('scaleup.newres', {
                c: result.dem2.ncols, r: result.dem2.nrows,
                s: result.dem2.cellsize.toPrecision(8),
              })}
            </span>
          </h3>
          {result.warnings.length > 0 && (
            <div className="alert warn small">{result.warnings.slice(0, 5).join(' · ')}{result.warnings.length > 5 ? ' …' : ''}</div>
          )}
          <div className="tabs">
            <button className={view === 'dem' ? 'active' : ''} onClick={() => setView('dem')}>dem</button>
            <button className={view === 'acc' ? 'active' : ''} onClick={() => setView('acc')}>acc (log₁₀)</button>
          </div>
          {view === 'dem'
            ? <MapView grid={result.dem2} palette="terrain" decimals={1} />
            : <MapView grid={accView!} palette="viridis" decimals={2} />}
          <div className="btn-row">
            <SaveRow path={outDem} content={() => serializeAsciiGrid(result.dem2, { decimals: 3 })} />
            <span className="mono small dim">{outDem}</span>
          </div>
          <div className="btn-row">
            <SaveRow path={outDir} content={() => serializeAsciiGrid(result.dir2, { decimals: 'int' })} />
            <span className="mono small dim">{outDir}</span>
          </div>
          <div className="btn-row">
            <SaveRow path={outAcc} content={() => serializeAsciiGrid(result.acc2, { decimals: 'int' })} />
            <span className="mono small dim">{outAcc}</span>
          </div>
        </div>
      )}
    </>
  )
}
