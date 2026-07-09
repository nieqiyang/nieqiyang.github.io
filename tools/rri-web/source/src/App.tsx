import { useEffect, useState } from 'react'
import { useI18n } from './i18n/index.tsx'
import type { Lang } from './i18n/translations.ts'
import { HomePage } from './pages/HomePage.tsx'
import { FlowDirectionPage } from './pages/FlowDirectionPage.tsx'
import { DemAdjustPage } from './pages/DemAdjustPage.tsx'
import { ScaleUpPage } from './pages/ScaleUpPage.tsx'
import { MakeRiverPage } from './pages/MakeRiverPage.tsx'
import { SectionPage } from './pages/SectionPage.tsx'
import { RainThiessenPage } from './pages/RainThiessenPage.tsx'
import { RainBasinPage } from './pages/RainBasinPage.tsx'
import { GsmapPage } from './pages/GsmapPage.tsx'
import { RriInputPage } from './pages/RriInputPage.tsx'
import { CoordPage } from './pages/CoordPage.tsx'
import { BoundaryPage } from './pages/BoundaryPage.tsx'
import { ViewerPage } from './pages/ViewerPage.tsx'
import { CalcHydroPage } from './pages/CalcHydroPage.tsx'
import { CalcPeakPage } from './pages/CalcPeakPage.tsx'
import { EvalPage } from './pages/EvalPage.tsx'
import { CalcTcPage } from './pages/CalcTcPage.tsx'
import { CalcZonePage } from './pages/CalcZonePage.tsx'
import { KmzPage } from './pages/KmzPage.tsx'

interface NavEntry {
  id: string
  icon: string
  labelKey: string
  component: () => JSX.Element
}
interface NavGroup {
  titleKey: string
  entries: NavEntry[]
}

const GROUPS: NavGroup[] = [
  {
    titleKey: 'nav.project',
    entries: [{ id: 'home', icon: '🏠', labelKey: 'nav.home', component: HomePage }],
  },
  {
    titleKey: 'nav.topo',
    entries: [
      { id: 'flowdir', icon: '🧭', labelKey: 'nav.flowdir', component: FlowDirectionPage },
      { id: 'demadjust', icon: '⛰️', labelKey: 'nav.demadjust', component: DemAdjustPage },
      { id: 'scaleup', icon: '🔍', labelKey: 'nav.scaleup', component: ScaleUpPage },
      { id: 'makeriver', icon: '🏞️', labelKey: 'nav.makeriver', component: MakeRiverPage },
      { id: 'section', icon: '📐', labelKey: 'nav.section', component: SectionPage },
    ],
  },
  {
    titleKey: 'nav.rain',
    entries: [
      { id: 'thiessen', icon: '🌧️', labelKey: 'nav.thiessen', component: RainThiessenPage },
      { id: 'rainbasin', icon: '💧', labelKey: 'nav.rainbasin', component: RainBasinPage },
      { id: 'gsmap', icon: '🛰️', labelKey: 'nav.gsmap', component: GsmapPage },
    ],
  },
  {
    titleKey: 'nav.sim',
    entries: [
      { id: 'rriinput', icon: '⚙️', labelKey: 'nav.rriinput', component: RriInputPage },
      { id: 'coord', icon: '📍', labelKey: 'nav.coord', component: CoordPage },
      { id: 'boundary', icon: '🚧', labelKey: 'nav.boundary', component: BoundaryPage },
    ],
  },
  {
    titleKey: 'nav.results',
    entries: [
      { id: 'viewer', icon: '🎬', labelKey: 'nav.viewer', component: ViewerPage },
      { id: 'hydro', icon: '📈', labelKey: 'nav.hydro', component: CalcHydroPage },
      { id: 'peak', icon: '🌊', labelKey: 'nav.peak', component: CalcPeakPage },
      { id: 'eval', icon: '🎯', labelKey: 'nav.eval', component: EvalPage },
      { id: 'tc', icon: '⏱️', labelKey: 'nav.tc', component: CalcTcPage },
      { id: 'zone', icon: '🧩', labelKey: 'nav.zone', component: CalcZonePage },
      { id: 'kmz', icon: '🌍', labelKey: 'nav.kmz', component: KmzPage },
    ],
  },
]

export default function App() {
  const { t, lang, setLang } = useI18n()
  const [page, setPage] = useState('home')
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('rri.theme') as 'light' | 'dark') ??
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('rri.theme', theme)
  }, [theme])

  const active = GROUPS.flatMap((g) => g.entries).find((e) => e.id === page) ?? GROUPS[0].entries[0]
  const Component = active.component

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <span>🌊</span>
          <span>
            {t('app.name')}
            <span className="sub">{t('app.tagline')}</span>
          </span>
        </div>
        {GROUPS.map((g) => (
          <div className="nav-group" key={g.titleKey}>
            <div className="nav-group-title">{t(g.titleKey)}</div>
            {g.entries.map((e) => (
              <div
                key={e.id}
                className={`nav-item${e.id === page ? ' active' : ''}`}
                onClick={() => setPage(e.id)}
              >
                <span className="icon">{e.icon}</span>
                {t(e.labelKey)}
              </div>
            ))}
          </div>
        ))}
        <div className="sidebar-footer">
          <div className="lang-switch">
            {(['en', 'ja', 'zh'] as Lang[]).map((l) => (
              <button key={l} className={l === lang ? 'active' : ''} onClick={() => setLang(l)}>
                {l === 'en' ? 'EN' : l === 'ja' ? '日本語' : '中文'}
              </button>
            ))}
          </div>
          <button className="theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>
      <main className="main">
        <div className="page" key={active.id}>
          <Component />
        </div>
      </main>
    </div>
  )
}
