// Modern replacement for makeKml.f90 + the gnuplot GIF pipeline:
// builds a time-animated KML with PNG ground overlays and packages everything
// into a single KMZ (zip). PNG frames are rendered by the caller (canvas).

export interface KmlParams {
  start: Date // UTC start time
  stepHours: number // lasth / outnum
  north: number
  south: number
  east: number
  west: number
  name?: string
}

function isoUtc(d: Date): string {
  return d.toISOString().slice(0, 16) + 'Z'
}

export function buildKml(frameNames: string[], p: KmlParams): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<kml xmlns="http://www.opengis.net/kml/2.2">')
  lines.push('<Folder>')
  lines.push(`<name>${p.name ?? 'RRI inundation'}</name>`)
  for (let t = 0; t < frameNames.length; t++) {
    const begin = new Date(p.start.getTime() + t * p.stepHours * 3600_000)
    const end = new Date(p.start.getTime() + (t + 1) * p.stepHours * 3600_000)
    lines.push(' <GroundOverlay>')
    lines.push(`  <name>step ${t + 1}</name>`)
    lines.push('  <TimeSpan>')
    lines.push(`   <begin>${isoUtc(begin)}</begin>`)
    lines.push(`   <end>${isoUtc(end)}</end>`)
    lines.push('  </TimeSpan>')
    lines.push('  <Icon>')
    lines.push(`    <href>${frameNames[t]}</href>`)
    lines.push('  </Icon>')
    lines.push('  <LatLonBox>')
    lines.push(`   <north>${p.north.toFixed(6)}</north>`)
    lines.push(`   <south>${p.south.toFixed(6)}</south>`)
    lines.push(`   <east>${p.east.toFixed(6)}</east>`)
    lines.push(`   <west>${p.west.toFixed(6)}</west>`)
    lines.push('  </LatLonBox>')
    lines.push(' </GroundOverlay>')
  }
  lines.push('</Folder>')
  lines.push('</kml>')
  return lines.join('\n')
}

// ---------- minimal ZIP (store method) for KMZ packaging ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

export function buildZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const e of entries) {
    const nameBytes = encoder.encode(e.name)
    const crc = crc32(e.data)
    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true) // version needed
    lv.setUint16(6, 0x0800, true) // UTF-8 names
    lv.setUint16(8, 0, true) // store
    lv.setUint16(10, 0, true) // time
    lv.setUint16(12, 0x21, true) // date (1980-01-01)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, e.data.length, true)
    lv.setUint32(22, e.data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    local.set(nameBytes, 30)
    chunks.push(local, e.data)

    const cen = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cen.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, e.data.length, true)
    cv.setUint32(24, e.data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    cen.set(nameBytes, 46)
    central.push(cen)

    offset += local.length + e.data.length
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  return new Blob([...chunks, ...central, end] as BlobPart[], { type: 'application/vnd.google-earth.kmz' })
}
