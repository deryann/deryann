// 全域變數
let appConfig = null;
let testData = {};
let availableTests = [];
let currentUser = '';
let currentTestName = '';
let selectedUser = '';
let selectedTest = '';
let wordList = [];
let currentIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let startTime = null;
let availableVoices = [];
let voice1 = null;
let voice2 = null;
let logEntries = [];
let testResults = []; // 記錄每個單字的測驗結果
let testInfoText = ''; // 畫面上方顯示的測驗資訊

// 老師模式變數
let isTeacherMode = false;
let teacherModeData = []; // 記錄每個單字的狀態
let teacherStartTime = null;

// DOM 元素
const setupScreen = document.getElementById('setupScreen');
const quizScreen = document.getElementById('quizScreen');
const resultScreen = document.getElementById('resultScreen');
const teacherScreen = document.getElementById('teacherScreen');
const userList = document.getElementById('userList');
const testList = document.getElementById('testList');
const rangeStart = document.getElementById('rangeStart');
const rangeEnd = document.getElementById('rangeEnd');
const rangeTotal = document.getElementById('rangeTotal');
const randomCheck = document.getElementById('randomCheck');
const startBtn = document.getElementById('startBtn');
const testInfo = document.getElementById('testInfo');
const answerInput = document.getElementById('answerInput');
const progressText = document.getElementById('progressText');
const progressTotal = document.getElementById('progressTotal');
const progressFill = document.getElementById('progressFill');
const correctText = document.getElementById('correctText');
const wrongText = document.getElementById('wrongText');
const questionPanel = document.getElementById('questionPanel');
const submitBtn = document.getElementById('submitBtn');
const replayBtn = document.getElementById('replayBtn');
const replay1Btn = document.getElementById('replay1Btn');
const replay2Btn = document.getElementById('replay2Btn');
const retestBtn = document.getElementById('retestBtn');
const feedbackPanel = document.getElementById('feedbackPanel');
const feedbackIconCorrect = document.getElementById('feedbackIconCorrect');
const feedbackIconWrong = document.getElementById('feedbackIconWrong');
const feedbackTitle = document.getElementById('feedbackTitle');
const feedbackYoursBox = document.getElementById('feedbackYoursBox');
const feedbackYours = document.getElementById('feedbackYours');
const feedbackCorrect = document.getElementById('feedbackCorrect');
const feedbackReplayBtn = document.getElementById('feedbackReplayBtn');
const nextBtn = document.getElementById('nextBtn');
const resultInfo = document.getElementById('resultInfo');
const finalCorrect = document.getElementById('finalCorrect');
const finalWrong = document.getElementById('finalWrong');
const finalTime = document.getElementById('finalTime');
const wrongSection = document.getElementById('wrongSection');
const wrongWordsList = document.getElementById('wrongWordsList');
const correctSection = document.getElementById('correctSection');
const correctWordsList = document.getElementById('correctWordsList');
const retryWrongBtn = document.getElementById('retryWrongBtn');
const saveLogBtn = document.getElementById('saveLogBtn');
const closeResultBtn = document.getElementById('closeResultBtn');
const yesSound = document.getElementById('yesSound');
const noSound = document.getElementById('noSound');

// 老師模式 DOM 元素
const teacherModeBtn = document.getElementById('teacherModeBtn');
const teacherInfo = document.getElementById('teacherInfo');
const wordRows = document.getElementById('wordRows');
const teacherCorrect = document.getElementById('teacherCorrect');
const teacherWrong = document.getElementById('teacherWrong');
const teacherPending = document.getElementById('teacherPending');
const teacherRateLabel = document.getElementById('teacherRateLabel');
const teacherRate = document.getElementById('teacherRate');
const teacherExitBtn = document.getElementById('teacherExitBtn');
const exportReportBtn = document.getElementById('exportReportBtn');

// 初始化
async function init() {
  try {
    // 載入使用者設定
    const configResponse = await fetch('config.json');
    appConfig = await configResponse.json();

    // 產生考生按鈕
    appConfig.Users.forEach(user => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'user-btn';
      button.setAttribute('aria-pressed', 'false');

      const initial = document.createElement('span');
      initial.className = 'user-initial';
      initial.textContent = user.charAt(0).toUpperCase();
      const name = document.createElement('span');
      name.textContent = user;
      button.append(initial, name);

      button.addEventListener('click', () => {
        selectedUser = user;
        updatePressed(userList, button);
      });
      userList.appendChild(button);
    });

    // 載入所有測驗卷
    await loadAvailableTests();

    // 初始化語音
    initVoices();

  } catch (error) {
    console.error('初始化失敗:', error);
    alert('系統初始化失敗，請確認檔案是否存在。');
  }
}

