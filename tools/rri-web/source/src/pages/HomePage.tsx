import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseRriInput, type RriInput } from '../core/rriInput.ts'
import { PageHeader } from '../components/common.tsx'

export function HomePage() {
  const { t } = useI18n()
  const proj = useProject()
  const [rri, setRri] = useState<RriInput | null>(null)
  const [rriErr, setRriErr] = useState(false)

  useEffect(() => {
    setRri(null)
    setRriErr(false)
    if (proj.root && proj.exists('RRI_Input.txt')) {
      proj.readText('RRI_Input.txt')
        .then((text) => setRri(parseRriInput(text)))
        .catch(() => setRriErr(true))
    }
  }, [proj.root, proj.files])

  if (!proj.supported) {
    return (
      <div className="landing">
        <h1>🌊 {t('app.name')}</h1>
        <p className="alert error">{t('home.notSupported')}</p>
      </div>
    )
  }

  if (!proj.root) {
    return (
      <div className="landing">
        <h1>🌊 {t('app.name')}</h1>
        <p>{t('home.openDesc')}</p>
        <button className="btn" onClick={() => proj.openProject().catch(() => {})}>
          📂 {t('home.openProject')}
        </button>
      </div>
    )
  }

  const steps = [
    { title: t('home.wf1'), desc: t('home.wf1d') },
    { title: t('home.wf2'), desc: t('home.wf2d') },
    { title: t('home.wf3'), desc: t('home.wf3d') },
    { title: t('home.wf4'), desc: t('home.wf4d') },
    { title: t('home.wf5'), desc: t('home.wf5d') },
  ]

  const groups = new Map<string, number>()
  for (const f of proj.files) {
    const dir = f.includes('/') ? f.slice(0, f.indexOf('/')) : '.'
    groups.set(dir, (groups.get(dir) ?? 0) + 1)
  }

  return (
    <>
      <PageHeader icon="🏠" title={t('nav.home')} desc="" />
      <div className="card">
        <h3>{t('home.currentProject')}</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>📂 {proj.rootName}</span>
          <span className="dim small">{proj.files.length} {t('common.file').toLowerCase()}(s)</span>
          <button className="btn small secondary" onClick={() => proj.openProject().catch(() => {})}>
            {t('home.reopen')}
          </button>
          <button className="btn small secondary" onClick={() => proj.refresh()}>{t('common.refresh')}</button>
        </div>
        <div style={{ marginTop: 12 }}>
          {rri && (
            <div className="alert ok">✓ {t('home.controlFound', { n: rri.lasth, o: rri.outnum })}</div>
          )}
          {!rri && !rriErr && !proj.exists('RRI_Input.txt') && (
            <div className="alert warn">{t('home.controlMissing')}</div>
          )}
          {rriErr && <div className="alert error">RRI_Input.txt: parse error</div>}
        </div>
        <div className="stat-tiles" style={{ marginTop: 10 }}>
          {[...groups.entries()].slice(0, 8).map(([dir, n]) => (
            <div className="stat-tile" key={dir}>
              <div className="k">{dir === '.' ? './' : dir + '/'}</div>
              <div className="v">{n}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>{t('home.workflow')}</h3>
        <div className="workflow-steps">
          {steps.map((s, i) => (
            <div className="workflow-step" key={i}>
              <div className="num">{i + 1}</div>
              <div className="body">
                <b>{s.title}</b>
                <span>{s.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
