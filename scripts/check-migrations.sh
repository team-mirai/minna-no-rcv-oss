#!/usr/bin/env bash
# supabase/migrations/ の運用ルールを検査する (CI から実行)。
#
#  1. ファイル名が <14桁タイムスタンプ>_<snake_case>.sql になっているか
#  2. バージョン (先頭 14 桁) が重複していないか
#     -> 重複すると片方が「適用済み」と誤判定され、もう片方が黙って飛ぶ
#  3. すでに main に入っているマイグレーションを書き換え / 削除していないか
#     -> 適用済みの履歴とファイルが食い違い、本番と手元でスキーマがずれる
#
# 使い方:
#   bash scripts/check-migrations.sh          # 1 と 2 だけ
#   BASE_REF=<sha|ref> bash scripts/check-migrations.sh   # 3 も検査する
set -euo pipefail

dir="supabase/migrations"
fail=0

if [ ! -d "$dir" ]; then
  echo "::error::$dir が見つかりません"
  exit 1
fi

# 1. ファイル名の規約
for f in "$dir"/*.sql; do
  base=$(basename "$f")
  if ! printf '%s' "$base" | grep -Eq '^[0-9]{14}_[a-z0-9_]+\.sql$'; then
    echo "::error file=$f::ファイル名は <14桁タイムスタンプ>_<snake_case>.sql にしてください (例: 20260906000006_results_open_at.sql)"
    fail=1
  fi
done

# 2. バージョンの重複
dups=$(ls "$dir" | sed -n 's/^\([0-9]\{14\}\)_.*\.sql$/\1/p' | sort | uniq -d || true)
if [ -n "$dups" ]; then
  for v in $dups; do
    echo "::error::バージョン $v が重複しています。タイムスタンプは一意にしてください"
  done
  fail=1
fi

# 3. 既存マイグレーションの改変
base_ref="${BASE_REF:-}"
if [ -n "$base_ref" ]; then
  changed=$(git diff --name-status "$base_ref"...HEAD -- "$dir" | awk '$1 != "A" { print }' || true)
  if [ -n "$changed" ]; then
    echo "$changed" | while read -r status path _rest; do
      echo "::error file=$path::すでに main にあるマイグレーションを変更 / 削除しています (status=$status)。適用済みの履歴とずれるので、修正は新しいマイグレーションファイルを追加して行ってください"
    done
    fail=1
  fi
fi

if [ "$fail" != "0" ]; then
  exit 1
fi

echo "supabase/migrations OK"