// 載入可用的測驗卷
async function loadAvailableTests() {
  const testFiles = appConfig.Tests;
  const defaultTest = appConfig.DefaultTest;

  for (const testName of testFiles) {
    try {
      const response = await fetch(`papers/${testName}.json`);
      const data = await response.json();
      testData[testName] = data;
      availableTests.push(testName);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip-btn';
      button.textContent = testName;
      button.dataset.test = testName;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => selectTest(testName));
      testList.appendChild(button);
    } catch (error) {
      console.warn(`無法載入測驗卷: ${testName}`);
    }
  }

  // 預設選擇測驗卷，並同步更新題目範圍
  if (availableTests.includes(defaultTest)) {
    selectTest(defaultTest);
  }
}

// 更新一組按鈕的選取狀態
function updatePressed(container, pressedButton) {
  container.querySelectorAll('button').forEach(button => {
    button.setAttribute('aria-pressed', button === pressedButton ? 'true' : 'false');
  });
}

// 選擇測驗卷，並更新題目範圍
function selectTest(testName) {
  selectedTest = testName;
  updatePressed(testList, testList.querySelector(`[data-test="${testName}"]`));

  const data = testData[testName];
  const maxNum = Math.max(...Object.keys(data).map(Number));
  rangeStart.max = maxNum;
  rangeEnd.max = maxNum;
  rangeStart.value = 1;
  rangeEnd.value = maxNum;
  rangeTotal.textContent = `這份卷共 ${maxNum} 題`;
}

// 初始化語音
function initVoices() {
  if (!('speechSynthesis' in window)) {
    renderVoiceInfo(null);
    updateVoiceTooltips();
    alert('你的瀏覽器不支援語音合成功能。');
    return;
  }

  // 載入語音清單
  const loadVoices = () => {
    availableVoices = speechSynthesis.getVoices();
    // 選擇英語語音
    const enVoices = availableVoices.filter(v => v.lang.startsWith('en'));

    if (enVoices.length >= 2) {
      voice1 = enVoices[0];
      voice2 = enVoices[1];
    } else if (enVoices.length === 1) {
      voice1 = enVoices[0];
      voice2 = enVoices[0];
    } else {
      // 使用預設語音
      voice1 = availableVoices[0];
      voice2 = availableVoices.length > 1 ? availableVoices[1] : availableVoices[0];
    }

    renderVoiceInfo(enVoices);
    updateVoiceTooltips();
  };

  loadVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

// 說明聲音 A（index 0）或聲音 B（index 1）實際使用的語音
function describeVoice(index) {
  if (!('speechSynthesis' in window)) return '這個瀏覽器不支援語音合成';
  const voice = index === 0 ? voice1 : voice2;
  if (!voice) return '聲音清單還沒載入，會先用瀏覽器預設聲音';
  let text = `${voice.name}（${voice.lang}）`;
  if (index === 1 && voice === voice1) text += '，與聲音 A 相同';
  return text;
}

// 更新所有聲音按鈕的 tooltip 與無障礙標籤
function updateVoiceTooltips() {
  document.querySelectorAll('[data-voice-index]').forEach(button => {
    const tip = describeVoice(Number(button.dataset.voiceIndex));
    button.dataset.tooltip = tip;
    button.setAttribute('aria-label', `${button.dataset.voiceLabel}：${tip}`);
  });
}

// 觸控裝置沒有 hover，點按聲音按鈕時短暫顯示 tooltip
let tooltipTimer = null;
document.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse') return;
  const button = event.target.closest('[data-tooltip]');
  document.querySelectorAll('.tip-visible').forEach(el => {
    if (el !== button) el.classList.remove('tip-visible');
  });
  if (!button) return;
  button.classList.add('tip-visible');
  clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(() => button.classList.remove('tip-visible'), 2500);
});

