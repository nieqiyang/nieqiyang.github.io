# 通量塔足迹动态可视化 · Flux Footprint Dynamics

基于 **JapanFlux2024** 数据集的通量塔足迹（FFP）气候态交互可视化网页。
在卫星底图上叠加足迹源区等值线，可按 **逐月 / 逐季 / 全年 / 单次半小时** 观察
足迹随主风向的动态迁移。界面支持 **中文 / English / 日本語**。

---

## 快速开始

1. 双击 **`启动.bat`**（Windows）。它会启动本地服务器并自动打开浏览器。
   - 或手动：在本文件夹内运行 `python -m http.server 8777`，
     然后浏览器打开 <http://localhost:8777/index.html>。
2. 从左侧列表选择一个站点即可查看其足迹。

> 需要联网以加载卫星/地图瓦片（Esri World Imagery、CARTO）。
> 站点数据与地图库（MapLibre GL）已随本文件夹本地打包。

深链接（可分享）示例：
```
index.html?site=A20240722-001&mode=season&lang=en&bm=dark
```
参数：`site`=站点号，`mode`=`month|season|annual|inst`，`lang`=`zh|en|ja`，`bm`=`sat|dark|light`。

---

## 功能

| 模块 | 说明 |
|------|------|
| **时间尺度** | **按真实日历时段的时间序列**（非多年平均）：逐年（2015、2016…）/ 逐季度（2015-Q3…）/ 逐月（2015-07…），可沿时间轴拖动或播放动画观察足迹迁移；单次半小时为浏览器实时计算的瞬时足迹 |
| **足迹等值线** | 源区占比 10%–80% 的嵌套等值面（暖核 → 冷缘），叠加在真实地形上；轮廓经 Chaikin 平滑 |
| **足迹指标** | 峰值距离、峰值方位、80% 最远距离、样本数 |
| **风玫瑰** | 该时段 16 方位 × 3 风速档的风向频率 |
| **底图切换** | 卫星影像 / 暗色 / 浅色 |
| **三语界面** | 中 / EN / 日 即时切换 |

---

## 方法与假设

足迹模型采用 **Kljun et al. (2015)** 二维参数化 FFP：

> Kljun, N., Calanca, P., Rotach, M.W., Schmid, H.P. (2015).
> *A simple two-dimensional parameterisation for Flux Footprint Prediction (FFP).*
> Geosci. Model Dev. 8, 3695–3713. doi:10.5194/gmd-8-3695-2015

关键约定（与需求一致）：

- **使用平均风速 `umean`**（`WS_1_1_1`），不使用粗糙长度 `z0`。
- **观测高度 `zm`** 取 `station.xlsx` 的 *Wind Height*（3D 风速仪高度），**未扣除零平面位移 `d`**（数据缺乏冠层高度）。
- **Obukhov 长度** `L = -(ρ·Cp·Ta·u*³)/(κ·g·H)`，与既有反演脚本一致。
- **边界层高度 `h`** 按稳定度分档参数化：不稳定 `1500 m` / 稳定 `500 m`（数据集无 BLH）。
- **侧向风速标准差 `σv`**：优先用实测 `V_SIGMA_1_1_1`；缺测站点用 `σv ≈ 2·u*` 参数化，界面以徽章标注（`σv 参数化`）。
- **质量筛选**：`u* > 0.1`、风向/风速/σv 有效、`zm/L ≥ -15.5`（模型有效域）。
- 气候态每期最多子采样 1500 条有效记录（对结果几乎无影响，仅为提速）。

足迹以各半小时风向旋转后叠加为气候态；等值线由 (东, 北) 米坐标投影为经纬度，
定位于真实塔位周围。

---

## 数据说明

- 纳入可视化的站点：`station.xlsx` 中同时具备坐标、风速仪高度，且含风向/风速/u\* 的站点（约 42 个）。
  缺风向或 u\* 的站点无法定位足迹，已排除。
- 单站数据文件：
  - `data/<站点>.json` —— `series.{year,quarter,month}` 三个按时间排序的足迹序列，每个时段含等值线 + 指标 + 风玫瑰。
  - `data/<站点>.ts.f32` —— 逐半小时 FFP 输入的紧凑二进制序列（供“单次半小时”模式在浏览器实时计算，字段见 `manifest.json`）。
  - `data/manifest.json` —— 站点索引与元信息。

---

## 目录结构

```
webapp/
├─ 启动.bat              # 一键启动本地服务器
├─ index.html
├─ css/style.css
├─ js/
│  ├─ app.js             # 主逻辑（地图/UI/i18n/动画）
│  ├─ ffp.js             # Kljun 2015 单次足迹（JS 移植，单次模式用）
│  ├─ worker.js          # Web Worker：后台计算瞬时足迹
│  └─ i18n.js            # 中/英/日文案
├─ vendor/maplibre-gl.*  # 本地打包的地图库
├─ data/                 # 生成的足迹数据
└─ pipeline/
   ├─ build_footprints.py               # 数据管线（可重跑）
   └─ calc_footprint_FFP_climatology.py # Kljun 官方气候态实现
```

## 重新生成数据

```bash
cd pipeline
python build_footprints.py    # 需 numpy / pandas / scipy / matplotlib / openpyxl
```
