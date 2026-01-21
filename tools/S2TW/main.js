// PWA化のためにService Workerを登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service_worker.js')
    .then((registration) => {
      console.log(`[Main] ServiceWorker registration finished. Scope:${registration.scope}`);
    })
    .catch((reason) => {
      console.log(`[Main] ServiceWorker registratio failed. Reason:${reason}`);
    });
  });
}

const TYPE_BROWSER = 'browser_';
const TYPE_INAPP = 'inapp_';
const TYPE_SPECIAL = 'special_';
const TYPE_UNKNOWN = 'unknown_';
/**
 * 在可能范围内判定浏览器。
 * （参考）
 * https://zenn.dev/kecy/articles/f51851e42c4243
 * https://qiita.com/nightyknite/items/b2590a69f2e0135756dc
 * @return {string} 判定结果（基本格式为 "type_name"。type 分为独立浏览器（browser）或应用内浏览器（inapp）。name 为浏览器名称。）
 */
function detectBrowser() {
  const ua = window.navigator.userAgent.toLowerCase().trim();

  // 特殊平台
  if (ua.includes('silk')) return TYPE_SPECIAL + 'silk';
  if (ua.includes('aftb')) return TYPE_SPECIAL + 'firetv';
  if (ua.includes('nintendo')) return TYPE_SPECIAL + 'nintendo';
  if (ua.includes('playstation')) return TYPE_SPECIAL + 'playstation';
  if (ua.includes('xbox')) return TYPE_SPECIAL + 'xbox';

  // 各种“独有浏览器”
  if (ua.includes('samsung')) return TYPE_BROWSER + '三星';
  if (ua.includes('ucbrowser')) return TYPE_BROWSER + 'UC浏览器';
  if (ua.includes('qqbrowser')) return TYPE_BROWSER + 'QQ浏览器';
  if (ua.includes('yabrowser')) return TYPE_BROWSER + 'Yandex';
  if (ua.includes('whale')) return TYPE_BROWSER + 'Whale';
  if (ua.includes('puffin')) return TYPE_BROWSER + 'Puffin';
  if (ua.includes('opr')) return TYPE_BROWSER + 'Opera';
  if (ua.includes('coc_coc')) return TYPE_BROWSER + 'Cốc Cốc';

  // 应用内浏览器
  if (ua.includes('yahoo') || ua.includes('yjapp')) return TYPE_INAPP + 'Yahoo';
  if (ua.includes('fban') || ua.includes('fbios')) return TYPE_INAPP + 'Facebook';
  if (ua.includes('instagram')) return TYPE_INAPP + 'Instagram';
  if (ua.includes('line')) return TYPE_INAPP + 'LINE';
  if (ua.includes('cfnetwork')) return TYPE_INAPP + 'iOS app';
  if (ua.includes('dalvik')) return TYPE_INAPP + 'Android app';
  if (ua.includes('wv)')) return TYPE_INAPP + 'Android WebView';

  // 特殊浏览器
  if (ua.includes('crios')) return TYPE_BROWSER + 'Chrome(iOS)';
  if (ua.includes('fxios')) return TYPE_BROWSER + 'Firefox(iOS)';

  // 普通浏览器
  if (ua.includes('trident') || ua.includes('msie')) return TYPE_BROWSER + 'IE';
  if (ua.includes('edge')) return TYPE_BROWSER + 'EdgeHTML';
  if (ua.includes('edg')) return TYPE_BROWSER + 'Edge';
  if (ua.includes('firefox')) return TYPE_BROWSER + 'Firefox';

  // 普通浏览器中，UserAgent 被过度模仿的对象（放在最后判定）
  if (ua.includes('chrome')) return TYPE_BROWSER + 'Chrome';
  if (ua.includes('safari')) return TYPE_BROWSER + 'Safari';

  // 均不符合时
  return TYPE_UNKNOWN + "未知";
}
/**
 * 判定浏览器是否声明支持语音识别。
 * 具体判定 SpeechRecognition 或 webkitSpeechRecognition 对象是否存在。
 * @returns {boolean} 如果浏览器声明支持语音识别则返回 true
 */
function is_speech_recognition_supported() {
  return window.SpeechRecognition || window.webkitSpeechRecognition != null;
}

const browser = detectBrowser();
const is_inapp = (browser.indexOf(TYPE_INAPP) == 0);
const isnot_supported = (is_speech_recognition_supported() != true);
console.log(`检测到的浏览器 : ${browser} / 语音识别不支持状态 : ${isnot_supported}`);