// 偵測瀏覽器與作業系統
function detectBrowser() {
  const ua = navigator.userAgent;
  let os = '其他系統';
  // iPadOS 13 以後會偽裝成 Mac，用觸控點數判斷
  const isIPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || isIPadOS) os = 'iOS / iPadOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  let name = '未知瀏覽器';
  let key = 'other';
  if (os === 'iOS / iPadOS') {
    // iOS 上所有瀏覽器都使用 Safari 的 WebKit 核心與系統語音
    if (/CriOS/.test(ua)) name = 'Chrome';
    else if (/FxiOS/.test(ua)) name = 'Firefox';
    else if (/EdgiOS/.test(ua)) name = 'Edge';
    else name = 'Safari';
    key = 'ios';
  } else if (/Edg\//.test(ua)) { name = 'Microsoft Edge'; key = 'edge'; }
  else if (/OPR\/|Opera/.test(ua)) { name = 'Opera'; key = 'opera'; }
  else if (/SamsungBrowser/.test(ua)) { name = 'Samsung Internet'; key = 'samsung'; }
  else if (/Firefox\//.test(ua)) { name = 'Firefox'; key = 'firefox'; }
  else if (/Chrome\//.test(ua)) { name = 'Google Chrome'; key = 'chrome'; }
  else if (/Safari\//.test(ua)) { name = 'Safari'; key = 'safari'; }

  return { name, key, os };
}

// 各瀏覽器預期會有的英文聲音說明
function getVoiceExpectation(browser) {
  const isMobile = browser.os === 'Android' || browser.os === 'iOS / iPadOS';
  switch (browser.key) {
    case 'edge':
      return isMobile
        ? '手機版 Edge 使用手機內建的語音引擎，英文聲音通常只有 1～數種。'
        : 'Edge 除了系統內建聲音，還有微軟線上「自然」聲音，英文聲音通常有 20 種以上（需連網）。';
    case 'chrome':
      if (browser.os === 'Android') {
        return 'Android 版 Chrome 使用手機的文字轉語音引擎，英文聲音通常只有 1～數種，可到手機「設定 › 文字轉語音」下載更多。';
      }
      return 'Chrome 內建 3 種 Google 英文聲音（US English、UK English Female、UK English Male，需連網），再加上系統內建聲音'
        + (browser.os === 'Windows' ? '（Windows 通常 2～3 種，例如 David、Zira、Mark）' : '')
        + '，合計大約 4～6 種以上。';
    case 'firefox':
      return 'Firefox 只使用作業系統內建的聲音：Windows 通常 2～3 種英文聲音，macOS 較多，Linux 可能只有 0～1 種。';
    case 'safari':
      return 'Safari 使用 macOS 內建聲音，英文聲音通常有 10 種以上（例如 Samantha、Daniel、Karen）。';
    case 'ios':
      return 'iPhone / iPad 上的瀏覽器都使用系統內建聲音，英文聲音通常有 10 種以上，可到「設定 › 輔助使用 › 朗讀內容 › 聲音」下載更多。';
    case 'opera':
      return 'Opera 沒有 Google 線上聲音，只使用作業系統內建聲音，英文通常 2～3 種。';
    case 'samsung':
      return 'Samsung Internet 使用手機的文字轉語音引擎，英文聲音通常只有 1～數種。';
    default:
      return '聲音數量依瀏覽器和作業系統而定。建議使用 Chrome 或 Edge，可以有較多英文聲音。';
  }
}

// 在首頁顯示瀏覽器與聲音說明
// enVoices 為 null 代表瀏覽器不支援語音合成
function renderVoiceInfo(enVoices) {
  const browser = detectBrowser();
  const browserInfo = document.getElementById('browserInfo');
  const voiceExpect = document.getElementById('voiceExpect');
  const voiceStatus = document.getElementById('voiceStatus');
  const voiceList = document.getElementById('voiceList');
  const badge = document.getElementById('voiceCountBadge');
  if (!browserInfo) return;

  browserInfo.textContent = `目前的瀏覽器：${browser.name}（${browser.os}）`;
  voiceExpect.textContent = getVoiceExpectation(browser);
  voiceList.innerHTML = '';
  voiceStatus.className = 'voice-line';

  if (enVoices === null) {
    badge.textContent = '不支援';
    badge.dataset.state = 'bad';
    voiceStatus.textContent = '這個瀏覽器不支援語音合成，無法播放單字發音，請改用 Chrome、Edge 或 Safari。';
    voiceStatus.classList.add('voice-bad');
    return;
  }

  badge.textContent = `偵測到 ${enVoices.length} 種英文聲音`;
  if (enVoices.length >= 2) {
    badge.dataset.state = 'good';
    voiceStatus.textContent = '測驗時的「聲音 A」「聲音 B」會使用下列前兩種不同的聲音。';
  } else if (enVoices.length === 1) {
    badge.dataset.state = 'warn';
    voiceStatus.textContent = '只有 1 種英文聲音，「聲音 A」和「聲音 B」聽起來會一樣。';
    voiceStatus.classList.add('voice-warn');
  } else {
    badge.dataset.state = 'warn';
    voiceStatus.textContent = availableVoices.length === 0
      ? '還沒取得聲音清單，有些瀏覽器要等一下或點一下頁面才會載入。'
      : '沒有找到英文聲音，會改用預設聲音，發音可能不是英文。';
    voiceStatus.classList.add('voice-warn');
  }

  enVoices.forEach((v, i) => {
    const li = document.createElement('li');
    const tag = i === 0 ? '聲音 A' : i === 1 ? '聲音 B' : '';
    if (tag) {
      const t = document.createElement('span');
      t.className = 'voice-tag';
      t.textContent = tag;
      li.appendChild(t);
    }
    li.appendChild(document.createTextNode(`${v.name}（${v.lang}）`));
    voiceList.appendChild(li);
  });
}

// 題目範圍欄位更新
rangeStart.addEventListener('change', normalizeRange);
rangeEnd.addEventListener('change', normalizeRange);

function normalizeRange() {
  const maxNum = parseInt(rangeEnd.max);
  const clamp = (value, fallback) => {
    const num = parseInt(value);
    if (isNaN(num)) return fallback;
    return Math.min(Math.max(num, 1), maxNum);
  };

  let start = clamp(rangeStart.value, 1);
  let end = clamp(rangeEnd.value, maxNum);

  // 確保 start <= end
  if (start > end) {
    [start, end] = [end, start];
  }

  rangeStart.value = start;
  rangeEnd.value = end;
}

// 切換畫面
function showScreen(screen) {
  [setupScreen, quizScreen, resultScreen, teacherScreen].forEach(s => {
    s.hidden = s !== screen;
  });
  window.scrollTo(0, 0);
}

// 開始測驗按鈕
startBtn.addEventListener('click', startTest);

function startTest() {
  // 驗證選擇
  if (!selectedUser) {
    alert('請選擇考生名字！');
    return;
  }

  if (!selectedTest) {
    alert('請選擇測驗卷！');
    return;
  }

  normalizeRange();
  currentUser = selectedUser;
  currentTestName = selectedTest;

  // 準備題目
  prepareWordList();
  testInfoText = `${currentUser} · ${currentTestName} · ${describeRange()}`;

  beginTest();
}

// 以目前的 wordList 開始一輪測驗
function beginTest() {
  // 初始化測驗狀態
  currentIndex = 0;
  correctCount = 0;
  wrongCount = 0;
  startTime = new Date();
  logEntries = [];
  testResults = []; // 重置測驗結果

  // 記錄測驗開始
  addLog(`=== 測驗開始 ===`);
  addLog(`考生: ${currentUser}`);
  addLog(`測驗卷: ${currentTestName}`);
  addLog(`題目範圍: ${rangeStart.value} - ${rangeEnd.value}`);
  addLog(`隨機 20 題: ${randomCheck.checked ? '是' : '否'}`);
  addLog(`題目清單: ${wordList.map(w => w.word).join(', ')}`);
  addLog(`開始時間: ${formatTime(startTime)}`);

  // 更新 UI
  testInfo.textContent = testInfoText;
  updateProgress();

  // 切換畫面
  showScreen(quizScreen);
  showQuestion();

  // 播放第一個單字
  speakWord(0);
}

// 題目範圍的文字說明
function describeRange() {
  const range = `第 ${rangeStart.value}–${rangeEnd.value} 題`;
  return randomCheck.checked ? `${range}隨機 20 題` : range;
}

// 準備單字清單
function prepareWordList() {
  const data = testData[currentTestName];
  const start = parseInt(rangeStart.value);
  const end = parseInt(rangeEnd.value);

  // 篩選範圍內的單字
  let selectedWords = [];
  for (let i = start; i <= end; i++) {
    if (data[i.toString()]) {
      selectedWords.push({
        number: i,
        word: data[i.toString()]
      });
    }
  }

  // 隨機 20 題
  if (randomCheck.checked && selectedWords.length > 20) {
    selectedWords = shuffleArray(selectedWords).slice(0, 20);
  }

  // 隨機排序
  wordList = shuffleArray(selectedWords);
}

// 陣列隨機排序
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// 更新進度
function updateProgress() {
  const answered = correctCount + wrongCount;
  progressText.textContent = `第 ${currentIndex + 1} 題`;
  progressTotal.textContent = `/ ${wordList.length}`;
  correctText.textContent = `答對 ${correctCount}`;
  wrongText.textContent = `答錯 ${wrongCount}`;
  progressFill.style.width = wordList.length ? `${(answered / wordList.length) * 100}%` : '0';
}

// 顯示作答區
function showQuestion() {
  feedbackPanel.hidden = true;
  questionPanel.hidden = false;
  answerInput.value = '';
  answerInput.focus();
}

// 播放單字 (隨機選擇語音)
function speakWord(voiceIndex = -1) {
  if (!wordList[currentIndex]) return;

  const word = wordList[currentIndex].word;
  const voice = voiceIndex === 0 ? voice1 : voiceIndex === 1 ? voice2 : (Math.random() < 0.5 ? voice1 : voice2);

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.voice = voice;
  utterance.lang = 'en-US';
  utterance.rate = 0.9;

  addLog(`播放單字: ${word} (語音: ${voice ? voice.name : 'default'})`);
  speechSynthesis.speak(utterance);
}

// 送出答案
submitBtn.addEventListener('click', checkAnswer);
answerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!e.repeat) checkAnswer();
  }
});

