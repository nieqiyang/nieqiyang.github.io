// Geographic raster viewer: Esri World Imagery basemap (Leaflet) with the model
// grid warped to Web Mercator and draped on top. Falls back to the flat pixel
// canvas for non-geographic (UTM) grids, and offers a flat/satellite toggle.
import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { AsciiGrid } from '../core/grid.ts'
import { GridCanvas, type Marker } from './GridCanvas.tsx'
import { renderGridImage, warpToMercator, isGeographic, displayRange } from './rasterRender.ts'
import { paletteGradientCss, type PaletteName } from './palettes.ts'
import { useI18n } from '../i18n/index.tsx'

const ESRI_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
const ESRI_ATTR = 'Tiles © <a href="https://www.esri.com/">Esri</a> — Source: Esri, Maxar, Earthstar Geographics, GIS User Community'

export interface MapViewProps {
  grid: AsciiGrid
  frame?: Float64Array
  palette?: PaletteName
  min?: number
  max?: number
  transparentBelow?: number
  categorical?: boolean
  markers?: Marker[]
  onCellClick?: (i: number, j: number, value: number) => void
  height?: number
  decimals?: number
}

export function MapView(props: MapViewProps) {
  const { t } = useI18n()
  const geographic = useMemo(() => isGeographic(props.grid), [props.grid])
  const [mode, setMode] = useState<'sat' | 'flat'>(() => {
    if (!geographic) return 'flat'
    const saved = localStorage.getItem('rri.mapmode')
    return saved === 'flat' ? 'flat' : 'sat'
  })
  const [opacity, setOpacity] = useState(() => Number(localStorage.getItem('rri.mapopacity') ?? 0.8))
  const [labels, setLabels] = useState(() => localStorage.getItem('rri.maplabels') !== '0')

  const effMode = geographic ? mode : 'flat'

  return (
    <div>
      <div className="viewer-toolbar" style={{ marginBottom: 6 }}>
        <div className="seg">
          <button
            className={effMode === 'sat' ? 'active' : ''}
            disabled={!geographic}
            title={geographic ? '' : t('map.notGeo')}
            onClick={() => { setMode('sat'); localStorage.setItem('rri.mapmode', 'sat') }}
          >
            🛰 {t('map.basemap')}
          </button>
          <button
            className={effMode === 'flat' ? 'active' : ''}
            onClick={() => { setMode('flat'); localStorage.setItem('rri.mapmode', 'flat') }}
          >
            ▦ {t('map.flat')}
          </button>
        </div>
        {effMode === 'sat' && (
          <>
            <span className="small dim">{t('map.opacity')}</span>
            <input
              type="range" min={0.15} max={1} step={0.05} value={opacity}
              style={{ width: 110 }}
              onChange={(e) => {
                setOpacity(Number(e.target.value))
                localStorage.setItem('rri.mapopacity', e.target.value)
              }}
            />
            <label className="checkbox-row small dim">
              <input type="checkbox" checked={labels}
                onChange={(e) => { setLabels(e.target.checked); localStorage.setItem('rri.maplabels', e.target.checked ? '1' : '0') }} />
              {t('map.labels')}
            </label>
          </>
        )}
      </div>
      {effMode === 'sat'
        ? <LeafletRaster {...props} opacity={opacity} labels={labels} />
        : <GridCanvas {...props} />}
    </div>
  )
}

