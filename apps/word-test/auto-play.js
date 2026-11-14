// 老師模式自動播放的狀態機：瀏覽器（window.AutoPlay）與 Node（module.exports）共用
// 不直接碰計時器或語音，全部由呼叫端注入，方便在 Node 測試
(function (root) {
  function createAutoPlayer(options) {
    const { total, speak, cancelSpeech, getGapSeconds, getAnswerSeconds, now, setTimer, clearTimer } = options;
    // 語音開始念（onstart）之後最多等多久（毫秒），超過就當作念完
    const speechTimeoutMs = options.speechTimeoutMs || (() => 10000);
    // 送出語音後等它開始念最多等多久（線上語音可能要先載入），沒等到 onstart 也當作念完
    const speechStartTimeoutMs = options.speechStartTimeoutMs ?? 10000;
    let status = 'idle'; // idle | playing | paused | stopped | finished
    let index = 0;
    let phase = null;    // A | gap | B | answer
    let token = 0;       // 每進入新階段或中斷就換號，舊的語音／計時器回呼一律作廢
    let timer = null;
    let durationMs = null;  // 休息階段的總長度
    let endsAt = null;      // 休息階段預計結束的時間
    let pausedRemainingMs = null;

    function clearPending() {
      token++;
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
    }

    function halt() {
      clearPending();
      cancelSpeech();
    }

    // resumeTiming：暫停後繼續時傳入 { durationMs, remainingMs }，休息階段只倒數剩下的時間
    // isResume：暫停後回到同一個階段；念單字階段會重念，但告訴呼叫端這是重念（不再計次）
    function enterPhase(nextPhase, resumeTiming, isResume = false) {
      clearPending();
      phase = nextPhase;
      durationMs = null;
      endsAt = null;
      pausedRemainingMs = null;
      const myToken = token;
      const isCurrent = () => myToken === token;

      if (phase === 'A' || phase === 'B') {
        // 念完才進入休息階段；有些瀏覽器在 cancel() 後不會送 onend，所以另設保險計時器
        // （先等語音開始，開始後再依單字長度等它念完）
        const done = () => {
          if (!isCurrent()) return;
          enterPhase(phase === 'A' ? 'gap' : 'answer');
        };
        timer = setTimer(done, speechStartTimeoutMs);
        // 真的開始念了才依單字長度起算保險時間
        const onStart = () => {
          if (!isCurrent()) return;
          if (timer !== null) clearTimer(timer);
          timer = setTimer(done, speechTimeoutMs(index));
        };
        notify();
        speak(index, phase === 'A' ? 0 : 1, done, { onStart, repeat: isResume });
        return;
      }

      // 秒數在每次進入休息階段時才讀，播放中修改從下一個休息階段生效
      let remainingMs;
      if (resumeTiming) {
        durationMs = resumeTiming.durationMs;
        remainingMs = resumeTiming.remainingMs;
      } else {
        const seconds = phase === 'gap' ? getGapSeconds() : getAnswerSeconds();
        durationMs = Math.max(0, Number(seconds) || 0) * 1000;
        remainingMs = durationMs;
      }
      endsAt = now() + remainingMs;
      timer = setTimer(() => {
        if (!isCurrent()) return;
        timer = null;
        if (phase === 'gap') {
          enterPhase('B');
        } else if (index + 1 >= total) {
          finish();
        } else {
          index++;
          enterPhase('A');
        }
      }, remainingMs);
      notify();
    }

    function notify() {
      if (options.onChange) options.onChange(getState());
    }

    function finish() {
      halt(); // 播完就不該再有聲音
      status = 'finished';
      phase = null;
      notify();
      if (options.onFinish) options.onFinish();
    }

    // 開始：第一次或播完後從第一題；停止後從停下那一題的念 A
    function start() {
      if (status === 'playing') return;
      if (status === 'paused') {
        resume();
        return;
      }
      if (status === 'idle' || status === 'finished') index = 0;
      status = 'playing';
      enterPhase('A');
    }

    function restart() {
      halt();
      index = 0;
      status = 'playing';
      enterPhase('A');
    }

    // 暫停：休息階段記下剩餘時間；念單字時直接中斷，繼續時重念同一個聲音
    function pause() {
      if (status !== 'playing') return;
      pausedRemainingMs = endsAt === null ? null : Math.max(0, endsAt - now());
      endsAt = null;
      halt();
      status = 'paused';
      notify();
    }

    function resume() {
      if (status !== 'paused') return;
      status = 'playing';
      if (pausedRemainingMs !== null) {
        enterPhase(phase, { durationMs, remainingMs: pausedRemainingMs }, true);
      } else {
        enterPhase(phase, null, true);
      }
    }

    function stop() {
      if (status !== 'playing' && status !== 'paused') return;
      halt();
      status = 'stopped';
      phase = null;
      notify();
    }

    function getState() {
      let remainingMs = null;
      if (status === 'playing' && endsAt !== null) remainingMs = Math.max(0, endsAt - now());
      if (status === 'paused') remainingMs = pausedRemainingMs;
      return { status, index, phase, total, durationMs, remainingMs };
    }

    return { start, pause, resume, stop, restart, getState };
  }

  // 秒數設定的預設值與上限（畫面上的輸入欄也從這裡取值）
  const DEFAULT_GAP_SECONDS = 2;
  const DEFAULT_ANSWER_SECONDS = 15;
  const MAX_SECONDS = 600;

  // 把輸入的秒數整理成 0～MAX_SECONDS 的整數；空白或不合法時用 fallback
  function parseSeconds(raw, fallback) {
    const text = String(raw ?? '').trim();
    const value = Math.floor(Number(text));
    if (text === '' || !Number.isFinite(value) || value < 0) return fallback;
    return Math.min(value, MAX_SECONDS);
  }

  const api = { createAutoPlayer, parseSeconds, DEFAULT_GAP_SECONDS, DEFAULT_ANSWER_SECONDS, MAX_SECONDS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.AutoPlay = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
