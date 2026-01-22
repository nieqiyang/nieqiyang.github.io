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
 * 判定浏览器
 */
function detectBrowser() {
  const ua = window.navigator.userAgent.toLowerCase().trim();
  if (ua.includes('silk')) return TYPE_SPECIAL + 'silk';
  if (ua.includes('aftb')) return TYPE_SPECIAL + 'firetv';
  if (ua.includes('nintendo')) return TYPE_SPECIAL + 'nintendo';
  if (ua.includes('playstation')) return TYPE_SPECIAL + 'playstation';
  if (ua.includes('xbox')) return TYPE_SPECIAL + 'xbox';
  if (ua.includes('samsung')) return TYPE_BROWSER + '三星';
  if (ua.includes('ucbrowser')) return TYPE_BROWSER + 'UC浏览器';
  if (ua.includes('qqbrowser')) return TYPE_BROWSER + 'QQ浏览器';
  if (ua.includes('yabrowser')) return TYPE_BROWSER + 'Yandex';
  if (ua.includes('chrome')) return TYPE_BROWSER + 'Chrome';
  if (ua.includes('safari')) return TYPE_BROWSER + 'Safari';
  return TYPE_UNKNOWN + "未知";
}

function is_speech_recognition_supported() {
  return window.SpeechRecognition || window.webkitSpeechRecognition != null;
}

// --- 翻译与识别全局变量 ---
var flag_speech = 0;
var recognition;
var lang = 'ja-JP';
var last_finished = ''; 
var textUpdateTimeoutID = 0;
var textUpdateTimeoutSecond = 30; 

let translationTimeout; 
let translateDelay = 600; 
let targetLang = 'zh-CN'; 
let lastTranslatedText = '';

// 获取当前时间戳用于日志
function getTimestamp() {
  const now = new Date();
  return "[" + now.getHours().toString().padStart(2, '0') + ":" + 
         now.getMinutes().toString().padStart(2, '0') + ":" + 
         now.getSeconds().toString().padStart(2, '0') + "] ";
}

// 更新翻译延迟
function updateTranslateDelay(val) {
    translateDelay = parseInt(val);
    const display = document.getElementById('value_translate_delay');
    if(display) display.innerText = val;
    updateConfig('slider_translate_delay', val);
}

// 更新翻译目标语言
function updateTargetLang(val) {
    targetLang = val;
    updateConfig('select_target_lang', val);
    lastTranslatedText = ''; 
}

/**
 * 核心翻译函数
 */
async function translateText(text) {
    if (!text || text.trim() === '' || text === lastTranslatedText) return;
    const sourceLang = lang.split('-')[0]; 
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const translatedContent = data[0].map(item => item[0]).join('');
        lastTranslatedText = text;
        document.getElementById('translated_text').innerHTML = translatedContent;
    } catch (error) {
        console.error('翻译失败:', error);
    }
}

