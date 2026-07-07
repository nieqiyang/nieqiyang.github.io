/* =====================================================================
 * ffp.js — Kljun et al. (2015) 单次通量足迹 (FFP) 的 JavaScript 实现
 * 与 Python calc_footprint_FFP_climatology 的单步逻辑逐行对应（umean 分支）。
 * 用于前端「单次半小时」模式：给定一条半小时记录，实时算出足迹网格并提取等值线。
 * 参考: Kljun, N. et al., 2015, Geosci. Model Dev. 8, 3695-3713.
 *
 * 网格策略（关键）：不再使用「对所有时刻一视同仁」的全局固定 D_half，
 * 而是按当前这一时刻足迹的物理尺度**自适应**地确定沿风/侧风范围，并在
 * 与风向对齐的矩形网格上直接计算 f(along, cross)。这样无论足迹是被压扁到
 * 塔基附近的一小片，还是伸展成很长的羽状，都能得到均匀充足的分辨率，
 * 避免「有效格点骤减 → 累积分布跳变 → 等值线在 2-3 格宽区域产生锯齿/断裂/假拓扑」。
 * ===================================================================== */
(function (global) {
  'use strict';

  // 模型常数（与官方一致）
  const A = 1.4524, B = -1.9914, C = 1.4622, D = 0.1359;
  const AC = 2.17, BC = 1.66, CC = 20.0;
  const OLN = 5000.0;   // 中性标度对 L 的限值
  const K = 0.4;        // 冯卡门常数
  const ZL_UNSTABLE = -15.5;  // zm/L 下界（强不稳定，官方阈值）
  const ZL_STABLE = 3.0;      // zm/L 上界（强稳定，超出模型标定范围则剔除）

  // 沿风归一化距离 xstar 的横风积分足迹 f*(xstar)（Kljun 已归一到积分=1）。
  const fstarOf = xs => { const t = xs - D; return t > 0 ? A * Math.pow(t, B) * Math.exp(-C / t) : 0; };

  // 预先一次性求出「横风积分足迹累积到 target 占比」对应的 xstar（与站点无关，只算一次）。
  function xstarForCumulative(target) {
    let x = D + 1e-4, dx = 0.01, cum = 0, last = fstarOf(x);
    while (x < 400) {
      x += dx;
      const cur = fstarOf(x);
      cum += 0.5 * (last + cur) * dx;
      last = cur;
      if (cum >= target) return x;
    }
    return x;
  }
  const XSTAR_FAR = xstarForCumulative(0.92);   // 覆盖约 92% 沿风累积（外加安全余量后 ~ 全部）

  // 侧风标准差标度 sigystar(xstar)
  const sigystarOf = xs => AC * Math.sqrt(BC * xs * xs / (1 + CC * xs));

  /**
   * 在与风向对齐的自适应矩形网格上计算一次足迹密度场 f(along, cross)。
   * inp: { zm, umean, ol, sigmav, ustar, wd(deg), h }
   * opts: { nAlong, nCrossHalf } 分辨率（可选）
   * 返回网格对象（含把 (列=cross, 行=along) 映射回 东/北 米坐标所需的旋转量）。
   */
  function footprintGrid(inp, opts) {
    const zm = inp.zm, umean = inp.umean, ustar = inp.ustar,
          sigmav = inp.sigmav, wd = inp.wd, h = inp.h;
    let ol = inp.ol;
    const zl = zm / ol;

    // 有效性（与官方 check 一致，并补上强稳定一侧的上界）
    if (!(ustar > 0.1) || !(sigmav > 0) || !(umean > 0) || !(h > 10) ||
        !(zm > 0) || zm >= h || zl <= ZL_UNSTABLE || zl > ZL_STABLE) {
      return null;
    }

    const nAlong = (opts && opts.nAlong) || 180;
    const nCrossHalf = (opts && opts.nCrossHalf) || 90;

    const uratio = umean / ustar * K;        // = ln(zm/z0)-psi_f 的等价量
    const oneMinus = 1.0 - zm / h;

    // sig_y 稳定度标度常数
    let olEff = ol;
    if (Math.abs(olEff) > OLN) olEff = -1e6;
    let scale_const = (olEff <= 0)
      ? 1e-5 * Math.pow(Math.abs(zm / olEff), -1) + 0.80
      : 1e-5 * Math.pow(Math.abs(zm / olEff), -1) + 0.55;
    if (scale_const > 1) scale_const = 1.0;
    const sigyFac = zm * sigmav / ustar / scale_const;

    // --- 自适应范围：由本时刻的物理尺度决定 ---
    // 沿风：xstar=XSTAR_FAR 对应的真实距离，乘小余量确保外圈(80%)闭合在域内。
    const alongMax = XSTAR_FAR * zm * uratio / oneMinus * 1.08;
    // 侧风：取域内最宽处(远端)的 sigy，再留 ~3.4σ 以完全包住横向拖尾。
    const sigyFar = sigystarOf(XSTAR_FAR) * sigyFac;
    const crossMax = 3.4 * sigyFar;
    if (!(alongMax > 0) || !(crossMax > 0)) return null;

    const H = nAlong + 1;             // 行数（沿风，从塔基 along=0 到 alongMax）
    const W = 2 * nCrossHalf + 1;     // 列数（侧风，-crossMax..crossMax，中列=风轴）
    const dAlong = alongMax / nAlong;
    const dCross = crossMax / nCrossHalf;
    const alongMin = 0, crossMin = -crossMax;
    const f = new Float64Array(W * H);

    for (let ia = 1; ia < H; ia++) {              // ia=0 行 along=0 恒为 0，跳过
      const along = alongMin + ia * dAlong;
      const xstar = along / zm * oneMinus / uratio;
      if (xstar <= D) continue;
      const fstar = A * Math.pow(xstar - D, B) * Math.exp(-C / (xstar - D));
      const f_ci = fstar / zm * oneMinus / uratio;
      const sigy = sigystarOf(xstar) * sigyFac;
      if (!(sigy > 0)) continue;
      const inv = f_ci / (Math.sqrt(2 * Math.PI) * sigy);
      const denom = 2 * sigy * sigy;
      const rowoff = ia * W;
      for (let ic = 0; ic < W; ic++) {
        const cross = crossMin + ic * dCross;
        const val = inv * Math.exp(-(cross * cross) / denom);
        if (val > 0) f[rowoff + ic] = val;
      }
    }

    const wr = wd * Math.PI / 180.0;
    return {
      f: f, W: W, H: H, dAlong: dAlong, dCross: dCross,
      alongMin: alongMin, crossMin: crossMin,
      sinwd: Math.sin(wr), coswd: Math.cos(wr),
    };
  }

  /**
   * 由密度场求出各 r%（源区占比）对应的等值线阈值。
   * 与官方 get_contour_levels 一致：对 f 降序累积 * dA；并在两侧做线性插值，
   * 取「累积恰为 r」处的精确阈值（比取最近点更稳，避免稀疏格点造成的阈值跳变）。
   * 返回 { r, level, captured(总捕获), clipped }。
   */
  function contourLevels(grid, rs) {
    const f = grid.f, dA = grid.dAlong * grid.dCross;
    const sorted = Float64Array.from(f).sort().reverse();  // 降序
    const cumArr = new Float64Array(sorted.length);
    let cum = 0;
    for (let i = 0; i < sorted.length; i++) { cum += sorted[i] * dA; cumArr[i] = cum; }
    const total = cum;
    const levels = [];
    for (const r of rs) {
      if (r >= total) {                      // 域没能捕获这么多 → 该圈无法闭合，标记跳过
        levels.push({ r: r, level: 0, captured: total, clipped: true });
        continue;
      }
      // 二分找首个 cumArr[i] >= r
      let lo = 0, hi = cumArr.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cumArr[mid] >= r) hi = mid; else lo = mid + 1; }
      let level;
      if (lo === 0) level = sorted[0];
      else {
        const c0 = cumArr[lo - 1], c1 = cumArr[lo];
        const frac = c1 > c0 ? (r - c0) / (c1 - c0) : 0;
        level = sorted[lo - 1] + frac * (sorted[lo] - sorted[lo - 1]);   // 线性插值到精确 r
      }
      levels.push({ r: r, level: level, captured: total, clipped: false });
    }
    return levels;
  }

  /* ---- Marching squares（拓扑精确 + 鞍点消歧版）----
   * 每个交点落在唯一的网格边上，用"边 id"作为端点键，保证段与段精确拼接。
   * 对模糊格(case 5/10)用四角均值判断中心内外，选择正确的连接方式，避免假拓扑。 */
  function marchingRings(grid, level) {
    const W = grid.W, H = grid.H, f = grid.f;
    const interp = (a, b) => { const d = b - a; return Math.abs(d) < 1e-30 ? 0.5 : (level - a) / d; };
    const pt = new Map();        // 边 id -> [col, row] 交点坐标
    const adj = new Map();       // 边 id -> [相邻边 id, ...]
    const link = (e1, e2) => {
      if (!adj.has(e1)) adj.set(e1, []);
      if (!adj.has(e2)) adj.set(e2, []);
      adj.get(e1).push(e2); adj.get(e2).push(e1);
    };
    for (let iy = 0; iy < H - 1; iy++) {
      for (let ix = 0; ix < W - 1; ix++) {
        const tl = f[iy * W + ix], tr = f[iy * W + ix + 1];
        const bl = f[(iy + 1) * W + ix], br = f[(iy + 1) * W + ix + 1];
        let idx = 0;
        if (tl > level) idx |= 8;
        if (tr > level) idx |= 4;
        if (br > level) idx |= 2;
        if (bl > level) idx |= 1;
        if (idx === 0 || idx === 15) continue;
        const eT = 'H' + iy + '_' + ix,       fT = () => pt.set(eT, [ix + interp(tl, tr), iy]);
        const eB = 'H' + (iy + 1) + '_' + ix, fB = () => pt.set(eB, [ix + interp(bl, br), iy + 1]);
        const eL = 'V' + ix + '_' + iy,       fL = () => pt.set(eL, [ix, iy + interp(tl, bl)]);
        const eR = 'V' + (ix + 1) + '_' + iy, fR = () => pt.set(eR, [ix + 1, iy + interp(tr, br)]);
        const conn = (a, fa, b, fb) => { if (!pt.has(a)) fa(); if (!pt.has(b)) fb(); link(a, b); };
        switch (idx) {
          case 1:  conn(eL, fL, eB, fB); break;
          case 2:  conn(eB, fB, eR, fR); break;
          case 3:  conn(eL, fL, eR, fR); break;
          case 4:  conn(eT, fT, eR, fR); break;
          case 6:  conn(eT, fT, eB, fB); break;
          case 7:  conn(eL, fL, eT, fT); break;
          case 8:  conn(eT, fT, eL, fL); break;
          case 9:  conn(eT, fT, eB, fB); break;
          case 11: conn(eT, fT, eR, fR); break;
          case 12: conn(eR, fR, eL, fL); break;
          case 13: conn(eR, fR, eB, fB); break;
          case 14: conn(eB, fB, eL, fL); break;
          case 5: {   // tr,bl 在阈值上：用中心均值消歧
            if ((tl + tr + bl + br) * 0.25 > level) { conn(eL, fL, eT, fT); conn(eB, fB, eR, fR); }
            else { conn(eT, fT, eR, fR); conn(eB, fB, eL, fL); }
            break;
          }
          case 10: {  // tl,br 在阈值上：用中心均值消歧
            if ((tl + tr + bl + br) * 0.25 > level) { conn(eT, fT, eR, fR); conn(eB, fB, eL, fL); }
            else { conn(eL, fL, eT, fT); conn(eB, fB, eR, fR); }
            break;
          }
        }
      }
    }
    // 沿邻接关系追踪闭合环
    const visited = new Set(), rings = [];
    for (const start of adj.keys()) {
      if (visited.has(start)) continue;
      const ring = [];
      let cur = start, prev = null, guard = 0;
      while (cur != null && !visited.has(cur) && guard++ < 1e6) {
        visited.add(cur);
        ring.push(pt.get(cur));
        const nbrs = adj.get(cur) || [];
        let nxt = null;
        for (const nb of nbrs) { if (nb !== prev && !visited.has(nb)) { nxt = nb; break; } }
        prev = cur; cur = nxt;
      }
      if (ring.length >= 3) { ring.push(ring[0]); rings.push(ring); }
    }
    return rings;
  }

  // 网格分数坐标 (列=cross, 行=along) -> (东,北) 米（按风向旋转回地理系）
  function gridToMeters(gi, gj, grid) {
    const cross = grid.crossMin + gi * grid.dCross;
    const along = grid.alongMin + gj * grid.dAlong;
    return [along * grid.sinwd + cross * grid.coswd,
            along * grid.coswd - cross * grid.sinwd];
  }

  /* Chaikin 角切平滑：对闭合环做 corner-cutting，去除粗网格造成的锯齿。 */
  function smoothRing(ring, iterations) {
    if (!ring || ring.length < 4) return ring;
    let pts = ring.slice();
    if (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) {
      pts = pts.slice(0, -1);
    }
    const it = iterations == null ? 2 : iterations;
    for (let s = 0; s < it; s++) {
      const n = pts.length, out = new Array(n * 2);
      for (let k = 0; k < n; k++) {
        const p0 = pts[k], p1 = pts[(k + 1) % n];
        out[2 * k]     = [0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]];
        out[2 * k + 1] = [0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]];
      }
      pts = out;
    }
    pts.push(pts[0].slice());
    return pts;
  }

  global.FFP = {
    footprintGrid: footprintGrid,
    contourLevels: contourLevels,
    marchingRings: marchingRings,
    gridToMeters: gridToMeters,
    smoothRing: smoothRing,
    RS_DEFAULT: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  };
})(typeof self !== 'undefined' ? self : this);
