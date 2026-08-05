# Spec 09: ボール通過ブロック（5の倍数ギミック）

## 元の仕様書
- **TRIGGER:** ボールが5の倍数回ブロックにあたったとき
- **ACTION:** 次にボールがブロックにあたる直前に、そのブロックが透明になって玉が通過してしまう
- **TEST:** 壁にはねかえったボールが再出現したブロックにあたると、そのステージのブロックが全部消えてクリア

## 曖昧だった点と作った仮定

### 1. 「衝突回数」のスコープ
- **曖昧点:** 衝突回数がステージごとにリセットされるのか、ゲーム全体でカウントされるのか
- **仮定:** **ステージごとにリセット**される。ステージクリアごとに0に戻す
- **理由:** ゲームワークショップの文脈では、各ステージが独立した挑戦として機能する方が遊びやすい

### 2. 「次にボールがブロックにあたる」の実装
- **曖昧点:** 5の倍数回に達した時点で、即座に次の衝突対象を決めるのか、それとも「次」の衝突が起きるまで待つのか
- **仮定:** 5の倍数に達したら**フラグをセット**し、その直後に発生する衝突が対象ブロックになる
- **実装:** `shouldPassThroughNextBrick` フラグが立ったら、次のonBallHitBrick呼び出しでそのブロックを透明化

### 3. 「透明になって玉が通過」の実装
- **曖昧点:** ブロックのHP、スコア、見た目、どれを変えるのか
- **仮定:** 
  - ブロックの `alpha` を 0 に設定（見た目：透明）
  - ブロックのHPを減らさない
  - スコアを加算しない
  - ブロックは消さない（まだゲームオブジェクトとして存在）
- **理由:** 「透明になって通過」という表現から、ブロックは「見た目だけ消える」状態と解釈

### 4. 「再出現したブロック」の実装
- **曖昧点:** どのタイミングでブロックが「再出現」するのか
- **仮定:** ボールが別のブロックに衝突するか、壁にぶつかって跳ね返ったとき、透明だったブロックが再表示（alpha = 1に戻す）
- **実装:** 通過状態を解除して、ブロックのalpha を1.0に戻す

### 5. 「再出現したブロックにあたると、そのステージのブロックが全部消える」
- **曖昧点:** 「全部消える」はその透明ブロックに限定されるのか、ステージ全体のブロックなのか
- **仮定:** **ステージ全体のブロックが消える（クリア判定）**
- **理由:** 「そのステージの」という表現と、TEST条件の「クリア」から、ステージクリアのトリガーと解釈

### 6. 複数のボール（spec_01対応）
- **曖昧点:** ボール100個の複数が存在するとき、どれか1つが5の倍数回衝突したら発動するのか
- **仮定:** **全ボール共有**で、どのボールの衝突でもカウント
- **理由:** 仕様書に「ボールが5の倍数回」と書かれており、ボール個別ではなく全体と解釈

---

## 実装ノート

### 実装ファイル
- [phaser-game.js](../../BrickBreaker/js/phaser-game.js)

### 追加した状態変数（コンストラクタに追加）
```javascript
this.ballBlockHitCount = 0;           // このステージのボール衝突回数
this.shouldPassThroughNextBrick = false;  // 次の衝突時に透明化するフラグ
this.passThroughBlockRef = null;      // 通過中のブロック参照
```

### 修正した関数

1. **コンストラクタ (`constructor`)**
   - 上記3つの状態変数を初期化

2. **`onBallHitBrick(ball, brick)` 関数**
   - **衝突カウント**: `ballBlockHitCount` をインクリメント
   - **5の倍数判定**: `ballBlockHitCount % 5 === 0` で5の倍数に達したら `shouldPassThroughNextBrick = true` をセット
   - **通過中ブロック再衝突検知**: `passThroughBlockRef === brick` でステージ全ブロック消え判定
   - **ブロック透明化**: `shouldPassThroughNextBrick` が立っていたら、そのブロックを `brick.setAlpha(0)` で透明化
   - **ブロック再出現**: 通過中ブロック以外が衝突したら `passThroughBlockRef.setAlpha(1)` で再表示

