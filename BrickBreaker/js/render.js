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

    if (scene.ballGlow && scene.ball) {
      scene.ballGlow.setPosition(scene.ball.x, scene.ball.y);
    }

    if (scene.ballSpecular && scene.ball) {
      scene.ballSpecular.setPosition(scene.ball.x - 2, scene.ball.y - 2);
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
    flashBrickVisual,
    syncActorDecorations
  };
})();