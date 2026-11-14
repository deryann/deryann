// 老師模式自動播放的狀態機：瀏覽器（window.AutoPlay）與 Node（module.exports）共用
// 不直接碰計時器或語音，全部由呼叫端注入，方便在 Node 測試
(function (root) {
  function createAutoPlayer(options) {
    const { total, speak, cancelSpeech, getGapSeconds, getAnswerSeconds, now, setTimer, clearTimer } = options;
    // 每次念單字最多等多久（毫秒），超過就當作念完
    const speechTimeoutMs = options.speechTimeoutMs || (() => 10000);
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
    function enterPhase(nextPhase, resumeTiming) {
      clearPending();
      phase = nextPhase;
      durationMs = null;
      endsAt = null;
      pausedRemainingMs = null;
      const myToken = token;
      const isCurrent = () => myToken === token;

      if (phase === 'A' || phase === 'B') {
        // 念完才進入休息階段；有些瀏覽器在 cancel() 後不會送 onend，所以另設保險計時器
        const done = () => {
          if (!isCurrent()) return;
          enterPhase(phase === 'A' ? 'gap' : 'answer');
        };
        timer = setTimer(done, speechTimeoutMs(index));
        notify();
        speak(index, phase === 'A' ? 0 : 1, done);
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
      clearPending();
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
        enterPhase(phase, { durationMs, remainingMs: pausedRemainingMs });
      } else {
        enterPhase(phase);
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

  const api = { createAutoPlayer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.AutoPlay = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
