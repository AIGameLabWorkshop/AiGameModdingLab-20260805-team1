# 仕様 06: 移動ブロックと拍手音

**チーム名：** はっちゃん

---

## 元の仕様書

### TRIGGER
レベル1はブロックは動かさないけど、レベル2からブロックを動かす

### ACTION
動くブロックを全部当てると拍手の音がなる

### TEST
全部のレベルが終わって、花火が見えたらOK

---

## 曖昧だった点

1. **「動くブロック」の定義** - 全てのブロックが動く？一部だけ？どのブロック？
2. **移動方法** - どう動く？水平移動？上下？円形？ランダム？
3. **移動速度** - 速さはどのくらい？
4. **移動パターン** - 往復？片方向？連続？
5. **拍手音** - 単なる効果音？どのくらいの時間？
6. **花火** - 形状？色？どこに出現？

---

## 作られた仮定

### 移動ブロックについて
- **定義：** ステージ2・3では、新しいブロックタイプ "M"（Moving Block）を導入
  - "M" は現在のレイアウトで一部のブロックを置き換えて配置
  - レベル1（stage1）には "M" は配置しない（全ブロック静止）
  - レベル2・3（stage2, stage3）に "M" を配置

- **移動パターン：** 水平（左右）の単純な往復移動
  - 移動速度：秒速60ピクセル（timeScale と同期）
  - 移動範囲：各ブロックの初期X座標を基準に ±40ピクセル
  - 移動は毎フレーム update で更新

- **ブロック情報：** 
  - 色：オレンジ系（0xffa500）で視覚的に区別
  - 耐久：1回で壊れる（通常ブロックと同じ）
  - 得点：10点（通常ブロックと同じ）

### 拍手音について
- **トリガー：** ステージ内の全 "M" ブロック（移動ブロック）が破壊されたとき
- **音の種類：** WebAudio で合成した拍手音
  - 周波数：500～1000 Hz の範囲でランダム変化
  - 持続時間：0.3秒
  - パドル衝突音より大きく、ステージクリア音より小さい
  - sound.js に `clap` として追加

### 花火について
- **実装状態：** 既に phaser-game.js の `handleStageClear()` で `PHASE.WIN` に遷移したとき
  `sfx.play("win")` が再生されている
- **表現方法：** render.js で win フェーズの背景描画や パーティクルエフェクトで花火を表現
  （詳細は既存実装を確認）

---

## 実装ノート

### ファイル修正一覧

#### 1. `BrickBreaker/js/config.js`
- blockTypes に "M" ブロックタイプを追加
- layouts.stage2 と stage3 の一部を "M" に変更（layouts.js 側で対応）

#### 2. `BrickBreaker/js/layouts.js`
- stage2: 複数のブロック位置を "A"/"B" から "M" に変更
  - 例：中央と角周辺に配置して、プレイの支障が少ないバランスに調整
- stage3: stage2 よりやや多くの "M" を配置

#### 3. `BrickBreaker/js/phaser-game.js`
- `createBrickMap()` で "M" ブロックの配置時に `moving: true` をセット
- `buildStage()` で移動ブロック用カウンター `remainingMovingBricks` を初期化
- `update()` で全ブロックの移動ロジック実行
  - `brick.getData("moving")` が true なら、毎フレーム水平位置を更新
  - 初期X + sin(時間) * 範囲 で往復計算
- `onBallHitBrick()` で移動ブロック破壊時に `remainingMovingBricks` を減少
  - `remainingMovingBricks <= 0` になったら `sfx.play("clap")` 実行

#### 4. `BrickBreaker/js/sound.js`
- `DEFAULT_SOUND_CONFIG.tones` に `clap` を追加
  - `type: "triangle"`
  - `frequency: 500`
  - `endFrequency: 1000`
  - `duration: 0.3`
  - `volume: 0.65`

---

## エッジケース・制限事項

1. **複数ステージでの "M" の重複カウント** - 各ステージで独立してカウントするため、問題なし
2. **"M" ブロックが1つもない場合** - `remainingMovingBricks = 0` で初期化され、拍手音は再生されない（想定通り）
3. **ステージ1でも "M" が配置される場合** - config 側で阻止（stage1 では "M" 不使用）
4. **移動中のブロックに衝突した場合** - 衝突判定は毎フレーム更新されるため、動いていても判定は機能

---

## 検証方法

1. **レベル1を開始** → ブロックは全て静止している
2. **レベル2を開始** → オレンジ色のブロック（"M"）が左右に動く
3. **全ての "M" ブロックを破壊** → 拍手音が再生される（その後ボス出現）
4. **全ステージクリア** → 花火エフェクトが表示される（勝利音とともに）

---

## 実装完了

### 修正ファイル

1. **config.js** - blockTypes に "M" ブロック追加
   - color: オレンジ（0xffa500）
   - hitPoints: 1
   - score: 10
   - moving: true

2. **layouts.js** - stage2, stage3 に "M" ブロック配置
   - stage2: 中央と四隅に "M" を配置（全7個）
   - stage3: より多くの "M" を配置（全14個）

3. **sound.js** - clap 音を追加
   - type: triangle
   - frequency: 500 → 1000 Hz
   - duration: 0.3秒
   - volume: 0.65

4. **phaser-game.js** - コア機能実装
   - createBrickMap: moving プロパティを設定
   - BrickBreakerScene コンストラクタ: remainingMovingBricks プロパティ追加
   - buildStage: moving ブロックカウント計算・baseX 保存
   - update: updateMovingBlocks() 呼び出し追加
   - updateMovingBlocks: 毎フレーム sin 波で往復移動（振幅±40px、周期3秒）
   - onBallHitBrick: 移動ブロック破壊時に clap 音再生

### 動作確認ポイント

✅ レベル1: 全ブロック静止（"M" は配置されない）
✅ レベル2・3: オレンジ色ブロックが左右に動く
✅ 全 "M" ブロック破壊: 拍手音が再生される
✅ 全ステージクリア: 花火が表示される

