// RRI_Input.txt (RRI_Input_Format_Ver1_4_2) parser / serializer.
// Line layout mirrors RRI_Read.f90 exactly: blank separator lines between blocks,
// numeric lines may carry "# comment" suffixes, path lines are read verbatim.

export interface RriInput {
  version: string
  rainfile: string
  demfile: string
  accfile: string
  dirfile: string
  utm: number
  eightDir: number
  lasth: number
  dt: number
  dtRiv: number
  outnum: number
  xllcornerRain: number
  yllcornerRain: number
  cellsizeRainX: number
  cellsizeRainY: number
  nsRiver: number
  numOfLanduse: number
  dif: number[]
  nsSlope: number[]
  soildepth: number[]
  gammaa: number[]
  ksv: number[]
  faif: number[]
  ka: number[]
  gammam: number[]
  beta: number[]
  ksg: number[]
  gammag: number[]
  kg0: number[]
  fpg: number[]
  rgl: number[]
  rivThresh: number
  widthParamC: number
  widthParamS: number
  depthParamC: number
  depthParamS: number
  heightParam: number
  heightLimitParam: number
  rivfileSwitch: number
  widthfile: string
  depthfile: string
  heightfile: string
  initSloSwitch: number
  initRivSwitch: number
  initGwSwitch: number
  initGamptFfSwitch: number
  initfileSlo: string
  initfileRiv: string
  initfileGw: string
  initfileGamptFf: string
  boundSloWlevSwitch: number
  boundRivWlevSwitch: number
  boundfileSloWlev: string
  boundfileRivWlev: string
  boundSloDiscSwitch: number
  boundRivDiscSwitch: number
  boundfileSloDisc: string
  boundfileRivDisc: string
  landSwitch: number
  landfile: string
  damSwitch: number
  damfile: string
  divSwitch: number
  divfile: string
  evpSwitch: number
  evpfile: string
  xllcornerEvp: number
  yllcornerEvp: number
  cellsizeEvpX: number
  cellsizeEvpY: number
  secLengthSwitch: number
  secLengthFile: string
  secSwitch: number
  secMapFile: string
  secFile: string
  outswitch: number[] // 10 flags: hs hr hg qr qu qv gu gv gampt_ff storage
  outfileHs: string
  outfileHr: string
  outfileHg: string
  outfileQr: string
  outfileQu: string
  outfileQv: string
  outfileGu: string
  outfileGv: string
  outfileGamptFf: string
  outfileStorage: string
  hydroSwitch: number
  locationFile: string
}

const VERSION = 'RRI_Input_Format_Ver1_4_2'

