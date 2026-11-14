// 自訂單字解析的測試：node --test apps/word-test/tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCustomWords, buildPaper } = require('../custom-words.js');

test('每行一個單字可以正確解析', () => {
  assert.deepEqual(parseCustomWords('apple\nbanana\ncherry'), ['apple', 'banana', 'cherry']);
});

test('以逗號分隔，或換行與逗號混用都可以', () => {
  assert.deepEqual(parseCustomWords('apple,banana,cherry'), ['apple', 'banana', 'cherry']);
  assert.deepEqual(parseCustomWords('apple\nbanana,cherry\ndog'), ['apple', 'banana', 'cherry', 'dog']);
});

test('全形逗號「，」與頓號「、」也可以當分隔符號', () => {
  assert.deepEqual(parseCustomWords('apple，banana、cherry\ndog, egg'), ['apple', 'banana', 'cherry', 'dog', 'egg']);
});

test('前後空白、空行、連續逗號與 Windows 換行都會被忽略', () => {
  assert.deepEqual(
    parseCustomWords('  apple  \r\n\n\n banana ,, ,cherry,\n   \n'),
    ['apple', 'banana', 'cherry']
  );
});

test('含空格的片語視為一題，中間連續空白縮成一個空格', () => {
  assert.deepEqual(parseCustomWords('ice cream, hot dog\nice  skate'), ['ice cream', 'hot dog', 'ice skate']);
  assert.deepEqual(parseCustomWords('ice \t cream, ice cream'), ['ice cream']);
});

test('完全相同的重複單字自動去除，保留第一次出現的位置', () => {
  assert.deepEqual(
    parseCustomWords('apple\nbanana, cherry\nice cream,apple'),
    ['apple', 'banana', 'cherry', 'ice cream']
  );
});

test('大小寫不同視為不同單字（作答比對區分大小寫）', () => {
  assert.deepEqual(parseCustomWords('May, may, May'), ['May', 'may']);
});

test('轉成與現有考卷相同的 {"1": ..., "2": ...} 結構', () => {
  assert.deepEqual(buildPaper(['apple', 'ice cream', 'cherry']), { 1: 'apple', 2: 'ice cream', 3: 'cherry' });
  assert.deepEqual(buildPaper([]), {});
});
