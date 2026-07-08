/* sitenames.js — 站点名称表（Site code / 英名 / 日名），键为 Metadata ID */
/* 自动生成自 station.xlsx；日文界面显示 ja，缺失时回退英名 */
const SITE_NAMES = {
  "A20240722-001": {
    "code": "JP-Ozm",
    "en": "Oizumi Urban Park",
    "ja": "大泉緑地"
  },
  "A20240722-002": {
    "code": "JP-BBY",
    "en": "Bibai bog",
    "ja": "美唄湿原"
  },
  "A20240722-003": {
    "code": "JP-Om1",
    "en": "B11 building in Osaka Metropolitan University",
    "ja": "大阪公立大学 B11ビル"
  },
  "A20240722-004": {
    "code": "JP-Om2",
    "en": "Farm field in Osaka Metropolitan University",
    "ja": "大阪公立大学 農場"
  },
  "A20241022-001": {
    "code": "JP-Api",
    "en": "Appi forest meteorology research site",
    "ja": "安比 森林気象研究サイト"
  },
  "A20241022-002": {
    "code": "JP-Fjy",
    "en": "Fujiyoshida forest meteorology research site",
    "ja": "富士吉田 森林気象研究サイト"
  },
  "A20241022-004": {
    "code": "JP-Kwg",
    "en": "Kawagoe forest meteorology research site",
    "ja": "川越 森林気象研究サイト"
  },
  "A20241022-005": {
    "code": "JP-Kzw",
    "en": "Karuizawa",
    "ja": "軽井沢"
  },
  "A20241022-007": {
    "code": "JP-MBF",
    "en": "Moshiri Birch Forest Site",
    "ja": "母子里 カンバ林サイト"
  },
  "A20241022-008": {
    "code": "JP-MMF",
    "en": "Moshiri Mixd Forest Site",
    "ja": "母子里 混交林サイト"
  },
  "A20241022-009": {
    "code": "JP-Mra",
    "en": "Muramatsu Agricultural Field",
    "ja": "村松 農耕地"
  },
  "A20241022-015": {
    "code": "JP-Sac",
    "en": "Sakai City Office",
    "ja": "堺市役所"
  },
  "A20241022-016": {
    "code": "JP-Sb1",
    "en": "Sarobetsu Mire Moss",
    "ja": "サロベツ湿原（ミズゴケ）"
  },
  "A20241022-017": {
    "code": "JP-Sb2",
    "en": "Sarobetsu Mire Sasa",
    "ja": "サロベツ湿原（ササ）"
  },
  "A20241022-018": {
    "code": "JP-Srk",
    "en": "Shirakami Beech Forest Site",
    "ja": "白神 ブナ林サイト"
  },
  "A20241022-019": {
    "code": "JP-SwL",
    "en": "Suwa Lake Site",
    "ja": "諏訪湖サイト"
  },
  "A20241022-020": {
    "code": "JP-Ta2",
    "en": "Takayama evergreen coniferous forest site",
    "ja": "高山 常緑針葉樹林サイト"
  },
  "A20241022-021": {
    "code": "JP-Tak",
    "en": "Takayama deciduous broadleaf forest site",
    "ja": "高山 落葉広葉樹林サイト"
  },
  "A20241022-022": {
    "code": "JP-Tmk",
    "en": "Tomakomai Flux Research Site",
    "ja": "苫小牧 フラックスリサーチサイト"
  },
  "A20241022-024": {
    "code": "JP-Yms",
    "en": "Yamashiro forest meteorology research site",
    "ja": "山城 森林気象研究サイト"
  },
  "A20241022-025": {
    "code": "JP-Ynf",
    "en": "Yona-Field Tower Site",
    "ja": "与那 フィールドタワーサイト"
  },
  "A20241022-028": {
    "code": "JP-Hc3",
    "en": "Hachihama Experimental Farm: Double Crop",
    "ja": "八浜実験農場：二毛作"
  },
  "A20241022-030": {
    "code": "JP-KaL",
    "en": "Koshin, Lake Kasumigaura",
    "ja": "霞ヶ浦 湖心"
  },
  "A20241022-031": {
    "code": "JP-Nkm",
    "en": "Nishikoma Site",
    "ja": "西駒サイト"
  },
  "A20241022-034": {
    "code": "JP-SMF",
    "en": "Seto Mixed Forest Site",
    "ja": "瀬戸 混交林サイト"
  },
  "A20241022-037": {
    "code": "JP-Hc1",
    "en": "Hachihama Experimental Farm: the International Rice Experiment",
    "ja": "八浜実験農場：国際稲作実験"
  },
  "A20241022-038": {
    "code": "JP-KaP",
    "en": "Kasumigaura lotus paddy",
    "ja": "霞ヶ浦 レンコン田"
  },
  "A20241022-039": {
    "code": "JP-Km1",
    "en": "Kushiro Mire: Onnenai Fen",
    "ja": "釧路湿原：温根内フェン"
  },
  "A20241022-040": {
    "code": "JP-Nsb",
    "en": "NIAES Soybean",
    "ja": "農環研 ダイズ圃場"
  },
  "A20241022-049": {
    "code": "JP-Hc2",
    "en": "Hachihama Experimental Farm",
    "ja": "八浜実験農場"
  },
  "A20241210-001": {
    "code": "JP-Ako",
    "en": "Akou green belt",
    "ja": "赤穂グリーンベルト"
  },
  "A20241210-002": {
    "code": "JP-Fhk",
    "en": "Fuji Hokuroku Flux Observation Site",
    "ja": "富士北麓 フラックス観測サイト"
  },
  "A20241210-003": {
    "code": "JP-Fmt",
    "en": "Field Museum Tama Hills",
    "ja": "多摩丘陵 フィールドミュージアム"
  },
  "A20241210-005": {
    "code": "JP-Khw",
    "en": "Kahoku Experiment watershed",
    "ja": "河北 実験流域"
  },
  "A20241210-007": {
    "code": "JP-Mse",
    "en": "Mase paddy flux site",
    "ja": "真瀬 水田フラックスサイト"
  },
  "A20241210-008": {
    "code": "JP-Nuf",
    "en": "Nagoya University Forest",
    "ja": "名古屋大学 演習林"
  },
  "A20241210-009": {
    "code": "JP-Shn",
    "en": "Shinshu University Experimental Forest Site",
    "ja": "信州大学 演習林サイト"
  },
  "A20241210-010": {
    "code": "JP-Spp",
    "en": "Sapporo forest meteorology research site",
    "ja": "札幌 森林気象研究サイト"
  },
  "A20241210-012": {
    "code": "JP-Tdf",
    "en": "Toyota Deciduous Forest",
    "ja": "豊田 落葉樹林"
  },
  "A20241210-013": {
    "code": "JP-Tgf",
    "en": "Terrestrial Environment Research Center, University of Tsukuba",
    "ja": "筑波大学 陸域環境研究センター"
  },
  "A20241210-014": {
    "code": "JP-Toc",
    "en": "Tomakomai Crane site",
    "ja": "苫小牧 クレーンサイト"
  },
  "A20241210-015": {
    "code": "JP-Tom",
    "en": "Tomakomai Experimental Forest",
    "ja": "苫小牧 実験林"
  },
  "A20241210-016": {
    "code": "JP-Tef",
    "en": "CC-LaG Teshio Experimental Forest",
    "ja": "天塩研究林 CC-LaG"
  },
  "A20241210-018": {
    "code": "JP-Kgu",
    "en": "Kugahara urban residential area",
    "ja": "久が原 都市住宅地"
  },
  "A20241210-019": {
    "code": "JP-Yrp",
    "en": "Yawara Rice paddy",
    "ja": "谷和原 水田"
  },
  "A20241210-020": {
    "code": "JP-Hrt",
    "en": "Hiratsuka Rice Paddy",
    "ja": "平塚 水田"
  },
  "A20241210-022": {
    "code": "JP-Tkb",
    "en": "Tsukuba Experimental Watershed",
    "ja": "筑波 実験流域"
  },
  "A20241210-025": {
    "code": "JP-Nap",
    "en": "Nunoike Agricultural Pond",
    "ja": "布池 農業用ため池"
  },
  "A20241210-026": {
    "code": "JP-Km2",
    "en": "Kushiro Mire: Akanuma Bog",
    "ja": "釧路湿原：赤沼"
  },
  "A20241210-028": {
    "code": "JP-NsM",
    "en": "Nasu Research Station, Manure Application Plot",
    "ja": "那須試験地 堆肥施用区"
  },
  "A20241210-029": {
    "code": "JP-NsC",
    "en": "Nasu Research Station, Chemical Fertilizer Plot",
    "ja": "那須試験地 化学肥料区"
  },
  "A20241210-030": {
    "code": "JP-Tmd",
    "en": "Tomakomai Flux Research Site Disturbed",
    "ja": "苫小牧 フラックスリサーチサイト（撹乱区）"
  }
};