function checkAnswer() {
  if (!wordList[currentIndex]) return;

  const userAnswer = answerInput.value.trim();
  const correctAnswer = wordList[currentIndex].word;

  if (!userAnswer) {
    alert('請輸入答案！');
    return;
  }

  // 檢查答案 (精確比對，區分大小寫)
  const isCorrect = userAnswer === correctAnswer;

  // 記錄測驗結果
  testResults.push({
    number: wordList[currentIndex].number,
    word: correctAnswer,
    isCorrect: isCorrect,
    userAnswer: userAnswer
  });

  if (isCorrect) {
    correctCount++;
    yesSound.play();
    addLog(`O: ${correctAnswer}`);
  } else {
    wrongCount++;
    noSound.play();
    addLog(`X: ${correctAnswer} Your answer: ${userAnswer}`);
  }

  showFeedback(isCorrect, correctAnswer, userAnswer);
  updateProgress();
}

// 找出兩個字串各自不在最長共同子序列中的字元
function diffMarks(a, b) {
  const lcs = [];
  for (let i = 0; i <= a.length; i++) {
    lcs.push(new Array(b.length + 1).fill(0));
  }
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const marksA = new Array(a.length).fill(true);
  const marksB = new Array(b.length).fill(true);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      marksA[i++] = false;
      marksB[j++] = false;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return [marksA, marksB];
}

