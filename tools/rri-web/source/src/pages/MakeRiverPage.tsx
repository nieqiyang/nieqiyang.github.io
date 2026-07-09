import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid, serializeAsciiGrid } from '../core/grid.ts'
import { parseRriInput } from '../core/rriInput.ts'
import { makeRiver, type MakeRiverResult } from '../tools/makeRiver.ts'
import { MapView } from '../components/MapView.tsx'
import { Field, FileSelect, NumInput, RunButton, SaveRow, ErrorBox, PageHeader, useRunner, TextInput } from '../components/common.tsx'

export function MakeRiverPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [demPath, setDemPath] = useState('topo/adem.txt')
  const [dirPath, setDirPath] = useState('topo/adir.txt')
  const [accPath, setAccPath] = useState('topo/acc.txt')
  const [utm, setUtm] = useState(false)
  const [thresh, setThresh] = useState(100)
  const [widthC, setWidthC] = useState(5.0)
  const [widthS, setWidthS] = useState(0.35)
  const [depthC, setDepthC] = useState(0.95)
  const [depthS, setDepthS] = useState(0.2)
  const [heightParam, setHeightParam] = useState(0)
  const [heightLimit, setHeightLimit] = useState(20)
  const [fromRri, setFromRri] = useState<string | null>(null)

  const [outW, setOutW] = useState('riv/width.txt')
  const [outD, setOutD] = useState('riv/depth.txt')
  const [outH, setOutH] = useState('riv/height.txt')
  const [outRiv, setOutRiv] = useState('riv/riv.txt')
  const [result, setResult] = useState<MakeRiverResult | null>(null)
  const [view, setView] = useState<'width' | 'depth' | 'height' | 'riv'>('width')

  // prefill from RRI_Input.txt
  useEffect(() => {
    if (!proj.root || !proj.exists('RRI_Input.txt')) return
    proj.readText('RRI_Input.txt').then((text) => {
      try {
        const r = parseRriInput(text)
        setThresh(r.rivThresh)
        setWidthC(r.widthParamC)
        setWidthS(r.widthParamS)
        setDepthC(r.depthParamC)
        setDepthS(r.depthParamS)
        setHeightParam(r.heightParam)
        setHeightLimit(r.heightLimitParam)
        setUtm(r.utm === 1)
        setFromRri('RRI_Input.txt')
      } catch { /* ignore */ }
    }).catch(() => {})
  }, [proj.root])

  const run = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const dem = parseAsciiGrid(await proj.readText(demPath))
    const dir = parseAsciiGrid(await proj.readText(dirPath))
    const acc = parseAsciiGrid(await proj.readText(accPath))
    setResult(makeRiver(dem, dir, acc, {
      utm, thresh, widthC, widthS, depthC, depthS, heightParam, heightLimit,
    }))
  })

  const stats = (() => {
    if (!result) return null
    let n = 0, domain = 0, w1 = Infinity, w2 = -Infinity, d1 = Infinity, d2 = -Infinity
    for (let k = 0; k < result.width.data.length; k++) {
      if (result.riv.data[k] >= -1) domain++
      const w = result.width.data[k]
      if (w > 0) {
        n++
        if (w < w1) w1 = w
        if (w > w2) w2 = w
        const d = result.depth.data[k]
        if (d < d1) d1 = d
        if (d > d2) d2 = d
      }
    }
    return { n, p: domain ? ((n / domain) * 100).toFixed(1) : '0', w1, w2, d1, d2 }
  })()

  return (
    <>
      <PageHeader icon="🏞️" title={t('nav.makeriver')} desc={t('makeriver.desc')} />
      <div className="card">
        <h3>{t('common.inputs')}</h3>
        <div className="form-grid wide">
          <Field label="DEM (adem)"><FileSelect value={demPath} onChange={setDemPath} /></Field>
          <Field label="DIR (adir)"><FileSelect value={dirPath} onChange={setDirPath} /></Field>
          <Field label="ACC"><FileSelect value={accPath} onChange={setAccPath} /></Field>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('common.parameters')}
          {fromRri && <span className="hint">← {fromRri}</span>}
        </h3>
        <div className="form-grid">
          <Field label={t('makeriver.thresh')}><NumInput value={thresh} onChange={setThresh} /></Field>
          <Field label="Cw (width_param_c)"><NumInput value={widthC} onChange={setWidthC} /></Field>
          <Field label="Sw (width_param_s)"><NumInput value={widthS} onChange={setWidthS} /></Field>
          <Field label="Cd (depth_param_c)"><NumInput value={depthC} onChange={setDepthC} /></Field>
          <Field label="Sd (depth_param_s)"><NumInput value={depthS} onChange={setDepthS} /></Field>
          <Field label="height_param" unit="m"><NumInput value={heightParam} onChange={setHeightParam} /></Field>
          <Field label="height_limit (acc)"><NumInput value={heightLimit} onChange={setHeightLimit} /></Field>
          <Field label="UTM">
            <label className="checkbox-row">
              <input type="checkbox" checked={utm} onChange={(e) => setUtm(e.target.checked)} /> UTM
            </label>
          </Field>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('common.outputs')}</h3>
        <div className="form-grid">
          <Field label="width"><TextInput mono value={outW} onChange={setOutW} /></Field>
          <Field label="depth"><TextInput mono value={outD} onChange={setOutD} /></Field>
          <Field label="height"><TextInput mono value={outH} onChange={setOutH} /></Field>
          <Field label="riv"><TextInput mono value={outRiv} onChange={setOutRiv} /></Field>
        </div>
        <div className="btn-row">
          <RunButton onRun={run} running={runner.running} disabled={!proj.root} />
        </div>
        <ErrorBox error={runner.error} />
      </div>

      {result && stats && (
        <div className="card">
          <h3>{t('common.results')}
            <span className="hint">{t('makeriver.stats', {
              n: stats.n, p: stats.p,
              w1: stats.w1.toFixed(1), w2: stats.w2.toFixed(1),
              d1: stats.d1.toFixed(2), d2: stats.d2.toFixed(2),
            })}</span>
          </h3>
          <div className="tabs">
            {(['width', 'depth', 'height', 'riv'] as const).map((v) => (
              <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{v}</button>
            ))}
          </div>
          {view === 'riv'
            ? <MapView grid={result.riv} categorical decimals={0} />
            : <MapView grid={result[view]} palette="water" transparentBelow={view === 'height' ? -9998 : 0} decimals={2} />}
          {([
            [outW, result.width], [outD, result.depth], [outH, result.height], [outRiv, result.riv],
          ] as const).map(([path, grid], k) => (
            <div className="btn-row" key={k}>
              <SaveRow path={path} content={() => serializeAsciiGrid(grid, { decimals: k === 3 ? 'int' : 2 })} />
              <span className="mono small dim">{path}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