if (is_inapp || isnot_supported) {
  const errorMessage = '请使用 Google Chrome 或 Microsoft Edge 等支持语音识别的浏览器进行访问。';
  alert(errorMessage);
  document.getElementById('status').innerHTML = errorMessage;
  document.getElementById('status').className = "error";
} else if (browser.indexOf('Safari') > 0) {
  alert('Safari 在语音识别中容易出现问题，建议使用 Google Chrome。');
}

// Web 摄像头
// 参考: https://qiita.com/qiita_mona/items/e58943cf74c40678050a
// 当无法使用 getUserMedia 时
if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
  const err = new Error('无法使用 getUserMedia()');
  alert(`${err.name} ${err.message}`);
  // throw err;
}

const $video = document.getElementById('result_video'); // 视频显示区域

// 清空 select 元素的 option 选项
function clearSelect(select) {
  while (select.firstChild) {
    select.removeChild(select.firstChild);
  }
}

// 如果 select 元素的 option 中存在 option.value 等于 value 的项目，则选中它
// 返回值：如果 option 中存在对应项目则返回 true
function selectValueIfExists(select, value) {
  if (value === null || value === undefined) return;
  var result = false;
  select.childNodes.forEach(n => {
    if (n.value === value) {
      select.value = value;
      result = true;
    }
  })
  return result;
}

// 枚举摄像头并将其设置为 select_camera 对象的 option 选项
// 参考：https://github.com/webrtc/samples/blob/gh-pages/src/content/devices/input-output/js/main.js
// deviceInfos : MediaDeviceInfo[]
// 前提：参数是 MediaDevices.enumerateDevices() 返回的 Promise 的解析内容
// 参考：https://developer.mozilla.org/ja/docs/Web/API/MediaDevices/enumerateDevices
function updateCameraSelector(deviceInfos) {
  // 记住当前选中的项目，以便最后重新选中
  const selectedDevice = select_camera.value;
  // 清空现有选项
  clearSelect(select_camera);
  // 在媒体设备列表中，将 videoinput（视频输入）作为 option 元素添加到 select 中
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    if (deviceInfo.kind === 'videoinput') {
      const option = document.createElement('option');
      option.value = deviceInfo.deviceId;
      option.text = deviceInfos[i].label || `摄像头 ${select_camera.length + 1}`;
      select_camera.appendChild(option);
    }
  }
  // 如果原本有选中的项目，则重新选中该项目
  selectValueIfExists(select_camera, selectedDevice);
}

// 将 stream 设置到 video 元素上，并返回媒体（摄像头、麦克风）列表
// 参考：https://github.com/webrtc/samples/blob/gh-pages/src/content/devices/input-output/js/main.js
function handleStream(stream) {
  window.stream = stream;
  $video.srcObject = stream;
  return navigator.mediaDevices.enumerateDevices();
}

