// 自動播放狀態機的測試：node --test apps/word-test/tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAutoPlayer } = require('../auto-play.js');

// 假的時鐘與語音：手動推進時間、手動讓語音念完
function createHarness({ total = 3, gap = 2, answer = 15, speechTimeoutMs = 10000, onChange } = {}) {
  let now = 0;
  let nextId = 1;
  const timers = new Map(); // id -> { at, fn }
  const spoken = [];        // { index, voiceIndex, done }
  const events = [];
  const settings = { gap, answer };

  const player = createAutoPlayer({
    total,
    getGapSeconds: () => settings.gap,
    getAnswerSeconds: () => settings.answer,
    speak(index, voiceIndex, done) {
      spoken.push({ index, voiceIndex, done });
    },
    cancelSpeech() {
      events.push('cancelSpeech');
    },
    speechTimeoutMs: () => speechTimeoutMs,
    onFinish: () => events.push('finish'),
    onChange,
    now: () => now,
    setTimer(fn, ms) {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
  });

  // 推進時間，依序觸發到期的計時器
  function advance(ms) {
    const target = now + ms;
    for (;;) {
      let next = null;
      for (const [id, t] of timers) {
        if (t.at <= target && (next === null || t.at < next.t.at)) next = { id, t };
      }
      if (!next) break;
      timers.delete(next.id);
      now = next.t.at;
      next.t.fn();
    }
    now = target;
  }

  // 讓最後一次語音念完
  function finishSpeech() {
    spoken[spoken.length - 1].done();
  }

  const said = () => spoken.map(s => `${s.index}${s.voiceIndex === 0 ? 'A' : 'B'}`);

  return { player, advance, finishSpeech, spoken, said, events, settings, timers };
}

test('第一次按開始，從第一題用聲音 A 念', () => {
  const h = createHarness();
  h.player.start();
  assert.deepEqual(h.said(), ['0A']);
  const state = h.player.getState();
  assert.equal(state.status, 'playing');
  assert.equal(state.index, 0);
  assert.equal(state.phase, 'A');
});

test('每題依序：念 A → 間隔 → 念 B → 作答時間 → 下一題', () => {
  const h = createHarness({ gap: 2, answer: 15 });
  h.player.start();
  h.finishSpeech();
  assert.equal(h.player.getState().phase, 'gap');
  h.advance(1999);
  assert.deepEqual(h.said(), ['0A']);
  h.advance(1);
  assert.deepEqual(h.said(), ['0A', '0B']);
  assert.equal(h.player.getState().phase, 'B');
  h.finishSpeech();
  assert.equal(h.player.getState().phase, 'answer');
  h.advance(14999);
  assert.deepEqual(h.said(), ['0A', '0B']);
  h.advance(1);
  assert.deepEqual(h.said(), ['0A', '0B', '1A']);
  assert.equal(h.player.getState().index, 1);
  assert.equal(h.player.getState().phase, 'A');
});

test('間隔要等單字念完才開始計時', () => {
  const h = createHarness({ gap: 2 });
  h.player.start();
  h.advance(5000); // 念得很慢，還沒念完
  assert.deepEqual(h.said(), ['0A']);
  h.finishSpeech();
  h.advance(1999);
  assert.deepEqual(h.said(), ['0A']);
  h.advance(1);
  assert.deepEqual(h.said(), ['0A', '0B']);
});

// 把目前這一題完整走完（念 A → 間隔 → 念 B → 作答時間）
function playThroughQuestion(h) {
  h.finishSpeech();
  h.advance(h.settings.gap * 1000);
  h.finishSpeech();
  h.advance(h.settings.answer * 1000);
}

test('播完最後一題的作答時間後自動結束，並通知播放完畢', () => {
  const h = createHarness({ total: 2 });
  h.player.start();
  playThroughQuestion(h);
  playThroughQuestion(h);
  assert.deepEqual(h.said(), ['0A', '0B', '1A', '1B']);
  assert.equal(h.player.getState().status, 'finished');
  assert.deepEqual(h.events.filter(e => e === 'finish'), ['finish']);
  assert.equal(h.timers.size, 0);
});

test('播放完畢後再按開始，等同重新播放，從第一題開始', () => {
  const h = createHarness({ total: 2 });
  h.player.start();
  playThroughQuestion(h);
  playThroughQuestion(h);
  h.player.start();
  assert.deepEqual(h.said(), ['0A', '0B', '1A', '1B', '0A']);
  assert.equal(h.player.getState().status, 'playing');
});

test('語音一直沒有回報念完時，等到保險時間後照樣往下走', () => {
  const h = createHarness({ gap: 2, speechTimeoutMs: 8000 });
  h.player.start();
  h.advance(7999);
  assert.equal(h.player.getState().phase, 'A');
  h.advance(1);
  assert.equal(h.player.getState().phase, 'gap');
  h.spoken[0].done();        // 很晚才送來的 onend 不能讓間隔被跳過
  assert.equal(h.player.getState().phase, 'gap');
  h.advance(2000);
  assert.deepEqual(h.said(), ['0A', '0B']);
});

test('語音正常念完後，保險計時器會被清掉', () => {
  const h = createHarness({ gap: 2, speechTimeoutMs: 8000 });
  h.player.start();
  h.finishSpeech();
  assert.equal(h.timers.size, 1); // 只剩間隔的計時器
});

test('播放中修改秒數，從下一個休息階段開始生效', () => {
  const h = createHarness({ gap: 2, answer: 15 });
  h.player.start();
  h.finishSpeech();          // 間隔 2 秒已開始
  h.settings.gap = 5;
  h.settings.answer = 3;
  h.advance(2000);
  assert.deepEqual(h.said(), ['0A', '0B']);
  h.finishSpeech();
  h.advance(3000);           // 作答時間用新的 3 秒
  assert.deepEqual(h.said(), ['0A', '0B', '1A']);
  h.finishSpeech();
  h.advance(4999);           // 下一題的間隔用新的 5 秒
  assert.deepEqual(h.said(), ['0A', '0B', '1A']);
  h.advance(1);
  assert.deepEqual(h.said(), ['0A', '0B', '1A', '1B']);
});

test('狀態改變時會通知畫面更新', () => {
  const phases = [];
  const h = createHarness({ onChange: state => phases.push(`${state.status}:${state.phase}`) });
  h.player.start();
  h.finishSpeech();
  h.player.pause();
  h.player.stop();
  assert.deepEqual(phases, ['playing:A', 'playing:gap', 'paused:gap', 'stopped:null']);
});

test('作答時間中暫停，繼續後倒數剩下的秒數', () => {
  const h = createHarness({ answer: 15 });
  h.player.start();
  h.finishSpeech();
  h.advance(2000);
  h.finishSpeech();          // 進入作答時間
  h.advance(5000);
  assert.equal(h.player.getState().remainingMs, 10000);
  h.player.pause();
  assert.equal(h.player.getState().status, 'paused');
  assert.equal(h.timers.size, 0);
  h.advance(60000);          // 暫停期間時間不會走
  assert.equal(h.player.getState().remainingMs, 10000);
  h.player.resume();
  assert.equal(h.player.getState().phase, 'answer');
  h.advance(9999);
  assert.deepEqual(h.said(), ['0A', '0B']);
  h.advance(1);
  assert.deepEqual(h.said(), ['0A', '0B', '1A']);
});

test('念單字時暫停，繼續後重新念同一個聲音', () => {
  const h = createHarness();
  h.player.start();
  h.finishSpeech();
  h.advance(2000);           // 念 B 中
  const pausedB = h.spoken[h.spoken.length - 1];
  h.player.pause();
  assert.ok(h.events.includes('cancelSpeech'));
  pausedB.done();            // cancel 造成的 onend 不能推進
  assert.equal(h.player.getState().phase, 'B');
  h.player.resume();
  assert.deepEqual(h.said(), ['0A', '0B', '0B']);
  h.finishSpeech();
  assert.equal(h.player.getState().phase, 'answer');
});

test('暫停中按開始等同繼續', () => {
  const h = createHarness({ gap: 2 });
  h.player.start();
  h.finishSpeech();
  h.advance(500);
  h.player.pause();
  h.player.start();
  assert.equal(h.player.getState().phase, 'gap');
  h.advance(1500);
  assert.deepEqual(h.said(), ['0A', '0B']);
});

test('停止會清掉計時器與語音，之後舊的回呼不會再推進', () => {
  const h = createHarness();
  h.player.start();
  h.finishSpeech();          // 進入間隔
  h.player.stop();
  assert.equal(h.player.getState().status, 'stopped');
  assert.equal(h.timers.size, 0);
  assert.ok(h.events.includes('cancelSpeech'));
  h.spoken[0].done();        // 瀏覽器在 cancel 後才補送 onend
  h.advance(60000);
  assert.deepEqual(h.said(), ['0A']);
});

test('停止後再按開始，從停下來那一題的念 A 開始', () => {
  const h = createHarness();
  h.player.start();
  playThroughQuestion(h);    // 進到第 2 題
  h.finishSpeech();
  h.advance(2000);           // 第 2 題念 B 中
  h.player.stop();
  h.player.start();
  assert.deepEqual(h.said(), ['0A', '0B', '1A', '1B', '1A']);
  assert.equal(h.player.getState().index, 1);
  assert.equal(h.player.getState().phase, 'A');
});

test('重新播放從第一題開始，舊一輪的語音念完也不會影響新一輪', () => {
  const h = createHarness();
  h.player.start();
  playThroughQuestion(h);    // 進到第 2 題念 A
  const oldA = h.spoken[h.spoken.length - 1];
  h.player.restart();
  assert.deepEqual(h.said(), ['0A', '0B', '1A', '0A']);
  oldA.done();               // 舊一輪的 onend 遲到
  assert.equal(h.player.getState().phase, 'A');
  assert.equal(h.player.getState().index, 0);
  assert.deepEqual(h.said(), ['0A', '0B', '1A', '0A']);
});
