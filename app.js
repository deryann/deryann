// 全域變數
let appConfig = null;
let testData = {};
let availableTests = [];
let currentUser = '';
let currentTestName = '';
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

// 老師模式變數
let isTeacherMode = false;
let teacherModeData = []; // 記錄每個單字的狀態
let teacherStartTime = null;

// DOM 元素
const setupDialog = document.getElementById('setupDialog');
const testWindow = document.getElementById('testWindow');
const resultDialog = document.getElementById('resultDialog');
const finalResultDialog = document.getElementById('finalResultDialog');
const userSelect = document.getElementById('userSelect');
const testSelect = document.getElementById('testSelect');
const rangeStart = document.getElementById('rangeStart');
const rangeEnd = document.getElementById('rangeEnd');
const rangeDisplay = document.getElementById('rangeDisplay');
const randomCheck = document.getElementById('randomCheck');
const startBtn = document.getElementById('startBtn');
const testTitle = document.getElementById('testTitle');
const testInfo = document.getElementById('testInfo');
const answerInput = document.getElementById('answerInput');
const progressText = document.getElementById('progressText');
const statsText = document.getElementById('statsText');
const submitBtn = document.getElementById('submitBtn');
const replay1Btn = document.getElementById('replay1Btn');
const replay2Btn = document.getElementById('replay2Btn');
const retestBtn = document.getElementById('retestBtn');
const resultImage = document.getElementById('resultImage');
const resultMessage = document.getElementById('resultMessage');
const resultOkBtn = document.getElementById('resultOkBtn');
const finalStats = document.getElementById('finalStats');
const finalTime = document.getElementById('finalTime');
const resultWordsList = document.getElementById('resultWordsList');
const saveLogBtn = document.getElementById('saveLogBtn');
const closeResultBtn = document.getElementById('closeResultBtn');
const yesSound = document.getElementById('yesSound');
const noSound = document.getElementById('noSound');

// 老師模式 DOM 元素
const teacherModeBtn = document.getElementById('teacherModeBtn');
const teacherModeWindow = document.getElementById('teacherModeWindow');
const teacherInfo = document.getElementById('teacherInfo');
const wordCardsContainer = document.getElementById('wordCardsContainer');
const teacherSummaryBtn = document.getElementById('teacherSummaryBtn');
const teacherExitBtn = document.getElementById('teacherExitBtn');
const teacherResultDialog = document.getElementById('teacherResultDialog');
const teacherStats = document.getElementById('teacherStats');
const teacherWordDetails = document.getElementById('teacherWordDetails');
const exportReportBtn = document.getElementById('exportReportBtn');
const closeTeacherResultBtn = document.getElementById('closeTeacherResultBtn');

