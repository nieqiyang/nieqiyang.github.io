import { useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid, type AsciiGrid } from '../core/grid.ts'
import { serializeBoundary1D, parsePastedSeries, parseBoundary1D, type BoundaryPoint } from '../tools/setBound.ts'
import { MapView } from '../components/MapView.tsx'
import { LineChart } from '../components/LineChart.tsx'
import { Field, FileSelect, ErrorBox, PageHeader, useRunner, SaveRow, TextInput } from '../components/common.tsx'

const COLORS = ['#3585c8', '#e0483b', '#178a50', '#b26a00', '#8a5fbf', '#0d8a8a']

export function BoundaryPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [gridPath, setGridPath] = useState('topo/acc.txt')
  const [grid, setGrid] = useState<AsciiGrid | null>(null)
  const [points, setPoints] = useState<BoundaryPoint[]>([])
  const [pasted, setPasted] = useState('')
  const [series, setSeries] = useState<{ times: number[]; values: number[][] } | null>(null)
  const [outPath, setOutPath] = useState('bound/qr_bound.txt')
  const [loadPath, setLoadPath] = useState('')

  const loadGrid = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    setGrid(parseAsciiGrid(await proj.readText(gridPath)))
  })

  const loadExisting = () => runner.run(async () => {
    if (!proj.root || !loadPath) throw new Error(t('common.needFile'))
    const b = parseBoundary1D(await proj.readText(loadPath))
    setPoints(b.points)
    setSeries({ times: b.times, values: b.values })
  })

  const parsePaste = () => runner.run(async () => {
    if (points.length === 0) throw new Error(t('bound.points') + ' = 0')
    const s = parsePastedSeries(pasted, points.length)
    if (s.times.length === 0) throw new Error('No rows parsed')
    setSeries(s)
  })

  const logView = grid
    ? { ...grid, data: Float64Array.from(grid.data, (v) => (v < 0 ? -9999 : Math.log10(v + 1))) }
    : null

  return (
    <>
      <PageHeader icon="🚧" title={t('nav.boundary')} desc={t('bound.desc')} />
      <div className="card">
        <div className="form-grid wide">
          <Field label={t('coord.grid')}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}><FileSelect value={gridPath} onChange={setGridPath} /></div>
              <button className="btn small secondary" onClick={loadGrid} disabled={!proj.root}>{t('common.load')}</button>
            </div>
          </Field>
          <Field label={`${t('common.load')} (${t('common.optional')})`}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}><FileSelect value={loadPath} onChange={setLoadPath} /></div>
              <button className="btn small secondary" onClick={loadExisting} disabled={!proj.root || !loadPath}>←</button>
            </div>
          </Field>
        </div>
        <ErrorBox error={runner.error} />
      </div>

      <div className="two-col">
        {grid && logView && (
          <div className="card">
            <h3>{t('bound.points')} <span className="hint">{t('coord.addFromMap')}</span></h3>
            <MapView
              grid={logView}
              palette="viridis"
              decimals={2}
              height={360}
              markers={points.map((p, k) => ({ i: p.i, j: p.j, label: p.name, color: COLORS[k % COLORS.length] }))}
              onCellClick={(i, j) => {
                const name = prompt(`${t('common.name')} (i=${i}, j=${j})`, `P${points.length + 1}`)
                if (name) setPoints((ps) => [...ps, { name: name.replace(/\s+/g, '_'), i, j }])
              }}
            />
            <table className="data" style={{ marginTop: 8 }}>
              <thead><tr><th>{t('common.name')}</th><th className="num">loc_i</th><th className="num">loc_j</th><th></th></tr></thead>
              <tbody>
                {points.map((p, k) => (
                  <tr key={k}>
                    <td className="mono" style={{ color: COLORS[k % COLORS.length] }}>{p.name}</td>
                    <td className="num">{p.i}</td>
                    <td className="num">{p.j}</td>
                    <td><button className="btn small secondary" onClick={() => setPoints((ps) => ps.filter((_, x) => x !== k))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card">
          <h3>{t('bound.paste')}</h3>
          <textarea
            rows={8}
            style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--bg-inset)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={'0\t3936.0\t3007.2\n21600\t3936.0\t3007.2\n43200\t3936.0\t3007.2'}
          />
          <div className="btn-row">
            <button className="btn small secondary" onClick={parsePaste} disabled={points.length === 0}>
              {t('common.load')}
            </button>
            {series && <span className="small dim">{t('bound.parsed', { t: series.times.length, p: points.length })}</span>}
          </div>
          {series && (
            <>
              <LineChart
                height={220}
                series={points.map((p, k) => ({
                  name: p.name,
                  color: COLORS[k % COLORS.length],
                  t: series.times.map((s) => s / 3600),
                  v: series.values.map((row) => row[k] ?? NaN),
                }))}
                xFormatter={(v) => `${v.toFixed(0)}h`}
              />
              <div className="form-grid wide" style={{ marginTop: 10 }}>
                <Field label={t('common.outputs')}><TextInput mono value={outPath} onChange={setOutPath} /></Field>
              </div>
              <div className="btn-row">
                <SaveRow
                  path={outPath}
                  content={() => serializeBoundary1D({ points, times: series.times, values: series.values })}
                />
                <span className="mono small dim">{outPath}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
