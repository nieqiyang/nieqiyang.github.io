// Port of evalHydro.f90 (Nash-Sutcliffe + RMSE), extended with the modern metric
// set commonly used in hydrology: KGE, PBIAS, R2, peak error, volume error, lag.

export interface HydroMetrics {
  n: number
  nse: number
  rmse: number
  kge: number
  r: number
  pbias: number // %
  peakObs: number
  peakSim: number
  peakErrorPct: number
  peakLagSteps: number
  volObs: number
  volSim: number
  volErrorPct: number
}

export function evalHydro(obs: number[], sim: number[]): HydroMetrics {
  const n = Math.min(obs.length, sim.length)
  const o = obs.slice(0, n)
  const s = sim.slice(0, n)

  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const om = mean(o)
  const sm = mean(s)

  let f = 0, f0 = 0, se = 0
  let cov = 0, vo = 0, vs = 0
  for (let i = 0; i < n; i++) {
    const d = o[i] - s[i]
    f += d * d
    f0 += (o[i] - om) ** 2
    se += d * d
    cov += (o[i] - om) * (s[i] - sm)
    vo += (o[i] - om) ** 2
    vs += (s[i] - sm) ** 2
  }
  const nse = 1 - f / f0
  const rmse = Math.sqrt(se / n)
  const r = cov / Math.sqrt(vo * vs)
  const alpha = Math.sqrt(vs / n) / Math.sqrt(vo / n) // sigma_s / sigma_o
  const beta = sm / om
  const kge = 1 - Math.sqrt((r - 1) ** 2 + (alpha - 1) ** 2 + (beta - 1) ** 2)
  const sumO = o.reduce((x, y) => x + y, 0)
  const sumS = s.reduce((x, y) => x + y, 0)
  const pbias = ((sumS - sumO) / sumO) * 100

  let peakObs = -Infinity, peakSim = -Infinity, iObs = 0, iSim = 0
  for (let i = 0; i < n; i++) {
    if (o[i] > peakObs) { peakObs = o[i]; iObs = i }
    if (s[i] > peakSim) { peakSim = s[i]; iSim = i }
  }

  return {
    n, nse, rmse, kge, r, pbias,
    peakObs, peakSim,
    peakErrorPct: ((peakSim - peakObs) / peakObs) * 100,
    peakLagSteps: iSim - iObs,
    volObs: sumO, volSim: sumS,
    volErrorPct: ((sumS - sumO) / sumO) * 100,
  }
}