// 初始化
async function init() {
  try {
    // 載入使用者設定
    const configResponse = await fetch('app_cfg.json');
    appConfig = await configResponse.json();
    
    // 填充使用者選單
    appConfig.Users.forEach(user => {
      const option = document.createElement('option');
      option.value = user;
      option.textContent = user;
      userSelect.appendChild(option);
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
  const testFiles = ['1A', '1AAll', '1ARS', '2AAll', '2AReading', '2AScience', 'AL'];
  
  for (const testName of testFiles) {
    try {
      const response = await fetch(`cfg/${testName}.json`);
      const data = await response.json();
      testData[testName] = data;
      availableTests.push(testName);
      
      const option = document.createElement('option');
      option.value = testName;
      option.textContent = testName;
      testSelect.appendChild(option);
    } catch (error) {
      console.warn(`無法載入測驗卷: ${testName}`);
    }
  }
}

// 初始化語音
function initVoices() {
  if (!('speechSynthesis' in window)) {
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
  };
  
  loadVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

// 範圍滑桿更新
rangeStart.addEventListener('input', updateRangeDisplay);
rangeEnd.addEventListener('input', updateRangeDisplay);

function updateRangeDisplay() {
  let start = parseInt(rangeStart.value);
  let end = parseInt(rangeEnd.value);
  
  // 確保 start <= end
  if (start > end) {
    [start, end] = [end, start];
    rangeStart.value = start;
    rangeEnd.value = end;
  }
  
  rangeDisplay.textContent = `${start} - ${end}`;
}

// 測驗卷選擇變更時，更新範圍
testSelect.addEventListener('change', () => {
  if (testSelect.value) {
    const data = testData[testSelect.value];
    const maxNum = Math.max(...Object.keys(data).map(Number));
    rangeStart.max = maxNum;
    rangeEnd.max = maxNum;
    rangeEnd.value = maxNum;
    updateRangeDisplay();
  }
});

// 開始測驗按鈕
startBtn.addEventListener('click', startTest);

function startTest() {
  // 驗證選擇
  if (!userSelect.value) {
    alert('請選擇考生名字！');
    return;
  }
  
  if (!testSelect.value) {
    alert('請選擇測驗卷！');
    return;
  }
  
  currentUser = userSelect.value;
  currentTestName = testSelect.value;
  
  // 準備題目
  prepareWordList();
  
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
  updateTestInfo();
  updateProgress();
  
  // 切換視窗
  setupDialog.style.display = 'none';
  testWindow.style.display = 'block';
  answerInput.focus();
  
  // 播放第一個單字
  speakWord(0);
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

// 更新測驗資訊
function updateTestInfo() {
  testInfo.textContent = `考生: ${currentUser}, ${currentTestName} 測驗, 題目: ${rangeStart.value}~${rangeEnd.value}`;
}

// 更新進度
function updateProgress() {
  progressText.textContent = `${currentIndex + 1}/${wordList.length}`;
  statsText.textContent = `Correct: ${correctCount}, Wrong: ${wrongCount}`;
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
    checkAnswer();
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
    word: correctAnswer,
    isCorrect: isCorrect,
    userAnswer: userAnswer
  });
  
  if (isCorrect) {
    correctCount++;
    yesSound.play();
    addLog(`O: ${correctAnswer}`);
    showResult(true, correctAnswer);
  } else {
    wrongCount++;
    noSound.play();
    addLog(`X: ${correctAnswer} Your answer: ${userAnswer}`);
    showResult(false, correctAnswer);
  }
  
  updateProgress();
}

// 顯示結果對話框
function showResult(isCorrect, correctAnswer) {
  resultDialog.style.display = 'flex';
  
  if (isCorrect) {
    resultMessage.textContent = 'Correct!';
    resultImage.src = 'r.jpg';
  } else {
    resultMessage.textContent = `Wrong! Correct answer is: ${correctAnswer}`;
    resultImage.src = 'w.jpg';
  }
  
  resultImage.style.display = 'block';
  resultImage.onerror = () => {
    resultImage.style.display = 'none';
  };
  
  resultOkBtn.focus();
}

// 結果對話框確定按鈕
resultOkBtn.addEventListener('click', closeResultDialog);
resultOkBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    closeResultDialog();
  }
});

function closeResultDialog() {
  resultDialog.style.display = 'none';
  answerInput.value = '';
  answerInput.focus();
  
  // 判斷是否為最後一題
  if (currentIndex >= wordList.length - 1) {
    showFinalResult();
  } else {
    currentIndex++;
    updateProgress();
    speakWord();
  }
}

// 顯示最終結果
function showFinalResult() {
  const endTime = new Date();
  const totalTime = ((endTime - startTime) / 1000).toFixed(1);
  
  addLog(`=== 測驗結束 ===`);
  addLog(`結束時間: ${formatTime(endTime)}`);
  addLog(`總時間: ${totalTime} 秒`);
  addLog(`正確: ${correctCount}, 錯誤: ${wrongCount}`);
  
  // 隱藏測驗視窗
  testWindow.style.display = 'none';
  
  // 顯示結果統計
  finalStats.textContent = `正確: ${correctCount} 題, 錯誤: ${wrongCount} 題`;
  finalTime.textContent = `總時間: ${totalTime} 秒`;
  
  // 顯示單字結果列表
  resultWordsList.innerHTML = '';
  testResults.forEach(result => {
    const wordDiv = document.createElement('div');
    wordDiv.className = `result-word ${result.isCorrect ? 'correct' : 'wrong'}`;
    wordDiv.textContent = result.word;
    if (!result.isCorrect) {
      wordDiv.title = `你的答案: ${result.userAnswer}`;
    }
    resultWordsList.appendChild(wordDiv);
  });
  
  // 顯示結果對話框
  finalResultDialog.style.display = 'flex';
}

