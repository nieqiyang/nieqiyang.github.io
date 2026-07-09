# RRI Toolbox 🌊

[中文](#中文) | [日本語](#日本語) | [English](#english)

**🌐 在线使用 / Use online / オンラインで使う： <https://nieqiyang.github.io/tools/rri-web/>**（请使用 Chrome / Edge，无需安装任何软件）

源码在 [`source/`](source/) 目录（不含 node_modules，`npm install` 后即可本地开发）。

---

## 中文

RRI 洪水模型（Rainfall-Runoff-Inundation，ICHARM/PWRI）前后处理工具集的**现代化网页应用**。用结构化表单、地图可视化和交互图表取代原 `etc/` 目录下需要手工编辑 txt 控制文件的 Fortran 工具链。全部计算在浏览器内完成，无需服务器。

### 快速开始

```bash
cd rri-web
npm install
npm run dev        # 打开 http://localhost:5180（请使用 Chrome / Edge）
```

首次使用：点击 **打开项目文件夹**，选择 RRI 项目目录（如 `RRI-CUI/Project/solo30s`）。此后所有工具直接读写该文件夹内的文件。

### 功能对照

| 原 Fortran 工具 | 本应用对应功能 | 说明 |
|---|---|---|
| flowDirection.f90 | 地形 → 流向与汇流 | 现代 priority-flood 算法，洼地/平坦区稳定排水，支持河道种子 |
| demAdjust2.f90 | 地形 → DEM 修正 | 逐格验证与原版输出一致；路径数组扫描替代 goto 重启，快数十倍 |
| scaleUp.f90 | 地形 → 网格粗化 | Masutani (2006) 算法完整移植 |
| makeRiver2/3.f90 | 地形 → 河道几何 | 参数自动从 RRI_Input.txt 预填，实时统计与预览 |
| section.f90 | 地形 → 河道断面 | 断面形状图 + 水深-湿周-水面宽表 |
| rainThiessen.f90 | 降雨 → 雨量站插值 | 泰森多边形（与原版一致）+ 新增 IDW 选项，含缺测回退 |
| rainBasin.f90 | 降雨 → 流域平均雨量 | 过程线/累积/分布图三合一，交互图表 |
| GSMaP calc_area + read_gsmap | 降雨 → 卫星雨量 | 浏览器内直接解码二进制，裁剪窗口自动计算且坐标自洽 |
| calcHydro.f90 | 结果 → 流量过程线 | 多站提取 + 观测叠加 + CSV 导出 |
| calcPeak.f90 | 结果 → 最大淹没深度 | 流式取最大，附淹没面积统计 |
| evalHydro.f90 | 结果 → 模型评估 | NSE/RMSE 之外新增 KGE、PBIAS、峰值/水量误差、峰现滞时 |
| evalPeak.f90 | 结果 → 模型评估（范围） | 拟合指数 ∩/∪ + 四分类空间对比图 |
| calcTc.f90 | 结果 → 汇流时间 | 记忆化 O(n) 替代原 O(n·L) 逐格全程行走 |
| calcZone.f90 | 结果 → 汇流分区 | 排序替代 O(n²) maxloc 循环 |
| makeKml.f90 + gnuplot + hs.plt | 结果 → Google Earth 导出 | 一键输出 KMZ（透明 PNG 帧 + 时间轴），淘汰 gnuplot GIF 流程 |
| coordinate.xlsx | 模拟 → 测站与坐标 | 经纬度 ↔ (loc_i, loc_j) 互转，点图选站生成 location.txt |
| 手工编辑 RRI_Input.txt | 模拟 → 控制文件编辑器 | Ver1_4_2 全部设置的结构化表单，带校验（kv/ka 互斥等），往返兼容 |
| setBound（手册 §8.8） | 模拟 → 边界条件 | 地图选点 + 粘贴表格时序 → 一维边界文件 |
| gnuplot hs.plt 动画 | 结果 → 淹没动画 | out/ 输出直接播放，点击格点看时序 |

### 验证

`npm run test:tools` 用 `RRI-CUI/Project/solo30s` 样例数据对比 Fortran 参考输出（adem/adir、rain.dat、rain_hyeto/cum/dist、sec_000001.txt 等），25 项断言全部通过。

---

## 日本語

RRI モデル（ICHARM/PWRI）の前処理・後処理ツール群（`etc/` の Fortran プログラム）を**モダンな Web アプリ**として再構築したものです。テキスト制御ファイルの手編集を、構造化フォーム・地図表示・対話型グラフに置き換えます。計算はすべてブラウザ内で完結し、サーバは不要です。

### 使い方

```bash
cd rri-web
npm install
npm run dev        # http://localhost:5180 を Chrome / Edge で開く
```

起動後、**プロジェクトフォルダを開く** から RRI プロジェクト（例: `RRI-CUI/Project/solo30s`）を選択してください。以降、各ツールはフォルダ内のファイルを直接読み書きします。

主な機能: 流向・集水面積計算（priority-flood 法）、DEM 補正（demAdjust2 と出力一致を検証済み）、解像度粗化、河道形状生成、横断面処理、ティーセン/IDW 雨量展開、GSMaP 取り込み、RRI_Input.txt 構造化エディタ（検証付き）、座標変換と地点管理、境界条件作成、浸水アニメーション、ハイドログラフ抽出、最大浸水深、モデル評価（NSE/KGE ほか）、到達時間、ゾーン分割、Google Earth（KMZ）出力。UI は日本語・英語・中国語に対応しています。

---

## English

A **modern web app** replacing the RRI model's Fortran pre/post-processing toolchain (the `etc/` folder of RRI-CUI, ICHARM/PWRI). Hand-edited text control files are replaced by structured forms, map visualization and interactive charts. Everything runs in the browser — no server required.

### Quick start

```bash
cd rri-web
npm install
npm run dev        # open http://localhost:5180 in Chrome / Edge
npm run build      # production build to dist/ (serve with `npm run preview`)
npm run test:tools # validation suite against the solo30s sample project
```

Click **Open project folder** and select an RRI project directory (e.g. `RRI-CUI/Project/solo30s`). All tools then read and write files inside it directly via the File System Access API (Chromium browsers only).

### Highlights

- **Faithful ports, validated cell-by-cell** against the Fortran reference outputs shipped with the solo30s sample (demAdjust2, rainThiessen, rainBasin, section — 25 assertions pass).
- **Better algorithms where it matters**: priority-flood flow direction (no pit stalls), memoized flow-path traversal for calcTc/calcZone (O(n) instead of O(n·L)/O(n²)), path-array scans instead of goto-restart walks in demAdjust2.
- **New capabilities**: structured RRI_Input.txt editor with validation, KGE/PBIAS/peak-error metrics, IDW interpolation option, one-click KMZ export with transparent PNG overlays, click-to-pick hydrograph locations, trilingual UI (EN/JA/ZH), dark/light theme.

### Notes

- The RRI solver itself (`0_rri_1_4_2.exe`) is still run from a terminal in the project folder; this app prepares its inputs and analyzes its outputs.
- 3B42RT (TRMM) import is not included as the product has been discontinued; the GSMaP importer covers current satellite rainfall workflows.
