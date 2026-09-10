# デプロイ

**main にマージすると、GitHub Actions が「本番 DB へのマイグレーション適用 → Vercel の
本番デプロイ開始 → 本番 URL の疎通確認」をこの順で直列に実行します。** 本番 DB に手で SQL を
当てる必要はありません。マイグレーションが失敗したらデプロイは始まりません（みらい議会
[team-mirai/mirai-gikai](https://github.com/team-mirai/mirai-gikai) と同じ構成）。

マイグレーションファイルの書き方・規約は [`migrations.md`](migrations.md) を参照。

## 何がいつ走るか

| いつ | 何が走るか | どこ |
| --- | --- | --- |
| PR を出す | test / typecheck / build ＋ migration ファイルの規約チェック | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| main にマージ | ① `supabase db push` で未適用のマイグレーションを本番 DB へ適用 → ② 成功したら Vercel の Deploy Hook を叩いて本番ビルドを開始 → ③ 本番 URL（`/` と `/demo`）が 200 を返すか確認 | [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) |

- 適用前後に `supabase migration list` を出すので、Actions のログが「いつ何を当てたか」の
  記録になります。
- `concurrency: deploy-production`（`cancel-in-progress: false`）で、連続マージしても本番への
  適用は 1 本ずつ直列に流れます。
- 手動で再実行したいときは Actions の「Migrate DB then Deploy」から `Run workflow`
  （`workflow_dispatch`）。

## Vercel の自動デプロイは止めてある

Vercel の Git 連携による main の自動デプロイは [`vercel.json`](../vercel.json) の
`git.deploymentEnabled.main: false` で止めてあります（PR の Preview デプロイはそのまま）。
main のデプロイは上の ② だけが起点です。**`VERCEL_DEPLOY_HOOK_URL` secret が無いと本番は
一切デプロイされない**ので、下の secret を先に設定してください。

順序は「DB が先、アプリが後」に固定されていますが、Vercel のビルド中（数分）は古いアプリが
新しい DB を読む時間があり、デプロイを戻すときは古いアプリに戻す一方で DB は新しいままに
なります。そのためマイグレーションは「古いアプリでも壊れない」書き方（expand / contract）を
守ります。詳細は [`migrations.md`](migrations.md)。

## なぜ自動化したか

2026-09-06、`results_open_at` を追加した PR をマージしたところ、アプリだけが先にデプロイされ
DB には列が無い状態になり、本番が 500（`column poll.results_open_at does not exist`）に
なりました。「マージしたら DB も一緒に更新される」を仕組みで保証するためです。

## 必要な secret（リポジトリ設定）

Settings → Secrets and variables → Actions に次の 2 つを登録します。

| 名前 | 中身 |
| --- | --- |
| `SUPABASE_DB_URL` | 本番 Supabase の **Session pooler** の接続文字列（`postgresql://postgres.<ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres`） |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel の **Deploy Hook** の URL（`https://api.vercel.com/v1/integrations/deploy/prj_.../...`） |

- `SUPABASE_DB_URL`：GitHub Actions のランナーは IPv4 のみなので、`db.<ref>.supabase.co` への
  直結ではなく pooler（ポート 5432 のセッションモード）を使います。Supabase Dashboard の
  Connect から取得できます。
- `VERCEL_DEPLOY_HOOK_URL`：Vercel の Project Settings → Git → **Deploy Hooks** で、
  Git Branch Name に `main` を指定して作成した Hook の URL です。この URL を知っていれば
  誰でも本番デプロイを起動できるので、secret 以外の場所に書かないでください。

どちらも未設定のままマージすると、ワークフローは何をすればよいかを書いたエラーで
落ちます（黙って skip しません）。マイグレーションを当てる前に 2 つまとめて確認するので、
「DB だけ進んでデプロイできない」状態にはなりません。

## この repo の GitHub Actions ポリシー

Settings → Actions → General で **「GitHub 製と team-mirai 製のアクションのみ許可」＋「full-length
SHA での固定を必須」** にしてあります（公開 OSS なのでサプライチェーンを絞る）。そのため
第三者の action（`supabase/setup-cli` など）は使えず、起動時に `startup_failure` になります。
Supabase CLI は [`deploy.yml`](../.github/workflows/deploy.yml) の中で GitHub Releases の tarball を
**バージョン固定＋`checksums.txt` の sha256 検証**で入れています。CLI を上げるときは
`SUPABASE_CLI_VERSION` を書き換えるだけです（checksum は同じリリースの `checksums.txt` から自動で取る）。

## 落ちたときの見方

- **`startup_failure`（ジョブが 1 つも走らない）**：workflow ファイルの問題です。多くは上の
  Actions ポリシーに引っかかる第三者 action の追加。run ページの Annotations に理由が出ます。

- **secret 未設定**：最初のステップのエラーメッセージに何を登録すればよいか書いてあります。
- **`db push` が「already exists」で落ちる**：過去に SQL エディタから手で当てたマイグレーションが
  履歴テーブルに無い状態です。[`migrations.md`](migrations.md) の「手で SQL エディタから当てない」
  にある `supabase migration repair` で履歴を揃えてください。DB は変更されません。
- **疎通確認だけ赤い**：デプロイは始まっています。Vercel のダッシュボードでビルドの状態を確認し、
  アプリと DB の整合（列が無い等）を疑ってください。
