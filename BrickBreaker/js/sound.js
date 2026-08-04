(function () {
  // 共有名前空間を取得する。
  // 未初期化の場合はここで作ってモジュールを登録できるようにする。
  const BB = window.BB || (window.BB = {});

  /*
    sound 設定が未定義でも動作を維持するためのフォールバック値です。
    通常は config.js の CONFIG.sound が使われます。
  */
  const DEFAULT_SOUND_CONFIG = {
    enabled: true,
    masterVolume: 0.22,
    tones: {
      start: { type: "sine", frequency: 660, endFrequency: 990, duration: 0.08, volume: 0.9 },
      paddleBounce: { type: "triangle", frequency: 300, endFrequency: 380, duration: 0.035, volume: 0.5 },
      brickHit: { type: "square", frequency: 600, endFrequency: 280, duration: 0.045, volume: 0.55 },
      lifeLost: { type: "sawtooth", frequency: 180, endFrequency: 95, duration: 0.14, volume: 0.55 },
      gameOver: { type: "sawtooth", frequency: 150, endFrequency: 75, duration: 0.2, volume: 0.7 },
      stageClear: { type: "sine", frequency: 523.25, endFrequency: 880, duration: 0.12, volume: 0.7 },
      win: { type: "sine", frequency: 523.25, endFrequency: 1174.66, duration: 0.22, volume: 0.85 }
    }
  };

  /*
    WebAudioを使ってSEを鳴らす小さなプレイヤーを作る関数です。
    ブラウザの自動再生制限（ユーザー操作が必要）に対応するため、
    unlock と play を分けて返します。

    引数:
    - soundConfig: config.js 側で定義された CONFIG.sound

    返り値:
    - unlock(): AudioContextの再開を試みる
    - play(name): soundConfig.tones[name] の音を鳴らす
  */
  function createSoundPlayer(soundConfig) {
    // 設定未指定時はフォールバックを使う。
    const settings = soundConfig || DEFAULT_SOUND_CONFIG;
    let audioContext = null;
    let masterGain = null;

    /*
      AudioContextを遅延初期化で取得する関数です。
      必要になるまで実体を作らないことで、
      ページ読み込み直後の不要な初期化を避けます。
    */
    function getAudioContext() {
      if (!settings.enabled) {
        return null;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }

      if (!audioContext) {
        audioContext = new AudioContextClass();
        masterGain = audioContext.createGain();
        masterGain.gain.value = settings.masterVolume;
        masterGain.connect(audioContext.destination);
      }

      return audioContext;
    }

    /*
      ユーザー操作後にAudioContextを再開する関数です。
      ブラウザが音声開始を許可していない状態（suspended）でだけ resume します。
    */
    function unlock() {
      const context = getAudioContext();
      if (context && context.state === "suspended") {
        context.resume().catch(function () {
          // ブラウザ側で拒否された場合は、次のユーザー操作で再試行する。
        });
      }
    }

    /*
      1つのトーン設定を実際に鳴らす低レベル関数です。
      - OscillatorNode: 音程と波形を作る
      - GainNode: 音量エンベロープ（立ち上がり→減衰）を作る

      ここは音の生成だけを担当し、
      どのSEを鳴らすかの判定は play 側で行います。
    */
    function playTone(context, tone) {
      if (!masterGain) {
        return;
      }

      const osc = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      const attack = 0.005;
      const duration = tone.duration;
      const endTime = now + duration;

      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.frequency, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endFrequency), endTime);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(tone.volume, Math.min(endTime, now + attack));
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(endTime + 0.01);
    }

    /*
      名前付きSEを再生する高レベル関数です。
      流れ:
      1) 設定テーブルから tone を引く
      2) AudioContext を取得する
      3) suspended なら resume 後に再生
      4) running なら即再生
    */
    function play(name) {
      const tones = settings.tones || {};
      const tone = tones[name];
      if (!tone) {
        return;
      }

      const context = getAudioContext();
      if (!context || !masterGain) {
        return;
      }

      if (context.state === "suspended") {
        context.resume().then(function () {
          playTone(context, tone);
        }).catch(function () {
          // resume できない場合は無音で継続する。
        });
        return;
      }

      playTone(context, tone);
    }

    return { unlock, play };
  }

  /*
    外部公開 API。
    phaser-game.js はこの API 経由でSEプレイヤーを取得する。
  */
  BB.audio = {
    createSoundPlayer: createSoundPlayer
  };
})();