window.BB = window.BB || {};

(function () {
  // layouts.js 側の静的レイアウトを参照する。
  // 存在しない場合でも空オブジェクトにして安全に動かす。
  const STATIC_LAYOUTS = window.BB.layouts || {};

  // ゲーム全体の設定値を1か所にまとめる。
  // Phaser 側はこのオブジェクトだけを参照して挙動を決める。
  window.BB.CONFIG = {
    // 画面の横幅（ゲーム内で使う座標の最大Xに近い値）。
    width: 360,
    // 画面の高さ（ゲーム内で使う座標の最大Yに近い値）。
    height: 520,

    // 最初に持っているライフ数。
    initialLives: 3,
    // パドルの高さ。
    paddleHeight: 7,
    // パドルの縦位置（画面下に固定するためのY座標）。
    paddleY: 490,
    // ボールの半径。
    ballRadius: 5,

    // ブロック種類ごとの見た目・耐久・得点。
    // color は 0xRRGGBB 形式（文字列/数値どちらでも可）。
    blockTypes: {
      A: {
        // Aブロックの色。
        color: "0xff6b6b",
        // Aブロックの耐久（1なら1回で壊れる）。
        hitPoints: 1,
        // Aブロックを壊したときの得点。
        score: 10
      },
      B: {
        // Bブロックの色。
        color: "0x6c63ff",
        // Bブロックの耐久。
        hitPoints: 1,
        // Bブロックを壊したときの得点。
        score: 10
      }
    },

    // ステージ定義。
    // difficulty はそのステージ中だけ適用される。
    stages: [
      {
        // 画面に表示するステージ名。
        name: "Lv.1 はじめの一歩",
        difficulty: {
          // このステージのパドル幅。
          paddleWidth: 72,
          // キーボード操作時に1フレームで動く量。
          paddleSpeed: 10,
          // ボールの基本速度（Phaserの速度単位）。
          ballSpeed: 220,
          // パドル端で当てたときの横方向の勢い補正。
          ballBoostOnHit: 1.2,
          // ほぼ真上移動にならないための横速度の最低値。
          ballMinHorizontalSpeed: 90
        },
        // ブロック配置可能エリア（createBrickMap がこの領域内に収まるようサイズを自動計算する）。
        brickField: {
          // ブロック領域の左端。
          left: 8,
          // ブロック領域の右端の余白。
          right: 8,
          // ブロック領域の上端。
          top: 10,
          // ブロック領域の下端（ただしパドル位置との兼ね合いで内部調整される）。
          bottom: 300,
          // ブロック同士の最小すき間。
          minGap: 1
        },
        // このステージで使うブロック配置。
        blockLayout: STATIC_LAYOUTS.stage1 || []
      },
      {
        // 画面に表示するステージ名。
        name: "Lv.2 試練のとき",
        difficulty: {
          // このステージのパドル幅。
          paddleWidth: 84,
          // キーボード操作時に1フレームで動く量。
          paddleSpeed: 9,
          // ボールの基本速度（Phaserの速度単位）。
          ballSpeed: 280,
          // パドル端で当てたときの横方向の勢い補正。
          ballBoostOnHit: 1.25,
          // ほぼ真上移動にならないための横速度の最低値。
          ballMinHorizontalSpeed: 110
        },
        // ブロック配置可能エリア（createBrickMap がこの領域内に収まるようサイズを自動計算する）。
        brickField: {
          // ブロック領域の左端。
          left: 8,
          // ブロック領域の右端の余白。
          right: 8,
          // ブロック領域の上端。
          top: 10,
          // ブロック領域の下端（ただしパドル位置との兼ね合いで内部調整される）。
          bottom: 300,
          // ブロック同士の最小すき間。
          minGap: 1
        },
        // このステージで使うブロック配置。
        blockLayout: STATIC_LAYOUTS.stage2 || []
      },
      {
        // 画面に表示するステージ名。
        name: "Lv.3 最後の挑戦",
        difficulty: {
          // このステージのパドル幅。
          paddleWidth: 76,
          // キーボード操作時に1フレームで動く量。
          paddleSpeed: 8,
          // ボールの基本速度（Phaserの速度単位）。
          ballSpeed: 330,
          // パドル端で当てたときの横方向の勢い補正。
          ballBoostOnHit: 1.3,
          // ほぼ真上移動にならないための横速度の最低値。
          ballMinHorizontalSpeed: 125
        },
        // ブロック配置可能エリア（createBrickMap がこの領域内に収まるようサイズを自動計算する）。
        brickField: {
          // ブロック領域の左端。
          left: 8,
          // ブロック領域の右端の余白。
          right: 8,
          // ブロック領域の上端。
          top: 10,
          // ブロック領域の下端（ただしパドル位置との兼ね合いで内部調整される）。
          bottom: 300,
          // ブロック同士の最小すき間。
          minGap: 1
        },
        // このステージで使うブロック配置。
        blockLayout: STATIC_LAYOUTS.stage3 || []
      }
    ],

    // 基本色（HUD は CSS 側、ゲームオブジェクトは Phaser 側で利用）。
    colors: {
      // 背景グラデーション上側の色（現在は将来拡張用）。
      bgTop: 0x12213d,
      // 背景の基準色。
      bgBottom: 0x07111f,
      // パドルの色。
      paddle: 0x74f7ff,
      // ボールの色。
      ball: 0xffe29a
    },

    // 効果音（SE）の設定。
    // 実際の再生は sound.js が担当し、ここは値の定義だけを持つ。
    sound: {
      // SE 全体を有効化するかどうか。
      enabled: true,
      // 最終出力に掛かる共通音量。
      masterVolume: 0.4,
      // SE 種類ごとのトーン定義。
      tones: {
        // 発射時の上昇音。
        start: { type: "sine", frequency: 660, endFrequency: 990, duration: 0.08, volume: 0.9 },
        // パドル反射時の短い反応音。
        paddleBounce: { type: "triangle", frequency: 300, endFrequency: 380, duration: 0.035, volume: 0.5 },
        // ブロック命中時の打鍵音。
        brickHit: { type: "square", frequency: 600, endFrequency: 280, duration: 0.045, volume: 0.55 },
        // ライフ減少時の下降音。
        lifeLost: { type: "sawtooth", frequency: 180, endFrequency: 95, duration: 0.14, volume: 0.55 },
        // ゲームオーバー時の重い下降音。
        gameOver: { type: "sawtooth", frequency: 150, endFrequency: 75, duration: 0.2, volume: 0.7 },
        // ステージクリア時の上昇音。
        stageClear: { type: "sine", frequency: 523.25, endFrequency: 880, duration: 0.12, volume: 0.7 },
        // 全クリア時の長めの上昇音。
        win: { type: "sine", frequency: 523.25, endFrequency: 1174.66, duration: 0.22, volume: 0.85 }
      }
    }
  };
})();
