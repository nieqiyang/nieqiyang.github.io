// Interactive raster viewer: palette rendering, zoom (wheel), pan (drag),
// hover readout with lat/lon, optional cell click, marker overlay, animation frames.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AsciiGrid } from '../core/grid.ts'
import { gridStats } from '../core/grid.ts'
import { ijToLonLat } from '../core/geo.ts'
import { paletteGradientCss, type PaletteName } from './palettes.ts'
import { renderGridImage, displayRange } from './rasterRender.ts'
import { useI18n } from '../i18n/index.tsx'

export interface Marker {
  i: number // 1-based row
  j: number // 1-based col
  label?: string
  color?: string
}

interface Props {
  grid: AsciiGrid
  /** override data for animation frames (same dims as grid) */
  frame?: Float64Array
  palette?: PaletteName
  min?: number
  max?: number
  /** values <= this are transparent (e.g. dry cells) */
  transparentBelow?: number
  categorical?: boolean
  markers?: Marker[]
  onCellClick?: (i: number, j: number, value: number) => void
  height?: number
  /** show value with this many decimals in the readout */
  decimals?: number
}

export function GridCanvas(props: Props) {
  const { grid, frame, palette = 'viridis', markers, onCellClick, height = 420, decimals = 3 } = props
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ scale: 0, ox: 0, oy: 0 }) // scale 0 = fit
  const [hover, setHover] = useState<{ i: number; j: number; v: number } | null>(null)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const data = frame ?? grid.data
  const stats = useMemo(() => displayRange(data, grid.nodata), [data, grid.nodata])

  const vmin = props.min ?? stats.min
  const vmax = props.max ?? (stats.max === vmin ? vmin + 1 : stats.max)

  // base image at grid resolution
  const baseCanvas = useMemo(() => renderGridImage(grid.ncols, grid.nrows, data, {
    palette, vmin, vmax,
    nodata: grid.nodata,
    transparentBelow: props.transparentBelow,
    categorical: props.categorical,
  }), [grid, data, palette, vmin, vmax, props.transparentBelow, props.categorical])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const w = wrap.clientWidth
    const h = height
    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.imageSmoothingEnabled = false

    const fit = Math.min(w / grid.ncols, h / grid.nrows)
    const scale = view.scale === 0 ? fit : view.scale
    const ox = view.scale === 0 ? (w - grid.ncols * fit) / 2 : view.ox
    const oy = view.scale === 0 ? (h - grid.nrows * fit) / 2 : view.oy
    ctx.drawImage(baseCanvas, ox, oy, grid.ncols * scale, grid.nrows * scale)

    if (markers) {
      ctx.font = '11px sans-serif'
      for (const m of markers) {
        const x = ox + (m.j - 0.5) * scale
        const y = oy + (m.i - 0.5) * scale
        ctx.fillStyle = m.color ?? '#e0483b'
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        if (m.label) {
          ctx.fillStyle = '#fff'
          ctx.strokeStyle = 'rgba(0,0,0,0.7)'
          ctx.lineWidth = 3
          ctx.strokeText(m.label, x + 8, y + 4)
          ctx.fillText(m.label, x + 8, y + 4)
        }
      }
    }
  }, [baseCanvas, grid.ncols, grid.nrows, view, height, markers])

  useEffect(() => {
    draw()
    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw])

  const toCell = (e: React.MouseEvent): { i: number; j: number } | null => {
    const wrap = wrapRef.current
    if (!wrap) return null
    const rect = wrap.getBoundingClientRect()
    const w = wrap.clientWidth
    const fit = Math.min(w / grid.ncols, height / grid.nrows)
    const scale = view.scale === 0 ? fit : view.scale
    const ox = view.scale === 0 ? (w - grid.ncols * fit) / 2 : view.ox
    const oy = view.scale === 0 ? (height - grid.nrows * fit) / 2 : view.oy
    const j = Math.floor((e.clientX - rect.left - ox) / scale) + 1
    const i = Math.floor((e.clientY - rect.top - oy) / scale) + 1
    if (i < 1 || j < 1 || i > grid.nrows || j > grid.ncols) return null
    return { i, j }
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const wrap = wrapRef.current!
    const rect = wrap.getBoundingClientRect()
    const w = wrap.clientWidth
    const fit = Math.min(w / grid.ncols, height / grid.nrows)
    const scale = view.scale === 0 ? fit : view.scale
    const ox = view.scale === 0 ? (w - grid.ncols * fit) / 2 : view.ox
    const oy = view.scale === 0 ? (height - grid.nrows * fit) / 2 : view.oy
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.25 : 0.8
    let ns = scale * factor
    if (ns < fit * 0.5) ns = fit * 0.5
    if (ns > fit * 200) ns = fit * 200
    setView({
      scale: ns,
      ox: mx - ((mx - ox) / scale) * ns,
      oy: my - ((my - oy) / scale) * ns,
    })
  }

  const onMouseDown = (e: React.MouseEvent) => {
    const wrap = wrapRef.current!
    const w = wrap.clientWidth
    const fit = Math.min(w / grid.ncols, height / grid.nrows)
    const scale = view.scale === 0 ? fit : view.scale
    const ox = view.scale === 0 ? (w - grid.ncols * fit) / 2 : view.ox
    const oy = view.scale === 0 ? (height - grid.nrows * fit) / 2 : view.oy
    dragRef.current = { x: e.clientX, y: e.clientY, ox, oy }
    if (view.scale === 0) setView({ scale, ox, oy })
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current && e.buttons === 1) {
      const d = dragRef.current
      setView((v) => ({ scale: v.scale, ox: d.ox + e.clientX - d.x, oy: d.oy + e.clientY - d.y }))
    }
    const cell = toCell(e)
    if (cell) {
      const v = data[(cell.i - 1) * grid.ncols + (cell.j - 1)]
      setHover({ i: cell.i, j: cell.j, v })
    } else setHover(null)
  }

  const onMouseUp = (e: React.MouseEvent) => {
    const d = dragRef.current
    dragRef.current = null
    if (d && Math.abs(e.clientX - d.x) < 4 && Math.abs(e.clientY - d.y) < 4 && onCellClick) {
      const cell = toCell(e)
      if (cell) onCellClick(cell.i, cell.j, data[(cell.i - 1) * grid.ncols + (cell.j - 1)])
    }
  }

  const hoverLL = hover ? ijToLonLat(hover.i, hover.j, grid) : null

  return (
    <div className="grid-viewer">
      <div
        ref={wrapRef}
        className="grid-canvas-wrap"
        style={{ height }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { setHover(null); dragRef.current = null }}
        onDoubleClick={() => setView({ scale: 0, ox: 0, oy: 0 })}
        title="wheel: zoom / drag: pan / double-click: reset"
      >
        <canvas ref={canvasRef} />
      </div>
      <div className="grid-statusbar">
        {!props.categorical && (
          <span className="legend">
            <span>{fmt(vmin, decimals)}</span>
            <span className="bar" style={{ background: paletteGradientCss(palette) }} />
            <span>{fmt(vmax, decimals)}</span>
          </span>
        )}
        <span>{grid.ncols}×{grid.nrows}</span>
        {hover && (
          <span>
            (i={hover.i}, j={hover.j}) {hoverLL && `(${hoverLL.lon.toFixed(5)}, ${hoverLL.lat.toFixed(5)})`}
            {' '}{t('common.value')}: <b>{hover.v <= -100 || hover.v === grid.nodata ? 'nodata' : fmt(hover.v, decimals)}</b>
          </span>
        )}
      </div>
    </div>
  )
}

function fmt(v: number, dec: number): string {
  if (!Number.isFinite(v)) return '-'
  if (Math.abs(v) >= 100000) return v.toExponential(2)
  return v.toFixed(dec)
}

export function gridQuickStats(g: AsciiGrid) {
  return gridStats(g)
}