// 顯示單字，並標出不同的字元
function renderDiffWord(container, word, marks) {
  container.innerHTML = '';
  [...word].forEach((char, index) => {
    if (marks && marks[index]) {
      const span = document.createElement('span');
      span.className = 'diff';
      span.textContent = char;
      container.appendChild(span);
    } else {
      container.appendChild(document.createTextNode(char));
    }
  });
}

// 顯示單題回饋
function showFeedback(isCorrect, correctAnswer, userAnswer) {
  feedbackPanel.classList.toggle('is-correct', isCorrect);
  feedbackPanel.classList.toggle('is-wrong', !isCorrect);
  feedbackIconCorrect.toggleAttribute('hidden', !isCorrect);
  feedbackIconWrong.toggleAttribute('hidden', isCorrect);
  feedbackYoursBox.hidden = isCorrect;

  if (isCorrect) {
    feedbackTitle.textContent = '答對了！';
    renderDiffWord(feedbackCorrect, correctAnswer, null);
  } else {
    feedbackTitle.textContent = '答錯了，看看哪裡不一樣';
    const [marksYours, marksCorrect] = diffMarks(userAnswer, correctAnswer);
    renderDiffWord(feedbackYours, userAnswer, marksYours);
    renderDiffWord(feedbackCorrect, correctAnswer, marksCorrect);
  }

  const isLast = currentIndex >= wordList.length - 1;
  nextBtn.textContent = isLast ? '看結果' : '下一題';

  questionPanel.hidden = true;
  feedbackPanel.hidden = false;
  nextBtn.focus();
}

