# BrickBreaker

Phaser 3 と JavaScript で作成した、シンプルなブロック崩しです。

## 遊び方
- 画面をタップしてゲームを開始します。
- 左右の矢印キー、または画面をタップしてドラッグするとパドルを動かせます。
- ボールをブロックに当てて、すべてのブロックを落とすとクリアです。

## ルール
- 3回までミスできます。
- ボールを落とすと 1ライフ減ります。
- すべてのブロックを壊すとクリアです。
- 現在は3ステージ構成です。

## ファイル構成
- index.html: 画面レイアウト
- css/styles.css: 見た目のデザイン
- js/layouts.js: ステージごとのブロック配置（静的データ）
- js/config.js: 調整可能な設定値（ステージ難易度、色、ブロック種別、SE設定など）
- js/constants.js: ゲーム内で共通利用する定数（状態名、UI文言、実装調整値）
- js/render.js: 描画専用モジュール（背景、ブロック/パドル/ボールの見た目レイヤー）
- js/sound.js: SE専用モジュール（WebAudioの再生制御）
- js/phaser-game.js: ゲーム本体（状態管理、物理、入力、進行。描画/SEはモジュール呼び出し）
- scripts/generate_layouts.py: `scripts/layout_masks/*.txt` から `js/layouts.js` を再生成
- scripts/layout_masks/: ステージごとの編集用マスク（`A` / `B` / `.`）

## ステージ管理
- ステージごとのブロック配置は `js/layouts.js` に静的データとしてまとめています。
- まずは `js/layouts.js` を直接編集するのが最短です。
- 各ステージの難易度は `difficulty` にまとめてあり、パドル幅やボール速度などを切り替えられます。
- `js/config.js` の `stages[].blockLayout` は、`js/layouts.js` の配列を参照します。
- ブロックの種類は `blockTypes`、配置は 2 次元配列の `blockLayout` で管理します。
- ブロックの実サイズは、`brickField` の範囲内に収まるように自動計算されます。



### 上級編オプション: スクリプトでレイアウト再生成

`scripts` は、マスク編集から `js/layouts.js` を再生成したいときに使う補助機能です。
最初は使わなくても問題ありません。

```bash
cd /home/keita/ScrumRecreation-template
python3 BrickBreaker/scripts/generate_layouts.py
```

差分チェックのみ:

```bash
python3 BrickBreaker/scripts/generate_layouts.py --check
```

---

## このリポジトリをローカルで動かす方法
このワークショップでは、実施中に子どもたちがコーディングを行うことは想定していません。
まずは「遊ぶ・考える・ふりかえる」体験を大切にします。

コードに興味が出てきた人だけ、ワークショップのあとでこの手順を使ってローカル環境で試せるようにしています。
ここから先は「興味がある人向けの発展編」として読んでください。

### 1. VS Code（ブイエスコード）って何？
VS Codeは、プログラムを書くための無料アプリです。
メモ帳より見やすく、ファイルを整理しやすいので、このプロジェクトでも使いやすいです。

### 2. VS Codeのインストール
1. 公式サイトを開く: https://code.visualstudio.com/
2. 自分のOS（Windows / macOS / Linux）向けのボタンを押してダウンロード
3. ダウンロードしたファイルを開いて、画面の案内どおりにインストール

### 3. まずは ZIP でダウンロード（おすすめ）
1. GitHubのこのリポジトリページを開く
2. 緑の `Code` ボタンを押す
3. `Download ZIP` を押して保存する
4. ダウンロードしたZIPを解凍（展開）する

### 4. VS Codeでフォルダを開く（編集するとき）
1. VS Codeを開く
2. メニューの `ファイル` → `フォルダーを開く` を選ぶ
3. さっき解凍したフォルダを選ぶ
4. 左のエクスプローラーでファイル（例: `BrickBreaker/index.html`）を開く

### 5. ゲームをブラウザで開く
基本は「開きたいプロジェクトの `index.html`（または `*.html`）」をブラウザで開きます。

- 例（BrickBreakerの場合）: `BrickBreaker/index.html`

- Linuxなら、次のコマンドでも開けます。

```bash
xdg-open BrickBreaker/index.html
```

ほかのプロジェクトを開くときは、最後のパスだけ入れ替えてください。

