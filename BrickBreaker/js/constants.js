// Phaser 実装で共通利用する定数をまとめたファイル。
// 設定値（config.js）とは役割が違い、こちらは「実装を読みやすくするための定義」を置く。
// サーバを介さずに読み込めるよう、window.BB 名前空間へ公開する。
window.BB = window.BB || {};

(function () {
  /*
    ゲーム進行の状態名です。
    文字列を直接コードに散らすと typo（打ち間違い）に弱くなるため、
    ここへ集約して比較ミスを防ぎます。

    READY   : 発射前（ボールがパドル上にある待機状態）
    PLAYING : プレイ中（ボールが動き、衝突判定が有効）
    OVER    : ライフが尽きた状態
    WIN     : 最終ステージをクリアした状態
  */
  const PHASE = {
    READY: "ready",
    PLAYING: "playing",
    OVER: "over",
    WIN: "win"
  };
  Object.freeze(PHASE);

  /*
    UI に表示する固定文言です。
    文言をここへまとめることで、
    - 多言語化
    - テキスト調整
    - 演出メッセージ差し替え
    を 1 箇所で行えるようにしています。
  */
  const UI_TEXT = {
    // 初回開始時の案内。
    start: "タップしてスタート\n3ステージ全部に挑戦しよう",
    // ミス後の再開案内。
    lifeLost: "ライフを失った！\nタップして続ける",
    // ゲームオーバー表示。
    gameOver: "ゲームオーバー\nもう一度遊ぼう",
    // 全ステージクリア表示。
    gameWin: "全ステージクリア！\nきみはラストまでたどり着いた！"
  };
  Object.freeze(UI_TEXT);

  /*
    実装上の調整値（マジックナンバー）を集約した定数です。
    gameplay 設定（config.js）と分けることで、
    「ゲーム仕様として調整したい値」と
    「実装都合の微調整値」を明確に区別できます。
  */
  const TUNING = {
    // 計算誤差で 0 や負数にならないようにする最小プレイフィールドサイズ。
    minPlayfieldSize: 8,
    // ready 時、パドルとボール中心の縦方向オフセット。
    ballRestOffsetY: 4,
    // パドル反射直後に、連続衝突を避けるため上へ戻す量。
    paddleReboundOffsetY: 1,
    // ブロック領域下限がパドルに近づきすぎないための余白。
    bottomPaddingFromPaddle: 24,
    // パドル端ヒット時の横速度強調係数。
    paddleBoostScale: 40,
    // ブロック側に score 未設定時の既定点。
    defaultBrickScore: 10,
    // ブロック側に hitPoints 未設定時の既定耐久。
    defaultBrickHp: 1,
    // パドル生成時の既定幅（ステージ適用前の初期値）。
    defaultPaddleWidth: 80,
    // 難易度未適用時のキーボード既定移動量。
    defaultKeyboardSpeed: 8
  };
  Object.freeze(TUNING);

  const constants = {
    PHASE,
    UI_TEXT,
    TUNING
  };

  // 公開オブジェクト自体も凍結し、参照の差し替えや追記を防ぐ。
  Object.freeze(constants);
  window.BB.constants = constants;
})();
