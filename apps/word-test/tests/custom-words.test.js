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

test('前後空白、空行、連續逗號與 Windows 換行都會被忽略', () => {
  assert.deepEqual(
    parseCustomWords('  apple  \r\n\n\n banana ,, ,cherry,\n   \n'),
    ['apple', 'banana', 'cherry']
  );
});

test('含空格的片語視為一題', () => {
  assert.deepEqual(parseCustomWords('ice cream, hot dog\nice  skate'), ['ice cream', 'hot dog', 'ice  skate']);
});

test('重複單字不分大小寫自動去除，保留第一次出現的原始寫法', () => {
  assert.deepEqual(
    parseCustomWords('apple\nbanana, cherry\nice cream,apple'),
    ['apple', 'banana', 'cherry', 'ice cream']
  );
  assert.deepEqual(parseCustomWords('Apple, apple, APPLE, Ice Cream, ice cream'), ['Apple', 'Ice Cream']);
});

test('轉成與現有考卷相同的 {"1": ..., "2": ...} 結構', () => {
  assert.deepEqual(buildPaper(['apple', 'ice cream', 'cherry']), { 1: 'apple', 2: 'ice cream', 3: 'cherry' });
  assert.deepEqual(buildPaper([]), {});
});
