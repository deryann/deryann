// 自訂單字解析：瀏覽器（window.CustomWords）與 Node（module.exports）共用
(function (root) {
  // 把使用者輸入的文字切成單字清單
  // 以換行、半形／全形逗號與頓號切分，去掉前後空白、中間連續空白縮成一格、去掉空字串
  // 完全相同才視為重複（作答比對區分大小寫，所以 May 與 may 是兩題）
  function parseCustomWords(text) {
    const seen = new Set();
    return String(text || '')
      .split(/[\r\n,，、]/)
      .map(word => word.trim().replace(/\s+/g, ' '))
      .filter(word => {
        if (word === '') return false;
        if (seen.has(word)) return false;
        seen.add(word);
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