// 根据配置显示摄像头画面
// isInit : 仅在没有摄像头选项时为 true，其他情况（切换选项或从保存的配置恢复时）不需要
// 参考：https://github.com/webrtc/samples/blob/gh-pages/src/content/devices/input-output/js/main.js
function setupCamera(isInit) {
  if (window.stream) {
    window.stream.getTracks().forEach(track => {
      track.stop();
    });
  }
  const videoSource = select_camera.value;
  const constraints = {
    video: {
      aspectRatio: {
        ideal: 1.7777777778
      },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  };
  if (isInit !== true) {
    constraints.video["deviceId"] = videoSource ? {
      exact: videoSource
    } : undefined;
  }
  navigator.mediaDevices.getUserMedia(constraints)
    .then(handleStream)
    .then(updateCameraSelector)
    .catch(onCameraError);
}

// 摄像头首次启动
function initCamera() {
  // 从本地存储中读取配置，如果没有则默认为空对象
  const conf = JSON.parse(localStorage.speech_to_text_config || '{}');
  var camera_selected = false;
  
  // 检查配置中是否存在已保存的摄像头设备 ID
  if (typeof conf.select_camera !== 'undefined') {
    // 如果保存的摄像头选项存在于当前的 select 选项列表中，则启动该选中的摄像头
    if (selectValueIfExists(select_camera, conf.select_camera)) {
      camera_selected = true;
      setupCamera();
    }
  }
  
  // 如果没有预设的摄像头设置，则使用默认摄像头启动
  if (!camera_selected) {
    setupCamera(true); // 参数 true 表示选择默认摄像头
  }
}

// 摄像头错误回调函数
function onCameraError(err) {
  // 在控制台打印错误名称和详细信息
  console.log(`摄像头相关问题：${err.name} / ${err.message}`)
  // 弹出警告提示用户
  alert(`无法读取摄像头画面。请检查浏览器的访问权限等设置`);
  // 显示错误帮助提示区域
  document.getElementById('help_on_error').style.display = 'block';
}

// 生成摄像头选项列表
// 流程：列举设备 -> 更新下拉选单 -> 执行初始化启动 -> 捕获异常
navigator.mediaDevices.enumerateDevices()
  .then(updateCameraSelector)
  .then(initCamera)
  .catch(onCameraError);


// 语音识别
// 参考: https://jellyware.jp/kurage/iot/webspeechapi.html
var flag_speech = 0;
var recognition;
var lang = 'ja-JP';
var last_finished = ''; // 最后确定的文本。为了防止确定部分瞬间消失而在此定义。
var textUpdateTimeoutID = 0;
var textUpdateTimeoutSecond = 30; // 语音识别结果未更新时，直到清空结果的秒数（0 或以下则不自动清空）

function vr_function() {
  // 兼容性处理：支持标准 API 或 webkit 前缀 API
  window.SpeechRecognition = window.SpeechRecognition || webkitSpeechRecognition;
  recognition = new webkitSpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = true; // 是否显示临时结果
  recognition.continuous = true;     // 是否持续识别

  // 开始检测到声音时
  recognition.onsoundstart = function() {
    document.getElementById('status').innerHTML = "正在识别...";
    document.getElementById('status').className = "processing";
  };
  // 无法匹配任何语音时
  recognition.onnomatch = function() {
    document.getElementById('status').innerHTML = "无法识别语音";
    document.getElementById('status').className = "error";
  };
  // 发生错误时
  recognition.onerror = function() {
    document.getElementById('status').innerHTML = "发生错误";
    document.getElementById('status').className = "error";
    if (flag_speech == 0)
      vr_function(); // 尝试重启识别
  };
  // 声音检测结束时
  recognition.onsoundend = function() {
    document.getElementById('status').innerHTML = "已停止";
    document.getElementById('status').className = "error";
    vr_function(); // 重启识别以保持持续运行
  };

  // 获得识别结果时
  recognition.onresult = function(event) {
    var results = event.results;
    var current_transcripts = ''; // 若有多个结果则进行拼接
    var need_reset = false;
    
    for (var i = event.resultIndex; i < results.length; i++) {
      if (results[i].isFinal) {
        // --- 确定部分的处理 ---
        last_finished = results[i][0].transcript;
        // 自动添加句号（日语习惯）
        const is_end_of_sentence = last_finished.endsWith('。') || last_finished.endsWith('？') || last_finished.endsWith('！');
        if (lang == 'ja-JP' && is_end_of_sentence != true) {
          last_finished += '。';
        }

        var result_log = last_finished

        // 检查是否开启了时间戳功能
        if (document.getElementById('checkbox_timestamp').checked) {
          var now = new window.Date();
          var Year = now.getFullYear();
          var Month = (("0" + (now.getMonth() + 1)).slice(-2));
          var Date = ("0" + now.getDate()).slice(-2);
          var Hour = ("0" + now.getHours()).slice(-2);
          var Min = ("0" + now.getMinutes()).slice(-2);
          var Sec = ("0" + now.getSeconds()).slice(-2);

          var timestamp = Year + '-' + Month + '-' + Date + ' ' + Hour + ':' + Min + ':' + Sec + '\t'
          result_log = timestamp + result_log
        }

        // 将确定的结果插入到日志区域
        document.getElementById('result_log').insertAdjacentHTML('beforeend', result_log + '\n');
        textAreaHeightSet(document.getElementById('result_log')); // 调整文本域高度
        need_reset = true;
        setTimeoutForClearText(); // 设置自动清空定时器
        flag_speech = 0;
      } else {
        // --- 正在识别中的处理 ---
        current_transcripts += results[i][0].transcript;
        clearTimeoutForClearText(); // 正在说话时取消清空定时器
        flag_speech = 1;
      }
    }

    // 更新界面显示的文字
    document.getElementById('result_text').innerHTML 
      = [last_finished, current_transcripts].join('<br>');
  
    setTimeoutForClearText();

    if (need_reset) { vr_function(); } // 确定一段话后重启以优化性能
  }

  flag_speech = 0;
  document.getElementById('status').innerHTML = "待机中";
  document.getElementById('status').className = "ready";
  recognition.start();
}

// 更新自动清空所需的秒数
function updateTextClearSecond() {
  const sec = Number(document.getElementById('select_autoclear_text').value);
  if ((!isNaN(sec)) && isFinite(sec) && (sec >= 0)) {
    textUpdateTimeoutSecond = sec;
  }
}

// 取消自动清空的定时器
function clearTimeoutForClearText() {
  if (textUpdateTimeoutID !== 0) {
    clearTimeout(textUpdateTimeoutID);
    textUpdateTimeoutID = 0;
  }
}

// 根据变量 textUpdateTimeoutSecond 设置定时器。
// 定时器超时后，自动清除字幕。
// 如果变量值小于或等于 0，则不设置定时器。
// 如果定时器已在运行，则用新的处理时机覆盖旧的。
function setTimeoutForClearText() {
  if (textUpdateTimeoutSecond <= 0) return;

  clearTimeoutForClearText();
  textUpdateTimeoutID = setTimeout(
    () => {
      document.getElementById('result_text').innerHTML = "";
      last_finished = ''; // 同时清除上次的确定结果。
      textUpdateTimeoutID = 0;
    },
    textUpdateTimeoutSecond * 1000);
}

// 自动调整识别结果日志 textarea（文本域）的高度
// 参考: https://webparts.cman.jp/input/textarea/
function textAreaHeightSet(argObj) {
  // 先将文本域缩小，以获取滚动条高度（即内容实际高度）
  argObj.style.height = "10px";
  var wSclollHeight = parseInt(argObj.scrollHeight);
  // 获取单行文本的高度
  var wLineH = parseInt(argObj.style.lineHeight.replace(/px/, ''));
  // 确保显示区域至少保留 2 行的高度
  if (wSclollHeight < (wLineH * 2)) {
    wSclollHeight = (wLineH * 2);
  }
  // 设置文本域的最终高度
  argObj.style.height = wSclollHeight + "px";
}

// 手动停止识别（用于强制分句）
document.addEventListener('keydown',
  event => {
    if (event.key === 'Enter') {
      if (flag_speech == 1) {
        recognition.stop();
      }
    }
  });

// 下载识别结果的日志文件
// 参考: https://qiita.com/kerupani129/items/99fd7a768538fcd33420
function downloadLogFile() {
  const a = document.createElement('a');
  a.href = 'data:text/plain,' + encodeURIComponent(document.getElementById('result_log').value);

  var now = new window.Date();
  var Year = now.getFullYear();
  var Month = (("0" + (now.getMonth() + 1)).slice(-2));
  var Date = ("0" + now.getDate()).slice(-2);
  var Hour = ("0" + now.getHours()).slice(-2);
  var Min = ("0" + now.getMinutes()).slice(-2);
  var Sec = ("0" + now.getSeconds()).slice(-2);

  // 文件名格式为：log_YYYYMMDD_HHMMSS.txt
  a.download = 'log_' + Year + Month + Date + '_' + Hour + Min + Sec + '.txt';

  a.click();
}

// 参考: https://blog.katsubemakito.net/html5/fullscreen
/**
 * 设置进入/退出全屏时的事件监听
 *
 * @param {function} callback 
 */
function eventFullScreen(callback) {
  document.addEventListener("fullscreenchange", callback, false);
  document.addEventListener("webkitfullscreenchange", callback, false);
  document.addEventListener("mozfullscreenchange", callback, false);
  document.addEventListener("MSFullscreenChange", callback, false);
}

/**
 * 检查当前浏览器是否支持全屏模式
 *
 * @return {boolean}
 */
function enabledFullScreen() {
  return (
    document.fullscreenEnabled || document.mozFullScreenEnabled || document.documentElement.webkitRequestFullScreen || document.msFullscreenEnabled
  );
}

/**
 * 开启全屏
 *
 * @param {object} [element] 要全屏显示的元素（默认为整个页面）
 */
function goFullScreen(element = null) {
  const doc = window.document;
  const docEl = (element === null) ? doc.documentElement : element;
  let requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
  requestFullScreen.call(docEl);
}

/**
 * 退出全屏
 */
function cancelFullScreen() {
  const doc = window.document;
  const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
  cancelFullScreen.call(doc);
}

/**
 * 获取当前正处于全屏状态的元素对象
 */
function getFullScreenObject() {
  const doc = window.document;
  const objFullScreen = doc.fullscreenElement || doc.mozFullScreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;
  return (objFullScreen);
}

const FullScreenBtn = document.querySelector("#FullScreenBtn"); // 全屏化按钮

const objResultText = document.querySelector("#result_text");
var font_size_windowed = parseFloat(getComputedStyle(objResultText).getPropertyValue('font-size'));
var flag_font_size_styled = 0; // 标记是否手动设置了字体大小

window.onload = () => {
  vr_function();
  const video_doc = document.querySelector("#video_wrapper"); // 需要全屏显示的对象

  //--------------------------------
  // [事件] 点击全屏按钮
  //--------------------------------
  FullScreenBtn.addEventListener("click", () => {
    if (getFullScreenObject()) {
      // 如果当前是全屏，则解除全屏
      cancelFullScreen(video_doc);
    } else {
      // 如果当前不是全屏，则开始全屏
      if (!enabledFullScreen()) {
        alert("您的浏览器不支持全屏功能");
        return (false);
      }
      goFullScreen(video_doc);
    }
  });

  //--------------------------------
  // 全屏状态改变事件
  //--------------------------------
  eventFullScreen(() => {
    // 切换按钮状态或执行缩放计算
    if (getFullScreenObject()) {
      // 进入全屏时：维持文字与画面的比例
      const ratio = window.parent.screen.height / document.querySelector("#result_video").clientHeight
      font_size_windowed = parseFloat(getComputedStyle(objResultText).getPropertyValue('font-size'));
      
      if (objResultText.style.fontSize) {
        // 记录用户是否通过滑动条手动指定了字体大小
        flag_font_size_styled = 1;
        font_size_windowed = parseFloat(getComputedStyle(objResultText).fontSize);
      }
      
      // 根据屏幕比例放大字体
      document.querySelector('#result_text').style.fontSize = parseFloat(getComputedStyle(objResultText).getPropertyValue('font-size')) * ratio + 'px';
      console.log("全屏开始");

    } else {
      // 退出全屏回到普通窗口时：恢复原始文字比例
      if (flag_font_size_styled) {
        // 如果之前手动设置过，则恢复到设置的大小
        document.querySelector('#result_text').style.fontSize = document.querySelector("#value_font_size").textContent + 'px';
      } else {
        // 如果没有手动设置（使用的是默认值），则清除内联样式以应用 CSS 默认规则
        // 目的是为了利用分屏显示时的默认 CSS 配置
        document.querySelector('#result_text').style.fontSize = '';
      }
      console.log("全屏结束");
    }
  });

  initConfig();
};

// 言語切替
// 参考: https://www.google.com/intl/ja/chrome/demos/speech.html
var langs = [
  ['中文', ['cmn-Hans-CN', '普通话']],
  ['Japanese', ['ja-JP']],
  ['English', ['en-US', 'United States'],
    ['en-GB', 'United Kingdom'],
  ],
  
];

for (var i = 0; i < langs.length; i++) {
  select_language.options[i] = new Option(langs[i][0], i);
}

// 设置默认语言
select_language.selectedIndex = 0;
updateCountry();
select_dialect.selectedIndex = 0;

// 更新国家/地区（方言）列表
function updateCountry() {
  // 清空现有的方言选项
  for (var i = select_dialect.options.length - 1; i >= 0; i--) {
    select_dialect.remove(i);
  }
  // 从 langs 数组中获取当前语言对应的方言列表
  var list = langs[select_language.selectedIndex];
  for (var i = 1; i < list.length; i++) {
    select_dialect.options.add(new Option(list[i][1], list[i][0]));
  }
  // 如果该语言下只有一个选项（没有区分方言），则隐藏下拉框
  select_dialect.style.display = list[1].length == 1 ? 'none' : 'inline';
  updateLanguage()
}

// 更新识别引擎的语言设置
function updateLanguage() {
  var flag_recognition_stopped = 0;
  // 如果识别引擎正在运行，先停止它
  if (recognition) {
    recognition.stop();
    flag_recognition_stopped = 1;
  }
  // 更新当前的语言代码
  lang = select_dialect.value;
  // 如果之前是运行状态，则重新启动引擎以应用新语言
  if (flag_recognition_stopped) {
    vr_function();
  }


// 添加结果翻译功能（集成 Google 翻译挂件）
// 参考: https://pisuke-code.com/js-usage-of-google-trans-api/
function googleTranslateElementInit() {
  new google.translate.TranslateElement({
    layout: google.translate.TranslateElement.InlineLayout.SIMPLE
  }, 'google_translate_element');
}

// 字体切换配置
// 参考: https://www.google.com/intl/ja/chrome/demos/speech.html
var fonts_custom = [
  ['黑体（浏览器默认）', "sans-serif", 'normal'],
  ['Noto Sans JP', "'Noto Sans JP', sans-serif", '500'],
  ['BIZ UDP Gothic', "'BIZ UDPゴシック', 'BIZ UDPGothic', 'Noto Sans JP', sans-serif", '700'],
  ['BIZ UDP Mincho', "'BIZ UDP明朝', 'BIZ UDPMincho', 'Noto Sans JP', serif", '400'],
  ['游黑体 (Yu Gothic)', "游ゴシック体, 'Yu Gothic', YuGothic, sans-serif", 'bold'],
  ['微软雅黑/Meiryo', "'メイリオ', 'Meiryo', 'Noto Sans JP', sans-serif", 'bold'],
];

// 将字体列表填充到 select 选项中
for (var i = 0; i < fonts_custom.length; i++) {
  select_font.options[i] = new Option(fonts_custom[i][0], i);
}

// 设置默认选中的字体
select_font.selectedIndex = 0;

// 初期設定
const config = JSON.parse(localStorage.speech_to_text_config || '{}');

function initConfig() {
  function triggerEvent(type, elem) {
    const ev = document.createEvent('HTMLEvents');
    ev.initEvent(type, true, true);
    elem.dispatchEvent(ev);
  }
  ['slider_font_size',
    'slider_opacity',
    'slider_text_shadow_stroke',
    'slider_text_stroke',
    'slider_line_height',
    'slider_letter_spacing',
    'selector_text_color',
    'selector_text_shadow_color',
    'selector_text_stroke_color',
    'slider_text_bg_opacity',
    'selector_text_bg_color',
    'selector_video_bg',
  ].forEach(id => {
    if (typeof config[id] !== 'undefined') {
      const el = document.getElementById(id);
      el.value = config[id];
      triggerEvent('input', el);
    }
  });
  ['video_bg',
    'result_video',
    'text_overlay_wrapper',
    'FullScreenBtn'
  ].forEach(id => {
    if (typeof config[id] !== 'undefined') {
      const el = document.getElementById(id);
      if (config[id]) {
        Object.keys(config[id]).forEach(key => {
          if (config[id][key]) {
            el.classList.add(key);
          } else {
            el.classList.remove(key);
          }
        });
      }
    }
  });
  
  ['checkbox_controls',
    'checkbox_log',
    'checkbox_timestamp',
    'checkbox_hiragana'
  ].forEach(id => {
    const el = document.getElementById(id);
    if(el){
      if (typeof config[id] !== 'undefined') {
        el.checked = config[el.id];
        triggerEvent('input', el);
      }
      el.addEventListener('input', function (e) {
        updateConfig(e.target.id, e.target.checked);
      });
    }
  });

  if (typeof config.position !== 'undefined') {
    const el = document.getElementById(config.position);
    el.checked = 'checked';
    triggerEvent('input', el);
  }
  if (typeof config.select_font !== 'undefined') {
    select_font.selectedIndex = config.select_font;
    triggerEvent('change', select_font);
  }
  if (typeof config.select_autoclear_text !== 'undefined') {
    const el = document.getElementById('select_autoclear_text');
    selectValueIfExists(el, config.select_autoclear_text);
    triggerEvent('change', el);
  }

  document.querySelectorAll('input.control_input').forEach(
    el => el.addEventListener('input', updateConfigValue)
  );
  document.querySelectorAll('input[name="selector_position"]').forEach(
    el => el.addEventListener('input', ev => updateConfig('position', el.id))
  );
  document.querySelector('#select_camera').addEventListener('change', updateConfigValue);
  document.querySelector('#select_font').addEventListener('change', updateConfigValue);

  document.querySelector('#select_autoclear_text').addEventListener('change', updateConfigValue);
}

function updateConfig(key, value) {
  config[key] = value;
  localStorage.speech_to_text_config = JSON.stringify(config);
}

function updateConfigClass(key, value_key, value) {
  if (config[key] == undefined) {
    config[key] = {};
  }
  config[key][value_key] = value;
  localStorage.speech_to_text_config = JSON.stringify(config);
}

function toggleClass(id, className) {
  const el = document.getElementById(id);
  const value = el.classList.toggle(className);
  updateConfigClass(id, className, value);
}

function updateConfigValue() {
  updateConfig(this.id, this.value);
}

function deleteConfig() {
  localStorage.removeItem('speech_to_text_config');
  location.reload();
}