// 重新播放按鈕
replay1Btn.addEventListener('click', () => speakWord(0));
replay2Btn.addEventListener('click', () => speakWord(1));

// 重新測試按鈕
retestBtn.addEventListener('click', () => {
  if (confirm('確定要重新測試嗎？目前進度將會重置。')) {
    addLog(`=== 重新測試 ===`);
    startTest();
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

// 儲存 log 按鈕
saveLogBtn.addEventListener('click', () => {
  saveLog();
  alert('Log 已儲存！');
});

// 關閉結果對話框按鈕
closeResultBtn.addEventListener('click', () => {
  finalResultDialog.style.display = 'none';
  setupDialog.style.display = 'flex';
});

// ============================================
// 老師模式功能
// ============================================

// 老師模式按鈕事件
teacherModeBtn.addEventListener('click', startTeacherMode);

// 開始老師模式
function startTeacherMode() {
  // 驗證選擇
  if (!testSelect.value) {
    alert('請選擇測驗卷！');
    return;
  }

  currentTestName = testSelect.value;
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
  teacherInfo.textContent = `測驗卷: ${currentTestName}, 題目範圍: ${rangeStart.value}~${rangeEnd.value}, 共 ${wordList.length} 題`;

  // 生成單字卡片
  generateWordCards();

  // 切換視窗
  setupDialog.style.display = 'none';
  teacherModeWindow.style.display = 'block';

  // 記錄 log
  logEntries = [];
  addLog(`=== 老師模式開始 ===`);
  addLog(`測驗卷: ${currentTestName}`);
  addLog(`題目範圍: ${rangeStart.value} - ${rangeEnd.value}`);
  addLog(`隨機 20 題: ${randomCheck.checked ? '是' : '否'}`);
  addLog(`題目清單: ${wordList.map(w => w.word).join(', ')}`);
  addLog(`開始時間: ${formatTime(teacherStartTime)}`);
}

// 生成單字卡片
function generateWordCards() {
  wordCardsContainer.innerHTML = '';

  teacherModeData.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'word-card';
    card.id = `word-card-${index}`;

    card.innerHTML = `
      <div class="word-card-header">
        <span class="word-card-number">#${item.number}</span>
        <span class="word-card-word">${item.word}</span>
      </div>
      <div class="word-card-buttons">
        <button class="play-btn" onclick="playTeacherWord(${index}, 0)">
          發音1 <span class="play-count" id="play1-count-${index}">0</span>
        </button>
        <button class="play-btn" onclick="playTeacherWord(${index}, 1)">
          發音2 <span class="play-count" id="play2-count-${index}">0</span>
        </button>
      </div>
      <div class="word-card-radios">
        <label class="radio-option">
          <input type="radio" name="result-${index}" value="" checked onchange="setWordResult(${index}, null)">
          尚未作答
        </label>
        <label class="radio-option correct-option">
          <input type="radio" name="result-${index}" value="correct" onchange="setWordResult(${index}, 'correct')">
          正確
        </label>
        <label class="radio-option wrong-option">
          <input type="radio" name="result-${index}" value="wrong" onchange="setWordResult(${index}, 'wrong')">
          錯誤
        </label>
      </div>
    `;

    wordCardsContainer.appendChild(card);
  });
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

// 設定單字結果
function setWordResult(index, result) {
  teacherModeData[index].result = result;

  const card = document.getElementById(`word-card-${index}`);
  card.classList.remove('correct', 'wrong');

  if (result === 'correct') {
    card.classList.add('correct');
  } else if (result === 'wrong') {
    card.classList.add('wrong');
  }

  addLog(`設定結果: ${teacherModeData[index].word} = ${result === null ? '未作答' : result === 'correct' ? '正確' : '錯誤'}`);
}

// 總結成績按鈕事件
teacherSummaryBtn.addEventListener('click', showTeacherSummary);

// 顯示老師模式總結
function showTeacherSummary() {
  const endTime = new Date();
  const totalTime = ((endTime - teacherStartTime) / 1000).toFixed(1);

  // 計算統計
  const correctCount = teacherModeData.filter(item => item.result === 'correct').length;
  const wrongCount = teacherModeData.filter(item => item.result === 'wrong').length;
  const unansweredCount = teacherModeData.filter(item => item.result === null).length;
  const totalCount = teacherModeData.length;
  const answeredCount = correctCount + wrongCount;
  const correctRate = answeredCount > 0 ? ((correctCount / answeredCount) * 100).toFixed(1) : 0;

  // 顯示統計
  teacherStats.innerHTML = `
    <p>正確: <span class="stat-highlight">${correctCount}</span> 題</p>
    <p>錯誤: <span class="stat-highlight">${wrongCount}</span> 題</p>
    <p>未作答: <span class="stat-highlight">${unansweredCount}</span> 題</p>
    <p>正確率: <span class="stat-highlight">${correctRate}%</span> (${correctCount}/${answeredCount})</p>
    <p>考試時間: ${totalTime} 秒</p>
  `;

  // 顯示詳細資訊
  teacherWordDetails.innerHTML = '';
  teacherModeData.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'teacher-word-item';

    const statusClass = item.result === 'correct' ? 'correct' :
                        item.result === 'wrong' ? 'wrong' : 'unanswered';
    const statusText = item.result === 'correct' ? '正確' :
                       item.result === 'wrong' ? '錯誤' : '未作答';

    itemDiv.innerHTML = `
      <span class="word-number">#${item.number}</span>
      <span class="word-text">${item.word}</span>
      <span class="play-counts">發音1: ${item.play1Count}次, 發音2: ${item.play2Count}次</span>
      <span class="word-status ${statusClass}">${statusText}</span>
    `;

    teacherWordDetails.appendChild(itemDiv);
  });

  // 記錄 log
  addLog(`=== 老師模式總結 ===`);
  addLog(`結束時間: ${formatTime(endTime)}`);
  addLog(`總時間: ${totalTime} 秒`);
  addLog(`正確: ${correctCount}, 錯誤: ${wrongCount}, 未作答: ${unansweredCount}`);
  addLog(`正確率: ${correctRate}%`);

  // 顯示對話框
  teacherResultDialog.style.display = 'flex';
}