function vr_function() {
  window.SpeechRecognition = window.SpeechRecognition || webkitSpeechRecognition;
  recognition = new webkitSpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = true; 
  recognition.continuous = true;     

  recognition.onsoundstart = function() {
    document.getElementById('status').innerHTML = "正在识别...";
    document.getElementById('status').className = "processing";
  };
  recognition.onnomatch = function() {
    document.getElementById('status').innerHTML = "无法识别语音";
    document.getElementById('status').className = "error";
  };
  recognition.onerror = function() {
    document.getElementById('status').innerHTML = "发生错误";
    document.getElementById('status').className = "error";
    if (flag_speech == 0) vr_function(); 
  };
  recognition.onsoundend = function() {
    document.getElementById('status').innerHTML = "已停止";
    document.getElementById('status').className = "error";
    vr_function(); 
  };

  recognition.onresult = function(event) {
    var results = event.results;
    var current_transcripts = ''; 
    var need_reset = false;
    
    for (var i = event.resultIndex; i < results.length; i++) {
      if (results[i].isFinal) {
        // --- 确定部分的处理 ---
        last_finished = results[i][0].transcript;
        const is_end_of_sentence = last_finished.endsWith('。') || last_finished.endsWith('？') || last_finished.endsWith('！');
        if (lang == 'ja-JP' && !is_end_of_sentence) {
          last_finished += '。';
        }

        // --- 写入日志 ---
        const logEntry = getTimestamp() + last_finished + '\n';
        const logArea = document.getElementById('result_log');
        logArea.value += logEntry; // 使用 .value 确保文本正确追加到 textarea
        textAreaHeightSet(logArea);
        logArea.scrollTop = logArea.scrollHeight; // 自动滚动到底部

        need_reset = true;
        flag_speech = 0;
      } else {
        current_transcripts += results[i][0].transcript;
        flag_speech = 1;
      }
    }

    // 更新原文界面显示
    const fullContent = [last_finished, current_transcripts].join('<br>');
    document.getElementById('result_text').innerHTML = fullContent;

    // 防抖翻译
    clearTimeout(translationTimeout);
    clearTimeoutForClearText(); 

    translationTimeout = setTimeout(() => {
        const pureText = (last_finished + current_transcripts).trim();
        translateText(pureText); 
    }, translateDelay);

    setTimeoutForClearText();
    if (need_reset) { vr_function(); }
  }

  flag_speech = 0;
  document.getElementById('status').innerHTML = "待机中";
  document.getElementById('status').className = "ready";
  recognition.start();
}

// 字幕自动清除
function updateTextClearSecond() {
  const sec = Number(document.getElementById('select_autoclear_text').value);
  if ((!isNaN(sec)) && isFinite(sec) && (sec >= 0)) {
    textUpdateTimeoutSecond = sec;
  }
}

function clearTimeoutForClearText() {
  if (textUpdateTimeoutID !== 0) {
    clearTimeout(textUpdateTimeoutID);
    textUpdateTimeoutID = 0;
  }
}

function setTimeoutForClearText() {
  if (textUpdateTimeoutSecond <= 0) return;
  clearTimeoutForClearText();
  textUpdateTimeoutID = setTimeout(() => {
      document.getElementById('result_text').innerHTML = "";
      document.getElementById('translated_text').innerHTML = ""; 
      last_finished = ''; 
      textUpdateTimeoutID = 0;
    }, textUpdateTimeoutSecond * 1000);
}

// 自动调整日志高度
function textAreaHeightSet(argObj) {
  argObj.style.height = "10px";
  var wSclollHeight = parseInt(argObj.scrollHeight);
  var wLineH = 20; // 预设行高
  if (wSclollHeight < (wLineH * 2)) wSclollHeight = (wLineH * 2);
  argObj.style.height = wSclollHeight + "px";
}

// 下载日志
function downloadLogFile() {
  const content = document.getElementById('result_log').value;
  if(!content) { alert("日志内容为空"); return; }
  
  const blob = new Blob([content], {type: 'text/plain'});
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  var now = new Date();
  var timestamp = now.getFullYear() + (now.getMonth() + 1).toString().padStart(2, '0') + 
                  now.getDate().toString().padStart(2, '0') + "_" + 
                  now.getHours().toString().padStart(2, '0') + 
                  now.getMinutes().toString().padStart(2, '0');
  a.download = 'log_' + timestamp + '.txt';
  a.click();
  window.URL.revokeObjectURL(url);
}

// --- 全屏逻辑 ---
function eventFullScreen(callback) {
  document.addEventListener("fullscreenchange", callback, false);
  document.addEventListener("webkitfullscreenchange", callback, false);
}

function goFullScreen(element = null) {
  const docEl = element || document.documentElement;
  const request = docEl.requestFullscreen || docEl.webkitRequestFullScreen;
  if(request) request.call(docEl);
}

function cancelFullScreen() {
  const cancel = document.exitFullscreen || document.webkitExitFullscreen;
  if(cancel) cancel.call(document);
}

function getFullScreenObject() {
  return document.fullscreenElement || document.webkitFullscreenElement;
}

