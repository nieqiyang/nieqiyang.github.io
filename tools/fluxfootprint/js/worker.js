/* worker.js — 在后台线程计算单次半小时足迹，返回经纬度 GeoJSON。
 * 网格范围随该时刻足迹的物理尺度自适应（见 ffp.js），不再依赖站点全局 domain。 */
importScripts('ffp.js');

function metersToLonLat(xe, yn, lat0, lon0) {
  const lat = lat0 + yn / 111320.0;
  const lon = lon0 + xe / (111320.0 * Math.cos(lat0 * Math.PI / 180.0));
  return [lon, lat];
}

self.onmessage = function (e) {
  const { inp, lat0, lon0, reqId } = e.data;
  const grid = FFP.footprintGrid(inp);   // 自适应网格
  if (!grid) {
    self.postMessage({ reqId, ok: false, reason: 'invalid' });
    return;
  }
  const rs = FFP.RS_DEFAULT;
  const levels = FFP.contourLevels(grid, rs);
  const features = [];
  let captured = 0;
  for (let li = 0; li < levels.length; li++) {
    const lv = levels[li];
    captured = lv.captured;
    if (lv.clipped || !(lv.level > 0)) continue;   // 域没能捕获这么多 → 跳过该圈
    const rings = FFP.marchingRings(grid, lv.level);
    if (!rings.length) continue;
    const polys = rings.map(ring => {
      const lonlat = ring.map(([gi, gj]) => {
        const [xe, yn] = FFP.gridToMeters(gi, gj, grid);
        return metersToLonLat(xe, yn, lat0, lon0);
      });
      return [FFP.smoothRing(lonlat, 2)];   // 每个环独立成一个多边形（外环，无洞）
    });
    features.push({
      type: 'Feature',
      properties: { level: Math.round(lv.r * 100) },
      geometry: { type: 'MultiPolygon', coordinates: polys },
    });
  }
  // 统计：峰值格点
  let maxv = -Infinity, mi = 0;
  for (let i = 0; i < grid.f.length; i++) if (grid.f[i] > maxv) { maxv = grid.f[i]; mi = i; }
  const pj = Math.floor(mi / grid.W), pi = mi % grid.W;   // 行=along, 列=cross
  const [pxe, pyn] = FFP.gridToMeters(pi, pj, grid);
  const peakDist = Math.hypot(pxe, pyn);
  const peakBear = ((Math.atan2(pxe, pyn) * 180 / Math.PI) % 360 + 360) % 360;

  self.postMessage({
    reqId, ok: true,
    geojson: { type: 'FeatureCollection', features: features },
    stats: { peak_dist: Math.round(peakDist * 10) / 10, peak_bearing: Math.round(peakBear * 10) / 10,
             captured: captured },
  });
};
