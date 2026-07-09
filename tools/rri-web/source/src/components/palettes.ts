// Color palettes for raster display. Each palette is a list of [t, r, g, b] stops.
type Stop = [number, number, number, number]

const PALETTES: Record<string, Stop[]> = {
  terrain: [
    [0.0, 46, 122, 70],
    [0.25, 118, 165, 82],
    [0.5, 210, 190, 120],
    [0.75, 160, 110, 70],
    [0.95, 220, 220, 220],
    [1.0, 255, 255, 255],
  ],
  water: [
    [0.0, 225, 240, 252],
    [0.25, 145, 200, 240],
    [0.5, 70, 145, 215],
    [0.75, 30, 85, 170],
    [1.0, 10, 35, 105],
  ],
  viridis: [
    [0.0, 68, 1, 84],
    [0.25, 59, 82, 139],
    [0.5, 33, 145, 140],
    [0.75, 94, 201, 98],
    [1.0, 253, 231, 37],
  ],
  rain: [
    [0.0, 240, 249, 255],
    [0.2, 160, 210, 245],
    [0.4, 60, 160, 230],
    [0.6, 30, 110, 190],
    [0.8, 120, 60, 180],
    [1.0, 220, 30, 90],
  ],
  diff: [
    [0.0, 33, 102, 172],
    [0.5, 247, 247, 247],
    [1.0, 178, 24, 43],
  ],
}

export type PaletteName = keyof typeof PALETTES | 'category'
export const PALETTE_NAMES: PaletteName[] = ['terrain', 'water', 'viridis', 'rain', 'diff', 'category']

// 12 visually distinct categorical colors
const CAT_COLORS: [number, number, number][] = [
  [78, 121, 167], [242, 142, 43], [225, 87, 89], [118, 183, 178],
  [89, 161, 79], [237, 201, 72], [176, 122, 161], [255, 157, 167],
  [156, 117, 95], [186, 176, 172], [59, 162, 114], [212, 166, 106],
]

export function paletteColor(name: PaletteName, t: number): [number, number, number] {
  if (name === 'category') {
    const idx = Math.abs(Math.round(t)) % CAT_COLORS.length
    return CAT_COLORS[idx]
  }
  const stops = PALETTES[name] ?? PALETTES.viridis
  const x = Math.max(0, Math.min(1, t))
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [t0, r0, g0, b0] = stops[i - 1]
      const [t1, r1, g1, b1] = stops[i]
      const f = t1 === t0 ? 0 : (x - t0) / (t1 - t0)
      return [
        Math.round(r0 + (r1 - r0) * f),
        Math.round(g0 + (g1 - g0) * f),
        Math.round(b0 + (b1 - b0) * f),
      ]
    }
  }
  const last = stops[stops.length - 1]
  return [last[1], last[2], last[3]]
}

export function paletteGradientCss(name: PaletteName): string {
  if (name === 'category') {
    const seg = CAT_COLORS.slice(0, 8).map((c, i) =>
      `rgb(${c[0]},${c[1]},${c[2]}) ${(i / 8) * 100}% ${((i + 1) / 8) * 100}%`).join(', ')
    return `linear-gradient(90deg, ${seg})`
  }
  const stops = PALETTES[name] ?? PALETTES.viridis
  const seg = stops.map((s) => `rgb(${s[1]},${s[2]},${s[3]}) ${s[0] * 100}%`).join(', ')
  return `linear-gradient(90deg, ${seg})`
}