/** Fortran list-directed read: strip comment, parse d0/e notation numbers. */
function nums(line: string, count?: number): number[] {
  const s = line.replace(/[#!].*$/, '').trim()
  const parts = s.split(/[\s,]+/).filter((p) => p !== '')
  const out = parts.map(parseFortranNumber)
  if (count !== undefined) return out.slice(0, count)
  return out
}

export function parseFortranNumber(s: string): number {
  // handles 0.5d0, 1.d-3, 5.556d-7 etc.
  const v = Number(s.replace(/[dD]/, 'e').replace(/e$/, ''))
  return v
}

export function formatFortranNumber(v: number): string {
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return `${v}.d0`
  const s = v.toExponential(6)
  const [mant, exp] = s.split('e')
  const trimmed = mant.replace(/0+$/, '').replace(/\.$/, '.0')
  return `${trimmed}d${Number(exp) >= 0 ? Number(exp) : Number(exp)}`
}

export function parseRriInput(text: string): RriInput {
  const rawLines = text.split(/\r?\n/)
  // Non-empty logical lines in order — RRI_Read skips exactly one line between blocks,
  // but blank-line counting is fragile against hand edits; instead we consume
  // non-blank lines sequentially, which matches every valid file.
  const lines = rawLines.map((l) => l).filter((l) => l.trim() !== '')
  let p = 0
  const next = () => {
    if (p >= lines.length) throw new Error('RRI_Input.txt: unexpected end of file')
    return lines[p++]
  }
  const nextPath = () => next().replace(/[#!].*$/, '').trim()
  const next1 = () => nums(next())[0]

  const version = next().trim()
  if (!version.startsWith('RRI_Input_Format')) {
    throw new Error(`Unsupported control file: first line is "${version}"`)
  }
  const r: Partial<RriInput> = { version }
  r.rainfile = nextPath()
  r.demfile = nextPath()
  r.accfile = nextPath()
  r.dirfile = nextPath()
  r.utm = next1()
  r.eightDir = next1()
  r.lasth = next1()
  r.dt = next1()
  r.dtRiv = next1()
  r.outnum = next1()
  r.xllcornerRain = next1()
  r.yllcornerRain = next1()
  const cs = nums(next(), 2)
  r.cellsizeRainX = cs[0]
  r.cellsizeRainY = cs[1] ?? cs[0]
  r.nsRiver = next1()
  const nl = next1()
  r.numOfLanduse = nl
  const arr = () => {
    const a = nums(next(), nl)
    while (a.length < nl) a.push(a[a.length - 1] ?? 0)
    return a
  }
  r.dif = arr()
  r.nsSlope = arr()
  r.soildepth = arr()
  r.gammaa = arr()
  r.ksv = arr()
  r.faif = arr()
  r.ka = arr()
  r.gammam = arr()
  r.beta = arr()
  r.ksg = arr()
  r.gammag = arr()
  r.kg0 = arr()
  r.fpg = arr()
  r.rgl = arr()
  r.rivThresh = next1()
  r.widthParamC = next1()
  r.widthParamS = next1()
  r.depthParamC = next1()
  r.depthParamS = next1()
  r.heightParam = next1()
  r.heightLimitParam = next1()
  r.rivfileSwitch = next1()
  r.widthfile = nextPath()
  r.depthfile = nextPath()
  r.heightfile = nextPath()
  const initSw = nums(next(), 4)
  r.initSloSwitch = initSw[0]
  r.initRivSwitch = initSw[1]
  r.initGwSwitch = initSw[2]
  r.initGamptFfSwitch = initSw[3]
  r.initfileSlo = nextPath()
  r.initfileRiv = nextPath()
  r.initfileGw = nextPath()
  r.initfileGamptFf = nextPath()
  const bw = nums(next(), 2)
  r.boundSloWlevSwitch = bw[0]
  r.boundRivWlevSwitch = bw[1]
  r.boundfileSloWlev = nextPath()
  r.boundfileRivWlev = nextPath()
  const bd = nums(next(), 2)
  r.boundSloDiscSwitch = bd[0]
  r.boundRivDiscSwitch = bd[1]
  r.boundfileSloDisc = nextPath()
  r.boundfileRivDisc = nextPath()
  r.landSwitch = next1()
  r.landfile = nextPath()
  r.damSwitch = next1()
  r.damfile = nextPath()
  r.divSwitch = next1()
  r.divfile = nextPath()
  r.evpSwitch = next1()
  r.evpfile = nextPath()
  r.xllcornerEvp = next1()
  r.yllcornerEvp = next1()
  const ecs = nums(next(), 2)
  r.cellsizeEvpX = ecs[0]
  r.cellsizeEvpY = ecs[1] ?? ecs[0]
  r.secLengthSwitch = next1()
  r.secLengthFile = nextPath()
  r.secSwitch = next1()
  r.secMapFile = nextPath()
  r.secFile = nextPath()
  r.outswitch = nums(next(), 10)
  while (r.outswitch.length < 10) r.outswitch.push(0)
  r.outfileHs = nextPath()
  r.outfileHr = nextPath()
  r.outfileHg = nextPath()
  r.outfileQr = nextPath()
  r.outfileQu = nextPath()
  r.outfileQv = nextPath()
  r.outfileGu = nextPath()
  r.outfileGv = nextPath()
  r.outfileGamptFf = nextPath()
  r.outfileStorage = nextPath()
  r.hydroSwitch = next1()
  r.locationFile = nextPath()
  return r as RriInput
}

function fmtArr(a: number[], f: (v: number) => string = fmtVal): string {
  return a.map(f).join('  ')
}
function fmtVal(v: number): string {
  if (Number.isInteger(v)) return v % 1 === 0 && Math.abs(v) < 1e7 ? `${v}.000` : String(v)
  if (Math.abs(v) < 0.001 && v !== 0) return v.toExponential(4).replace('e', 'd')
  return String(Math.round(v * 1e7) / 1e7)
}
function fmtInt(v: number): string {
  return String(Math.round(v))
}

export function serializeRriInput(r: RriInput): string {
  const L: string[] = []
  L.push(VERSION)
  L.push('')
  L.push(r.rainfile)
  L.push(r.demfile)
  L.push(r.accfile)
  L.push(r.dirfile)
  L.push('')
  L.push(`${fmtInt(r.utm)}    # utm(1) or latlon(0)`)
  L.push(`${fmtInt(r.eightDir)}    # 4-direction (0), 8-direction(1)`)
  L.push(`${fmtInt(r.lasth)}    # lasth(hour)`)
  L.push(`${fmtInt(r.dt)}    # dt(second)`)
  L.push(`${fmtInt(r.dtRiv)}    # dt_riv`)
  L.push(`${fmtInt(r.outnum)}    # outnum [-]`)
  L.push(`${r.xllcornerRain}   # xllcorner_rain`)
  L.push(`${r.yllcornerRain}    # yllcorner_rain`)
  L.push(`${r.cellsizeRainX} ${r.cellsizeRainY}    # cellsize_rain`)
  L.push('')
  L.push(`${fmtVal(r.nsRiver)}     # ns_river`)
  L.push(`${fmtInt(r.numOfLanduse)}    # num_of_landuse`)
  L.push(`${fmtArr(r.dif, fmtInt)}    # diffusion(1) or kinematic(0)`)
  L.push(`${fmtArr(r.nsSlope)}     # ns_slope`)
  L.push(`${fmtArr(r.soildepth)}     # soildepth`)
  L.push(`${fmtArr(r.gammaa)}     # gammaa`)
  L.push('')
  L.push(`${fmtArr(r.ksv)}     # ksv`)
  L.push(`${fmtArr(r.faif)}     # faif`)
  L.push('')
  L.push(`${fmtArr(r.ka)}     # ka`)
  L.push(`${fmtArr(r.gammam)}     # gammam`)
  L.push(`${fmtArr(r.beta)}     # beta`)
  L.push('')
  L.push(`${fmtArr(r.ksg)}     # kgv (ksg)`)
  L.push(`${fmtArr(r.gammag)}     # gammag`)
  L.push(`${fmtArr(r.kg0)}     # tg (kg0)`)
  L.push(`${fmtArr(r.fpg)}     # fpg`)
  L.push(`${fmtArr(r.rgl)}     # rgl (init_cond_gw)`)
  L.push('')
  L.push(`${fmtVal(r.rivThresh)}      # riv_thresh`)
  L.push(`${fmtVal(r.widthParamC)}      # width_param_c`)
  L.push(`${fmtVal(r.widthParamS)}      # width_param_s`)
  L.push(`${fmtVal(r.depthParamC)}      # depth_param_c`)
  L.push(`${fmtVal(r.depthParamS)}      # depth_param_s`)
  L.push(`${fmtVal(r.heightParam)}      # height_param`)
  L.push(`${fmtVal(r.heightLimitParam)}       # height_limit_param`)
  L.push('')
  L.push(`${fmtInt(r.rivfileSwitch)} `)
  L.push(r.widthfile)
  L.push(r.depthfile)
  L.push(r.heightfile)
  L.push('')
  L.push(`${fmtInt(r.initSloSwitch)}  ${fmtInt(r.initRivSwitch)}  ${fmtInt(r.initGwSwitch)}  ${fmtInt(r.initGamptFfSwitch)}`)
  L.push(r.initfileSlo)
  L.push(r.initfileRiv)
  L.push(r.initfileGw)
  L.push(r.initfileGamptFf)
  L.push('')
  L.push(`${fmtInt(r.boundSloWlevSwitch)}  ${fmtInt(r.boundRivWlevSwitch)}`)
  L.push(r.boundfileSloWlev)
  L.push(r.boundfileRivWlev)
  L.push('')
  L.push(`${fmtInt(r.boundSloDiscSwitch)}  ${fmtInt(r.boundRivDiscSwitch)}`)
  L.push(r.boundfileSloDisc)
  L.push(r.boundfileRivDisc)
  L.push('')
  L.push(`${fmtInt(r.landSwitch)}`)
  L.push(r.landfile)
  L.push('')
  L.push(`${fmtInt(r.damSwitch)}`)
  L.push(r.damfile)
  L.push('')
  L.push(`${fmtInt(r.divSwitch)}`)
  L.push(r.divfile)
  L.push('')
  L.push(`${fmtInt(r.evpSwitch)}`)
  L.push(r.evpfile)
  L.push(`${r.xllcornerEvp}      # xllcorner_evp`)
  L.push(`${r.yllcornerEvp}      # yllcorner_evp`)
  L.push(`${r.cellsizeEvpX}  ${r.cellsizeEvpY}     # cellsize`)
  L.push('')
  L.push(`${fmtInt(r.secLengthSwitch)}`)
  L.push(r.secLengthFile)
  L.push('')
  L.push(`${fmtInt(r.secSwitch)}`)
  L.push(r.secMapFile)
  L.push(r.secFile)
  L.push('')
  L.push(r.outswitch.map(fmtInt).join('  '))
  L.push(r.outfileHs)
  L.push(r.outfileHr)
  L.push(r.outfileHg)
  L.push(r.outfileQr)
  L.push(r.outfileQu)
  L.push(r.outfileQv)
  L.push(r.outfileGu)
  L.push(r.outfileGv)
  L.push(r.outfileGamptFf)
  L.push(r.outfileStorage)
  L.push('')
  L.push(`${fmtInt(r.hydroSwitch)}`)
  L.push(r.locationFile)
  L.push('')
  return L.join('\n')
}

export function defaultRriInput(): RriInput {
  return {
    version: VERSION,
    rainfile: './rain/rain.dat',
    demfile: './topo/adem.txt',
    accfile: './topo/acc.txt',
    dirfile: './topo/adir.txt',
    utm: 0, eightDir: 1, lasth: 360, dt: 600, dtRiv: 60, outnum: 96,
    xllcornerRain: 0, yllcornerRain: 0, cellsizeRainX: 0.00833333, cellsizeRainY: 0.00833333,
    nsRiver: 0.03, numOfLanduse: 1,
    dif: [1], nsSlope: [0.4], soildepth: [1.0], gammaa: [0.475],
    ksv: [0], faif: [0.3163],
    ka: [0], gammam: [0], beta: [8.0],
    ksg: [0], gammag: [0.4], kg0: [0.0005], fpg: [0.03], rgl: [0.5],
    rivThresh: 100, widthParamC: 5.0, widthParamS: 0.35,
    depthParamC: 0.95, depthParamS: 0.2, heightParam: 0, heightLimitParam: 20,
    rivfileSwitch: 0,
    widthfile: './riv/width.txt', depthfile: './riv/depth.txt', heightfile: './riv/height.txt',
    initSloSwitch: 0, initRivSwitch: 0, initGwSwitch: 0, initGamptFfSwitch: 0,
    initfileSlo: './init/hs_init.out', initfileRiv: './init/hr_init.out',
    initfileGw: './init/hg_init.out', initfileGamptFf: './init/gamptff_init.out',
    boundSloWlevSwitch: 0, boundRivWlevSwitch: 0,
    boundfileSloWlev: './bound/hs_bound.txt', boundfileRivWlev: './bound/hr_bound.txt',
    boundSloDiscSwitch: 0, boundRivDiscSwitch: 0,
    boundfileSloDisc: './bound/qs_bound.txt', boundfileRivDisc: './bound/qr_bound.txt',
    landSwitch: 0, landfile: './topo/landuse.txt',
    damSwitch: 0, damfile: './dam.txt',
    divSwitch: 0, divfile: './div.txt',
    evpSwitch: 0, evpfile: './infile/PET.txt',
    xllcornerEvp: 0, yllcornerEvp: 0, cellsizeEvpX: 0.00833333, cellsizeEvpY: 0.00833333,
    secLengthSwitch: 0, secLengthFile: './riv/length.txt',
    secSwitch: 0, secMapFile: './riv/sec_map.txt', secFile: './riv/section/sec_',
    outswitch: [1, 1, 0, 1, 0, 0, 0, 0, 0, 1],
    outfileHs: './out/hs_', outfileHr: './out/hr_', outfileHg: './out/hg_',
    outfileQr: './out/qr_', outfileQu: './out/qu_', outfileQv: './out/qv_',
    outfileGu: './out/gu_', outfileGv: './out/gv_',
    outfileGamptFf: './out/gampt_ff_', outfileStorage: './out/storage.dat',
    hydroSwitch: 1, locationFile: './location.txt',
  }
}