function LeafletRaster(props: MapViewProps & { opacity: number; labels: boolean }) {
  const { grid, frame, palette = 'viridis', height = 420, decimals = 3 } = props
  const { t } = useI18n()
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const overlayRef = useRef<L.ImageOverlay | null>(null)
  const labelsRef = useRef<L.TileLayer | null>(null)
  const markersRef = useRef<L.LayerGroup | null>(null)
  const boundsKeyRef = useRef('')
  const [hover, setHover] = useState<{ i: number; j: number; v: number; lat: number; lng: number } | null>(null)

  const data = frame ?? grid.data
  const stats = useMemo(() => displayRange(data, grid.nodata), [data, grid.nodata])
  const vmin = props.min ?? stats.min
  const vmax = props.max ?? (stats.max === vmin ? vmin + 1 : stats.max)

  const bounds = useMemo(() => L.latLngBounds(
    [grid.yllcorner, grid.xllcorner],
    [grid.yllcorner + grid.nrows * grid.cellsize, grid.xllcorner + grid.ncols * grid.cellsize],
  ), [grid.xllcorner, grid.yllcorner, grid.ncols, grid.nrows, grid.cellsize])

  // rendered + warped overlay image
  const dataUrl = useMemo(() => {
    const flat = renderGridImage(grid.ncols, grid.nrows, data, {
      palette, vmin, vmax,
      nodata: grid.nodata,
      transparentBelow: props.transparentBelow,
      categorical: props.categorical,
    })
    return warpToMercator(flat, grid).toDataURL()
  }, [grid, data, palette, vmin, vmax, props.transparentBelow, props.categorical])

  // init map once per mount
  useEffect(() => {
    const div = divRef.current!
    const map = L.map(div, {
      zoomControl: true,
      attributionControl: true,
      zoomSnap: 0.5,
      wheelPxPerZoomLevel: 90,
    })
    L.tileLayer(ESRI_IMAGERY, { maxZoom: 19, attribution: ESRI_ATTR }).addTo(map)
    map.fitBounds(bounds.pad(0.06))
    mapRef.current = map

    const toCell = (lat: number, lng: number) => {
      const g = gridRef.current
      const j = Math.floor((lng - g.xllcorner) / g.cellsize) + 1
      const i = g.nrows - Math.floor((lat - g.yllcorner) / g.cellsize)
      if (i < 1 || j < 1 || i > g.nrows || j > g.ncols) return null
      return { i, j }
    }
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const c = toCell(e.latlng.lat, e.latlng.lng)
      if (!c) { setHover(null); return }
      const v = (frameRef.current ?? gridRef.current.data)[(c.i - 1) * gridRef.current.ncols + (c.j - 1)]
      setHover({ ...c, v, lat: e.latlng.lat, lng: e.latlng.lng })
    })
    map.on('mouseout', () => setHover(null))
    map.on('click', (e: L.LeafletMouseEvent) => {
      const cb = clickRef.current
      if (!cb) return
      const c = toCell(e.latlng.lat, e.latlng.lng)
      if (c) cb(c.i, c.j, (frameRef.current ?? gridRef.current.data)[(c.i - 1) * gridRef.current.ncols + (c.j - 1)])
    })

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(div)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      overlayRef.current = null
      labelsRef.current = null
      markersRef.current = null
    }
  }, [])

  // refs so map handlers see the latest props without re-binding
  const gridRef = useRef(grid)
  const frameRef = useRef(frame)
  const clickRef = useRef(props.onCellClick)
  gridRef.current = grid
  frameRef.current = frame
  clickRef.current = props.onCellClick

  // overlay image + bounds
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!overlayRef.current) {
      overlayRef.current = L.imageOverlay(dataUrl, bounds, { opacity: props.opacity, zIndex: 400 }).addTo(map)
    } else {
      overlayRef.current.setUrl(dataUrl)
      const key = bounds.toBBoxString()
      if (key !== boundsKeyRef.current) overlayRef.current.setBounds(bounds)
    }
    const key = bounds.toBBoxString()
    if (key !== boundsKeyRef.current) {
      boundsKeyRef.current = key
      map.fitBounds(bounds.pad(0.06))
    }
  }, [dataUrl, bounds])

  // opacity
  useEffect(() => { overlayRef.current?.setOpacity(props.opacity) }, [props.opacity])

  // reference labels layer
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (props.labels && !labelsRef.current) {
      labelsRef.current = L.tileLayer(ESRI_LABELS, { maxZoom: 19, zIndex: 650 }).addTo(map)
    } else if (!props.labels && labelsRef.current) {
      labelsRef.current.remove()
      labelsRef.current = null
    }
  }, [props.labels])

  // markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current?.remove()
    const group = L.layerGroup()
    const ms = props.markers ?? []
    const permanent = ms.length <= 24
    for (const m of ms) {
      const lat = grid.yllcorner + (grid.nrows - m.i + 0.5) * grid.cellsize
      const lng = grid.xllcorner + (m.j - 0.5) * grid.cellsize
      const cm = L.circleMarker([lat, lng], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: m.color ?? '#e0483b',
        fillOpacity: 1,
      })
      if (m.label) {
        cm.bindTooltip(m.label, { permanent, direction: 'right', offset: [8, 0], className: 'map-label' })
      }
      group.addLayer(cm)
    }
    group.addTo(map)
    markersRef.current = group
  }, [props.markers, grid])

  return (
    <div className="grid-viewer">
      <div ref={divRef} className="map-wrap" style={{ height }} />
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
            (i={hover.i}, j={hover.j}) ({hover.lng.toFixed(5)}, {hover.lat.toFixed(5)})
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
