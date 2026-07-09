// Small shared UI pieces: labeled fields, project file selector, run button, save row.
import { useMemo, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useProject, downloadText, normalizePath } from '../state/project.tsx'

export function Field({ label, unit, children }: { label: ReactNode; unit?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}{unit && <span className="unit">[{unit}]</span>}</label>
      {children}
    </div>
  )
}

export function NumInput({ value, onChange, step, min, max }: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
}) {
  const [text, setText] = useState<string | null>(null)
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text ?? String(value)}
      onChange={(e) => {
        setText(e.target.value)
        const v = Number(e.target.value.replace(/[dD]/, 'e'))
        if (Number.isFinite(v)) onChange(v)
      }}
      onBlur={() => setText(null)}
      step={step}
      min={min}
      max={max}
    />
  )
}

/** dropdown over project files matching a filter, with free-text entry */
export function FileSelect({ value, onChange, filter, placeholder }: {
  value: string
  onChange: (v: string) => void
  filter?: (path: string) => boolean
  placeholder?: string
}) {
  const proj = useProject()
  const options = useMemo(() => {
    const f = filter ?? ((p: string) => /\.(txt|dat|out|asc|csv|data)$/i.test(p))
    return proj.files.filter(f)
  }, [proj.files, filter])
  const norm = normalizePath(value)
  return (
    <div className="file-select-row">
      <select
        value={options.includes(norm) ? norm : ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{norm !== '' && !options.includes(norm) ? norm : (placeholder ?? '—')}</option>
        {options.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
    </div>
  )
}

export function TextInput({ value, onChange, mono, placeholder }: {
  value: string
  onChange: (v: string) => void
  mono?: boolean
  placeholder?: string
}) {
  return (
    <input
      type="text"
      className={mono ? 'mono' : undefined}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function RunButton({ onRun, running, label, disabled }: {
  onRun: () => void
  running: boolean
  label?: string
  disabled?: boolean
}) {
  const { t } = useI18n()
  return (
    <button className="btn" onClick={onRun} disabled={running || disabled}>
      {running && <span className="spin" />}
      {running ? t('common.running') : (label ?? t('common.run'))}
    </button>
  )
}

/** Save-to-project + download pair for a text artifact */
export function SaveRow({ path, content, onSaved }: {
  path: string
  content: () => string
  onSaved?: (path: string) => void
}) {
  const { t } = useI18n()
  const proj = useProject()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button
        className="btn small"
        disabled={busy || !proj.root}
        onClick={async () => {
          setBusy(true)
          try {
            await proj.writeText(path, content())
            await proj.refresh()
            setMsg(t('common.saved', { file: normalizePath(path) }))
            onSaved?.(path)
          } catch (e) {
            setMsg(String(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        {t('common.save')}
      </button>
      <button
        className="btn small secondary"
        onClick={() => downloadText(normalizePath(path).split('/').pop() ?? 'output.txt', content())}
      >
        {t('common.download')}
      </button>
      {msg && <span className="small dim">{msg}</span>}
    </span>
  )
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null
  return <div className="alert error">{error}</div>
}

export function PageHeader({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <>
      <h1 className="page-title"><span>{icon}</span>{title}</h1>
      <p className="page-desc">{desc}</p>
    </>
  )
}

/** run an async task with busy/error state handling */
export function useRunner(): {
  running: boolean
  error: string | null
  run: (fn: () => Promise<void>) => void
  setError: (e: string | null) => void
} {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return {
    running,
    error,
    setError,
    run: (fn) => {
      setRunning(true)
      setError(null)
      // yield a frame so the spinner paints before heavy sync work
      setTimeout(async () => {
        try {
          await fn()
        } catch (e) {
          console.error(e)
          setError(e instanceof Error ? e.message : String(e))
        } finally {
          setRunning(false)
        }
      }, 30)
    },
  }
}