// 匯出報告按鈕事件
exportReportBtn.addEventListener('click', exportTeacherReport);

// 匯出老師模式報告
function exportTeacherReport() {
  const endTime = new Date();
  const totalTime = ((endTime - teacherStartTime) / 1000).toFixed(1);

  // 計算統計
  const correctCount = teacherModeData.filter(item => item.result === 'correct').length;
  const wrongCount = teacherModeData.filter(item => item.result === 'wrong').length;
  const unansweredCount = teacherModeData.filter(item => item.result === null).length;
  const answeredCount = correctCount + wrongCount;
  const correctRate = answeredCount > 0 ? ((correctCount / answeredCount) * 100).toFixed(1) : 0;

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

// 關閉老師模式總結對話框
closeTeacherResultBtn.addEventListener('click', () => {
  teacherResultDialog.style.display = 'none';
});

// 結束老師模式按鈕事件
teacherExitBtn.addEventListener('click', exitTeacherMode);

// 結束老師模式
function exitTeacherMode() {
  if (confirm('確定要結束老師模式嗎？')) {
    addLog(`=== 老師模式結束 ===`);

    isTeacherMode = false;
    teacherModeData = [];
    teacherModeWindow.style.display = 'none';
    teacherResultDialog.style.display = 'none';
    setupDialog.style.display = 'flex';
  }
}
