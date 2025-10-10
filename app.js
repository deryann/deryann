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

// DOM 元素
const setupDialog = document.getElementById('setupDialog');
const testWindow = document.getElementById('testWindow');
const resultDialog = document.getElementById('resultDialog');
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
const yesSound = document.getElementById('yesSound');
const noSound = document.getElementById('noSound');

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
  
  // 儲存 log
  saveLog();
  
  // 顯示總結果
  alert(`Total Result\n\nCorrect: ${correctCount}, Wrong: ${wrongCount}\nTotal time: ${totalTime} 秒`);
  
  // 重置回設定畫面
  testWindow.style.display = 'none';
  setupDialog.style.display = 'flex';
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

// 儲存 log
function saveLog() {
  const logContent = logEntries.join('\n');
  const blob = new Blob([logContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `testing_${currentTestName}_${currentUser}.log`;
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
