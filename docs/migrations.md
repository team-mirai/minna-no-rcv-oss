# マイグレーション

スキーマは `supabase/migrations/*.sql` で管理します。本番への適用は main マージ時の CD が行うので
（[`deploy.md`](deploy.md)）、**本番 DB に手で SQL を当てないでください**。

## 自分の Supabase プロジェクトに当てる（開発用）

```bash
supabase db push              # Supabase CLI。もしくは supabase/migrations/*.sql を SQL エディタで実行
```

`purge_expired_data()`（保存期間の削除）は関数を定義してあるだけで、**スケジュール登録は
別途必要**です。手順は `supabase/migrations/*_retention.sql` のコメントを参照。

## 書き方の原則（expand / contract）

本番では「DB マイグレーション → アプリのデプロイ」の順で流れますが、Vercel のビルド中（数分）は
**古いアプリが新しい DB を読む**時間があり、デプロイを戻すときは**古いアプリに戻す一方で DB は
新しいまま**になります。そのため、**古いアプリでも壊れないマイグレーション**だけを書きます。

- **足すのは自由**：列・テーブルの追加は `null 許容` か `default` 付きで足す。古いアプリが
  動いたままでも壊れない。
- **消す・厳しくするのは 2 回に分ける**：`drop column` / `not null` 化 / 列名変更は、
  ①アプリ側の参照を消したリリースを先に出す →②次の PR で DDL を当てる。
- 破壊的な DDL を機能追加の PR に混ぜない。

## ファイルの規約（CI がチェック）

PR ごとに [`scripts/check-migrations.sh`](../scripts/check-migrations.sh) が次を検査します
（[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) の `migrations` job）。

1. ファイル名が `<14桁タイムスタンプ>_<snake_case>.sql`（例: `20260906000006_results_open_at.sql`）
2. 先頭 14 桁の version が重複していない（重複すると片方が「適用済み」と誤判定されて黙って飛ぶ）
3. **すでに main に入っているマイグレーションファイルを書き換え・削除していない**（適用済みの
   履歴とファイルが食い違い、本番と手元でスキーマがずれる）。修正は新しいファイルを足して行う

## 手で SQL エディタから当てない

手で当てると `supabase_migrations.schema_migrations` の履歴とファイルがずれ、次の
`db push` が「もう存在する」で落ちます。緊急で手当てしたときは、その version ぶんだけ

```bash
supabase migration repair --status applied <version> --db-url "$SUPABASE_DB_URL"
```

で履歴を揃えてください（DB は変更されず、履歴テーブルだけ埋まります）。

## 適用状況を見る

```bash
supabase migration list --db-url "$SUPABASE_DB_URL"   # local / remote の対応表
```

CD のログにも適用前後の同じ出力が残ります。
