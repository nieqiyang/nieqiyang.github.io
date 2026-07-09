import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject } from '../state/project.tsx'
import { parseRriInput, serializeRriInput, defaultRriInput, type RriInput } from '../core/rriInput.ts'
import { Field, FileSelect, NumInput, ErrorBox, PageHeader, useRunner, TextInput, SaveRow } from '../components/common.tsx'

type TabId = 'files' | 'time' | 'params' | 'river' | 'cond' | 'options' | 'output'

export function RriInputPage() {
  const { t } = useI18n()
  const proj = useProject()
  const runner = useRunner()
  const [cfg, setCfg] = useState<RriInput | null>(null)
  const [tab, setTab] = useState<TabId>('files')

  const set = <K extends keyof RriInput>(key: K, value: RriInput[K]) =>
    setCfg((c) => (c ? { ...c, [key]: value } : c))

  const setArr = (key: keyof RriInput, idx: number, value: number) =>
    setCfg((c) => {
      if (!c) return c
      const arr = [...(c[key] as number[])]
      arr[idx] = value
      return { ...c, [key]: arr }
    })

  const load = () => runner.run(async () => {
    if (!proj.root) throw new Error(t('common.noProject'))
    setCfg(parseRriInput(await proj.readText('RRI_Input.txt')))
  })

  useEffect(() => {
    if (proj.root && proj.exists('RRI_Input.txt') && !cfg) load()
  }, [proj.root])

  const setLanduseCount = (n: number) => {
    setCfg((c) => {
      if (!c) return c
      const resize = (a: number[]) => {
        const out = a.slice(0, n)
        while (out.length < n) out.push(a[a.length - 1] ?? 0)
        return out
      }
      return {
        ...c, numOfLanduse: n,
        dif: resize(c.dif), nsSlope: resize(c.nsSlope), soildepth: resize(c.soildepth),
        gammaa: resize(c.gammaa), ksv: resize(c.ksv), faif: resize(c.faif),
        ka: resize(c.ka), gammam: resize(c.gammam), beta: resize(c.beta),
        ksg: resize(c.ksg), gammag: resize(c.gammag), kg0: resize(c.kg0),
        fpg: resize(c.fpg), rgl: resize(c.rgl),
      }
    })
  }

  // validation (same rules RRI_Read enforces)
  const problems: string[] = []
  if (cfg) {
    for (let i = 0; i < cfg.numOfLanduse; i++) {
      if (cfg.ksv[i] > 0 && cfg.ka[i] > 0) problems.push(t('rri.errKvKa', { n: i + 1 }))
      if (cfg.gammam[i] > cfg.gammaa[i]) problems.push(t('rri.errGamma', { n: i + 1 }))
    }
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: 'files', label: t('rri.tab.files') },
    { id: 'time', label: t('rri.tab.time') },
    { id: 'params', label: t('rri.tab.params') },
    { id: 'river', label: t('rri.tab.river') },
    { id: 'cond', label: t('rri.tab.cond') },
    { id: 'options', label: t('rri.tab.options') },
    { id: 'output', label: t('rri.tab.output') },
  ]

  const paramRow = (label: string, key: keyof RriInput, unit?: string) => (
    <tr key={key as string}>
      <td>{label}{unit && <span className="faint small"> [{unit}]</span>}</td>
      {Array.from({ length: cfg!.numOfLanduse }, (_, i) => (
        <td key={i} className="num">
          <NumInput value={(cfg![key] as number[])[i]} onChange={(v) => setArr(key, i, v)} />
        </td>
      ))}
    </tr>
  )

  const outVars = ['hs', 'hr', 'hg', 'qr', 'qu', 'qv', 'gu', 'gv', 'gampt_ff', 'storage']
  const outFileKeys: (keyof RriInput)[] = ['outfileHs', 'outfileHr', 'outfileHg', 'outfileQr', 'outfileQu', 'outfileQv', 'outfileGu', 'outfileGv', 'outfileGamptFf', 'outfileStorage']

  return (
    <>
      <PageHeader icon="⚙️" title={t('nav.rriinput')} desc={t('rri.desc')} />
      <div className="card">
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="btn secondary" onClick={load} disabled={!proj.root}>{t('rri.load')}</button>
          <button className="btn secondary" onClick={() => setCfg(defaultRriInput())}>{t('rri.new')}</button>
          {cfg && (
            <SaveRow path="RRI_Input.txt" content={() => serializeRriInput(cfg)} />
          )}
        </div>
        <ErrorBox error={runner.error} />
        {cfg && (problems.length > 0
          ? <div className="alert error">{problems.map((p, k) => <div key={k}>⚠ {p}</div>)}</div>
          : <div className="alert ok small">✓ {t('rri.validated')}</div>)}
      </div>

      {cfg && (
        <div className="card">
          <div className="tabs">
            {TABS.map((tb) => (
              <button key={tb.id} className={tab === tb.id ? 'active' : ''} onClick={() => setTab(tb.id)}>
                {tb.label}
              </button>
            ))}
          </div>

          {tab === 'files' && (
            <div className="form-grid wide">
              <Field label={t('rri.rain.file')}>
                <FileSelect value={cfg.rainfile} onChange={(v) => set('rainfile', './' + v)} />
              </Field>
              <Field label={t('rri.dem.file')}>
                <FileSelect value={cfg.demfile} onChange={(v) => set('demfile', './' + v)} />
              </Field>
              <Field label={t('rri.acc.file')}>
                <FileSelect value={cfg.accfile} onChange={(v) => set('accfile', './' + v)} />
              </Field>
              <Field label={t('rri.dir.file')}>
                <FileSelect value={cfg.dirfile} onChange={(v) => set('dirfile', './' + v)} />
              </Field>
            </div>
          )}

          {tab === 'time' && (
            <>
              <div className="form-grid">
                <Field label={t('rri.utm')}>
                  <select value={cfg.utm} onChange={(e) => set('utm', Number(e.target.value))}>
                    <option value={0}>{t('rri.latlon')}</option>
                    <option value={1}>{t('rri.utmv')}</option>
                  </select>
                </Field>
                <Field label={t('rri.eightdir')}>
                  <select value={cfg.eightDir} onChange={(e) => set('eightDir', Number(e.target.value))}>
                    <option value={1}>8</option>
                    <option value={0}>4</option>
                  </select>
                </Field>
                <Field label={t('rri.lasth')} unit="h"><NumInput value={cfg.lasth} onChange={(v) => set('lasth', v)} /></Field>
                <Field label={t('rri.dt')} unit="s"><NumInput value={cfg.dt} onChange={(v) => set('dt', v)} /></Field>
                <Field label={t('rri.dtriv')} unit="s"><NumInput value={cfg.dtRiv} onChange={(v) => set('dtRiv', v)} /></Field>
                <Field label={t('rri.outnum')}><NumInput value={cfg.outnum} onChange={(v) => set('outnum', v)} /></Field>
              </div>
              <h3 style={{ marginTop: 16 }}>{t('rri.rainGeoref')}</h3>
              <div className="form-grid">
                <Field label="xllcorner_rain"><NumInput value={cfg.xllcornerRain} onChange={(v) => set('xllcornerRain', v)} /></Field>
                <Field label="yllcorner_rain"><NumInput value={cfg.yllcornerRain} onChange={(v) => set('yllcornerRain', v)} /></Field>
                <Field label="cellsize_rain x"><NumInput value={cfg.cellsizeRainX} onChange={(v) => set('cellsizeRainX', v)} /></Field>
                <Field label="cellsize_rain y"><NumInput value={cfg.cellsizeRainY} onChange={(v) => set('cellsizeRainY', v)} /></Field>
              </div>
            </>
          )}

          {tab === 'params' && (
            <>
              <div className="alert info small">{t('rri.paramHint')}</div>
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <Field label={t('rri.nsriver')} unit="m⁻¹ᐟ³s"><NumInput value={cfg.nsRiver} onChange={(v) => set('nsRiver', v)} /></Field>
                <Field label={t('rri.landuse.n')}>
                  <NumInput value={cfg.numOfLanduse} onChange={(v) => setLanduseCount(Math.max(1, Math.min(20, Math.round(v))))} />
                </Field>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data" style={{ minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 180 }}>{t('common.parameters')}</th>
                      {Array.from({ length: cfg.numOfLanduse }, (_, i) => (
                        <th key={i} className="num">{t('rri.landuse.col', { n: i + 1 })}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{t('rri.diffusion')}</td>
                      {Array.from({ length: cfg.numOfLanduse }, (_, i) => (
                        <td key={i}>
                          <select value={cfg.dif[i]} onChange={(e) => setArr('dif', i, Number(e.target.value))}>
                            <option value={1}>{t('rri.diff1')}</option>
                            <option value={0}>{t('rri.diff0')}</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                    {paramRow(t('rri.nsslope'), 'nsSlope', 'm⁻¹ᐟ³s')}
                    {paramRow(t('rri.soildepth'), 'soildepth', 'm')}
                    {paramRow(t('rri.gammaa'), 'gammaa', '-')}
                    {paramRow(t('rri.ksv'), 'ksv', 'm/s')}
                    {paramRow(t('rri.faif'), 'faif', 'm')}
                    {paramRow(t('rri.ka'), 'ka', 'm/s')}
                    {paramRow(t('rri.gammam'), 'gammam', '-')}
                    {paramRow(t('rri.beta'), 'beta', '-')}
                  </tbody>
                </table>
              </div>
              <h3 style={{ marginTop: 16 }}>{t('rri.gw')}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="data" style={{ minWidth: 420 }}>
                  <tbody>
                    {paramRow('ksg', 'ksg', 'm/s')}
                    {paramRow('gammag', 'gammag', '-')}
                    {paramRow('kg0', 'kg0')}
                    {paramRow('fpg', 'fpg')}
                    {paramRow('rgl', 'rgl')}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'river' && (
            <>
              <div className="form-grid" style={{ marginBottom: 10 }}>
                <Field label={t('rri.rivgeom')}>
                  <select value={cfg.rivfileSwitch} onChange={(e) => set('rivfileSwitch', Number(e.target.value))}>
                    <option value={0}>{t('rri.rivByParam')}</option>
                    <option value={1}>{t('rri.rivByFile')}</option>
                  </select>
                </Field>
              </div>
              {cfg.rivfileSwitch === 0 ? (
                <div className="form-grid">
                  <Field label="riv_thresh (acc)"><NumInput value={cfg.rivThresh} onChange={(v) => set('rivThresh', v)} /></Field>
                  <Field label="width_param_c"><NumInput value={cfg.widthParamC} onChange={(v) => set('widthParamC', v)} /></Field>
                  <Field label="width_param_s"><NumInput value={cfg.widthParamS} onChange={(v) => set('widthParamS', v)} /></Field>
                  <Field label="depth_param_c"><NumInput value={cfg.depthParamC} onChange={(v) => set('depthParamC', v)} /></Field>
                  <Field label="depth_param_s"><NumInput value={cfg.depthParamS} onChange={(v) => set('depthParamS', v)} /></Field>
                  <Field label="height_param" unit="m"><NumInput value={cfg.heightParam} onChange={(v) => set('heightParam', v)} /></Field>
                  <Field label="height_limit_param"><NumInput value={cfg.heightLimitParam} onChange={(v) => set('heightLimitParam', v)} /></Field>
                </div>
              ) : (
                <div className="form-grid wide">
                  <Field label="width"><FileSelect value={cfg.widthfile} onChange={(v) => set('widthfile', './' + v)} /></Field>
                  <Field label="depth"><FileSelect value={cfg.depthfile} onChange={(v) => set('depthfile', './' + v)} /></Field>
                  <Field label="height"><FileSelect value={cfg.heightfile} onChange={(v) => set('heightfile', './' + v)} /></Field>
                </div>
              )}
              <h3 style={{ marginTop: 16 }}>{t('rri.seclen')} / {t('rri.sec')}</h3>
              <div className="form-grid wide">
                <Field label={`${t('rri.seclen')} (0/1)`}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select value={cfg.secLengthSwitch} onChange={(e) => set('secLengthSwitch', Number(e.target.value))}>
                      <option value={0}>0</option><option value={1}>1</option>
                    </select>
                    <div style={{ flex: 1 }}><TextInput mono value={cfg.secLengthFile} onChange={(v) => set('secLengthFile', v)} /></div>
                  </div>
                </Field>
                <Field label={`${t('rri.sec')} (0/1)`}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select value={cfg.secSwitch} onChange={(e) => set('secSwitch', Number(e.target.value))}>
                      <option value={0}>0</option><option value={1}>1</option>
                    </select>
                    <div style={{ flex: 1 }}><TextInput mono value={cfg.secMapFile} onChange={(v) => set('secMapFile', v)} /></div>
                    <div style={{ flex: 1 }}><TextInput mono value={cfg.secFile} onChange={(v) => set('secFile', v)} /></div>
                  </div>
                </Field>
              </div>
            </>
          )}

          {tab === 'cond' && (
            <>
              <h3>{t('rri.init')} (hs / hr / hg / gampt_ff)</h3>
              <div className="form-grid wide">
                {([
                  ['initSloSwitch', 'initfileSlo', 'hs'],
                  ['initRivSwitch', 'initfileRiv', 'hr'],
                  ['initGwSwitch', 'initfileGw', 'hg'],
                  ['initGamptFfSwitch', 'initfileGamptFf', 'gampt_ff'],
                ] as const).map(([sw, file, label]) => (
                  <Field key={sw} label={`${label} (0/1)`}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={cfg[sw]} onChange={(e) => set(sw, Number(e.target.value))}>
                        <option value={0}>0</option><option value={1}>1</option>
                      </select>
                      <div style={{ flex: 1 }}><TextInput mono value={cfg[file]} onChange={(v) => set(file, v)} /></div>
                    </div>
                  </Field>
                ))}
              </div>
              <h3 style={{ marginTop: 16 }}>{t('rri.bound')}</h3>
              <div className="alert info small">{t('rri.boundFmt')}</div>
              <div className="form-grid wide">
                {([
                  ['boundSloWlevSwitch', 'boundfileSloWlev', `${t('rri.wlev')} - slope`],
                  ['boundRivWlevSwitch', 'boundfileRivWlev', `${t('rri.wlev')} - river`],
                  ['boundSloDiscSwitch', 'boundfileSloDisc', `${t('rri.disc')} - slope`],
                  ['boundRivDiscSwitch', 'boundfileRivDisc', `${t('rri.disc')} - river`],
                ] as const).map(([sw, file, label]) => (
                  <Field key={sw} label={label}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={cfg[sw]} onChange={(e) => set(sw, Number(e.target.value))}>
                        <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option>
                      </select>
                      <div style={{ flex: 1 }}><TextInput mono value={cfg[file]} onChange={(v) => set(file, v)} /></div>
                    </div>
                  </Field>
                ))}
              </div>
            </>
          )}

          {tab === 'options' && (
            <div className="form-grid wide">
              {([
                ['landSwitch', 'landfile', t('rri.landuse.file')],
                ['damSwitch', 'damfile', t('rri.dam')],
                ['divSwitch', 'divfile', t('rri.div')],
              ] as const).map(([sw, file, label]) => (
                <Field key={sw} label={`${label} (0/1)`}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select value={cfg[sw]} onChange={(e) => set(sw, Number(e.target.value))}>
                      <option value={0}>0</option><option value={1}>1</option>
                    </select>
                    <div style={{ flex: 1 }}><TextInput mono value={cfg[file]} onChange={(v) => set(file, v)} /></div>
                  </div>
                </Field>
              ))}
              <Field label={`${t('rri.evp')} (0/1/2)`}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={cfg.evpSwitch} onChange={(e) => set('evpSwitch', Number(e.target.value))}>
                    <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option>
                  </select>
                  <div style={{ flex: 1 }}><TextInput mono value={cfg.evpfile} onChange={(v) => set('evpfile', v)} /></div>
                </div>
              </Field>
              {cfg.evpSwitch !== 0 && (
                <>
                  <Field label="xllcorner_evp"><NumInput value={cfg.xllcornerEvp} onChange={(v) => set('xllcornerEvp', v)} /></Field>
                  <Field label="yllcorner_evp"><NumInput value={cfg.yllcornerEvp} onChange={(v) => set('yllcornerEvp', v)} /></Field>
                  <Field label="cellsize_evp x"><NumInput value={cfg.cellsizeEvpX} onChange={(v) => set('cellsizeEvpX', v)} /></Field>
                  <Field label="cellsize_evp y"><NumInput value={cfg.cellsizeEvpY} onChange={(v) => set('cellsizeEvpY', v)} /></Field>
                </>
              )}
            </div>
          )}

          {tab === 'output' && (
            <>
              <h3>{t('rri.outFlags')}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="data">
                  <thead>
                    <tr>{outVars.map((v) => <th key={v} className="num">{v}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr>
                      {outVars.map((v, i) => (
                        <td key={v} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={cfg.outswitch[i] === 1}
                            onChange={(e) => {
                              const arr = [...cfg.outswitch]
                              arr[i] = e.target.checked ? 1 : 0
                              set('outswitch', arr)
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      {outFileKeys.map((k) => (
                        <td key={k as string}>
                          <TextInput mono value={cfg[k] as string} onChange={(v) => set(k, v)} />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <h3 style={{ marginTop: 16 }}>{t('rri.hydroSw')}</h3>
              <div className="form-grid wide">
                <Field label={`${t('rri.hydroSw')} (0/1)`}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select value={cfg.hydroSwitch} onChange={(e) => set('hydroSwitch', Number(e.target.value))}>
                      <option value={0}>0</option><option value={1}>1</option>
                    </select>
                    <div style={{ flex: 1 }}><TextInput mono value={cfg.locationFile} onChange={(v) => set('locationFile', v)} /></div>
                  </div>
                </Field>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
