import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { section, parseXZ, serializeSection, type SectionResult } from '../tools/section.ts'
import { LineChart } from '../components/LineChart.tsx'
import { Field, FileSelect, NumInput, RunButton, SaveRow, ErrorBox, PageHeader, useRunner, TextInput } from '../components/common.tsx'

export function SectionPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()

  const [inPath, setInPath] = useState('')
  const [pasted, setPasted] = useState('')
  const [ns, setNs] = useState(0.03)
  const [div, setDiv] = useState(100)
  const [datum, setDatum] = useState(25)
  const [startIdx, setStartIdx] = useState(1)
  const [endIdx, setEndIdx] = useState(30)
  const [outPath, setOutPath] = useState('riv/section/sec_000001.txt')
  const [result, setResult] = useState<SectionResult | null>(null)

  const pts = useMemo(() => (pasted.trim() ? parseXZ(pasted) : null), [pasted])

  const run = () => runner.run(async () => {
    let points = pts
    if (!points) {
      if (!proj.root || !inPath) throw new Error(t('common.needFile'))
      points = parseXZ(await proj.readText(inPath))
    }
    if (points.length === 0) throw new Error('No (x, z) points found')
    setResult(section(points, { nsRiver: ns, div, datum, startIdx, endIdx: Math.min(endIdx, points.length) }))
  })

  return (
    <>
      <PageHeader icon="📐" title={t('nav.section')} desc={t('section.desc')} />
      <div className="card">
        <h3>{t('common.inputs')}</h3>
        <div className="form-grid wide">
          <Field label={t('section.input')}>
            <FileSelect value={inPath} onChange={setInPath} />
          </Field>
          <Field label={`${t('section.input')} (paste x z)`}>
            <textarea rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)}
              placeholder={'3.0  25.359\n5.0  25.276\n…'} />
          </Field>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('common.parameters')}</h3>
        <div className="form-grid">
          <Field label="Manning n"><NumInput value={ns} onChange={setNs} /></Field>
          <Field label={t('section.div')}><NumInput value={div} onChange={setDiv} /></Field>
          <Field label={t('section.datum')} unit="m"><NumInput value={datum} onChange={setDatum} /></Field>
          <Field label={t('section.startx')}><NumInput value={startIdx} onChange={setStartIdx} /></Field>
          <Field label={t('section.endx')}><NumInput value={endIdx} onChange={setEndIdx} /></Field>
        </div>
        <div className="form-grid wide" style={{ marginTop: 12 }}>
          <Field label={t('common.outputs')}><TextInput mono value={outPath} onChange={setOutPath} /></Field>
        </div>
        <div className="btn-row">
          <RunButton onRun={run} running={runner.running} />
        </div>
        <ErrorBox error={runner.error} />
      </div>

      {result && (
        <div className="two-col">
          <div className="card">
            <h3>{t('section.profile')}
              <span className="hint">
                {t('section.depth')}: {result.depth.toFixed(2)} m · {t('section.height')}: {result.height.toFixed(2)} m
              </span>
            </h3>
            <LineChart
              height={260}
              series={[{
                name: 'z (m)',
                color: '#8a6d3b',
                t: result.profile.map((p) => p.x),
                v: result.profile.map((p) => p.z),
              }]}
              xFormatter={(x) => x.toFixed(0)}
              yLabel="z [m]"
              xLabel="x [m]"
            />
            <div className="btn-row">
              <SaveRow path={outPath} content={() => serializeSection(result, div)} />
              <span className="mono small dim">{outPath}</span>
            </div>
          </div>
          <div className="card" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <h3>depth / perimeter / width / n</h3>
            <table className="data">
              <thead>
                <tr><th className="num">depth [m]</th><th className="num">perimeter [m]</th><th className="num">width [m]</th><th className="num">n</th></tr>
              </thead>
              <tbody>
                {result.table.map((r, k) => (
                  <tr key={k}>
                    <td className="num">{r.depth.toFixed(3)}</td>
                    <td className="num">{r.peri.toFixed(3)}</td>
                    <td className="num">{r.width.toFixed(3)}</td>
                    <td className="num">{r.ns.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