### 6. Gitで取得する方法（オプション）
更新を取り込みたい人は、Gitで取得してもOKです。

--

## 起動方法
ローカルで確認する場合は、次のファイルをブラウザで開いてください。

```text
BrickBreaker/index.html
```

## 改造ヒント

### ヒント1: js/config.js と js/layouts.js だけで進める改造（やりやすい順）
まずは `js/config.js` の数値や配列を変える方法がおすすめです。
コード本体を大きく変えずに、ゲームの雰囲気を変えられます。

1. パドルを広く/狭くする
- 変更場所: `paddleWidth`、または各ステージの `difficulty.paddleWidth`
- 例: `88 -> 100`（やさしくする）、`88 -> 76`（難しくする）

2. ボール速度を調整する
- 変更場所: `ballSpeed`、または各ステージの `difficulty.ballSpeed`
- 例: `4 -> 3.5`（やさしくする）、`4 -> 5`（難しくする）

3. ライフ数を増減する
- 変更場所: `initialLives`
- 例: `3 -> 5`（長く遊べる）

4. 1ブロックあたりの得点を変える
- 変更場所: `blockTypes.A.score` / `blockTypes.B.score`
- 例: `10 -> 20`（スコアが伸びやすい）

5. ブロックの色と種類を変える
- 変更場所: `blockTypes`
- 例: `A` と `B` の `color` を変更して見た目を変える

6. ステージの並びを変える
- 変更場所: `js/layouts.js`
- ヒント: `""` は空きマス。`"A"` や `"B"` を増減して、自由に配置を作れます
- 上級編オプション: `scripts/layout_masks/*.txt` を編集してから `python3 BrickBreaker/scripts/generate_layouts.py` で再生成してもOK

7. ステージを追加する
- 変更場所: `js/layouts.js` に新しい配列を追加し、`js/config.js` の `stages` 末尾にステージを追加
- ヒント: 既存ステージをコピーして `name`、`difficulty`、`blockLayout` を変えると進めやすい
- 上級編オプション: マスク運用する場合は `scripts/layout_masks/` に `*.txt` を追加して再生成する（ファイル名がステージキーになる）

8. パドルの操作感を変える
- 変更場所: 各ステージの `difficulty.paddleSpeed`
- 例: `10 -> 8`（落ち着いた操作感）、`8 -> 11`（素早く動ける）

9. 画面メッセージや状態定義を調整する
- 変更場所: `js/constants.js` の `UI_TEXT` / `PHASE`
- 例: 開始文言やゲームオーバー文言を変更する

10. 実装調整値（マジックナンバー）を調整する
- 変更場所: `js/constants.js` の `TUNING`
- 例: `defaultKeyboardSpeed` を変更して、難易度未適用時の移動量を調整する

### ヒント2: ゲーム性を上げる改造（アイテム・イベント）
ここからは、`js/config.js` への追加と少しのコード追加で、遊びの幅を広げる案です。

1. アイテムドロップを追加する
- 例: ブロック破壊時に一定確率で「スピードアップ」「ライフ+1」を落とす
- 入口: `js/config.js` に `itemDropRate` や `itemTypes` を追加し、`js/phaser-game.js` で生成と効果を反映

2. ボール数を増やす（マルチボール）
- 例: 特定条件でボールを2個/3個に増やす（例: ステージ開始10秒後、特定ブロック破壊時）
- 入口: `js/config.js` に `maxBalls` や `multiBallTrigger` を追加し、`js/phaser-game.js` で追加ボール生成と更新を行う

3. 時間イベントを追加する
- 例: 10秒だけパドルが広くなる、20秒ごとにボール速度が少し上がる
- 入口: `js/config.js` に `eventIntervalSec` / `eventDurationSec` を追加し、`js/phaser-game.js` の更新ループで扱う

4. ブロック効果イベントを追加する
- 例: 特定タイプのブロックを壊すと「全ブロックの色が変わる」「次の5秒だけ得点2倍」
- 入口: `blockTypes` に `onBreakEffect` を追加し、`js/phaser-game.js` 側で効果を切り替える

## 改造時のコツ
- はじめは一度に1か所だけ変えて、動きを確認する
- 数値は大きく変えすぎず、少しずつ調整する
- 変更前の値をメモしておくと、いつでも戻しやすい
