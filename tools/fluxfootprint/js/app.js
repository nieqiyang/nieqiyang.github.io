/* app.js — 通量塔足迹可视化主逻辑 */
'use strict';

// ---------- 全局状态 ----------
const S = {
  lang: 'zh',
  manifest: null,
  siteMeta: {},        // id -> manifest entry
  site: null,          // 当前站点完整 json
  ts: null,            // 单次模式时间序列 {arr, N, dates}
  mode: 'month',
  idx: 0,
  playing: false,
  timer: null,
  worker: null,
  reqId: 0,
};

// 土地利用配色（chip 与足迹一致体系）
const LU_COLOR = {
  URB:'#b0bec5', WET:'#4dd0e1', GRA:'#aed581', DBF:'#66bb6a', ENF:'#26a69a',
  MF:'#9ccc65', CRO:'#ffd54f', EBF:'#43a047', SAV:'#ffb74d', WSA:'#c0a060',
  OSH:'#bcaaa4', CSH:'#8d9440', BSV:'#a1887f', DNF:'#4db6ac', WAT:'#4fc3f7',
};
// 足迹热力配色（内核亮→外缘暗）
const FP_RAMP = { 10:'#fff7bc',20:'#fee391',30:'#fec44f',40:'#fe9929',
  50:'#ec7014',60:'#cc4c02',70:'#993404',80:'#662506' };
const LEVELS = [80,70,60,50,40,30,20,10];

const T = () => I18N[S.lang];
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// ================= 地图初始化 =================
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_REF = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      sat: { type:'raster', tiles:[ESRI], tileSize:256, attribution:'Esri, Maxar, Earthstar Geographics' },
      ref: { type:'raster', tiles:[ESRI_REF], tileSize:256 },
    },
    layers: [
      { id:'sat', type:'raster', source:'sat' },
      { id:'ref', type:'raster', source:'ref', paint:{ 'raster-opacity':0.55 } },
    ],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  },
  center: [138, 37.5], zoom: 4.4, attributionControl: true,
});
map.addControl(new maplibregl.NavigationControl({ showCompass:true }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth:120, unit:'metric' }), 'bottom-right');

let towerMarker = null;

map.on('load', () => {
  map.addSource('footprint', { type:'geojson', data:emptyFC() });
  map.addLayer({ id:'fp-fill', type:'fill', source:'footprint',
    paint:{ 'fill-color':['get','color'], 'fill-opacity':0.6, 'fill-antialias':true } });
  map.addLayer({ id:'fp-line', type:'line', source:'footprint',
    paint:{ 'line-color':['get','line'], 'line-width':['case',['==',['get','level'],50],1.6,0.7],
      'line-opacity':0.7 } });
  boot();
});

function emptyFC(){ return { type:'FeatureCollection', features:[] }; }

// 带重试的 JSON 拉取（应对首帧并发拥塞导致的偶发失败）
async function fetchJSONRetry(url, tries){
  for (let i=0;i<tries;i++){
    try {
      const r = await fetch(url, { cache:'no-store' });
      if (r.ok) return await r.json();
    } catch(e){}
    await new Promise(res=>setTimeout(res, 250*(i+1)));
  }
  return null;
}

// ================= 启动 =================
async function boot(){
  bindUI();
  setLang(S.lang);
  S.manifest = await fetchJSONRetry('data/manifest.json', 4);
  if (!S.manifest){ toast('manifest 加载失败：请通过本地服务器打开 (启动.bat)'); return; }
  S.manifest.sites.forEach(s => S.siteMeta[s.id] = s);
  buildSiteList();
  addTowerDots();
  // worker
  S.worker = new Worker('js/worker.js');
  S.worker.onmessage = onWorkerMsg;
  applyURLParams();
}

// 深链接：?site=ID&mode=month&lang=zh
function applyURLParams(){
  const q = new URLSearchParams(location.search);
  const lang = q.get('lang'); if (lang && I18N[lang]) setLang(lang);
  const mode = q.get('mode'); if (mode && ['year','quarter','month','inst'].includes(mode)) { S.mode=mode;
    $$('#mode-tabs button').forEach(b=> b.classList.toggle('active', b.dataset.mode===mode)); }
  const bm = q.get('bm'); if (bm && BASEMAPS[bm]) setBasemap(bm);
  const site = q.get('site');
  if (site && S.siteMeta[site]) selectSite(site);
}

