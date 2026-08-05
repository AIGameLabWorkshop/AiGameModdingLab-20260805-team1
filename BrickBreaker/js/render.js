(function () {
  // 共有名前空間を取得する。
  // 未初期化のときはここで作って、描画モジュールを登録できるようにする。
  const BB = window.BB || (window.BB = {});

  /*
    色指定を Phaser / Canvas で扱いやすい数値へそろえる関数です。
    - number はそのまま使う
    - "0x..." 文字列は数値へ変換する
    - その他は白（0xffffff）へフォールバックする
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
    数値カラー（0xRRGGBB）を CSS の #RRGGBB 文字列へ変換する関数です。
    CanvasTexture を描くときに使います。
  */
  function colorToCss(color) {
    const normalized = normalizeColor(color);
    return "#" + normalized.toString(16).padStart(6, "0");
  }

  /*
    パーティクル共通の白い円形テクスチャを用意します。
    色は各エミッターの tint で変えるため、テクスチャ自体は白で作成します。
  */
  function ensureParticleTexture(scene) {
    const textureKey = "bb:particle";
    if (!scene.textures.exists(textureKey)) {
      const texture = scene.textures.createCanvas(textureKey, 8, 8);
      const ctx = texture.getContext();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(4, 4, 4, 0, Math.PI * 2);
      ctx.fill();
      texture.refresh();
    }
    return textureKey;
  }

  /*
    数値カラーを RGB 成分へ分解する関数です。
    明度調整（shiftColor）の前処理として使います。
  */
  function colorToRgb(color) {
    const normalized = normalizeColor(color);
    return {
      r: (normalized >> 16) & 0xff,
      g: (normalized >> 8) & 0xff,
      b: normalized & 0xff
    };
  }

  /*
    色を明るく/暗くシフトした CSS rgb(...) 文字列を返す関数です。
    正負の amount を受け取り、各チャンネルを 0-255 に収めます。
  */
  function shiftColor(color, amount) {
    const rgb = colorToRgb(color);
    const clamp = function (value) {
      return Math.max(0, Math.min(255, Math.round(value)));
    };
    const r = clamp(rgb.r + amount);
    const g = clamp(rgb.g + amount);
    const b = clamp(rgb.b + amount);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  /*
    角丸矩形の Path を作る共通ヘルパーです。
    実際の fill / stroke は呼び出し側で行います。
  */
  function roundedRectPath(ctx, x, y, w, h, radius) {
    const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /*
    Scene インスタンスへ描画関連プロパティを初期化する関数です。
    Scene 側の責務を増やさず、描画モジュールが必要な状態をここでそろえます。
  */
  function initSceneVisualState(scene) {
    scene.bgOrbs = [];
    scene.bgScanlines = null;
    scene.paddleGlow = null;
    scene.paddleVisual = null;
    scene.ballGlow = null;
    scene.ballSpecular = null;
    scene.brickDecorations = [];
  }

  /*
    背景レイヤーを構築する関数です。
    - グラデーション
    - オーブ（ゆらぎ）
    - 細いスキャンライン
    を合成して、旧実装に近い奥行き感を作ります。

    テクスチャは毎回作らず、存在チェックして再利用します。
  */
  function createBackgroundLayer(scene, config) {
    if (!scene.textures.exists("bb:bgGradient")) {
      const texture = scene.textures.createCanvas("bb:bgGradient", config.width, config.height);
      const ctx = texture.getContext();
      const gradient = ctx.createLinearGradient(0, 0, 0, config.height);
      gradient.addColorStop(0, colorToCss(config.colors.bgTop));
      gradient.addColorStop(1, colorToCss(config.colors.bgBottom));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, config.width, config.height);
      texture.refresh();
    }

    if (!scene.textures.exists("bb:orbCyan")) {
      const texture = scene.textures.createCanvas("bb:orbCyan", 220, 220);
      const ctx = texture.getContext();
      const gradient = ctx.createRadialGradient(110, 110, 0, 110, 110, 110);
      gradient.addColorStop(0, "rgba(116,247,255,0.18)");
      gradient.addColorStop(1, "rgba(116,247,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 220, 220);
      texture.refresh();
    }

    if (!scene.textures.exists("bb:orbWarm")) {
      const texture = scene.textures.createCanvas("bb:orbWarm", 260, 260);
      const ctx = texture.getContext();
      const gradient = ctx.createRadialGradient(130, 130, 0, 130, 130, 130);
      gradient.addColorStop(0, "rgba(255,209,102,0.12)");
      gradient.addColorStop(1, "rgba(255,209,102,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 260, 260);
      texture.refresh();
    }

    if (!scene.textures.exists("bb:scanline")) {
      const texture = scene.textures.createCanvas("bb:scanline", config.width, config.height);
      const ctx = texture.getContext();
      ctx.clearRect(0, 0, config.width, config.height);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let y = 0; y <= config.height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(config.width, y + 0.5);
        ctx.stroke();
      }
      texture.refresh();
    }

    // 背景の最下層を配置する。
    scene.add.image(config.width / 2, config.height / 2, "bb:bgGradient").setDepth(-30);

    // ぼんやりしたオーブを複数配置する。
    scene.bgOrbs = [
      scene.add.image(48, 82, "bb:orbCyan").setDepth(-29),
      scene.add.image(config.width - 56, 150, "bb:orbWarm").setDepth(-29),
      scene.add.image(config.width / 2, config.height - 72, "bb:orbCyan").setDepth(-29).setAlpha(0.55)
    ];

    // オーブへゆるい往復移動を付けて静止画感を減らす。
    scene.bgOrbs.forEach((orb, index) => {
      const xShift = index === 1 ? 10 : 8;
      const yShift = index === 1 ? 8 : 6;
      scene.tweens.add({
        targets: orb,
        x: orb.x + xShift,
        y: orb.y + yShift,
        duration: 2400 + index * 500,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1
      });
    });

    // 薄いラインを背景の上に重ねる。
    scene.bgScanlines = scene.add.image(config.width / 2, config.height / 2, "bb:scanline");
    scene.bgScanlines.setDepth(-28).setAlpha(0.75);
  }

  /*
    汎用のやわらかい発光テクスチャを 1 回だけ作る関数です。
    ボール/ブロックの光レイヤーで共通利用します。
  */
  function ensureGlowTexture(scene) {
    if (scene.textures.exists("bb:glowSoft")) {
      return;
    }

    const texture = scene.textures.createCanvas("bb:glowSoft", 128, 128);
    const ctx = texture.getContext();
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,0.55)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.16)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    texture.refresh();
  }

  /*
    パドル用の下方向グローテクスチャを作る関数です。
    上側へ光がにじまないようにして、違和感を抑えています。
  */
  function ensurePaddleGlowTexture(scene) {
    if (scene.textures.exists("bb:paddleGlow")) {
      return;
    }

    const texture = scene.textures.createCanvas("bb:paddleGlow", 320, 140);
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 320, 140);

    // 光源の芯。
    ctx.save();
    ctx.shadowColor = "rgba(122,247,255,0.62)";
    ctx.shadowBlur = 26;
    roundedRectPath(ctx, 52, 34, 216, 12, 6);
    ctx.fillStyle = "rgba(122,247,255,0.34)";
    ctx.fill();
    ctx.restore();

    // 下側に落ちる尾（余韻）。
    const tail = ctx.createLinearGradient(0, 44, 0, 140);
    tail.addColorStop(0, "rgba(122,247,255,0.18)");
    tail.addColorStop(0.55, "rgba(122,247,255,0.06)");
    tail.addColorStop(1, "rgba(122,247,255,0)");
    ctx.fillStyle = tail;
    ctx.fillRect(60, 44, 200, 96);

    // 上側はクリアして下方向のみの発光にする。
    ctx.clearRect(0, 0, 320, 30);
    texture.refresh();
  }

  /*
    指定幅のパドル見た目テクスチャキーを返す関数です。
    既存があれば再利用し、なければその場で生成します。
  */
  function getPaddleTextureKey(scene, config, width, color) {
    const safeWidth = Math.max(8, Math.round(width));
    const safeHeight = Math.max(6, Math.round(config.paddleHeight));
    const normalizedColor = normalizeColor(color);
    const key = "bb:paddle:" + safeWidth + "x" + safeHeight + ":" + String(normalizedColor);

    if (scene.textures.exists(key)) {
      return key;
    }

    const texture = scene.textures.createCanvas(key, safeWidth, safeHeight);
    const ctx = texture.getContext();
    const radius = Math.min(6, Math.max(2, Math.floor(safeHeight * 0.45)));

    // 上から下へ明暗が出る本体グラデーション。
    const fill = ctx.createLinearGradient(0, 0, 0, safeHeight);
    fill.addColorStop(0, shiftColor(normalizedColor, 58));
    fill.addColorStop(0.5, colorToCss(normalizedColor));
    fill.addColorStop(1, shiftColor(normalizedColor, -42));

    roundedRectPath(ctx, 0.5, 0.5, safeWidth - 1, safeHeight - 1, radius);
    ctx.fillStyle = fill;
    ctx.fill();

    // 上面ハイライト。
    ctx.save();
    roundedRectPath(ctx, 1.5, 1.5, safeWidth - 3, Math.max(1, Math.floor(safeHeight * 0.42)), Math.max(1, radius - 1));
    ctx.fillStyle = "rgba(255,255,255,0.26)";
    ctx.fill();
    ctx.restore();

    // 輪郭線。
    roundedRectPath(ctx, 0.5, 0.5, safeWidth - 1, safeHeight - 1, radius);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    ctx.stroke();

    texture.refresh();
    return key;
  }

  /*
    パドル本体の表示オブジェクトを作る関数です。
    物理 body は Scene 側、見た目はここで担当します。
  */
  function createPaddleVisual(scene, config, tuning, paddle) {
    const image = scene.add.image(
      paddle.x,
      paddle.y,
      getPaddleTextureKey(scene, config, tuning.defaultPaddleWidth, config.colors.paddle)
    );
    image.setDepth(7);
    return image;
  }

  /*
    パドル下のグローレイヤーを作る関数です。
    現在は alpha 0 で初期化し、必要になれば値だけ上げられる形にしています。
  */
  function createPaddleGlow(scene, config, paddle) {
    const glow = scene.add.image(paddle.x, paddle.y, "bb:paddleGlow");
    glow.setTint(config.colors.paddle).setAlpha(0).setDepth(6);
    return glow;
  }

  /*
    ボール周辺の装飾（グロー + 白ハイライト）を生成する関数です。
    返り値を Scene 側へ保持して、毎フレーム同期に使います。
  */
  function createBallEffects(scene, config, ball) {
    const ballGlow = scene.add.image(ball.x, ball.y, "bb:glowSoft");
    ballGlow.setTint(config.colors.ball).setAlpha(0.4).setDepth(6);
    ballGlow.setDisplaySize(config.ballRadius * 8, config.ballRadius * 8);

    const ballSpecular = scene.add.circle(
      ball.x - 2,
      ball.y - 2,
      Math.max(1.5, config.ballRadius * 0.22),
      0xffffff,
      0.7
    );
    ballSpecular.setDepth(9);

    return { ballGlow, ballSpecular };
  }

  /*
    ブロック見た目テクスチャキーを返す関数です。
    サイズと色ごとにキャッシュし、同じ条件の再生成を避けます。
  */
  function getBrickTextureKey(scene, width, height, color) {
    const safeWidth = Math.max(3, Math.round(width));
    const safeHeight = Math.max(3, Math.round(height));
    const normalizedColor = normalizeColor(color);
    const key = "bb:block:" + safeWidth + "x" + safeHeight + ":" + String(normalizedColor);

    if (scene.textures.exists(key)) {
      return key;
    }

    const texture = scene.textures.createCanvas(key, safeWidth, safeHeight);
    const ctx = texture.getContext();
    const radius = Math.min(6, Math.max(1, Math.floor(Math.min(safeWidth, safeHeight) * 0.22)));

    // ブロック本体の縦グラデーション。
    const fill = ctx.createLinearGradient(0, 0, 0, safeHeight);
    fill.addColorStop(0, shiftColor(normalizedColor, 72));
    fill.addColorStop(0.42, colorToCss(normalizedColor));
    fill.addColorStop(1, shiftColor(normalizedColor, -48));

    roundedRectPath(ctx, 0.5, 0.5, safeWidth - 1, safeHeight - 1, radius);
    ctx.fillStyle = fill;
    ctx.fill();

    // 上面ハイライト。
    ctx.save();
    roundedRectPath(ctx, 1.5, 1.5, safeWidth - 3, Math.max(1, Math.floor(safeHeight * 0.46)), Math.max(1, radius - 1));
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fill();
    ctx.restore();

    // 輪郭線。
    roundedRectPath(ctx, 0.5, 0.5, safeWidth - 1, safeHeight - 1, radius);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.34)";
    ctx.stroke();

    texture.refresh();
    return key;
  }

  /*
    ステージ再構築前に、前ステージの装飾オブジェクトを破棄する関数です。
    物理 body と別管理のため、ここで明示的に掃除します。
  */
  function clearBrickDecorations(scene) {
    scene.brickDecorations.forEach((decoration) => {
      if (decoration && decoration.active) {
        decoration.destroy();
      }
    });
    scene.brickDecorations = [];
  }

  /*
    1 個のブロックへ見た目レイヤーを付与する関数です。
    bodyRect は衝突判定、visual/glow/sparkle は描画専用として分離します。
  */
  function decorateBrick(scene, config, bodyRect, brickData) {
    const isTinyBrick = brickData.width * brickData.height <= 90;
    const blockTexture = getBrickTextureKey(scene, brickData.width, brickData.height, brickData.color);

    if (!isTinyBrick) {
      // 通常サイズ以上は外側グローを追加する。
      const glow = scene.add.image(brickData.x, brickData.y, "bb:glowSoft");
      glow.setTint(brickData.color).setAlpha(0.3).setDepth(4);
      glow.setDisplaySize(brickData.width * 1.72, brickData.height * 2.25);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      scene.brickDecorations.push(glow);
      bodyRect.setData("glow", glow);
    }

    // 本体ビジュアル。
    const visual = scene.add.image(brickData.x, brickData.y, blockTexture);
    visual.setDepth(7);
    bodyRect.setData("visual", visual);
    scene.brickDecorations.push(visual);

    if (!isTinyBrick) {
      // 小さすぎるブロックにはノイズになりやすいので sparkle は付けない。
      const sparkle = scene.add.circle(
        brickData.x - brickData.width * 0.3,
        brickData.y - brickData.height * 0.22,
        Math.max(1, Math.min(3, brickData.height * 0.15)),
        0xffffff,
        0.22
      );
      sparkle.setDepth(8);
      scene.brickDecorations.push(sparkle);
      bodyRect.setData("sparkle", sparkle);
    }

    // 将来の色差し替え用メタデータ。
    bodyRect.setData("renderColor", config.colors.paddle);
  }

  /*
    ブロック破壊時に関連する装飾をまとめて破棄する関数です。
  */
  function destroyBrickDecorations(bodyRect) {
    ["visual", "sparkle", "glow"].forEach((key) => {
      const entity = bodyRect.getData(key);
      if (entity && entity.active) {
        entity.destroy();
      }
    });
  }

  /*
    ブロック破壊時の爆発エフェクト演出です。
    破壊位置を中心に、小さなパーティクルが放射状に飛び散ります。
  */
  function createBrickExplosion(scene, x, y) {
    const particleTexture = ensureParticleTexture(scene);
    // Phaser 3.90 では particles の生成時に設定を渡し、戻り値を直接操作する。
    const emitter = scene.add.particles(x, y, particleTexture, {
      // スピード：100-200 px/s でランダム
      speed: {min: 120, max: 220},
      // 角度：360度全方向
      angle: {min: 0, max: 360},
      // スケール：小さな粒（最初 0.5-1.0、終了時 0.1）
      scale: {start: 0.6, end: 0.1},
      // パーティクルの色をオレンジ～黄色系に設定
      tint: [0xff8c00, 0xffa500, 0xffd700],
      // ライフスパン：400-600ms
      lifespan: {min: 400, max: 600},
      // 発生量：一度に 8-12 個放射
      emitZone: {
        source: new Phaser.Geom.Circle(0, 0, 5),
        type: "random",
        quantity: 10
      }
    });

    // 一度だけ放射してから自動で破棄
    emitter.explode(10);

    // 短時間後にエミッター自体を破棄
    scene.time.delayedCall(1000, () => {
      emitter.destroy();
    });
  }

  /*
    ヒット時の軽い明滅演出を入れる関数です。
    耐久が残っているときの手応えを視覚で補強します。
  */
  function flashBrickVisual(scene, bodyRect) {
    const visual = bodyRect.getData("visual");
    if (!visual || !visual.active) {
      return;
    }

    scene.tweens.add({
      targets: visual,
      alpha: 0.58,
      duration: 60,
      yoyo: true,
      ease: "Sine.easeOut"
    });
  }

  /*
    物理オブジェクト位置に合わせて装飾を追従させる関数です。
    毎フレーム呼ばれる前提なので、処理は軽く保ちます。
  */
  function syncActorDecorations(scene, config) {
    if (scene.paddleVisual && scene.paddle) {
      scene.paddleVisual.setPosition(scene.paddle.x, scene.paddle.y);
      scene.paddleVisual.setDisplaySize(scene.paddle.width, config.paddleHeight);
    }

    if (scene.paddleGlow && scene.paddle) {
      scene.paddleGlow.setPosition(scene.paddle.x, scene.paddle.y + config.paddleHeight * 0.34);
      scene.paddleGlow.setDisplaySize(scene.paddle.width * 1.04, config.paddleHeight * 2.9);
    }

    // 最初のボールのグロー・ハイライトのみ同期（100個全てはパフォーマンスの関係で不可）
    if (scene.ballGlow && scene.balls && scene.balls.length > 0) {
      scene.ballGlow.setPosition(scene.balls[0].x, scene.balls[0].y);
    }

    if (scene.ballSpecular && scene.balls && scene.balls.length > 0) {
      scene.ballSpecular.setPosition(scene.balls[0].x - 2, scene.balls[0].y - 2);
    }

    if (scene.boss && scene.boss.active) {
      const isFinalBoss = scene.boss.getData("isFinalBoss");
      const radius = isFinalBoss ? 50 : 30;
      const eyeDistance = isFinalBoss ? 25 : 15;
      const leftEye = scene.boss.getData("leftEye");
      const rightEye = scene.boss.getData("rightEye");
      const mouth = scene.boss.getData("mouth");
      const tongue = scene.boss.getData("tongue");

      if (leftEye) {
        leftEye.setPosition(scene.boss.x - eyeDistance, scene.boss.y - radius / 4);
      }
      if (rightEye) {
        rightEye.setPosition(scene.boss.x + eyeDistance, scene.boss.y - radius / 4);
      }
      if (mouth) {
        mouth.setPosition(scene.boss.x, scene.boss.y);
      }
      if (tongue) {
        tongue.setPosition(scene.boss.x, scene.boss.y);
      }
    }
  }

  /*
    Gemini の号泣顔を描画してゲームオーバー画面に表示する関数です。
    Canvas テクスチャで顔を描画し、揺れアニメーション + 涙パーティクルを付けます。
  */
  function createGeminiGameOverFace(scene, config) {
    // テクスチャキー
    const textureKey = "bb:geminiGameOverFace";

    // 1回だけテクスチャを作成
    if (!scene.textures.exists(textureKey)) {
      const size = 320; // 320x320 の Canvas で描画
      const texture = scene.textures.createCanvas(textureKey, size, size);
      const ctx = texture.getContext();

      // 背景透明
      ctx.clearRect(0, 0, size, size);

      const centerX = size / 2;
      const centerY = size / 2;
      const faceRadius = 120;
      const eyeRadius = 16;

      // 顔（黄色い円）
      ctx.fillStyle = "#FFD700";
      ctx.beginPath();
      ctx.arc(centerX, centerY, faceRadius, 0, Math.PI * 2);
      ctx.fill();

      // 顔の輪郭
      ctx.strokeStyle = "rgba(255, 200, 0, 0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // 左目（青い円）
      ctx.fillStyle = "#1E90FF";
      ctx.beginPath();
      ctx.arc(centerX - 40, centerY - 35, eyeRadius, 0, Math.PI * 2);
      ctx.fill();

      // 右目（青い円）
      ctx.fillStyle = "#1E90FF";
      ctx.beginPath();
      ctx.arc(centerX + 40, centerY - 35, eyeRadius, 0, Math.PI * 2);
      ctx.fill();

      // 左瞳孔
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(centerX - 40, centerY - 30, 6, 0, Math.PI * 2);
      ctx.fill();

      // 右瞳孔
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(centerX + 40, centerY - 30, 6, 0, Math.PI * 2);
      ctx.fill();

      // 悲しい口（弧線）
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY + 40, 30, 0, Math.PI); // 下半分が悲しい形
      ctx.stroke();

      // 左涙
      ctx.fillStyle = "rgba(100, 200, 255, 0.8)";
      ctx.beginPath();
      ctx.arc(centerX - 40, centerY, 8, 0, Math.PI * 2);
      ctx.fill();

      // 右涙
      ctx.fillStyle = "rgba(100, 200, 255, 0.8)";
      ctx.beginPath();
      ctx.arc(centerX + 40, centerY, 8, 0, Math.PI * 2);
      ctx.fill();

      texture.refresh();
    }

    // Scene に配置
    const faceImage = scene.add.image(config.width / 2, config.height / 2, textureKey);
    faceImage.setDisplaySize(config.height * 0.6, config.height * 0.6);
    faceImage.setDepth(100); // 最前面に表示
    faceImage.setAlpha(0.9);

    // 顔の揺れアニメーション（水平方向）
    scene.tweens.add({
      targets: faceImage,
      x: config.width / 2 + 8,
      duration: 120,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    const particleTexture = ensureParticleTexture(scene);

    // 涙のパーティクルエミッター（左目から落ちる）
    const leftTearEmitter = scene.add.particles(
      config.width / 2 - 50,
      config.height / 2 - 80,
      particleTexture,
      {
      speedY: { min: 40, max: 80 },
      speedX: { min: -10, max: 10 },
      lifespan: 2000,
      gravityY: 100,
      frequency: 150,
      quantity: 1,
      tint: 0x64C8FF,
      alpha: { start: 0.8, end: 0 },
      scale: { start: 0.4, end: 0 },
      emitZone: {
        type: "circle",
        source: new Phaser.Geom.Circle(0, 0, 8)
      }
      }
    );
    leftTearEmitter.setDepth(101);

    // 涙のパーティクルエミッター（右目から落ちる）
    const rightTearEmitter = scene.add.particles(
      config.width / 2 + 50,
      config.height / 2 - 80,
      particleTexture,
      {
      speedY: { min: 40, max: 80 },
      speedX: { min: -10, max: 10 },
      lifespan: 2000,
      gravityY: 100,
      frequency: 150,
      quantity: 1,
      tint: 0x64C8FF,
      alpha: { start: 0.8, end: 0 },
      scale: { start: 0.4, end: 0 },
      emitZone: {
        type: "circle",
        source: new Phaser.Geom.Circle(0, 0, 8)
      }
      }
    );
    rightTearEmitter.setDepth(101);

    // Scene に参照を保持（クリーンアップ用）
    scene.geminiGameOverFace = faceImage;
    scene.tearEmitters = [leftTearEmitter, rightTearEmitter];

    return { faceImage, tearEmitters: [leftTearEmitter, rightTearEmitter] };
  }

  /*
    ゲームオーバー画面をクリーンアップする関数です。
    Gemini の顔とパーティクルを破棄します。
  */
  function destroyGeminiGameOverFace(scene) {
    if (scene.geminiGameOverFace && scene.geminiGameOverFace.active) {
      scene.geminiGameOverFace.destroy();
      scene.geminiGameOverFace = null;
    }

    if (scene.tearEmitters && Array.isArray(scene.tearEmitters)) {
      scene.tearEmitters.forEach((emitter) => {
        if (emitter && emitter.active) {
          emitter.destroy();
        }
      });
      scene.tearEmitters = [];
    }
  }

  /*
    敵キャラを描画する関数です。
    黒い円の体に、白と黒の目玉を描きます。
  */
  function decorateEnemy(scene, enemy) {
    const radius = 10;
    const eyeRadius = 3;
    const eyeDistance = 6;

    // 左目（白）
    const leftEyeWhite = scene.add.circle(
      enemy.x - eyeDistance,
      enemy.y - 2,
      eyeRadius,
      0xffffff
    );
    leftEyeWhite.setDepth(8);
    enemy.setData("leftEyeWhite", leftEyeWhite);

    // 左瞳孔（黒）
    const leftPupil = scene.add.circle(
      enemy.x - eyeDistance,
      enemy.y - 2,
      eyeRadius * 0.5,
      0x000000
    );
    leftPupil.setDepth(9);
    enemy.setData("leftPupil", leftPupil);

    // 右目（白）
    const rightEyeWhite = scene.add.circle(
      enemy.x + eyeDistance,
      enemy.y - 2,
      eyeRadius,
      0xffffff
    );
    rightEyeWhite.setDepth(8);
    enemy.setData("rightEyeWhite", rightEyeWhite);

    // 右瞳孔（黒）
    const rightPupil = scene.add.circle(
      enemy.x + eyeDistance,
      enemy.y - 2,
      eyeRadius * 0.5,
      0x000000
    );
    rightPupil.setDepth(9);
    enemy.setData("rightPupil", rightPupil);
  }

  /*
    ボスキャラ（ニコちゃんマーク）を描画する関数です。
    最終ステージでは舌付きボス、通常ステージではニコちゃん顔を描きます。
  */
  function decorateBoss(scene, boss) {
    const isFinalBoss = boss.getData("isFinalBoss");
    const radius = isFinalBoss ? 50 : 30;
    const eyeRadius = isFinalBoss ? 8 : 5;
    const eyeDistance = isFinalBoss ? 25 : 15;
    const mouthRadius = isFinalBoss ? 20 : 12;

    // 左目（黒）
    const leftEye = scene.add.circle(
      boss.x - eyeDistance,
      boss.y - (radius / 4),
      eyeRadius,
      0x000000
    );
    leftEye.setDepth(8);
    boss.setData("leftEye", leftEye);

    // 右目（黒）
    const rightEye = scene.add.circle(
      boss.x + eyeDistance,
      boss.y - (radius / 4),
      eyeRadius,
      0x000000
    );
    rightEye.setDepth(8);
    boss.setData("rightEye", rightEye);

    if (isFinalBoss) {
      // 最終ボス：舌付き顔を描く
      // Graphics 内はボス中心からの相対座標で描き、本体位置へ追従させる。
      const mouth = scene.add.graphics();
      mouth.lineStyle(4, 0x000000);
      mouth.arc(0, 10, mouthRadius, 0, Math.PI);  // 下向きの弧
      mouth.setPosition(boss.x, boss.y);
      mouth.setDepth(8);
      boss.setData("mouth", mouth);
      
      // 舌（赤色）を描く
      const tongue = scene.add.graphics();
      tongue.fillStyle(0xff0000, 1);  // 赤色
      // 舌を描く：ボスの下部からぶら下がる形状
      tongue.fillRect(-6, radius / 2, 12, 20);
      tongue.fillCircle(0, radius / 2 + 20, 8);
      tongue.setPosition(boss.x, boss.y);
      tongue.setDepth(8);
      boss.setData("tongue", tongue);
    } else {
      // 通常ボス：ニコちゃん顔を描く
      // 口（弧線を Graphics で描画）
      const mouth = scene.add.graphics();
      mouth.lineStyle(3, 0x000000);
      mouth.arc(0, 12, mouthRadius, 0, Math.PI);  // 下向きの弧
      mouth.setPosition(boss.x, boss.y);
      mouth.setDepth(8);
      boss.setData("mouth", mouth);
    }
  }

  /*
    外部公開 API。
    phaser-game.js はこのオブジェクトだけを参照し、
    描画の内部実装には依存しない構成にする。
  */
  BB.renderer = {
    initSceneVisualState,
    createBackgroundLayer,
    ensureGlowTexture,
    ensurePaddleGlowTexture,
    getPaddleTextureKey,
    createPaddleVisual,
    createPaddleGlow,
    createBallEffects,
    decorateBrick,
    clearBrickDecorations,
    destroyBrickDecorations,
    createBrickExplosion,
    flashBrickVisual,
    syncActorDecorations,
    createGeminiGameOverFace,
    destroyGeminiGameOverFace,
    decorateEnemy,
    decorateBoss
  };
})();