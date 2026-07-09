// Lightweight SVG line chart with hover readout — used for hydrographs & hyetographs.
import { useMemo, useRef, useState } from 'react'

export interface Series {
  name: string
  color: string
  t: number[]
  v: number[]
  /** draw as bars from zero (hyetograph style) */
  bars?: boolean
}

interface Props {
  series: Series[]
  height?: number
  xLabel?: string
  yLabel?: string
  /** invert y axis (rainfall convention) */
  invertY?: boolean
  xFormatter?: (t: number) => string
}

export function LineChart({ series, height = 280, xLabel, yLabel, invertY, xFormatter }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [width, setWidth] = useState(720)

  // responsive width
  useMemo(() => {
    if (typeof ResizeObserver === 'undefined') return
    setTimeout(() => {
      if (wrapRef.current) setWidth(wrapRef.current.clientWidth)
    })
  }, [])

  const pad = { l: 58, r: 14, t: 10, b: 30 }
  const iw = Math.max(100, width - pad.l - pad.r)
  const ih = height - pad.t - pad.b

  const ext = useMemo(() => {
    let tmin = Infinity, tmax = -Infinity, vmin = Infinity, vmax = -Infinity
    for (const s of series) {
      for (let k = 0; k < s.t.length; k++) {
        if (s.t[k] < tmin) tmin = s.t[k]
        if (s.t[k] > tmax) tmax = s.t[k]
        if (Number.isFinite(s.v[k])) {
          if (s.v[k] < vmin) vmin = s.v[k]
          if (s.v[k] > vmax) vmax = s.v[k]
        }
      }
    }
    if (!Number.isFinite(tmin)) { tmin = 0; tmax = 1; vmin = 0; vmax = 1 }
    if (vmin > 0) vmin = 0
    if (vmax === vmin) vmax = vmin + 1
    return { tmin, tmax: tmax === tmin ? tmin + 1 : tmax, vmin, vmax }
  }, [series])

  const X = (t: number) => pad.l + ((t - ext.tmin) / (ext.tmax - ext.tmin)) * iw
  const Y = (v: number) => {
    const f = (v - ext.vmin) / (ext.vmax - ext.vmin)
    return invertY ? pad.t + f * ih : pad.t + (1 - f) * ih
  }

  const yTicks = useMemo(() => niceTicks(ext.vmin, ext.vmax, 5), [ext])
  const xTicks = useMemo(() => niceTicks(ext.tmin, ext.tmax, 6), [ext])

  const fmtX = xFormatter ?? ((t: number) => (Math.abs(t) >= 3600 && t % 3600 === 0 ? `${t / 3600}h` : String(t)))

  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    setHoverX(e.clientX - rect.left)
  }

  // hover values
  let tip: { x: number; rows: { name: string; color: string; v: number }[]; tv: number } | null = null
  if (hoverX !== null && hoverX >= pad.l && hoverX <= pad.l + iw && series.length > 0) {
    const tv = ext.tmin + ((hoverX - pad.l) / iw) * (ext.tmax - ext.tmin)
    const rows = series.map((s) => {
      // nearest index
      let best = 0
      let bd = Infinity
      for (let k = 0; k < s.t.length; k++) {
        const d = Math.abs(s.t[k] - tv)
        if (d < bd) { bd = d; best = k }
      }
      return { name: s.name, color: s.color, v: s.v[best] }
    })
    tip = { x: hoverX, rows, tv }
  }

  return (
    <div className="chart-wrap" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setHoverX(null)}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* grid + axes */}
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={pad.l} x2={pad.l + iw} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeWidth="1" />
            <text x={pad.l - 6} y={Y(v) + 4} textAnchor="end" fontSize="10.5" fill="var(--text-faint)">
              {fmtNum(v)}
            </text>
          </g>
        ))}
        {xTicks.map((v) => (
          <g key={`x${v}`}>
            <line x1={X(v)} x2={X(v)} y1={pad.t} y2={pad.t + ih} stroke="var(--border)" strokeWidth="0.5" />
            <text x={X(v)} y={height - 12} textAnchor="middle" fontSize="10.5" fill="var(--text-faint)">
              {fmtX(v)}
            </text>
          </g>
        ))}
        <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="none" stroke="var(--border)" />
        {yLabel && (
          <text x={12} y={pad.t + 10} fontSize="10.5" fill="var(--text-dim)">{yLabel}</text>
        )}
        {xLabel && (
          <text x={pad.l + iw} y={height - 2} textAnchor="end" fontSize="10.5" fill="var(--text-dim)">{xLabel}</text>
        )}
        {/* series */}
        {series.map((s, si) => {
          if (s.bars) {
            const bw = Math.max(1, (iw / Math.max(1, s.t.length)) * 0.8)
            return (
              <g key={si}>
                {s.t.map((tt, k) => {
                  const y = Y(s.v[k])
                  const y0 = Y(0)
                  return (
                    <rect
                      key={k}
                      x={X(tt) - bw / 2}
                      y={Math.min(y, y0)}
                      width={bw}
                      height={Math.abs(y - y0)}
                      fill={s.color}
                      opacity="0.75"
                    />
                  )
                })}
              </g>
            )
          }
          const d = s.t.map((tt, k) => `${k === 0 ? 'M' : 'L'}${X(tt).toFixed(1)},${Y(s.v[k]).toFixed(1)}`).join(' ')
          return <path key={si} d={d} fill="none" stroke={s.color} strokeWidth="1.8" />
        })}
        {tip && <line x1={tip.x} x2={tip.x} y1={pad.t} y2={pad.t + ih} stroke="var(--text-faint)" strokeDasharray="3 3" />}
      </svg>
      {/* legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, marginTop: 2 }}>
        {series.map((s, si) => (
          <span key={si} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-dim)' }}>
            <span style={{ width: 14, height: 3, background: s.color, display: 'inline-block', borderRadius: 2 }} />
            {s.name}
          </span>
        ))}
      </div>
      {tip && (
        <div className="chart-tip" style={{ left: Math.min(tip.x + 10, width - 160), top: 8 }}>
          <div>t = {fmtX(tip.tv)}</div>
          {tip.rows.map((r, k) => (
            <div key={k} style={{ color: r.color }}>{r.name}: {fmtNum(r.v)}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min
  if (span <= 0) return [min]
  const step0 = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const norm = step0 / mag
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag
  const start = Math.ceil(min / step) * step
  const out: number[] = []
  for (let v = start; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e9) / 1e9)
  return out
}

function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '-'
  if (Math.abs(v) >= 100000) return v.toExponential(1)
  if (Math.abs(v) >= 100) return v.toFixed(0)
  if (Math.abs(v) >= 1) return v.toFixed(2)
  return v.toFixed(3)
}