// 在总览图上标出所有塔
function addTowerDots(){
  const fc = { type:'FeatureCollection', features: S.manifest.sites.map(s => ({
    type:'Feature', properties:{ id:s.id, color: LU_COLOR[s.land_use]||'#fff' },
    geometry:{ type:'Point', coordinates:[s.lon, s.lat] } })) };
  if (map.getSource('towers')) { map.getSource('towers').setData(fc); return; }
  map.addSource('towers', { type:'geojson', data:fc });
  map.addLayer({ id:'towers', type:'circle', source:'towers', paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],4,3,10,5],
    'circle-color':['get','color'], 'circle-stroke-width':1.5,
    'circle-stroke-color':'rgba(0,0,0,0.6)', 'circle-opacity':0.9 } });
  map.on('click','towers', e => selectSite(e.features[0].properties.id));
  map.on('mouseenter','towers', ()=> map.getCanvas().style.cursor='pointer');
  map.on('mouseleave','towers', ()=> map.getCanvas().style.cursor='');
}

// ================= 站点列表 =================
function buildSiteList(filter=''){
  const list = $('#site-list'); list.innerHTML='';
  const f = filter.trim().toLowerCase();
  S.manifest.sites.forEach(s => {
    const luName = (T().landuse[s.land_use]||s.land_use);
    if (f && !(s.id.toLowerCase().includes(f) || luName.toLowerCase().includes(f)
        || s.land_use.toLowerCase().includes(f))) return;
    const el = document.createElement('div');
    el.className = 'site-item' + (S.site&&S.site.id===s.id?' active':'');
    el.dataset.id = s.id;
    el.innerHTML = `<span class="chip" style="background:${LU_COLOR[s.land_use]||'#fff'}"></span>
      <div class="si-main"><div class="si-id">${s.id.replace('A2024','')}</div>
      <div class="si-sub">${luName}${s.sigmav_source==='parameterized'?' · σv*':''}</div></div>
      <div class="si-zm">${s.zm}m</div>`;
    el.onclick = ()=> selectSite(s.id);
    list.appendChild(el);
  });
}

// ================= 选择站点 =================
async function selectSite(id){
  stopPlay();
  const site = await fetchJSONRetry(`data/${id}.json`, 4);
  if (!site){ toast(T().no_data); return; }
  S.site = site;
  S.ts = null; S.idx = 0;
  $$('.site-item').forEach(e=> e.classList.toggle('active', e.dataset.id===id));
  $('#empty').style.display='none';
  ['#info-card','#metric-card','#rose-card','#legend-card','#bottombar'].forEach(s=>$(s).style.display='');
  updateInfoCard();
  addTowerMarker();
  // 若当前是 inst 模式，先加载时间序列
  if (S.mode==='inst') await ensureTS();
  setupTimeline();
  render();
  fitToSite();
}

function updateInfoCard(){
  const s=S.site, t=T();
  $('#v-land').textContent = (t.landuse[s.land_use]||s.land_use)+` (${s.land_use})`;
  $('#v-zm').textContent = s.zm+' m';
  $('#v-years').textContent = s.year_start+'–'+s.year_end;
  $('#v-n').textContent = s.n_valid.toLocaleString();
  const b=$('#v-sigv');
  if (s.sigmav_source==='measured'){ b.className='badge measured'; b.textContent=t.sigmav_measured; }
  else { b.className='badge param'; b.textContent=t.sigmav_param; }
}

function addTowerMarker(){
  if (towerMarker) towerMarker.remove();
  const el=document.createElement('div');
  el.style.cssText='width:14px;height:14px;border-radius:50%;background:#4dd0e1;'
    +'box-shadow:0 0 0 4px rgba(77,208,225,0.3),0 0 14px rgba(77,208,225,0.8);border:2px solid #fff;';
  towerMarker=new maplibregl.Marker({element:el}).setLngLat([S.site.lon,S.site.lat]).addTo(map);
}

function fitToSite(){
  // 用当前序列中等值线范围最大的一期来定视野（稳定、包含性好）
  let best=null, bestSpan=-1;
  const scan = arr => arr.forEach(e=>{ const bb=bboxOf(e.contours);
    if(bb){ const sp=(bb[1][0]-bb[0][0])*(bb[1][1]-bb[0][1]); if(sp>bestSpan){bestSpan=sp;best=bb;} } });
  if (S.mode!=='inst') scan(currentSeries());
  if (!best && S.site.series) scan(S.site.series.year||[]);
  if (best) map.fitBounds(best, { padding:{top:110,bottom:170,left:330,right:300}, duration:900, maxZoom:17 });
  else map.flyTo({ center:[S.site.lon,S.site.lat], zoom:15, duration:900 });
}

