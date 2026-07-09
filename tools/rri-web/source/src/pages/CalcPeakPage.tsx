import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseAsciiGrid, serializeAsciiGrid, type AsciiGrid } from '../core/grid.ts'
import { cellSizeMeters } from '../core/geo.ts'
import { PeakAccumulator } from '../tools/calcPeak.ts'
import { listOutputFiles } from './ViewerPage.tsx'
import { MapView } from '../components/MapView.tsx'
import { Field, FileSelect, RunButton, SaveRow, ErrorBox, PageHeader, useRunner, TextInput, NumInput } from '../components/common.tsx'

export function CalcPeakPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [prefix, setPrefix] = useState('out/hs_')
  const [refPath, setRefPath] = useState('topo/adem.txt')
  const [outPath, setOutPath] = useState('hpeak.txt')
  const [thresh, setThresh] = useState(0.5)
  const [result, setResult] = useState<{ peak: AsciiGrid; count: number } | null>(null)

  const matched = useMemo(() => listOutputFiles(proj.files, prefix), [proj.files, prefix])

  const run = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    if (matched.length === 0) throw new Error(t('common.needFile'))
    const ref = parseAsciiGrid(await proj.readText(refPath))
    const acc = new PeakAccumulator(ref)
    for (const f of matched) acc.addFrameText(await proj.readText(f))
    setResult({ peak: acc.result(), count: acc.count })
  })

  const stats = (() => {
    if (!result) return null
    let n = 0
    for (let k = 0; k < result.peak.data.length; k++) {
      const v = result.peak.data[k]
      if (v > thresh && v < 1e5) n++
    }
    const g = result.peak
    const { dx, dy } = cellSizeMeters(g.ncols, g.nrows, g.xllcorner, g.yllcorner, g.cellsize, false)
    return { n, area: ((n * dx * dy) / 1e6).toFixed(1) }
  })()

  return (
    <>
      <PageHeader icon="🌊" title={t('nav.peak')} desc={t('peak.desc')} />
      <div className="card">
        <div className="form-grid wide">
          <Field label={t('viewer.prefix')}><TextInput mono value={prefix} onChange={setPrefix} /></Field>
          <Field label={t('peak.ref')}><FileSelect value={refPath} onChange={setRefPath} /></Field>
          <Field label={t('peak.out')}><TextInput mono value={outPath} onChange={setOutPath} /></Field>
        </div>
        <div className="btn-row">
          <span className="small dim">{t('viewer.found', { n: matched.length })}</span>
          <RunButton onRun={run} running={runner.running} disabled={!proj.root || matched.length === 0} />
        </div>
        <ErrorBox error={runner.error} />
      </div>

      {result && stats && (
        <div className="card">
          <h3>{t('common.results')}
            <span className="hint">{t('peak.stats', { t: thresh, n: stats.n, a: stats.area })}</span>
          </h3>
          <div className="viewer-toolbar">
            <span className="small dim">{t('eval.simThresh')}</span>
            <div style={{ width: 90 }}><NumInput value={thresh} onChange={setThresh} /></div>
          </div>
          <MapView grid={result.peak} palette="water" min={0} max={Math.max(1, thresh * 4)} transparentBelow={0.001} decimals={2} height={460} />
          <div className="btn-row">
            <SaveRow path={outPath} content={() => serializeAsciiGrid(result.peak, { decimals: 2 })} />
            <span className="mono small dim">{outPath}</span>
          </div>
        </div>
      )}
    </>
  )
}
