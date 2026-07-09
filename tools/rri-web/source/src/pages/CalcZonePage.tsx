import { useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid, serializeAsciiGrid } from '../core/grid.ts'
import { calcZone, type CalcZoneResult } from '../tools/calcZone.ts'
import { MapView } from '../components/MapView.tsx'
import { Field, FileSelect, NumInput, RunButton, SaveRow, ErrorBox, PageHeader, useRunner, TextInput } from '../components/common.tsx'

export function CalcZonePage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [demPath, setDemPath] = useState('topo/adem.txt')
  const [dirPath, setDirPath] = useState('topo/adir.txt')
  const [accPath, setAccPath] = useState('topo/acc.txt')
  const [utm, setUtm] = useState(false)
  const [div, setDiv] = useState(20)
  const [accThresh, setAccThresh] = useState(20)
  const [rivRatio, setRivRatio] = useState(0.1)
  const [outPath, setOutPath] = useState('zone.txt')
  const [result, setResult] = useState<CalcZoneResult | null>(null)
  const [view, setView] = useState<'zone' | 'len'>('zone')

  const run = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const dem = parseAsciiGrid(await proj.readText(demPath))
    const dir = parseAsciiGrid(await proj.readText(dirPath))
    const acc = parseAsciiGrid(await proj.readText(accPath))
    setResult(calcZone(dem, dir, acc, { utm, div: Math.round(div), accThresh, rivRatio }))
  })

  return (
    <>
      <PageHeader icon="🧩" title={t('nav.zone')} desc={t('zone.desc')} />
      <div className="card">
        <h3>{t('common.inputs')}</h3>
        <div className="form-grid wide">
          <Field label="DEM"><FileSelect value={demPath} onChange={setDemPath} /></Field>
          <Field label="DIR"><FileSelect value={dirPath} onChange={setDirPath} /></Field>
          <Field label="ACC"><FileSelect value={accPath} onChange={setAccPath} /></Field>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('common.parameters')}</h3>
        <div className="form-grid">
          <Field label={t('zone.div')}><NumInput value={div} onChange={setDiv} /></Field>
          <Field label={t('zone.accThresh')}><NumInput value={accThresh} onChange={setAccThresh} /></Field>
          <Field label={t('zone.rivRatio')}><NumInput value={rivRatio} onChange={setRivRatio} /></Field>
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
          <h3>{t('common.results')}</h3>
          <div className="tabs">
            <button className={view === 'zone' ? 'active' : ''} onClick={() => setView('zone')}>zone</button>
            <button className={view === 'len' ? 'active' : ''} onClick={() => setView('len')}>distance [m]</button>
          </div>
          {view === 'zone'
            ? <MapView grid={result.zone} categorical decimals={0} height={460} />
            : <MapView grid={result.len} palette="viridis" min={0} decimals={0} height={460} />}
          <div className="btn-row">
            <SaveRow path={outPath} content={() => serializeAsciiGrid(result.zone, { decimals: 'int' })} />
            <span className="mono small dim">{outPath}</span>
          </div>
        </div>
      )}
    </>
  )
}