function bboxOf(contours){
  let mnx=180,mny=90,mxx=-180,mxy=-90,any=false;
  contours.forEach(c=> c.ring.forEach(([lo,la])=>{ any=true;
    mnx=Math.min(mnx,lo);mxx=Math.max(mxx,lo);mny=Math.min(mny,la);mxy=Math.max(mxy,la); }));
  return any?[[mnx,mny],[mxx,mxy]]:null;
}

// ================= 时间轴 =================
// 当前模式对应的时间序列（真实日历时段的有序数组）
function currentSeries(){
  if (S.mode==='inst' || !S.site || !S.site.series) return [];
  return S.site.series[S.mode] || [];
}

function setupTimeline(){
  const slider=$('#slider'), ticks=$('#tl-ticks');
  $('#play').style.display='';
  if (S.mode==='inst'){
    const N = S.ts ? S.ts.N : 1;
    slider.min=0; slider.max=Math.max(0,N-1); slider.step=1;
    if (S.idx>N-1) S.idx=0; slider.value=S.idx;
    ticks.innerHTML=''; $('#tl-hint').textContent=T().inst_hint;
  } else {
    const arr=currentSeries();
    slider.min=0; slider.max=Math.max(0,arr.length-1); slider.step=1;
    if (S.idx>arr.length-1) S.idx=0; slider.value=S.idx;
    buildTicks(arr);
    $('#tl-hint').textContent = arr.length ? `${arr[0].t} – ${arr[arr.length-1].t}` : T().no_data;
  }
  updateTLLabel();
}

// 时间轴刻度：稀疏显示年份
function buildTicks(arr){
  const ticks=$('#tl-ticks'); ticks.innerHTML='';
  if (!arr.length) return;
  const yearOf = t => String(t).slice(0,4);
  const N = arr.length, want = Math.min(6, N);
  const seen = new Set();
  for (let k=0;k<want;k++){
    const i = Math.round(k*(N-1)/(want-1||1));
    const sp=document.createElement('span'); sp.textContent=yearOf(arr[i].t);
    ticks.appendChild(sp);
  }
}

function updateTLLabel(){
  const cur=$('#tl-cur');
  if (S.mode==='inst'){ if(S.ts){ cur.textContent=fmtDate(S.ts.dates[S.idx]); } return; }
  const arr=currentSeries();
  cur.textContent = arr[S.idx] ? fmtPeriod(arr[S.idx].t) : '–';
}

// 期键格式化：2015 / 2015-Q3 / 2015-07 -> 本地化显示
function fmtPeriod(t){
  const lang=S.lang;
  if (/^\d{4}$/.test(t)) return lang==='en'? t : t+(lang==='ja'?'年':'年');
  const q=t.match(/^(\d{4})-Q(\d)$/);
  if (q){ return lang==='en'? `${q[1]} Q${q[2]}` : `${q[1]}年 Q${q[2]}`; }
  const m=t.match(/^(\d{4})-(\d{2})$/);
  if (m){ return lang==='en'? `${m[1]}-${m[2]}` : `${m[1]}年${parseInt(m[2])}月`; }
  return t;
}