3. **`resetWholeGame()` 関数**
   - 状態変数を全リセット（ゲーム再スタート時）

4. **`buildStage(stageIndex)` 関数**
   - 状態変数をリセット（新しいステージに移行時）

### 実装コード変更個所

**onBallHitBrick 関数の先頭に追加:**
```javascript
// spec_09: ボール通過ブロック - 衝突回数をカウント
this.ballBlockHitCount += 1;
console.log("ボール衝突回数: " + this.ballBlockHitCount);

// spec_09: 5の倍数に達したら、次の衝突を透明化対象にマーク
if (this.ballBlockHitCount % 5 === 0) {
  this.shouldPassThroughNextBrick = true;
  console.log("5の倍数到達！次のブロック衝突を透明化します");
}

// spec_09: 通過中のブロックが再度衝突 → ステージクリア
if (this.passThroughBlockRef === brick) {
  console.log("再出現したブロックに再衝突！全ブロック消えてステージクリア");
  // ステージのすべてのブロックを消す
  this.bricks.children.entries.forEach((b) => {
    this.remainingBricks -= 1;
    if (b.getData("moving")) {
      this.remainingMovingBricks -= 1;
    }
    RENDERER.destroyBrickDecorations(b);
    b.destroy();
  });
  this.remainingBricks = 0;
  this.passThroughBlockRef = null;
  // ボス出現またはステージクリア
  this.spawnBoss();
  return;
}

// spec_09: 透明化対象ブロック → 通過モード
if (this.shouldPassThroughNextBrick && !this.passThroughBlockRef) {
  this.shouldPassThroughNextBrick = false;
  this.passThroughBlockRef = brick;
  brick.setAlpha(0);  // ブロックを透明化
  console.log("ブロックを透明化してボールを通します");
  // 音声、HP、スコアは処理しない（通過するのみ）
  return;
}

// spec_09: 通過中のブロック以外の衝突 → 透明ブロックを再表示
if (this.passThroughBlockRef && this.passThroughBlockRef !== brick) {
  this.passThroughBlockRef.setAlpha(1);  // 再出現
  console.log("別のブロック衝突のため透明ブロックを再表示");
  this.passThroughBlockRef = null;
}

sfx.play("brickHit");
```

### エッジケース・制限事項
1. **複数ボール同時衝突:** ボール100個が同時に複数ブロックに衝突した場合
   - **対応:** `shouldPassThroughNextBrick && !this.passThroughBlockRef` の条件で、1つのブロックのみを透明化対象に限定

2. **敵・ボスとの衝突:** 敵やボスにぶつかった場合は衝突カウントに含めない
   - **対応:** `onBallHitBrick` 内のみでカウント（別の `onBallHitEnemy` や `onBallHitBoss` では加算しない）

3. **通過中ブロックの破壊:** 通過状態のブロックが何らかの理由で破壊される場合
   - **対応:** 通過中はブロック破壊処理をスキップ（return文で早期終了）

4. **再出現タイミング:** 「別の衝突が起きたら再出現」という実装
   - **実装:** シンプルに、通過中ブロック以外が衝突したら即座に再表示

---

## 動作検証チェックリスト

- [ ] ステージ開始時に `ballBlockHitCount = 0` にリセットされる
- [ ] ブロック衝突1～4回: 通常通り破壊される
- [ ] ブロック衝突5回目: 次の衝突対象ブロックが決定される
- [ ] 衝突6回目: そのブロックが透明になる（alpha = 0）
- [ ] 透明ブロックを通り抜けたボールが壁に当たってはねかえる
- [ ] はねかえったボール（または次の別ブロック衝突）で透明ブロックが再表示（alpha = 1）
- [ ] 再表示ブロックに衝突したら全ブロック消えてステージクリア判定
- [ ] 衝突10回目以降も同じギミック繰り返し

---

## 実装完了

