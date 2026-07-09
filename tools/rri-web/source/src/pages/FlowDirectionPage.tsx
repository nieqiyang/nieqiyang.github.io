import { useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid, serializeAsciiGrid } from '../core/grid.ts'
import { flowDirection, type FlowDirectionResult } from '../tools/flowDirection.ts'
import { MapView } from '../components/MapView.tsx'
import { Field, FileSelect, RunButton, SaveRow, ErrorBox, PageHeader, useRunner, TextInput } from '../components/common.tsx'

export function FlowDirectionPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [demPath, setDemPath] = useState('topo/dem.txt')
  const [useRiv, setUseRiv] = useState(false)
  const [rivPath, setRivPath] = useState('riv/riv.txt')
  const [outDir, setOutDir] = useState('topo/dir_mod.txt')
  const [outAcc, setOutAcc] = useState('topo/acc_mod.txt')
  const [result, setResult] = useState<FlowDirectionResult | null>(null)
  const [view, setView] = useState<'acc' | 'dir'>('acc')

  const run = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const dem = parseAsciiGrid(await proj.readText(demPath))
    const riv = useRiv ? parseAsciiGrid(await proj.readText(rivPath)) : null
    setResult(flowDirection(dem, riv))
  })

  // log-scaled acc for display
  const accView = result
    ? { ...result.acc, data: Float64Array.from(result.acc.data, (v) => (v < 0 ? -9999 : Math.log10(v + 1))) }
    : null

  return (
    <>
      <PageHeader icon="🧭" title={t('nav.flowdir')} desc={t('flowdir.desc')} />
      <div className="card">
        <h3>{t('common.inputs')}</h3>
        <div className="form-grid wide">
          <Field label={t('flowdir.dem')}><FileSelect value={demPath} onChange={setDemPath} /></Field>
          <Field label={t('flowdir.riv')}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label className="checkbox-row">
                <input type="checkbox" checked={useRiv} onChange={(e) => setUseRiv(e.target.checked)} />
              </label>
              <div style={{ flex: 1 }}>
                {useRiv ? <FileSelect value={rivPath} onChange={setRivPath} /> : <span className="dim small">{t('common.none')}</span>}
              </div>
            </div>
          </Field>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('common.outputs')}</h3>
        <div className="form-grid wide">
          <Field label={t('flowdir.outDir')}><TextInput mono value={outDir} onChange={setOutDir} /></Field>
          <Field label={t('flowdir.outAcc')}><TextInput mono value={outAcc} onChange={setOutAcc} /></Field>
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
              {t('flowdir.outlets', { n: result.outlets.length })}
              {result.maskedCells > 0 && ` · ${t('flowdir.masked', { n: result.maskedCells })}`}
            </span>
          </h3>
          <div className="tabs">
            <button className={view === 'acc' ? 'active' : ''} onClick={() => setView('acc')}>acc (log₁₀)</button>
            <button className={view === 'dir' ? 'active' : ''} onClick={() => setView('dir')}>dir</button>
          </div>
          {view === 'acc'
            ? <MapView grid={accView!} palette="viridis" decimals={2}
                markers={result.outlets.slice(0, 50).map((o) => ({ ...o, label: 'outlet' }))} />
            : <MapView grid={result.dir} categorical decimals={0} />}
          <div className="btn-row">
            <SaveRow path={outDir} content={() => serializeAsciiGrid(result.dir, { decimals: 'int' })} />
            <span className="mono small dim">{outDir}</span>
          </div>
          <div className="btn-row">
            <SaveRow path={outAcc} content={() => serializeAsciiGrid(result.acc, { decimals: 'int' })} />
            <span className="mono small dim">{outAcc}</span>
          </div>
        </div>
      )}
    </>
  )
}
