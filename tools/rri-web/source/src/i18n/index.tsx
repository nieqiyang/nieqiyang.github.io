import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { M, LANG_INDEX, type Lang } from './translations.ts'

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<I18n>({ lang: 'en', setLang: () => {}, t: (k) => k })

function detectLang(): Lang {
  const saved = localStorage.getItem('rri.lang')
  if (saved === 'en' || saved === 'ja' || saved === 'zh') return saved
  const nav = navigator.language.toLowerCase()
  if (nav.startsWith('ja')) return 'ja'
  if (nav.startsWith('zh')) return 'zh'
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)
  const value = useMemo<I18n>(() => {
    const idx = LANG_INDEX[lang]
    return {
      lang,
      setLang: (l) => {
        localStorage.setItem('rri.lang', l)
        setLangState(l)
      },
      t: (key, vars) => {
        const entry = M[key]
        let s = entry ? entry[idx] : key
        if (vars) {
          for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
        }
        return s
      },
    }
  }, [lang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  return useContext(Ctx)
}
