# BrickBreaker Scripts

このディレクトリは BrickBreaker 専用の補助スクリプトを置く場所です。

## レイアウト再生成

`js/layouts.js` は次のコマンドで再生成できます。

```bash
cd /home/keita/ScrumRecreation-template
python3 BrickBreaker/scripts/generate_layouts.py
```

リポジトリルート（`/home/keita/ScrumRecreation-template`）にいる場合は、次でも実行できます。

```bash
python3 BrickBreaker/scripts/generate_layouts.py
```

マスク編集は `BrickBreaker/scripts/layout_masks/` 配下の `.txt` を編集します。

- `A` / `B`: ブロック種別
- `.`: 空きマス（`""`）

差分チェックだけしたい場合:

```bash
python3 BrickBreaker/scripts/generate_layouts.py --check
```