function fmtDate(d){
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function currentPeriodData(){
  if (S.mode==='inst') return null;
  const arr=currentSeries();
  return arr[S.idx] || null;
}

// ================= 渲染 =================
function render(){
  updateTLLabel();
  if (S.mode==='inst'){ renderInst(); return; }
  const per=currentPeriodData();
  if (!per || !per.contours.length){ map.getSource('footprint').setData(emptyFC()); clearMetrics(); toast(T().no_data); return; }
  const fc={ type:'FeatureCollection', features:[] };
  LEVELS.forEach(lv=>{
    const c=per.contours.find(x=>x.level===lv); if(!c) return;
    fc.features.push(polyFeature(c.ring, lv));
  });
  map.getSource('footprint').setData(fc);
  map.triggerRepaint();
  showMetrics(per.stats, per.n_used||per.n);
  updateRoseTitle();
  drawRose(per.rose);
}

function polyFeature(ring, lv){
  const smooth = FFP.smoothRing(ring.map(p=>[p[0],p[1]]), 2);
  return { type:'Feature', properties:{ level:lv, color:FP_RAMP[lv], line:shade(FP_RAMP[lv]) },
    geometry:{ type:'Polygon', coordinates:[smooth] } };
}
function shade(hex){ // 提亮描边
  const c=hex.replace('#',''); const r=parseInt(c.substr(0,2),16),g=parseInt(c.substr(2,2),16),b=parseInt(c.substr(4,2),16);
  const f=x=>Math.min(255,Math.round(x*1.25+40)); return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ---- 单次模式 ----
async function ensureTS(){
  if (S.ts && S.ts.id===S.site.id) return;
  toast(T().loading);
  const buf=await (await fetch(`data/${S.site.id}.ts.f32`)).arrayBuffer();
  const arr=new Float32Array(buf); const N=arr.length/7;
  const dates=new Array(N);
  for(let i=0;i<N;i++) dates[i]=new Date(arr[i*7]*60000);
  S.ts={ id:S.site.id, arr, N, dates };
}

let instPending=null;
function renderInst(){
  if(!S.ts) return;
  updateRoseTitle();
  drawInstNeedleCurrent();     // 即时更新风向指针（不必等 worker）
  const i=S.idx, a=S.ts.arr;
  const inp={ zm:S.site.zm, umean:a[i*7+1], ustar:a[i*7+2], ol:a[i*7+3],
    sigmav:a[i*7+4], wd:a[i*7+5], h:a[i*7+6] };
  const reqId=++S.reqId;
  S.worker.postMessage({ inp, lat0:S.site.lat, lon0:S.site.lon, reqId });
}
function onWorkerMsg(e){
  const d=e.data; if(d.reqId!==S.reqId) return; // 丢弃过期请求
  if(!d.ok){ map.getSource('footprint').setData(emptyFC()); clearMetrics(); toast(T().no_data); return; }
  // worker 返回按 level 属性；重排叠放顺序
  const feats=[];
  LEVELS.forEach(lv=>{ d.geojson.features.filter(f=>f.properties.level===lv).forEach(f=>{
    f.properties.color=FP_RAMP[lv]; f.properties.line=shade(FP_RAMP[lv]); feats.push(f); }); });
  map.getSource('footprint').setData({ type:'FeatureCollection', features:feats });
  const i=S.idx,a=S.ts.arr;
  showMetrics({ peak_dist:d.stats.peak_dist, peak_bearing:d.stats.peak_bearing, r80_max_dist:null }, 1);
}

// ================= 指标 & 风玫瑰 =================
function showMetrics(stats,nUsed){
  $('#m-peak').innerHTML = stats.peak_dist!=null? `${Math.round(stats.peak_dist)}<small>m</small>`:'–';
  $('#m-bear').innerHTML = stats.peak_bearing!=null? `${Math.round(stats.peak_bearing)}<small>°</small>`:'–';
  $('#m-r80').innerHTML = stats.r80_max_dist!=null? `${Math.round(stats.r80_max_dist)}<small>m</small>`:'–';
  $('#m-nused').textContent = nUsed!=null? (nUsed>1?nUsed.toLocaleString():'1'):'–';
}
function clearMetrics(){ ['#m-peak','#m-bear','#m-r80','#m-nused'].forEach(s=>$(s).textContent='–'); }

function drawRose(rose){
  const cv=$('#rose'), ctx=cv.getContext('2d'); const W=cv.width; ctx.clearRect(0,0,W,W);
  if(!rose){ return; }
  const cx=W/2, cy=W/2, R=W*0.42, ns=rose.nsec;
  const maxTot=Math.max(...rose.freq.map(r=>r[0]+r[1]+r[2]),0.001);
  const binC=['rgba(77,208,225,0.9)','rgba(255,183,77,0.9)','rgba(230,75,53,0.9)'];
  // 网格圈
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
  for(let g=1;g<=3;g++){ ctx.beginPath(); ctx.arc(cx,cy,R*g/3,0,2*Math.PI); ctx.stroke(); }
  ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.font='11px sans-serif'; ctx.textAlign='center';
  ['N','E','S','W'].forEach((d,i)=>{ const a=i*Math.PI/2 - Math.PI/2;
    ctx.fillText(d, cx+Math.cos(a)*(R+12), cy+Math.sin(a)*(R+12)+4); });
  const wsec=(2*Math.PI/ns)*0.72;
  for(let s=0;s<ns;s++){
    const ang=(s/ns)*2*Math.PI - Math.PI/2; // 0=N 顺时针
    let r0=0;
    for(let b=0;b<3;b++){
      const val=rose.freq[s][b]; if(val<=0){continue;}
      const r1=r0+(val/maxTot)*R;
      ctx.beginPath();
      ctx.arc(cx,cy,r1,ang-wsec/2,ang+wsec/2);
      ctx.arc(cx,cy,r0,ang+wsec/2,ang-wsec/2,true);
      ctx.closePath(); ctx.fillStyle=binC[b]; ctx.fill();
      r0=r1;
    }
  }
}

// 风玫瑰 / 风向指示 标题随模式切换
function updateRoseTitle(){
  const h=$('#rose-title'); if(!h) return;
  h.textContent = S.mode==='inst' ? T().wind_dir : T().wind_rose;
}

// 单次半小时：风玫瑰替换为风向指针（该时刻是单条记录，玫瑰图会造成误解）
function drawInstNeedle(wd, ws){
  const cv=$('#rose'), ctx=cv.getContext('2d'), W=cv.width; ctx.clearRect(0,0,W,W);
  const cx=W/2, cy=W/2, R=W*0.40;
  // 外圈 + 内圈
  ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=1;
  [R, R*0.55].forEach(rr=>{ ctx.beginPath(); ctx.arc(cx,cy,rr,0,2*Math.PI); ctx.stroke(); });
  // 每 30° 刻度
  ctx.strokeStyle='rgba(255,255,255,0.10)';
  for(let d=0; d<360; d+=30){ const a=(d-90)*Math.PI/180;
    ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*R*0.9, cy+Math.sin(a)*R*0.9);
    ctx.lineTo(cx+Math.cos(a)*R, cy+Math.sin(a)*R); ctx.stroke(); }
  // 方位标注
  ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='11px sans-serif'; ctx.textAlign='center';
  ['N','E','S','W'].forEach((d,i)=>{ const a=i*Math.PI/2 - Math.PI/2;
    ctx.fillText(d, cx+Math.cos(a)*(R+13), cy+Math.sin(a)*(R+13)+4); });
  if(wd==null || !isFinite(wd)){ return; }
  // 指针指向「风来向」(足迹/源区所在方位) = 气象风向 wd
  const a=(wd-90)*Math.PI/180;
  const tipx=cx+Math.cos(a)*R*0.98, tipy=cy+Math.sin(a)*R*0.98;
  const tailx=cx-Math.cos(a)*R*0.42, taily=cy-Math.sin(a)*R*0.42;
  // 尾迹（淡）
  ctx.strokeStyle='rgba(77,208,225,0.35)'; ctx.lineWidth=3; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(tailx,taily); ctx.stroke();
  // 主轴
  ctx.strokeStyle='#4dd0e1'; ctx.lineWidth=3.5;
  ctx.beginPath(); ctx.moveTo(tailx,taily); ctx.lineTo(tipx,tipy); ctx.stroke();
  // 箭头
  const ah=13, aw=8;
  const bx=cx+Math.cos(a)*(R*0.98-ah), by=cy+Math.sin(a)*(R*0.98-ah);
  const px=-Math.sin(a), py=Math.cos(a);
  ctx.fillStyle='#4dd0e1'; ctx.beginPath();
  ctx.moveTo(tipx,tipy);
  ctx.lineTo(bx+px*aw, by+py*aw);
  ctx.lineTo(bx-px*aw, by-py*aw);
  ctx.closePath(); ctx.fill();
  // 中心点
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx,cy,3,0,2*Math.PI); ctx.fill();
  // 读数：风来向角度 + 风速
  ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='600 14px sans-serif'; ctx.textAlign='center';
  const spd=(ws!=null&&isFinite(ws))? ` · ${ws.toFixed(1)} m/s` : '';
  ctx.fillText(`${T().wind_from} ${Math.round(wd)}°${spd}`, cx, cy+R+28);
}