// 下一題按鈕
nextBtn.addEventListener('click', nextQuestion);
nextBtn.addEventListener('keydown', (e) => {
  // 避免按住 Enter 時連續跳題
  if (e.key === 'Enter' && e.repeat) {
    e.preventDefault();
  }
});

function nextQuestion() {
  // 判斷是否為最後一題
  if (currentIndex >= wordList.length - 1) {
    showFinalResult();
  } else {
    currentIndex++;
    updateProgress();
    showQuestion();
    speakWord();
  }
}

// 格式化經過時間
function formatDuration(totalSeconds) {
  const seconds = Math.round(totalSeconds);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes} 分 ${seconds % 60} 秒` : `${seconds} 秒`;
}

// 顯示最終結果
function showFinalResult() {
  const endTime = new Date();
  const totalTime = ((endTime - startTime) / 1000).toFixed(1);

  addLog(`=== 測驗結束 ===`);
  addLog(`結束時間: ${formatTime(endTime)}`);
  addLog(`總時間: ${totalTime} 秒`);
  addLog(`正確: ${correctCount}, 錯誤: ${wrongCount}`);

  // 顯示結果統計
  resultInfo.textContent = testInfoText;
  finalCorrect.textContent = correctCount;
  finalWrong.textContent = wrongCount;
  finalTime.textContent = formatDuration(totalTime);

  // 顯示單字結果列表
  wrongWordsList.innerHTML = '';
  correctWordsList.innerHTML = '';
  testResults.forEach(result => {
    if (result.isCorrect) {
      const chip = document.createElement('span');
      chip.className = 'word-chip';
      chip.textContent = result.word;
      correctWordsList.appendChild(chip);
    } else {
      const item = document.createElement('div');
      item.className = 'wrong-item';

      const word = document.createElement('div');
      word.className = 'wrong-item-word';
      word.textContent = result.word;

      const answer = document.createElement('div');
      answer.className = 'wrong-item-answer';
      const answerText = document.createElement('strong');
      answerText.textContent = result.userAnswer;
      answer.append('你寫成 ', answerText);

      item.append(word, answer);
      wrongWordsList.appendChild(item);
    }
  });

  wrongSection.hidden = wrongCount === 0;
  correctSection.hidden = correctCount === 0;
  retryWrongBtn.hidden = wrongCount === 0;
  retryWrongBtn.textContent = `只重練答錯的 ${wrongCount} 個字`;

  // 顯示結果畫面
  showScreen(resultScreen);
}

// 只重練答錯的字
retryWrongBtn.addEventListener('click', () => {
  const wrongWords = testResults
    .filter(result => !result.isCorrect)
    .map(result => ({ number: result.number, word: result.word }));
  if (wrongWords.length === 0) return;

  wordList = shuffleArray(wrongWords);
  testInfoText = `${currentUser} · ${currentTestName} · 重練答錯的 ${wrongWords.length} 個字`;
  beginTest();
  addLog(`=== 重練答錯的字 ===`);
});

// 重新播放按鈕
replayBtn.addEventListener('click', () => {
  speakWord();
  answerInput.focus();
});
replay1Btn.addEventListener('click', () => {
  speakWord(0);
  answerInput.focus();
});
replay2Btn.addEventListener('click', () => {
  speakWord(1);
  answerInput.focus();
});
feedbackReplayBtn.addEventListener('click', () => speakWord());

// 重新開始按鈕
retestBtn.addEventListener('click', () => {
  if (confirm('確定要重新測試嗎？目前進度將會重置。')) {
    wordList = shuffleArray(wordList);
    beginTest();
    addLog(`=== 重新測試 ===`);
  }
});

// 記錄 log
function addLog(message) {
  const timestamp = formatTime(new Date());
  const logEntry = `${timestamp} - WordTest - INFO - ${message}`;
  logEntries.push(logEntry);
  console.log(logEntry);
}

// 格式化時間
function formatTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 格式化時間用於檔名
function formatTimeForFilename(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// 儲存 log
function saveLog() {
  const logContent = logEntries.join('\n');
  const blob = new Blob([logContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = formatTimeForFilename(new Date());
  a.download = `testing_${currentTestName}_${currentUser}_${timestamp}.log`;
  a.click();
  URL.revokeObjectURL(url);
}

// 頁面載入時初始化
window.addEventListener('load', init);

// 初始化語音 (使用者互動)
document.addEventListener('click', function initOnce() {
  if ('speechSynthesis' in window) {
    speechSynthesis.getVoices();
  }
  document.removeEventListener('click', initOnce);
});

// 儲存紀錄按鈕
saveLogBtn.addEventListener('click', () => {
  saveLog();
  alert('Log 已儲存！');
});

// 回到設定按鈕
closeResultBtn.addEventListener('click', () => {
  showScreen(setupScreen);
});

// ============================================
// 老師模式功能
// ============================================

// 老師模式按鈕事件
teacherModeBtn.addEventListener('click', startTeacherMode);

// 開始老師模式
function startTeacherMode() {
  // 驗證選擇
  if (!selectedTest) {
    alert('請選擇測驗卷！');
    return;
  }

  normalizeRange();
  currentTestName = selectedTest;
  isTeacherMode = true;
  teacherStartTime = new Date();

  // 準備題目清單
  prepareWordList();

  // 初始化老師模式資料
  teacherModeData = wordList.map((item, index) => ({
    index: index,
    number: item.number,
    word: item.word,
    play1Count: 0,
    play2Count: 0,
    result: null // null: 未作答, 'correct': 正確, 'wrong': 錯誤
  }));

  // 更新老師模式資訊
  teacherInfo.textContent = `${currentTestName} · ${describeRange()} · 共 ${wordList.length} 題`;

  // 生成單字列
  generateWordRows();
  updateTeacherStats();

  // 切換畫面
  showScreen(teacherScreen);

  // 記錄 log
  logEntries = [];
  addLog(`=== 老師模式開始 ===`);
  addLog(`測驗卷: ${currentTestName}`);
  addLog(`題目範圍: ${rangeStart.value} - ${rangeEnd.value}`);
  addLog(`隨機 20 題: ${randomCheck.checked ? '是' : '否'}`);
  addLog(`題目清單: ${wordList.map(w => w.word).join(', ')}`);
  addLog(`開始時間: ${formatTime(teacherStartTime)}`);
}

// 生成單字列
function generateWordRows() {
  wordRows.innerHTML = '';

  teacherModeData.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'word-row';
    row.id = `word-row-${index}`;

    row.innerHTML = `
      <div class="word-row-number">#${item.number}</div>
      <div class="word-row-word">${item.word}</div>
      <div class="word-row-group">
        <button type="button" class="play-btn" data-voice-index="0" data-voice-label="播放發音 A" aria-label="播放發音 A" onclick="playTeacherWord(${index}, 0)">
          A · <span id="play1-count-${index}">0</span>
        </button>
        <button type="button" class="play-btn" data-voice-index="1" data-voice-label="播放發音 B" aria-label="播放發音 B" onclick="playTeacherWord(${index}, 1)">
          B · <span id="play2-count-${index}">0</span>
        </button>
      </div>
      <div class="word-row-group">
        <button type="button" class="mark-btn mark-correct" id="mark-correct-${index}" aria-pressed="false" onclick="setWordResult(${index}, 'correct')">對</button>
        <button type="button" class="mark-btn mark-wrong" id="mark-wrong-${index}" aria-pressed="false" onclick="setWordResult(${index}, 'wrong')">錯</button>
      </div>
    `;

    wordRows.appendChild(row);
  });

  updateVoiceTooltips();
}

// 播放老師模式單字
function playTeacherWord(index, voiceIndex) {
  const item = teacherModeData[index];
  const word = item.word;
  const voice = voiceIndex === 0 ? voice1 : voice2;

  // 更新播放次數
  if (voiceIndex === 0) {
    item.play1Count++;
    document.getElementById(`play1-count-${index}`).textContent = item.play1Count;
  } else {
    item.play2Count++;
    document.getElementById(`play2-count-${index}`).textContent = item.play2Count;
  }

  // 播放語音
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.voice = voice;
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  speechSynthesis.speak(utterance);

  addLog(`老師模式播放: ${word} (發音${voiceIndex + 1}, 第${voiceIndex === 0 ? item.play1Count : item.play2Count}次)`);
}

// 設定單字結果 (再按一次同一個結果會取消批改)
function setWordResult(index, result) {
  const item = teacherModeData[index];
  if (item.result === result) {
    result = null;
  }
  item.result = result;

  const row = document.getElementById(`word-row-${index}`);
  row.classList.toggle('correct', result === 'correct');
  row.classList.toggle('wrong', result === 'wrong');
  document.getElementById(`mark-correct-${index}`).setAttribute('aria-pressed', result === 'correct' ? 'true' : 'false');
  document.getElementById(`mark-wrong-${index}`).setAttribute('aria-pressed', result === 'wrong' ? 'true' : 'false');

  updateTeacherStats();

  addLog(`設定結果: ${item.word} = ${result === null ? '未作答' : result === 'correct' ? '正確' : '錯誤'}`);
}

// 計算老師模式統計
function getTeacherStats() {
  const correctCount = teacherModeData.filter(item => item.result === 'correct').length;
  const wrongCount = teacherModeData.filter(item => item.result === 'wrong').length;
  const unansweredCount = teacherModeData.filter(item => item.result === null).length;
  const answeredCount = correctCount + wrongCount;
  const correctRate = answeredCount > 0 ? ((correctCount / answeredCount) * 100).toFixed(1) : 0;
  return { correctCount, wrongCount, unansweredCount, answeredCount, correctRate };
}

// 更新老師模式統計
function updateTeacherStats() {
  const stats = getTeacherStats();
  teacherCorrect.textContent = stats.correctCount;
  teacherWrong.textContent = stats.wrongCount;
  teacherPending.textContent = stats.unansweredCount;
  teacherRateLabel.textContent = `正確率（${stats.correctCount} / ${stats.answeredCount}）`;
  teacherRate.textContent = stats.answeredCount > 0 ? `${Math.round(stats.correctRate)}%` : '–';
}

// 匯出報告按鈕事件
exportReportBtn.addEventListener('click', exportTeacherReport);

// 匯出老師模式報告
function exportTeacherReport() {
  const endTime = new Date();
  const totalTime = ((endTime - teacherStartTime) / 1000).toFixed(1);

  // 計算統計
  const { correctCount, wrongCount, unansweredCount, correctRate } = getTeacherStats();

  // 記錄 log
  addLog(`=== 老師模式總結 ===`);
  addLog(`結束時間: ${formatTime(endTime)}`);
  addLog(`總時間: ${totalTime} 秒`);
  addLog(`正確: ${correctCount}, 錯誤: ${wrongCount}, 未作答: ${unansweredCount}`);
  addLog(`正確率: ${correctRate}%`);

  // 生成報告內容
  let reportContent = `=== 老師模式考試結果 ===\n`;
  reportContent += `測驗卷: ${currentTestName}\n`;
  reportContent += `題目範圍: ${rangeStart.value} - ${rangeEnd.value}\n`;
  reportContent += `考試時間: ${formatTime(teacherStartTime)}\n`;
  reportContent += `結束時間: ${formatTime(endTime)}\n`;
  reportContent += `總時間: ${totalTime} 秒\n\n`;

  reportContent += `【統計摘要】\n`;
  reportContent += `- 正確: ${correctCount} 題\n`;
  reportContent += `- 錯誤: ${wrongCount} 題\n`;
  reportContent += `- 未作答: ${unansweredCount} 題\n`;
  reportContent += `- 正確率: ${correctRate}%\n\n`;

  reportContent += `【各單字詳情】\n`;
  teacherModeData.forEach(item => {
    const statusText = item.result === 'correct' ? '正確' :
                       item.result === 'wrong' ? '錯誤' : '未作答';
    reportContent += `#${item.number.toString().padStart(3, ' ')}  ${item.word.padEnd(15, ' ')} - 發音1: ${item.play1Count}次, 發音2: ${item.play2Count}次 - ${statusText}\n`;
  });

  reportContent += `\n【完整 Log】\n`;
  reportContent += logEntries.join('\n');

  // 下載報告
  const blob = new Blob([reportContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = formatTimeForFilename(new Date());
  a.download = `teacher_mode_${currentTestName}_${timestamp}.log`;
  a.click();
  URL.revokeObjectURL(url);

  alert('報告已匯出！');
}

// 結束老師模式按鈕事件
teacherExitBtn.addEventListener('click', exitTeacherMode);

// 結束老師模式
function exitTeacherMode() {
  if (confirm('確定要結束老師模式嗎？')) {
    addLog(`=== 老師模式結束 ===`);

    isTeacherMode = false;
    teacherModeData = [];
    showScreen(setupScreen);
  }
}
