// 自訂單字解析：瀏覽器（window.CustomWords）與 Node（module.exports）共用
(function (root) {
  // 把使用者輸入的文字切成單字清單
  // 以換行與逗號切分、去掉前後空白與空字串，不分大小寫去除重複（保留第一次出現的寫法）
  function parseCustomWords(text) {
    const seen = new Set();
    return String(text || '')
      .split(/[\r\n,]/)
      .map(word => word.trim())
      .filter(word => {
        if (word === '') return false;
        const key = word.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  // 轉成與 papers/*.json 相同的結構：{"1": "apple", "2": "banana", ...}
  function buildPaper(words) {
    const paper = {};
    words.forEach((word, index) => {
      paper[String(index + 1)] = word;
    });
    return paper;
  }

  const api = { parseCustomWords, buildPaper };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.CustomWords = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