function drawInstNeedleCurrent(){
  if(!S.ts) return; const i=S.idx, a=S.ts.arr;
  drawInstNeedle(a[i*7+5], a[i*7+1]);
}

// ================= 播放 =================
function togglePlay(){ S.playing?stopPlay():startPlay(); }
function startPlay(){
  const max=+$('#slider').max; if(!(max>0)) return;   // 单帧无需播放
  S.playing=true; setPlayIcon(true);
  const speed=+$('#speed').value; const interval=S.mode==='inst'? (420-speed*45) : (1050-speed*110);
  S.timer=setInterval(()=>{
    const max=+$('#slider').max; S.idx=(S.idx+1)>max?0:S.idx+1;
    $('#slider').value=S.idx; render();
  }, Math.max(60,interval));
}
function stopPlay(){ S.playing=false; setPlayIcon(false); if(S.timer){clearInterval(S.timer);S.timer=null;} }
// 精确单步：上一/下一时间步长
function stepBy(delta){
  stopPlay();
  const max=+$('#slider').max;
  let v=S.idx+delta;
  if(v<0)v=0; if(v>max)v=max;
  if(v===S.idx) return;
  S.idx=v; $('#slider').value=v;
  if(S.mode==='inst') debounceInst(); else render();
}
function setPlayIcon(p){ $('#play-icon').innerHTML = p
  ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>'; }

// ================= UI 绑定 =================
function bindUI(){
  $$('#lang button').forEach(b=> b.onclick=()=>setLang(b.dataset.lang));
  $$('#mode-tabs button').forEach(b=> b.onclick=()=>setMode(b.dataset.mode));
  $('#search').oninput = e=> buildSiteList(e.target.value);
  $('#slider').oninput = e=>{ S.idx=+e.target.value; if(S.mode==='inst') debounceInst(); else render(); };
  $('#play').onclick = togglePlay;
  $('#step-prev').onclick = ()=> stepBy(-1);
  $('#step-next').onclick = ()=> stepBy(1);
  $('#speed').oninput = ()=>{ if(S.playing){ stopPlay(); startPlay(); } };
  $('#info-btn').onclick = ()=> $('#modal-bg').classList.add('show');
  $('#modal-close').onclick = ()=> $('#modal-bg').classList.remove('show');
  $('#modal-bg').onclick = e=>{ if(e.target.id==='modal-bg') $('#modal-bg').classList.remove('show'); };
  // 图例渐变
  const grad=LEVELS.slice().reverse().map(l=>FP_RAMP[l]).join(',');
  $('#legend-grad').style.background=`linear-gradient(90deg,${grad})`;
  // 底图切换
  $$('#basemap-ctrl button').forEach(b=> b.onclick=()=>setBasemap(b.dataset.bm));
}

const BASEMAPS = {
  sat:  { tiles:[ESRI], ref:true },
  dark: { tiles:['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                 'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'], ref:false },
  light:{ tiles:['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                 'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'], ref:false },
};
function setBasemap(bm){
  const cfg=BASEMAPS[bm]; if(!cfg) return;
  $$('#basemap-ctrl button').forEach(b=> b.classList.toggle('active', b.dataset.bm===bm));
  map.getSource('sat').setTiles(cfg.tiles);
  if(map.getLayer('ref')) map.setLayoutProperty('ref','visibility', cfg.ref?'visible':'none');
  map.triggerRepaint();
}

let instTimer=null;
function debounceInst(){ updateTLLabel(); if(instTimer)clearTimeout(instTimer);
  instTimer=setTimeout(renderInst,50); }

async function setMode(m){
  if(m===S.mode) return; stopPlay(); S.mode=m; S.idx=0;
  $$('#mode-tabs button').forEach(b=> b.classList.toggle('active', b.dataset.mode===m));
  if(!S.site) return;
  if(m==='inst') await ensureTS();
  setupTimeline(); render();
}

function setLang(l){
  S.lang=l; document.documentElement.lang=l;
  $$('#lang button').forEach(b=> b.classList.toggle('active', b.dataset.lang===l));
  $$('[data-i18n]').forEach(e=>{ const k=e.getAttribute('data-i18n'); if(T()[k]!=null) e.textContent=T()[k]; });
  $$('[data-i18n-ph]').forEach(e=>{ const k=e.getAttribute('data-i18n-ph'); if(T()[k]!=null) e.placeholder=T()[k]; });
  $('#step-prev').title=T().step_prev; $('#step-next').title=T().step_next; $('#play').title=T().play;
  if(S.manifest) buildSiteList($('#search').value);
  updateRoseTitle();
  if(S.site){ updateInfoCard(); setupTimeline();
    if(S.mode==='inst'){ drawInstNeedleCurrent(); }
    else { const per=currentPeriodData(); if(per) drawRose(per.rose); }
  }
}

// ================= 提示 =================
let toastTimer=null;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  if(toastTimer)clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),1800); }
