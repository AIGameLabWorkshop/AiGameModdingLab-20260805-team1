#!/usr/bin/env python3
"""Generate BrickBreaker/js/layouts.js from editable text masks.

Mask format:
- One text file per stage in BrickBreaker/scripts/layout_masks/
- 25 lines x 40 columns in current data (script validates rectangular shape)
- Allowed chars: A, B, .
  - A/B -> block type key
  - .   -> empty cell ("")
"""

from __future__ import annotations

import argparse
from pathlib import Path

HEADER = """// ステージごとのブロックレイアウトを静的データとしてまとめるファイル。
// 1行を1段として並べた\"テーブル形式\"で、配置をそのまま編集しやすくしている。
//
// 実装ルール（このファイルを編集するときの前提）:
// 1) 各ステージは2次元配列で表現する。
//    - 外側配列の1要素が「1行（上から下）」に対応する。
//    - 内側配列の1要素が「1列（左から右）」に対応する。
//    - 現在の標準データは 25x40 だが、実装自体は可変行・可変列に対応している。
//
// 2) セルに入れる値は blockTypes のキー文字列、または ""（空きマス）を使う。
//    - 現在の標準運用では "A" / "B" / "" を使用している。
//    - blockTypes に種類を追加すれば、"C" なども配置に使える。
//
// 3) 文字列以外の値は使わない。
//    - null / undefined / 数値 / 真偽値は使用しない。
//    - 空きマスは必ず ""（空文字）で表現する。
//
// 4) 行数・列数は変更可能。
//    - createBricks 側で行列数に応じてブロックサイズを自動計算する。
//    - ただし大きく変えると難易度や視認性は変わるため、意図を持って調整する。
//
// 5) ステージ識別子はこのファイル側の固定制約ではない。
//    - 追加・改名は可能で、どのキーを使うかは呼び出し側（config.js）の参照次第。
//    - ステージを増やすときは、layouts 側に配列を追加し、config.js の stages から参照する。
//
// 6) 末尾カンマと配列の閉じ方は既存スタイルに合わせる。
//    - 行単位で編集しても差分が追いやすいよう、現在の表形式を維持する。
(function () {
  window.BB = window.BB || {};
  window.BB.layouts = {
"""

FOOTER = """  };
})();
"""


def parse_mask(mask_path: Path) -> list[list[str]]:
    lines = [line.rstrip("\n") for line in mask_path.read_text(encoding="utf-8").splitlines()]
    if not lines:
        raise ValueError(f"Mask is empty: {mask_path}")

    col_count = len(lines[0])
    if col_count == 0:
        raise ValueError(f"Mask has zero columns: {mask_path}")

    grid: list[list[str]] = []
    for i, line in enumerate(lines, start=1):
        if len(line) != col_count:
            raise ValueError(
                f"Non-rectangular mask in {mask_path} at line {i}: "
                f"expected {col_count} cols, got {len(line)}"
            )

        row: list[str] = []
        for ch in line:
            if ch == ".":
                row.append("")
            elif ch in {"A", "B"}:
                row.append(ch)
            else:
                raise ValueError(f"Invalid character '{ch}' in {mask_path} line {i}")
        grid.append(row)

    return grid


def render_stage(stage_name: str, grid: list[list[str]], is_last: bool) -> str:
    row_lines = []
    for row in grid:
        cells = ", ".join(f'"{cell}"' if cell else '""' for cell in row)
        row_lines.append(f"      [{cells}],")

    close = "    ]" if is_last else "    ],"
    return "\n".join([f"    {stage_name}: [", *row_lines, close])


def discover_stage_names(mask_dir: Path) -> list[str]:
    stage_names = sorted(path.stem for path in mask_dir.glob("*.txt") if path.is_file())
    if not stage_names:
        raise FileNotFoundError(f"No mask files found in: {mask_dir}")
    return stage_names


def build_layouts_js(mask_dir: Path) -> str:
    stage_names = discover_stage_names(mask_dir)
    stages: list[str] = []
    for index, stage_name in enumerate(stage_names):
        mask_path = mask_dir / f"{stage_name}.txt"
        grid = parse_mask(mask_path)
        stages.append(render_stage(stage_name, grid, is_last=(index == len(stage_names) - 1)))

    return HEADER + "\n".join(stages) + "\n" + FOOTER


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate BrickBreaker/js/layouts.js from text masks")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit with non-zero status if generated output differs from current layouts.js",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    brickbreaker_dir = script_dir.parent
    mask_dir = script_dir / "layout_masks"
    output_path = brickbreaker_dir / "js" / "layouts.js"

    generated = build_layouts_js(mask_dir)

    if args.check:
        current = output_path.read_text(encoding="utf-8") if output_path.exists() else ""
        if current != generated:
            raise SystemExit(1)
        return

    output_path.write_text(generated, encoding="utf-8")


if __name__ == "__main__":
    main()