// --- 初始化 ---
window.onload = () => {
  vr_function();
  const fullScreenBtn = document.querySelector("#FullScreenBtn");
  const videoWrapper = document.querySelector("#video_wrapper");

  if(fullScreenBtn) {
    fullScreenBtn.addEventListener("click", () => {
      getFullScreenObject() ? cancelFullScreen() : goFullScreen(videoWrapper);
    });
  }

  eventFullScreen(() => {
    const textAreas = ['#result_text', '#translated_text'];
    if (getFullScreenObject()) {
      textAreas.forEach(selector => {
        const el = document.querySelector(selector);
        el.dataset.origSize = getComputedStyle(el).fontSize;
        el.style.fontSize = (parseFloat(el.dataset.origSize) * 1.5) + "px"; // 全屏放大
      });
    } else {
      textAreas.forEach(selector => {
        const el = document.querySelector(selector);
        el.style.fontSize = el.dataset.origSize || "";
      });
    }
  });

  initConfig();
};

// 语言切换
var langs = [
  ['English', 'en-US'],
  ['中文', 'cmn-Hans-CN'],
  ['Japanese', 'ja-JP']
];
const selectLang = document.getElementById('select_language');
const selectDialect = document.getElementById('select_dialect');

// ---  增加控制日志显示/隐藏的函数 ---
function toggleLogVisibility() {
  const checkbox = document.getElementById('checkbox_log');
  const logSection = document.getElementById('log');
  if (checkbox && logSection) {
    logSection.style.display = checkbox.checked ? 'block' : 'none';
  }
}

if(selectLang) {
    langs.forEach((l, i) => selectLang.options[i] = new Option(l[0], i));
    selectLang.selectedIndex = 1; // 默认中文
    selectLang.onchange = updateCountry;
}

function updateCountry() {
  selectDialect.innerHTML = "";
  // 修正后的遍历逻辑
  var item = langs[selectLang.selectedIndex];
  // 因为现在结构简单了，直接添加
  selectDialect.options.add(new Option(item[0], item[1]));
  updateLanguage();
}

function updateLanguage() {
  if (recognition) recognition.stop();
  lang = selectDialect.value;
  vr_function();
}

// 配置持久化
const config = JSON.parse(localStorage.speech_to_text_config || '{}');

function initConfig() {
  const controls = [
    'slider_font_size', 'slider_opacity', 'slider_text_shadow_stroke', 
    'slider_text_bg_opacity', 'selector_text_bg_color', 
    'slider_translate_delay', 'select_target_lang'
  ];

  controls.forEach(id => {
    const el = document.getElementById(id);
    if (el && config[id] !== undefined) {
      el.value = config[id];
      if(id === 'slider_translate_delay') translateDelay = parseInt(config[id]);
      if(id === 'select_target_lang') targetLang = config[id];
      el.dispatchEvent(new Event('input'));
    }
  });

  // 处理复选框：日志显示和详细设置
  ['checkbox_controls', 'checkbox_log'].forEach(id => {
    const el = document.getElementById(id);
    if (el && config[id] !== undefined) {
      el.checked = config[id];
    }
    // 绑定点击事件，实时切换显示状态
    if (el) {
        el.addEventListener('change', () => {
            if(id === 'checkbox_log') toggleLogVisibility();
            updateConfig(id, el.checked);
        });
    }
  });

  // 初始化时执行一次显示判断
  toggleLogVisibility();

  document.querySelectorAll('.control_input').forEach(el => {
    el.addEventListener('input', (e) => updateConfig(e.target.id, e.target.value));
  });
}

function updateConfig(key, value) {
  config[key] = value;
  localStorage.speech_to_text_config = JSON.stringify(config);
}

function toggleClass(id, className) {
  const el = document.getElementById(id);
  if(!el) return;
  const isActive = el.classList.toggle(className);
  if (!config[id]) config[id] = {};
  config[id][className] = isActive;
  updateConfig(id, config[id]);
}

function deleteConfig() {
  localStorage.removeItem('speech_to_text_config');
  location.reload();
}