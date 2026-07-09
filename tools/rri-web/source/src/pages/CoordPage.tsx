import { useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid, type AsciiGrid } from '../core/grid.ts'
import { lonLatToIJ, ijToLonLat } from '../core/geo.ts'
import { parseLocationFile, serializeLocationFile, type HydroLocation } from '../tools/calcHydro.ts'
import { MapView } from '../components/MapView.tsx'
import { Field, FileSelect, NumInput, ErrorBox, PageHeader, useRunner } from '../components/common.tsx'
import { SaveRow } from '../components/common.tsx'

export function CoordPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [gridPath, setGridPath] = useState('topo/acc.txt')
  const [grid, setGrid] = useState<AsciiGrid | null>(null)
  const [lon, setLon] = useState(0)
  const [lat, setLat] = useState(0)
  const [row, setRow] = useState(1)
  const [col, setCol] = useState(1)
  const [convMsg, setConvMsg] = useState('')
  const [locs, setLocs] = useState<HydroLocation[]>([])

  const loadGrid = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    const g = parseAsciiGrid(await proj.readText(gridPath))
    setGrid(g)
    const c = ijToLonLat(Math.round(g.nrows / 2), Math.round(g.ncols / 2), g)
    setLon(Number(c.lon.toFixed(5)))
    setLat(Number(c.lat.toFixed(5)))
    if (proj.exists('location.txt')) {
      try { setLocs(parseLocationFile(await proj.readText('location.txt'))) } catch { /* ignore */ }
    }
  })

  const toIJ = () => {
    if (!grid) return
    const r = lonLatToIJ(lon, lat, grid)
    if (!r.inside) { setConvMsg(t('coord.outside')); return }
    setRow(r.i)
    setCol(r.j)
    setConvMsg(`(${lon}, ${lat}) → loc_i=${r.i}, loc_j=${r.j}`)
  }
  const toLL = () => {
    if (!grid) return
    const c = ijToLonLat(row, col, grid)
    setLon(Number(c.lon.toFixed(6)))
    setLat(Number(c.lat.toFixed(6)))
    setConvMsg(`loc_i=${row}, loc_j=${col} → (${c.lon.toFixed(6)}, ${c.lat.toFixed(6)})`)
  }

  const accAt = (i: number, j: number) =>
    grid ? grid.data[(i - 1) * grid.ncols + (j - 1)] : NaN

  // log view for acc-like grids
  const logView = grid
    ? { ...grid, data: Float64Array.from(grid.data, (v) => (v < 0 ? -9999 : Math.log10(v + 1))) }
    : null

  return (
    <>
      <PageHeader icon="📍" title={t('nav.coord')} desc={t('coord.desc')} />
      <div className="card">
        <div className="form-grid wide">
          <Field label={t('coord.grid')}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}><FileSelect value={gridPath} onChange={setGridPath} /></div>
              <button className="btn small secondary" onClick={loadGrid} disabled={!proj.root}>{t('common.load')}</button>
            </div>
          </Field>
        </div>
        <ErrorBox error={runner.error} />
        {grid && (
          <>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <Field label={t('coord.lon')}><NumInput value={lon} onChange={setLon} /></Field>
              <Field label={t('coord.lat')}><NumInput value={lat} onChange={setLat} /></Field>
              <Field label={t('coord.row')}><NumInput value={row} onChange={setRow} /></Field>
              <Field label={t('coord.col')}><NumInput value={col} onChange={setCol} /></Field>
            </div>
            <div className="btn-row">
              <button className="btn small secondary" onClick={toIJ}>{t('coord.toIJ')}</button>
              <button className="btn small secondary" onClick={toLL}>{t('coord.toLL')}</button>
              {convMsg && <span className="mono small dim">{convMsg}</span>}
            </div>
          </>
        )}
      </div>

      {grid && logView && (
        <div className="two-col">
          <div className="card">
            <h3>{gridPath} (log₁₀) <span className="hint">{t('coord.addFromMap')}</span></h3>
            <MapView
              grid={logView}
              palette="viridis"
              decimals={2}
              markers={locs.map((l, k) => ({ i: l.i, j: l.j, label: l.name, color: '#e0483b' }))}
              onCellClick={(i, j) => {
                setRow(i)
                setCol(j)
                const c = ijToLonLat(i, j, grid)
                setLon(Number(c.lon.toFixed(6)))
                setLat(Number(c.lat.toFixed(6)))
                const name = prompt(`${t('common.name')} (i=${i}, j=${j}, acc=${accAt(i, j)})`)
                if (name) setLocs((ls) => [...ls, { name: name.replace(/\s+/g, '_'), i, j }])
              }}
            />
          </div>
          <div className="card">
            <h3>{t('coord.locations')}</h3>
            <table className="data">
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th className="num">loc_i</th>
                  <th className="num">loc_j</th>
                  <th className="num">{t('coord.accValue')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {locs.map((l, k) => (
                  <tr key={k}>
                    <td className="mono">{l.name}</td>
                    <td className="num">{l.i}</td>
                    <td className="num">{l.j}</td>
                    <td className="num">{Number.isFinite(accAt(l.i, l.j)) ? accAt(l.i, l.j) : '-'}</td>
                    <td>
                      <button className="btn small secondary" onClick={() => setLocs((ls) => ls.filter((_, x) => x !== k))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {locs.length === 0 && (
                  <tr><td colSpan={5} className="dim">{t('coord.addFromMap')}</td></tr>
                )}
              </tbody>
            </table>
            {locs.length > 0 && (
              <div className="btn-row">
                <SaveRow path="location.txt" content={() => serializeLocationFile(locs)} />
                <span className="mono small dim">location.txt</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
