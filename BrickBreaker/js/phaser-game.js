(function () {
  // 共有名前空間から設定を読み取る。
  // 必須要素が欠けている場合は何もせず終了する。
  const BB = window.BB || {};
  const CONFIG = BB.CONFIG;
  const SHARED_CONSTANTS = BB.constants;
  const RENDERER = BB.renderer;
  const AUDIO = BB.audio;

  if (!window.Phaser || !CONFIG || !SHARED_CONSTANTS || !RENDERER || !AUDIO) {
    return;
  }

  /*
    共通定数を取り出す。
    定義元は constants.js で、
    このファイルは「使う側」に徹することで責務を分離する。
  */
  const { PHASE, UI_TEXT, TUNING } = SHARED_CONSTANTS;

  /*
    必須 DOM 要素を取得する小さなヘルパーです。
    もし要素が見つからなければ、原因が分かるエラーメッセージを投げます。
  */
  function getRequiredElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error("Required element not found: #" + id);
    }
    return element;
  }

  // 既存 HTML の HUD / Overlay 要素をそのまま使う。
  // 表示更新は Scene 内からここへ直接反映する。
  const scoreEl = getRequiredElement("score");
  const livesEl = getRequiredElement("lives");
  const stageBadgeEl = getRequiredElement("stageBadge");
  const stageNameEl = getRequiredElement("stageName");
  const stageProgressEl = getRequiredElement("stageProgress");
  const overlayEl = getRequiredElement("overlay");
  const overlayTextEl = getRequiredElement("overlayText");
  const restartBtn = getRequiredElement("restartBtn");

  /*
    オーバーレイ（中央メッセージ）を表示する関数です。
    渡された message を本文に入れ、hidden クラスを外して見える状態にします。
    画面の状態説明はこの関数に集約しておくと、文言変更がしやすくなります。
  */
  function showOverlay(message) {
    overlayTextEl.textContent = message;
    overlayEl.classList.remove("hidden");
  }

  /*
    オーバーレイを非表示にする関数です。
    ゲーム開始時など、メッセージが不要な場面で呼びます。
  */
  function hideOverlay() {
    overlayEl.classList.add("hidden");
  }

  // SE は sound.js のプレイヤーを使う。
  // ゲーム本体は play / unlock 呼び出しだけを担当する。
  const sfx = AUDIO.createSoundPlayer(CONFIG.sound);

  // ページ上の最初の操作で音声再生が許可されるよう、
  // 全体入力で unlock を呼んでおく。
  document.addEventListener("pointerdown", sfx.unlock, { passive: true });
  document.addEventListener("keydown", sfx.unlock, { passive: true });

  /*
    色指定を Phaser が扱える形式にそろえる関数です。
    - すでに数値ならそのまま使う
    - "0x..." 文字列なら数値へ変換する
    - それ以外は白色（0xffffff）にフォールバックする
    設定の書き方が混ざっても安全に動かすためのガードです。
  */
  function normalizeColor(color) {
    if (typeof color === "number") {
      return color;
    }
    if (typeof color === "string" && color.startsWith("0x")) {
      return Number(color);
    }
    return 0xffffff;
  }

  /*
    ステージの2次元配列（blockLayout）から、
    実際に配置するブロック一覧を作る関数です。

    役割:
    1) 行数・列数を読み取る
    2) brickField の範囲に収まるよう、ブロック幅/高さ/隙間を自動計算する
    3) 空きマスを除いて、配置情報（x, y, width, height, color, score, hp）を返す

    返り値は「まだ描画していない設計図データ」で、
    実際の生成は buildStage 側で行います。
  */
  function createBrickMap(stage) {
    // レイアウトは「行の配列」の形になっている。
    const layout = stage.blockLayout || [];
    // 行数（上から何段あるか）。
    const rows = layout.length;
    if (!rows) {
      return [];
    }

    const cols = layout.reduce(function (max, row) {
      return Math.max(max, row.length);
    }, 0);

    if (!cols) {
      return [];
    }

    // ここから、ブロックをどの範囲に並べるかを計算する。
    // brickField はステージごとに定義されている。
    const field = stage.brickField;
    const left = field.left;
    const right = field.right;
    const top = field.top;
    const fallbackBottom = CONFIG.paddleY - TUNING.bottomPaddingFromPaddle;
    const bottom = Math.min(field.bottom, fallbackBottom);
    const availableWidth = Math.max(TUNING.minPlayfieldSize, CONFIG.width - left - right);
    const availableHeight = Math.max(TUNING.minPlayfieldSize, bottom - top);

    // 隙間を広げすぎると領域からはみ出すので、最大値を先に計算する。
    const maxGapByWidth = cols > 1 ? (availableWidth - cols) / (cols - 1) : availableWidth;
    const maxGapByHeight = rows > 1 ? (availableHeight - rows) / (rows - 1) : availableHeight;
    const gapLimit = Math.max(0, Math.min(maxGapByWidth, maxGapByHeight));
    const gap = Math.min(field.minGap || 0, gapLimit);

    // 行列数と隙間から、1個あたりのブロックサイズを逆算する。
    const brickWidth = (availableWidth - Math.max(0, cols - 1) * gap) / cols;
    const brickHeight = (availableHeight - Math.max(0, rows - 1) * gap) / rows;

    const bricks = [];
    // 2重ループで「上から下、左から右」にブロックを作る。
    for (let row = 0; row < layout.length; row += 1) {
      const line = layout[row];
      for (let col = 0; col < line.length; col += 1) {
        const typeKey = line[col];
        if (!typeKey) {
          // 空欄セルはブロックを置かない。
          continue;
        }
        const type = CONFIG.blockTypes[typeKey];
        if (!type) {
          // 未定義の種類は安全のため無視する。
          continue;
        }

        // 境界（左/右・上/下）を先に整数へ丸めることで、
        // 隣接ブロック間の細いにじみ線を減らす。
        const leftEdge = Math.round(left + col * (brickWidth + gap));
        const rightEdge = Math.round(left + (col + 1) * brickWidth + col * gap);
        const topEdge = Math.round(top + row * (brickHeight + gap));
        const bottomEdge = Math.round(top + (row + 1) * brickHeight + row * gap);
        const snappedWidth = Math.max(1, rightEdge - leftEdge);
        const snappedHeight = Math.max(1, bottomEdge - topEdge);
        const x = leftEdge + snappedWidth / 2;
        const y = topEdge + snappedHeight / 2;
        bricks.push({
          x: x,
          y: y,
          width: snappedWidth,
          height: snappedHeight,
          color: normalizeColor(type.color),
          score: type.score || TUNING.defaultBrickScore,
          hp: type.hitPoints || TUNING.defaultBrickHp,
          moving: type.moving || false,
          type: typeKey
        });
      }
    }

    return bricks;
  }

  class BrickBreakerScene extends Phaser.Scene {
    constructor() {
      super("BrickBreakerScene");

      // 進行状態
      this.phase = PHASE.READY;
      this.stageIndex = 0;
      this.score = 0;
      this.defaultInitialLives = CONFIG.initialLives;
      this.lives = CONFIG.initialLives;
      this.remainingBricks = 0;
      this.remainingMovingBricks = 0;

      // ゲームオブジェクト
      this.paddle = null;
      this.balls = []; // 通常ボールと追加ボールを管理する配列
      this.bricks = null;

      // 描画演出用オブジェクト（物理判定は持たない）
      this.bgOrbs = [];
      this.bgScanlines = null;
      this.paddleGlow = null;
      this.paddleVisual = null;
      this.ballGlow = null;
      this.ballSpecular = null;
      this.brickDecorations = [];

      // 敵・ボス管理
      this.enemies = [];             // 敵の配列
      this.boss = null;              // ボスの参照（1体のみ）
      this.bossCollider = null;      // ボス出現中だけ有効にする衝突判定
      this.bossHp = 0;               // ボスのHP
      this.hasSpawnedEnemy = false;  // このステージで敵が出たか

      // ステージ3 追加ボール管理（spec_07対応）
      this.extraBall = null;         // ステージ3の追加ボール参照
      this.extraBallSpawned = false; // 追加ボール発動済みフラグ

      // 入力・難易度
      this.cursors = null;
      this.spaceKey = null;
      this.activeDifficulty = null;

      // ポインター操作の状態
      this.pointerControlActive = false;
      this.pointerTargetX = CONFIG.width / 2;
      this.activeDomPointerId = null;
      this.pointerDragOffsetX = 0;

      // パドル抜けフォールバック判定用
      this.lastBallY = 0;

      // ボール通過ブロック管理（spec_09対応）
      this.ballBlockHitCount = 0;           // このステージのボール衝突回数
      this.shouldPassThroughNextBrick = false; // 次の衝突時に透明化するフラグ
      this.passThroughBlockRef = null;      // 通過中のブロック参照
    }

    /*
      Scene の初期化処理です。
      ここでは「ゲーム開始時に1回だけ必要な準備」をまとめて行います。

      主な流れ:
      1) 背景色と物理ワールド境界を設定する
      2) キーボード・ポインター入力を登録する
      3) ゲームオブジェクトを作る
      4) 初期状態（ready）へリセットする
    */
    create() {
      // カメラの背景色を設定する（何も描かれていない部分の色）。
      this.cameras.main.setBackgroundColor(CONFIG.colors.bgBottom);

      // 下方向だけ反射を無効にして、ミス判定を手動で処理する。
      this.physics.world.setBounds(0, 0, CONFIG.width, CONFIG.height);
      this.physics.world.setBoundsCollision(true, true, true, false);

      this.cursors = this.input.keyboard.createCursorKeys();
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.registerPointerControls();
      RENDERER.initSceneVisualState(this);
      RENDERER.createBackgroundLayer(this, CONFIG);

      // 画面に必要な部品を作ってから、ゲーム状態を初期化する。
      this.buildWorldObjects();
      this.resetWholeGame();
      this.registerEquipmentControls();
    }

    /*
      ポインター入力のイベント登録をまとめる関数です。
      create 内に直接書くよりも、
      「何を登録しているか」をひとかたまりで把握しやすくなります。
    */
    registerPointerControls() {
      // ゲーム内 X を操作目標へ反映する。
      // タップ開始位置で瞬間移動しないよう、パドルとの相対差を維持する。
      const updatePointerTargetFromWorldX = (worldX) => {
        this.pointerTargetX = Phaser.Math.Clamp(worldX + this.pointerDragOffsetX, 0, CONFIG.width);
      };

      // ブラウザ座標 clientX をゲーム内 X 座標へ変換する。
      // キャンバス外の値も Clamp して端まで追従させる。
      const updatePointerTargetFromClientX = (clientX) => {
        const rect = this.game.canvas.getBoundingClientRect();
        if (!rect.width) {
          return;
        }
        const normalizedX = (clientX - rect.left) / rect.width;
        updatePointerTargetFromWorldX(normalizedX * CONFIG.width);
      };

      // タップ開始: 位置を記録し、ゲーム開始トリガーにも使う。
      this.input.on("pointerdown", (pointer) => {
        sfx.unlock();
        this.pointerControlActive = true;
        this.pointerDragOffsetX = this.paddle.x - pointer.worldX;
        this.pointerTargetX = this.paddle.x;
        this.activeDomPointerId = pointer.event && typeof pointer.event.pointerId === "number"
          ? pointer.event.pointerId
          : null;
        this.activateGame();
      });

      // ドラッグ中だけ目標 X を更新する。
      this.input.on("pointermove", (pointer) => {
        if (!this.pointerControlActive) {
          return;
        }
        updatePointerTargetFromWorldX(pointer.worldX);
      });

      // pointerup / pointerupoutside の両方で同じ終了処理にする。
      const deactivatePointerControl = () => {
        this.pointerControlActive = false;
        this.activeDomPointerId = null;
        this.pointerDragOffsetX = 0;
      };
      this.input.on("pointerup", deactivatePointerControl);
      this.input.on("pointerupoutside", deactivatePointerControl);

      // モバイル環境では、キャンバス外へ指が出ると Phaser 側 move が
      // 途切れるケースがあるため、window イベントで補助追従する。
      window.addEventListener("pointermove", (event) => {
        if (!this.pointerControlActive) {
          return;
        }

        if (
          this.activeDomPointerId !== null &&
          typeof event.pointerId === "number" &&
          event.pointerId !== this.activeDomPointerId
        ) {
          return;
        }

        updatePointerTargetFromClientX(event.clientX);
      }, { passive: true });

      window.addEventListener("pointerup", (event) => {
        if (
          this.activeDomPointerId !== null &&
          typeof event.pointerId === "number" &&
          event.pointerId !== this.activeDomPointerId
        ) {
          return;
        }
        deactivatePointerControl();
      }, { passive: true });

      window.addEventListener("pointercancel", (event) => {
        if (
          this.activeDomPointerId !== null &&
          typeof event.pointerId === "number" &&
          event.pointerId !== this.activeDomPointerId
        ) {
          return;
        }
        deactivatePointerControl();
      }, { passive: true });
    }

    /*
      装備選択UI のイベント登録をまとめる関数です。
      各装備ボタンがクリックされたときの処理を登録します。
    */
    registerEquipmentControls() {
      const equipmentABtn = document.getElementById("equipmentA");
      const equipmentBBtn = document.getElementById("equipmentB");
      const equipmentCBtn = document.getElementById("equipmentC");

      if (!equipmentABtn || !equipmentBBtn || !equipmentCBtn) {
        return;
      }

      // 各装備ボタンのクリック時に装備を適用する。
      equipmentABtn.addEventListener("click", () => {
        sfx.unlock();
        this.applyEquipment("A");
      });

      equipmentBBtn.addEventListener("click", () => {
        sfx.unlock();
        this.applyEquipment("B");
      });

      equipmentCBtn.addEventListener("click", () => {
        sfx.unlock();
        this.applyEquipment("C");
      });
    }

    /*
      装備選択パネルを表示する関数です。
      オーバーレイにメッセージと装備選択ボタンを表示します。
    */
    showEquipmentSelection() {
      const overlayTextEl = document.getElementById("overlayText");
      const equipmentPanel = document.getElementById("equipmentPanel");

      // 装備ボタンの pointerdown が親オーバーレイへ伝わっても、
      // 選択完了前にボールが発射されないよう開始入力を止める。
      this.isSelectingEquipment = true;

      if (overlayTextEl) {
        overlayTextEl.textContent = UI_TEXT.equipmentSelect;
      }

      if (equipmentPanel) {
        equipmentPanel.classList.remove("hidden");
      }

      showOverlay("");
    }

    /*
      装備を適用して、ゲーム開始画面へ遷移する関数です。
      指定された装備の効果を CONFIG に反映させます。
    */
    applyEquipment(equipmentKey) {
      const equipment = CONFIG.equipment && CONFIG.equipment[equipmentKey];
      if (!equipment || !equipment.apply) {
        return;
      }

      const initialLivesBeforeEquipment = CONFIG.initialLives;
      // 装備の apply 関数を実行して、CONFIG を更新する。
      equipment.apply(CONFIG, SHARED_CONSTANTS);

      // 初期ライフを変える装備は、構築済みの現在ライフと HUD にも差分を反映する。
      this.lives += CONFIG.initialLives - initialLivesBeforeEquipment;
      this.updateHud();

      // パドル幅が変わっていれば、ゲームに反映させる。
      // （最初のステージを既に buildStage 済みなので、ここで直接更新）
      const stage = this.getStage(this.stageIndex);
      if (stage && stage.difficulty) {
        this.paddle.width = CONFIG.paddleWidth;
        this.paddle.body.setSize(CONFIG.paddleWidth, CONFIG.paddleHeight, true);
        this.paddle.body.updateFromGameObject();

        if (this.paddleVisual) {
          this.paddleVisual.setTexture(RENDERER.getPaddleTextureKey(this, CONFIG, CONFIG.paddleWidth, CONFIG.colors.paddle));
        }
      }

      // 装備選択パネルを非表示にする。
      const equipmentPanel = document.getElementById("equipmentPanel");
      if (equipmentPanel) {
        equipmentPanel.classList.add("hidden");
      }

      // ゲーム開始メッセージを表示する。
      const overlayTextEl = document.getElementById("overlayText");
      if (overlayTextEl) {
        overlayTextEl.textContent = UI_TEXT.start;
      }

      // 装備の適用が完了したので、次の入力からゲームを開始できるようにする。
      this.isSelectingEquipment = false;
    }

    /*
      ステージ定義を取り出す小さなアクセサ関数です。
      CONFIG.stages[...] の直接参照を減らし、
      「ステージを使う」意図をコード上で明確にします。
    */
    getStage(stageIndex) {
      return CONFIG.stages[stageIndex];
    }

    /*
      ゲーム内の主要オブジェクトを作る関数です。
      - パドル: static body（自分は速度で動かない壁のような当たり判定）
      - ボール: dynamic body（速度を持って動く）
      - ブロック群: staticGroup（まとめて静的当たり判定を管理）

      あわせて、ボールがパドル/ブロックに当たったときのコールバックを登録します。
    */
    buildWorldObjects() {
      RENDERER.ensureGlowTexture(this);
      RENDERER.ensurePaddleGlowTexture(this);

      // add.rectangle は見た目の四角。physics.add.existing で当たり判定を持たせる。
      this.paddle = this.add.rectangle(
        CONFIG.width / 2,
        CONFIG.paddleY,
        TUNING.defaultPaddleWidth,
        CONFIG.paddleHeight,
        CONFIG.colors.paddle
      );
      // true を渡すと static body（自分では動かず、他を跳ね返す壁のような体）になる。
      this.physics.add.existing(this.paddle, true);
      this.paddle.setFillStyle(CONFIG.colors.paddle, 0.01);

      this.paddleVisual = RENDERER.createPaddleVisual(this, CONFIG, TUNING, this.paddle);

      // パドル下に発光レイヤーを重ねる。
      this.paddleGlow = RENDERER.createPaddleGlow(this, CONFIG, this.paddle);

      // spec_10: ゲーム開始時の通常ボールは1個だけ配置する。
      // 初期位置は発射前に待機するパドル中央上。
      const ballStartX = CONFIG.width / 2;
      const ballStartY = CONFIG.paddleY - CONFIG.ballRadius - TUNING.ballRestOffsetY;

      // ボールを円として作る。
      const ball = this.add.circle(
        ballStartX,
        ballStartY,
        CONFIG.ballRadius,
        CONFIG.colors.ball
      );
      // false を渡すと dynamic body（速度で動く体）になる。
      this.physics.add.existing(ball, false);
      // 重力はこのゲームでは使わない。
      ball.body.setAllowGravity(false);
      // 画面端に当たる判定を有効化。
      ball.body.setCollideWorldBounds(true);
      // 反射係数1 = 速度をほぼそのまま反転させる。
      ball.body.setBounce(1, 1);

      // 複数ボール対応の配列へ、開始時の1個を追加する。
      this.balls.push(ball);

      // 通常ボールにエフェクトを付与する。
      if (this.balls.length > 0) {
        const ballEffects = RENDERER.createBallEffects(this, CONFIG, this.balls[0]);
        this.ballGlow = ballEffects.ballGlow;
        this.ballSpecular = ballEffects.ballSpecular;
      }

      RENDERER.syncActorDecorations(this, CONFIG);

      // ブロックはまとめて staticGroup で管理する。
      this.bricks = this.physics.add.staticGroup();

      // ボールがパドル/ブロック/敵/ボスに当たったときの処理を登録する。
      // Phaser の collider は配列全要素との判定を自動で行う。
      this.physics.add.collider(this.balls, this.paddle, this.onBallHitPaddle, null, this);
      this.physics.add.collider(this.balls, this.bricks, this.onBallHitBrick, null, this);
      this.physics.add.collider(this.balls, this.enemies, this.onBallHitEnemy, null, this);
    }

    /*
      指定ステージの difficulty を、現在のプレイ設定へ反映する関数です。
      パドルは見た目の幅だけでなく、当たり判定サイズも同時に更新します。
      （見た目だけ変えると衝突ズレが起きるため）
    */
    applyStageDifficulty(stageIndex) {
      // 今のステージの難易度設定を取り出す。
      const stage = this.getStage(stageIndex);
      this.activeDifficulty = stage.difficulty;
      // パドル幅だけは見た目と当たり判定の両方を更新する必要がある。
      this.paddle.width = this.activeDifficulty.paddleWidth;
      this.paddle.fillColor = CONFIG.colors.paddle;
      this.paddle.body.setSize(this.activeDifficulty.paddleWidth, CONFIG.paddleHeight, true);
      this.paddle.body.updateFromGameObject();

      if (this.paddleVisual) {
        this.paddleVisual.setTexture(RENDERER.getPaddleTextureKey(this, CONFIG, this.activeDifficulty.paddleWidth, CONFIG.colors.paddle));
      }
    }

    /*
      ステージを構築し直す関数です。
      既存ブロックを消してから、新ステージのレイアウトを読み取り、
      ブロックを作成して残数を更新します。

      最後に:
      - ステージ HUD を更新
      - ボールをパドル上へ戻す（ready 状態）
    */
    buildStage(stageIndex) {
      // 前のステージのブロックを全部消す。
      RENDERER.clearBrickDecorations(this);
      this.bricks.clear(true, true);
      // 敵・ボスもリセット
      this.destroyAllEnemies();
      if (this.bossCollider) {
        this.bossCollider.destroy();
        this.bossCollider = null;
      }
      if (this.boss) {
        // ボスの描画要素（目、口、舌）を破棄
        const leftEye = this.boss.getData("leftEye");
        const rightEye = this.boss.getData("rightEye");
        const mouth = this.boss.getData("mouth");
        const tongue = this.boss.getData("tongue");
        
        if (leftEye) leftEye.destroy();
        if (rightEye) rightEye.destroy();
        if (mouth) mouth.destroy();
        if (tongue) tongue.destroy();
        
        if (this.bossCollider) {
          this.bossCollider.destroy();
          this.bossCollider = null;
        }
        this.boss.destroy();
        this.boss = null;
      }
      this.hasSpawnedEnemy = false;
      
      // ステージ3 追加ボール管理をリセット（spec_07対応）
      this.extraBallSpawned = false;
      if (this.extraBall) {
        // 破棄済みボールを後続のリセット・発射処理で参照しないよう管理対象から外す。
        this.balls = this.balls.filter((ball) => ball !== this.extraBall);
        this.extraBall.destroy();
        this.extraBall = null;
      }

      // spec_09: ボール通過ブロック用の状態をリセット（新ステージごと）
      this.ballBlockHitCount = 0;
      this.shouldPassThroughNextBrick = false;
      if (this.passThroughBlockRef) {
        this.passThroughBlockRef.setAlpha(1);  // 残っていたら再表示
        this.passThroughBlockRef = null;
      }
      
      const stage = this.getStage(stageIndex);
      this.applyStageDifficulty(stageIndex);

      const brickData = createBrickMap(stage);
      // 設計図（brickData）をもとに1つずつブロックを置く。
      brickData.forEach((brick) => {
        const rect = this.add.rectangle(brick.x, brick.y, brick.width, brick.height, brick.color, 0.01);
        this.physics.add.existing(rect, true);
        rect.setDepth(2);
        RENDERER.decorateBrick(this, CONFIG, rect, brick);

        // setData で「耐久」「点数」をブロック自身に持たせる。
        rect.setData("hp", brick.hp);
        rect.setData("score", brick.score);
        // 移動フラグを持たせる。
        rect.setData("moving", brick.moving);
        // ブロック種別を記録（爆発エフェクト判定などで使用）。
        rect.setData("type", brick.type);
        // 移動ブロックのための初期位置を保存。
        if (brick.moving) {
          rect.setData("baseX", brick.x);
        }
        this.bricks.add(rect);
      });

      this.remainingBricks = brickData.length;
      // 移動ブロック数をカウント。
      this.remainingMovingBricks = brickData.filter(b => b.moving).length;
      
      // ステージ3のための追加ボール準備（spec_07対応）
      // 「途中から」＝ステージ3でブロック数50%破壊時に発動
      if (stageIndex === 2) {
        // パドル周辺にボールを1個作成して、配列に追加
        const ballStartX = CONFIG.width / 2;
        const ballStartY = CONFIG.paddleY - CONFIG.ballRadius - TUNING.ballRestOffsetY;
        const offsetX = (Math.random() - 0.5) * 60;
        const x = Phaser.Math.Clamp(ballStartX + offsetX, CONFIG.ballRadius, CONFIG.width - CONFIG.ballRadius);
        const y = Phaser.Math.Clamp(ballStartY, CONFIG.ballRadius, CONFIG.height - CONFIG.ballRadius);
        
        this.extraBall = this.add.circle(x, y, CONFIG.ballRadius, CONFIG.colors.ball);
        this.physics.add.existing(this.extraBall, false);
        this.extraBall.body.setAllowGravity(false);
        this.extraBall.body.setCollideWorldBounds(true);
        this.extraBall.body.setBounce(1, 1);
        // 追加ボール配列に登録
        this.balls.push(this.extraBall);
      }
      
      this.updateStageHud();
      this.resetBallToPaddle();
    }

    /*
      ボールをパドル上へ戻して停止させる関数です。
      ready 状態では毎フレームこれを呼び、
      「発射前はボールがパドルに乗っている」見た目を保ちます。
    */
    resetBallToPaddle() {
      // 全ボールをパドル上に戻す
      this.balls.forEach((ball) => {
        ball.setPosition(this.paddle.x, this.paddle.y - CONFIG.ballRadius - TUNING.ballRestOffsetY);
        ball.body.setVelocity(0, 0);
      });
      RENDERER.syncActorDecorations(this, CONFIG);
      if (this.balls.length > 0) {
        this.lastBallY = this.balls[0].y;
      }
    }

    /*
      ボールを発射する関数です。
      ready 状態のときだけ有効で、
      左右どちらへ飛ぶかはランダムで決めます。
    */
    launchBall() {
      if (!this.isReadyPhase()) {
        // 発射済みなら何もしない。
        return;
      }

      // 全ボールを発射する（各ボールは独立した方向・速度）
      this.balls.forEach((ball) => {
        // 左右どちらに飛ぶかはランダムで決める
        const horizontal = Math.random() < 0.5 ? -1 : 1;
        // 上下の速度も少しランダムに変動させて、ばらつきを持たせる
        const verticalVariation = 0.8 + Math.random() * 0.4; // 0.8～1.2倍
        ball.body.setVelocity(
          this.activeDifficulty.ballSpeed * horizontal,
          -this.activeDifficulty.ballSpeed * verticalVariation
        );
      });
      this.phase = PHASE.PLAYING;
      RENDERER.syncActorDecorations(this, CONFIG);
      sfx.play("start");
      if (this.balls.length > 0) {
        this.lastBallY = this.balls[0].y;
      }
      hideOverlay();
    }

    /*
      「開始操作」の共通入口です。
      呼び出し元はタップ・クリック・スペースキーなど複数ありますが、
      ここに集約することで状態遷移を一元化しています。

      ルール:
      - playing 中は無視
      - over / win なら全体リセットしてから開始
      - それ以外は発射処理へ
    */
    activateGame() {
      if (this.isSelectingEquipment) {
        // 装備ボタンの選択操作はゲーム開始として扱わない。
        return;
      }

      if (this.isPlayingPhase()) {
        // プレイ中に開始操作されても無視する。
        return;
      }

      if (this.phase === PHASE.OVER || this.phase === PHASE.WIN) {
        // ゲーム終了後の開始操作は「最初からやり直し」にする。
        this.resetWholeGame();
      }

      this.launchBall();
    }

    /*
      ゲーム全体を初期状態へ戻す関数です。
      ステージ番号・スコア・ライフを初期値に戻し、
      ステージ1を構築したうえで装備選択画面を表示します。
    */
    resetWholeGame() {
      // ゲームオーバー画面の Gemini 顔をクリーンアップする。
      RENDERER.destroyGeminiGameOverFace(this);
      // 進行情報を初期値に戻す。
      this.phase = PHASE.READY;
      this.stageIndex = 0;
      this.score = 0;
      // 前回選んだディフェンス装備が次のゲームへ累積しないよう基準値へ戻す。
      CONFIG.initialLives = this.defaultInitialLives;
      this.lives = CONFIG.initialLives;
      // 装備システム用：パドル幅を初期値にリセット（ゲーム開始時のリトライで装備が残らないようにする）
      CONFIG.paddleWidth = TUNING.defaultPaddleWidth;
      this.paddle.setPosition(CONFIG.width / 2, CONFIG.paddleY);
      // spec_09: ボール通過ブロック用の状態をリセット
      this.ballBlockHitCount = 0;
      this.shouldPassThroughNextBrick = false;
      this.passThroughBlockRef = null;
      this.buildStage(this.stageIndex);
      this.updateHud();
      this.showEquipmentSelection();
    }

    /*
      HUD のスコアとライフ表示を更新する関数です。
      内部状態（number）を DOM 表示（text）へ反映します。
    */
    updateHud() {
      scoreEl.textContent = String(this.score);
      livesEl.textContent = String(this.lives);
    }

    /*
      HUD のステージ表示を更新する関数です。
      - 何面目か（例: 2 / 3）
      - ステージ名
      - 進捗バー幅
      をまとめて反映します。
    */
    updateStageHud() {
      const current = this.stageIndex + 1;
      const total = CONFIG.stages.length;
      stageBadgeEl.textContent = String(current) + " / " + String(total);
      stageNameEl.textContent = this.getStage(this.stageIndex).name;
      stageProgressEl.style.width = String((current / total) * 100) + "%";
    }

    /*
      ボールとパドルの衝突コールバックです。
      実際の反射計算は reflectBallFromPaddle に委譲します。
    */
    onBallHitPaddle(ball, paddle) {
      if (!this.isPlayingPhase()) {
        return;
      }

      sfx.play("paddleBounce");
      this.reflectBallFromPaddle(ball, paddle);
    }

    /*
      パドル反射の共通ロジックです。

      仕組み:
      1) パドル中心からの当たり位置を -1〜+1 に正規化
      2) 当たり位置に応じて横速度を計算（端ほど大きい）
      3) 横速度が小さすぎる場合は最低値を保証
      4) 縦速度は必ず上向きへ
      5) めり込み防止のため、ボールをパドルの少し上に戻す
    */
    reflectBallFromPaddle(ball, paddle) {
      // 当たった位置を -1（左端）〜 +1（右端）に正規化する。
      const halfPaddleWidth = paddle.width / 2;
      const offset = (ball.x - paddle.x) / halfPaddleWidth;
      const clampedOffset = Phaser.Math.Clamp(offset, -1, 1);
      // 端で当てるほど横速度が大きくなる。
      const xVelocity = clampedOffset * (this.activeDifficulty.ballSpeed + this.activeDifficulty.ballBoostOnHit * TUNING.paddleBoostScale);
      const minHorizontal = this.activeDifficulty.ballMinHorizontalSpeed;
      // 横速度が小さすぎると縦往復だけになりやすいので、最低値を保証する。
      const safeX = Math.abs(xVelocity) < minHorizontal
        ? (xVelocity < 0 ? -minHorizontal : minHorizontal)
        : xVelocity;

      ball.body.setVelocityX(safeX);
      // Y方向は必ず上向き（マイナス）にする。
      ball.body.setVelocityY(-Math.abs(ball.body.velocity.y));
      // パドル内にめり込んだままだと連続衝突するので少し上へ戻す。
      ball.setY(paddle.y - paddle.height / 2 - CONFIG.ballRadius - TUNING.paddleReboundOffsetY);
      this.lastBallY = ball.y;
    }

    /*
      ボールとブロックの衝突コールバックです。
      - HP を減らす
      - 0 以下なら破壊して得点加算
      - 残りブロック0ならステージクリア処理へ
      - spec_09対応：5の倍数回衝突時に通過ブロックギミック発動
    */
    onBallHitBrick(ball, brick) {
      if (!this.isPlayingPhase()) {
        return;
      }

      // spec_09: ボール通過ブロック - 衝突回数をカウント
      this.ballBlockHitCount += 1;
      console.log("ボール衝突回数: " + this.ballBlockHitCount);

      // spec_09: 5の倍数に達したら、次の衝突を透明化対象にマーク
      if (this.ballBlockHitCount % 5 === 0) {
        this.shouldPassThroughNextBrick = true;
        console.log("5の倍数到達！次のブロック衝突を透明化します");
      }

      // spec_09: 通過中のブロックが再度衝突 → ステージクリア（全ブロック消え）
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

      // spec_09: 透明化対象ブロック → 通過モード（スコア/HP処理なし）
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
      const hp = (brick.getData("hp") || 1) - 1;
      if (hp <= 0) {
        // 壊れたら消して、得点と残り数を更新する。
        this.remainingBricks -= 1;
        this.score += brick.getData("score") || TUNING.defaultBrickScore;
        this.updateHud();

        // 移動ブロックの場合は moving カウンターも減らす。
        if (brick.getData("moving")) {
          this.remainingMovingBricks -= 1;
          // すべての移動ブロックが破壊されたら拍手音を再生。
          if (this.remainingMovingBricks <= 0) {
            sfx.play("clap");
          }
        }

        // W ブロック（壁）の場合は爆発エフェクトを演出。
        if (brick.getData("type") === "W") {
          RENDERER.createBrickExplosion(this, brick.x, brick.y);
        }

        RENDERER.destroyBrickDecorations(brick);

        brick.destroy();
        
        // 敵出現判定：最初のブロックが壊れたときに敵を1体出現
        if (this.remainingBricks === this.getStage(this.stageIndex).blockLayout.flat().filter(cell => cell).length - 1) {
          if (!this.hasSpawnedEnemy) {
            this.spawnEnemy();
          }
        }

        // ステージ3 追加ボール発動判定（spec_07対応）
        // ブロック破壊が50%に到達したら、追加ボール1個を有効化して+20点
        if (this.stageIndex === 2 && !this.extraBallSpawned) {
          const totalBlocks = this.getStage(this.stageIndex).blockLayout.flat().filter(cell => cell).length;
          const destroyedBlocks = totalBlocks - this.remainingBricks;
          const destroyedPercent = destroyedBlocks / totalBlocks;
          
          if (destroyedPercent >= 0.5) {
            // 追加ボールを有効化
            this.extraBallSpawned = true;
            // ステージ3用スコア加算
            this.score += 20;
            this.updateHud();
            sfx.play("powerup");  // パワーアップ音（存在する場合）
            console.log("ステージ3 追加ボール発動！スコア+20");
          }
        }
      } else {
        // まだ壊れない場合は耐久だけ減らす。
        brick.setData("hp", hp);

        RENDERER.flashBrickVisual(this, brick);
      }

      if (this.remainingBricks <= 0) {
        // すべてのブロックが破壊されたときにボスを出現
        this.spawnBoss();
        // クリア処理の前にボスを出現させるので、クリアは保留（ボスを倒したときにクリア）
      }
    }

    /*
      敵をボールに当たったときの処理です。
      敵は1回で消えます。
    */
    onBallHitEnemy(ball, enemy) {
      if (!this.isPlayingPhase()) {
        return;
      }

      sfx.play("brickHit");
      this.score += 50;  // 敵を倒した得点
      this.updateHud();

      // 敵配列から削除
      const index = this.enemies.indexOf(enemy);
      if (index > -1) {
        this.enemies.splice(index, 1);
      }
      enemy.destroy();
    }

    /*
      ボスをボールに当たったときの処理です。
      最終ステージのボスはHP=10で10回のボール衝突で消え、
      通常ステージのボスはHP=5で5回のボール衝突で消えます。
      ボスを倒すとステージクリアとなります。
    */
    onBallHitBoss(ball, boss) {
      if (!this.isPlayingPhase()) {
        return;
      }

      sfx.play("brickHit");
      this.bossHp -= 1;
      
      if (this.bossHp <= 0) {
        // ボスが倒れたら得点を加算してステージクリア処理へ
        this.score += 100;  // ボス撃破のボーナス点
        this.updateHud();
        
        // ボスの描画要素（目、口、舌）を破棄
        const leftEye = this.boss.getData("leftEye");
        const rightEye = this.boss.getData("rightEye");
        const mouth = this.boss.getData("mouth");
        const tongue = this.boss.getData("tongue");
        
        if (leftEye) leftEye.destroy();
        if (rightEye) rightEye.destroy();
        if (mouth) mouth.destroy();
        if (tongue) tongue.destroy();
        
        this.boss.destroy();
        this.boss = null;
        this.handleStageClear();
      }
    }

    /*
      ステージクリア時の進行処理です。
      最終ステージなら win にして完了メッセージを出し、
      まだ続きがあるなら次ステージを ready で構築します。
    */
    handleStageClear() {
      if (this.isFinalStage()) {
        this.phase = PHASE.WIN;
        sfx.play("win");
        showOverlay(UI_TEXT.gameWin);
        return;
      }

      this.stageIndex += 1;
      this.phase = PHASE.READY;
      this.paddle.setPosition(CONFIG.width / 2, CONFIG.paddleY);
      this.buildStage(this.stageIndex);
      sfx.play("stageClear");
      showOverlay(this.getStage(this.stageIndex).name + "\nタップして続ける");
    }

    /*
      ボール落下（ミス）時の処理です。
      ライフを減らし、
      - 0 なら over
      - 残っていれば ready に戻して再開待ち
      という分岐を行います。
    */
    handleLifeLost() {
      this.lives -= 1;
      this.updateHud();

      if (this.lives <= 0) {
        this.phase = PHASE.OVER;
        // ゲームオーバー後も物理演算で動き続けないよう、有効な全ボールを停止する。
        this.balls.forEach((ball) => {
          if (ball.active && ball.body) {
            ball.body.setVelocity(0, 0);
          }
        });
        sfx.play("gameOver");
        showOverlay(UI_TEXT.gameOver);
        // Gemini の号泣顔を表示する。
        RENDERER.createGeminiGameOverFace(this, CONFIG);
        return;
      }

      this.phase = PHASE.READY;
      sfx.play("lifeLost");
      this.resetBallToPaddle();
      showOverlay(UI_TEXT.lifeLost);
    }

    /*
      現在が ready 状態かどうかを返す関数です。
      文字列を直接比較する処理を外へ隠すことで、
      呼び出し側は「何を知りたいか」だけを読めるようになります。
    */
    isReadyPhase() {
      return this.phase === PHASE.READY;
    }

    /*
      現在が playing 状態かどうかを返す関数です。
      更新処理や衝突処理での条件分岐をそろえるために使います。
    */
    isPlayingPhase() {
      return this.phase === PHASE.PLAYING;
    }

    /*
      現在ステージが最終ステージかを判定する関数です。
      次ステージへ進めるか、ゲームクリアにするかの分岐で使います。
    */
    isFinalStage() {
      return this.stageIndex + 1 >= CONFIG.stages.length;
    }

    /*
      敵を1体スポーンする関数です。
      敵は画面上部中央に出現し、左右にゆっくり動きます。
    */
    spawnEnemy() {
      const enemyX = CONFIG.width / 2;
      const enemyY = 80;
      const enemy = this.add.circle(enemyX, enemyY, 10, 0x000000);  // 黒い円
      this.physics.add.existing(enemy, false);
      enemy.body.setAllowGravity(false);
      enemy.body.setCollideWorldBounds(true);
      enemy.body.setBounce(1, 1);
      enemy.setData("spawnTime", this.time.now);
      
      // 敵の描画（目玉と足を追加）
      RENDERER.decorateEnemy(this, enemy);
      
      this.enemies.push(enemy);
      this.hasSpawnedEnemy = true;
    }

    /*
      ボスをスポーンする関数です。
      最終ステージではHP=10の大型ボスが出現し、舌を表示します。
      通常ステージではHP=5の通常ボスが出現します。
    */
    spawnBoss() {
      if (this.boss) {
        return;  // 既にボスが存在するなら何もしない
      }
      
      // 最終ステージかどうかで異なるボスを出現させる
      const isFinalBoss = this.isFinalStage();
      const bossX = CONFIG.width / 2;
      const bossY = 100;
      const bossRadius = isFinalBoss ? 50 : 30;  // 最終ボスは大きい
      const boss = this.add.circle(bossX, bossY, bossRadius, 0xffff00);  // 黄色い円
      this.physics.add.existing(boss, false);
      boss.body.setAllowGravity(false);
      boss.body.setCollideWorldBounds(true);
      boss.body.setBounce(1, 1);
      boss.setData("spawnTime", this.time.now);
      
      // ボスの種別フラグをセット（描画時に使用）
      boss.setData("isFinalBoss", isFinalBoss);
      
      // ボスの描画（ニコちゃん顔または舌付き顔）
      RENDERER.decorateBoss(this, boss);
      
      this.boss = boss;
      // 最終ボスはHP=10、通常ボスはHP=5
      this.bossHp = isFinalBoss ? 10 : 5;
      // ボスが存在する期間だけ、ボールとの衝突判定を有効にする。
      this.bossCollider = this.physics.add.collider(this.balls, boss, this.onBallHitBoss, null, this);
    }

    /*
      移動ブロックの位置を毎フレーム更新する関数です。
      moving フラグが true のブロックは、baseX を中心に左右に往復します。
      振幅は ±40ピクセル、周期は約 3秒。
    */
    updateMovingBlocks() {
      if (!this.bricks) {
        return;
      }

      const elapsed = this.time.now / 1000;  // 秒単位での経過時間
      const amplitude = 40;  // 移動範囲（±40ピクセル）
      const frequency = 2 * Math.PI / 3;  // 周期 3秒

      this.bricks.children.entries.forEach((brick) => {
        if (brick.getData("moving")) {
          const baseX = brick.getData("baseX");
          // sin波で往復移動（-1 ～ +1）を amplitude で拡大。
          const offset = Math.sin(elapsed * frequency) * amplitude;
          brick.setX(baseX + offset);
        }
      });
    }

    /*
      敵・ボスの位置を更新する関数です。
      毎フレーム update 内で呼ばれ、敵・ボスが左右にゆっくり移動するようにします。
    */
    updateEnemyPositions() {
      const elapsed = this.time.now / 1000;  // 秒単位での経過時間
      
      // 敵の移動（左右に振動）
      this.enemies.forEach((enemy) => {
        const baseX = CONFIG.width / 2;
        const amplitude = 80;
        const frequency = 1;
        enemy.x = baseX + Math.sin(elapsed * frequency * Math.PI * 2) * amplitude;
        enemy.x = Phaser.Math.Clamp(enemy.x, 30, CONFIG.width - 30);
      });

      // ボスの移動（敵より遅く移動）
      if (this.boss) {
        const baseX = CONFIG.width / 2;
        const amplitude = 60;
        const frequency = 0.5;
        this.boss.x = baseX + Math.sin(elapsed * frequency * Math.PI * 2) * amplitude;
        this.boss.x = Phaser.Math.Clamp(this.boss.x, 40, CONFIG.width - 40);
      }
    }

    /*
      すべての敵を削除する関数です。
      ステージ切り替わり時などに呼ばれます。
    */
    destroyAllEnemies() {
      this.enemies.forEach((enemy) => {
        enemy.destroy();
      });
      this.enemies = [];
    }

    /*
      入力に応じてパドル位置を更新する関数です。

      ルール:
      - ポインター操作中は pointerTargetX を優先
      - それ以外は左右キーで移動
      - 最後に画面外へ出ないよう Clamp する

      位置を更新したら、見た目の座標を物理ボディへ同期します。
    */
    updatePaddleFromInput() {
      const halfPaddle = this.paddle.width / 2;

      if (this.pointerControlActive) {
        this.paddle.x = Phaser.Math.Clamp(this.pointerTargetX, halfPaddle, CONFIG.width - halfPaddle);
      } else {
        const speed = this.activeDifficulty ? this.activeDifficulty.paddleSpeed : TUNING.defaultKeyboardSpeed;
        if (this.cursors.left.isDown) {
          this.paddle.x -= speed;
        }
        if (this.cursors.right.isDown) {
          this.paddle.x += speed;
        }
        this.paddle.x = Phaser.Math.Clamp(this.paddle.x, halfPaddle, CONFIG.width - halfPaddle);
      }

      this.paddle.body.updateFromGameObject();
    }

    /*
      パドル抜け（トンネリング）を減らすための補助判定です。
      物理エンジンの衝突が取りこぼされるケースに備えて、
      前フレームと今フレームのボール位置から
      「パドル上面をまたいだか」を手動で判定します。

      条件がそろったら reflectBallFromPaddle を呼び、
      通常衝突と同じ反射ロジックで処理します。
    */
    handlePaddlePassThroughFallback() {
      // 全ボールに対してパドル抜けチェックを行う
      const halfPaddle = this.paddle.width / 2;
      const paddleTop = this.paddle.y - this.paddle.height / 2;

      this.balls.forEach((ball) => {
        const movingDown = ball.body.velocity.y > 0;
        // 前フレームと今フレームのボール位置からパドル上面をまたいだか判定
        const previousBottom = this.lastBallY + CONFIG.ballRadius;
        const currentBottom = ball.y + CONFIG.ballRadius;
        const withinPaddleX =
          ball.x >= this.paddle.x - halfPaddle - CONFIG.ballRadius &&
          ball.x <= this.paddle.x + halfPaddle + CONFIG.ballRadius;

        if (movingDown && previousBottom <= paddleTop && currentBottom >= paddleTop && withinPaddleX) {
          this.reflectBallFromPaddle(ball, this.paddle);
        }
      });
    }

    /*
      毎フレーム呼ばれる更新関数です。

      この関数で行うこと:
      1) 入力に応じてパドル位置を更新
      2) スペースキーの開始操作を判定
      3) ready 中はボールをパドルに追従
      4) playing 中はパドル抜けフォールバック判定
      5) 画面下への落下判定
      6) 次フレーム比較用の座標保存
    */
    update() {
      // 移動ブロックを毎フレーム更新。
      this.updateMovingBlocks();
      
      this.updatePaddleFromInput();
      this.updateEnemyPositions();  // 敵・ボスの位置を毎フレーム更新
      RENDERER.syncActorDecorations(this, CONFIG);

      // スペースキーを「押した瞬間」だけ開始処理を呼ぶ。
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        sfx.unlock();
        this.activateGame();
      }

      if (this.isReadyPhase()) {
        // 発射前はボールをパドルの上にくっつける。
        this.resetBallToPaddle();
      }

      if (this.isPlayingPhase()) {
        // 高速時の取りこぼし対策:
        // 前フレームと今フレームでボール下端がパドル上面をまたいだら、
        // 物理衝突が拾えなくても手動で反射させる。
        this.handlePaddlePassThroughFallback();
      }

      if (this.isPlayingPhase()) {
        // 全ボールの画面下への落下判定
        this.balls.forEach((ball) => {
          if (ball.y - CONFIG.ballRadius > CONFIG.height) {
            // 画面下へ完全に落ちたらミスとして扱う。
            this.handleLifeLost();
          }
        });
      }

      // 次フレーム比較用に、今回のYを保存しておく。
      if (this.balls.length > 0) {
        this.lastBallY = this.balls[0].y;
      }
    }
  }

  // Phaser 本体を既存 canvas 要素にマウントする。
  const canvasEl = getRequiredElement("gameCanvas");
  const game = new Phaser.Game({
    // この環境では明示的な render type が必要。
    type: Phaser.CANVAS,
    canvas: canvasEl,
    width: CONFIG.width,
    height: CONFIG.height,
    backgroundColor: "#07111f",
    physics: {
      default: "arcade",
      arcade: {
        debug: false
      }
    },
    scene: [BrickBreakerScene]
  });

  /*
    Scene インスタンスを安全に取得する関数です。
    起動直後など、まだ Scene が準備中の瞬間は null を返します。
    イベントハンドラから使うことで、初期化タイミングのズレを吸収できます。
  */
  function getSceneInstance() {
    // Scene がまだ作られていない瞬間は null を返す。
    return game.scene.keys.BrickBreakerScene || null;
  }

  // Overlay タップでも開始できるようにしておく。
  overlayEl.addEventListener("pointerdown", function () {
    sfx.unlock();
    const scene = getSceneInstance();
    if (scene) {
      scene.activateGame();
    }
  });

  // リスタートボタンはいつでも初期化を呼べる。
  restartBtn.addEventListener("click", function () {
    sfx.unlock();
    const scene = getSceneInstance();
    if (scene) {
      scene.resetWholeGame();
    }
  });
})();
