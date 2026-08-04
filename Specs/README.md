# Specs README

このフォルダに、BrickBreakerの「魔改造」仕様書を管理します。

ワークショップの流れ：
1. **仕様書を書く** → `TEMPLATE.md` に沿ってアイデアを3行にまとめる
2. **AIに実装させる** → 仕様書を「BrickBreaker 仕様実装エージェント」に渡す
3. **学習する** → `Assumptions/` で、AIがどう補完したかを確認

---

## ディレクトリ構成

### 📋 TEMPLATE.md
**仕様書テンプレート**

子供たちがゲーム改造のアイデアを3行仕様書として落とし込むためのテンプレートです。

```
1. TRIGGER（いつ？）- 何が起きたら機能が発動するか
2. ACTION（どうなる？）- ゲーム画面で何が変わるか
3. TEST（成功条件）- どうなっていればOKか
```

### 📁 Samples/
**サンプル仕様書集**

ぶっ飛び度の異なる4つのサンプル仕様書が入っています。

| 難易度 | 名前 | 説明 |
|--------|------|------|
| ⭐ 地味 | `01_simple_powerup.md` | パワーアップアイテムの追加 |
| ⭐⭐ 派手 | `02_wild_particle_explosion.md` | コンボ時のパーティクル爆発 |
| ⭐⭐⭐ 超派手 | `03_wild_time_reversal.md` | ゲーム時間の巻き戻し |
| ⭐⭐⭐⭐ 究極 | `04_boss_shooting_battle.md` | ボス戦シューティングゲーム |

ワークショップの参加者はこのサンプルを選ぶか、`TEMPLATE.md` からオリジナル仕様を作成します。

### 📁 Assumptions/
**実装時の補完記録**

仕様書をAIエージェント（BrickBreaker 仕様実装エージェント）が実装する際に、曖昧な点や補完内容が記録されます。

例：`01_simple_powerup.md` の仕様書を実装したときの記録 → `Assumptions/01_simple_powerup.md`

含まれる内容：
- **曖昧だった点** - 「大きくなる」ってどのくらい？など
- **AIが作った仮定** - 1.5倍に拡大する、3秒後に戻す など
- **判断の理由** - なぜそう決めたのか
- **実装ノート** - 実装時に何をしたか

これにより、子供たちは「良い仕様書の書き方」を学べます。

---

## 使い方

### 1. 仕様書を新規作成する場合

```
Specs/YOUR_SPEC.md を作成
↓
TEMPLATE.md を参考にして、TRIGGER / ACTION / TEST を記入
↓
「BrickBreaker 仕様実装エージェント」に Specs/YOUR_SPEC.md を渡す
```

### 2. サンプルから選ぶ場合

```
Specs/Samples/ からアイデアに合うサンプルを選ぶ
↓
「BrickBreaker 仕様実装エージェント」に Specs/Samples/XXXX.md を渡す
```

### 3. 実装結果を確認する

```
「BrickBreaker 仕様実装エージェント」の出力を確認
↓
Specs/Assumptions/YOUR_SPEC.md を見て、AIがどう補完したかを学ぶ
```

---

## 参考

- [TEMPLATE.md](./TEMPLATE.md) - 仕様書テンプレート
- [Samples/](./Samples/) - 実装例サンプル
- [Assumptions/](./Assumptions/) - 補完記録


