# みんなのRCV

誰でも **優先順位付投票（Ranked Choice Voting / 即時決選）** を無料で開催できるツール。
「調整さん」のようにアカウント登録なしで、URL を配るだけで投票を始められます。

> ⚠️ 本人確認をしない緩い一意性（1ブラウザ1票）のプロトタイプです。
> **正式な選挙・議決には使えません。**

設計の考え方は [`docs/design.md`](docs/design.md) を参照。

## 何がうれしいのか

「1人1票で一番だけ選ぶ」ふつうの多数決は、似た候補に票が割れて「みんなの2番目に良い案」が
消えがちです。RCV は候補を順位で選び、最下位を落として票を次順位へ移す、を過半数が出るまで
繰り返すので、広く支持される選択が残りやすくなります。

## UI / 体験

会場のスクリーンに映して使うことを想定した、開票演出つきの UI を持っています。

- **順位付けボード**（`src/app/p/[slug]/VoteClient.tsx`）… タップで1位から積む → カードの
  長押しドラッグ（Pointer Events・自動スクロール・settle アニメ）で並べ替え。⠿ ハンドルは
  即時ドラッグ・↑↓キー対応。送信成功で投票箱アイソメアニメ（`BallotDoneArt`）のポップアップ。
- **開票プレゼン**（`/p/<slug>/present`・16:9投影）… 開会（紙吹雪）→ ラウンドごとの
  除外発表→票移動（イエロー＋黒枠の移動票・過半数破線の追従・行の並べ替え遷移）→
  決定スタンプ → 「もし1位票だけで決めていたら？」比較。クリック / ← → Space / P（自動再生）
  で進行。`/demo` でサンプルデータの開票を体験できる。
- **結果ページ**（`/p/<slug>/results`）… 1位を強調した勝者ヒーロー（紙吹雪＋決定スタンプ）＋
  手動操作・進行バーつきの「開票のドラマ」リプレイ＋比較カード＋共有（URL コピー / X）。
  受付中（`show_live_count`）は“1位票のいま”を15秒ごとに自動更新。
- **管理ページ** … 参加URLのコピー＆QR表示（会場投影用）・投票数の自動更新・予約した締切と
  結果公開時刻の表示・締切の確認モーダル・「いま結果を公開する」。

## アーキテクチャ

- **Next.js 15（App Router）+ TypeScript + Tailwind CSS 4 + @phosphor-icons/react**
- **Supabase（Postgres）／フル BFF**：ブラウザは Supabase を直接叩かない。すべての読み書きは
  Server 側の `service_role` クライアント（`src/lib/supabase.ts`）経由。RLS は全テーブルで
  有効（ポリシー無し＝拒否）で、認可はアプリ層で担う。
- **poll ごとに完全独立**：「いま開催中の投票はどれか」のようなグローバル状態を持たない。
- **アカウントレス**：参加は `/p/<slug>`、管理は `/p/<slug>/manage?key=<admin_key>`。
  管理キーは作成時に一度だけ発行し、DB にはハッシュだけ保存する。

```
src/
  features/rcv/tally.ts         IRV 集計の純粋関数（テスト付き）
  features/rcv/presenter/       開票プレゼン（16:9投影・RcvResultsPresenter / config / rowOrder / demo）
  features/rcv/replay/          モバイル結果ページ用の開票リプレイ
  components/                   Brand / Modal / BallotDoneArt / RcvExplainer
  lib/                          supabase / voter Cookie / 管理キー / slug / 締切・結果公開(closeAt) / env / haptics
  features/og/card.tsx          SNS シェア用 OG 画像（1200×630）の共通レイアウト
  server/polls.ts               BFF（作成・取得・受理・締切・結果公開・集計）
  server/rateLimit.ts           DB ベースの固定窓レート制限（作成・投票）
  app/                          画面（トップ / 作成 / 参加 / 結果 / プレゼン / 管理 / デモ）＋ Server Actions
  app/**/opengraph-image.tsx    ページごとの OG 画像
assets/fonts/                   OG 画像描画用の日本語フォント（サーバ専用・README / OFL.txt あり）
supabase/migrations/
  ..._init.sql                  テーブル・RLS・トリガー
  ..._functions.sql             submit_ballot / close_poll（原子的 RPC）
  ..._rate_limit.sql            レート制限用の列・インデックス
  ..._retention.sql             purge_expired_data（保存期間の削除関数）
  ..._results_open_at.sql       結果公開時刻（締切と分離）
```

## 投票受理の atomic 性

満たしたい性質は 2 つです。**締切がコミットした後の票は絶対に入らない**ことと、
**結果は締切後の不変データから計算され、何度計算しても同じになる**こと。

素直に書くと「status を SELECT →選択肢を SELECT → upsert」の 3 往復・3 トランザクションに
なり、検証した瞬間と書き込む瞬間の間に締切が入り得ます。ここを **DB の行ロックだけ** で
構造的に解いています（advisory lock も Redis も不要）。

1. **`submit_ballot`（単一 RPC・1 tx）** … `poll` 行を `FOR SHARE` で読み、status/close_at/
   rankings 検証と `ballot` の upsert を同一トランザクションに閉じる。submit 同士は
   `FOR SHARE` なのでブロックし合わず、高並行に耐える。
2. **`close_poll`（UPDATE）** … poll 行の排他ロックを取るので、進行中の `submit_ballot`
   がコミットするのを待ってから `closed` にする。これがコミットした後の受理は
   `FOR SHARE` で `closed` を読んで弾かれる ＝ **締切後に票が入らないことを DB が保証**。
3. **集計** … 締切後の不変データにのみ `tallyRcv` を実行し `poll_result` にスナップショット
   （決定的なので冪等）。

この直列化はローカル Postgres 16 で実証済みです（close が in-flight submit を待ち、close 後の
submit が `poll_closed` になる）。

## 締切（close_at）と結果公開（results_open_at）

作成フォームで締切（任意）を指定できます。指定した時刻を過ぎると、

- 受理は `submit_ballot` が `close_at` を見て `poll_closed` を返す（**DB が拒否する**）。
- 参加ページは結果ページへ送り、管理ページ・結果ページを開いた時点で `ensureClosedIfDue` が
  `status` を `closed` に確定させる（＝ cron 不要の遅延クローズ。締切直後に誰も開かなくても、
  票が入らないこと自体は上の 1 で保証されている）。

締切は指定しなくても構いません（管理URLの「投票を締め切る」を押すまで受け付け続ける）。

**締切と結果公開は別の時刻**です。締切＝受付をやめる時刻、結果公開＝結果を見せる時刻で、
「18時に締め切って、20時の配信で発表する」ように分けられます。

- `results_open_at` が **null なら締切と同時に公開**（既定・これまでの挙動）。
- 指定した場合、締切済みでもその時刻まで **参加者には結果ページ・プレゼンモードで結果を
  出しません**。待機画面では集計そのものを呼ばないので、描画しないだけで props に載る
  （＝ DevTools から読める）事故も起きません。
- 発表を前倒ししたいときは、管理ページの「いま結果を公開する」で `results_open_at` を
  現在時刻に更新します（締切は動かしません）。
- 受付中の途中経過（`show_live_count`）はこれとは独立で、これまでどおりの挙動です。

### 主催者はいつでもプレゼンモードを開ける

配信・会場でこちらから発表するには、参加者に見せないまま主催者だけが開票画面を映せる必要が
あります（結果を公開してから映す運用だと、読み上げる前に参加者のスマホに結果が出てしまう）。
そのため **プレゼンモード（`/p/<slug>/present`）は管理キー付きURLならいつでも開けます**。

- `?key=<管理キー>` を付けて開いたときだけ主催者とみなす（管理ページの検証と同じ
  `verifyAdminKey`。ハッシュ照合で、キーそのものはDBに無い）。キーが無い／合わないアクセスは
  これまでどおり待機画面。
- 締切済み・公開待ちなら **確定結果**（`poll_result` のスナップショットと同じ・後から変わらない）、
  まだ受付中なら **途中経過（暫定）**。どちらも画面右上にその旨のバッジを出す。
- 何を映すかの判定は `src/lib/closeAt.ts` の `resolvePresentMode(status, resultsOpenAt, isAdmin)`
  に集約（`final` / `live` / `standby`・テスト付き）。
- 管理キーがURLに載るので、画面共有するときは全画面表示にしてURL欄を映さないこと。

入力の検証と表示フォーマットは `src/lib/closeAt.ts`（純粋関数・テスト付き）にまとめてあり、
表示は主催者と参加者で食い違わないよう **日本時間で固定** しています。結果を公開してよいかの
判定も同じファイルの `isResultsOpen`（締切済み かつ 公開時刻を過ぎている）に集約しています。

## セットアップ

```bash
npm ci                        # package-lock.json をそのまま使う（依存を足すときだけ npm install）
cp .env.example .env          # SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / APP_SECRET を設定
# Supabase プロジェクトにマイグレーションを適用（Supabase CLI）
supabase db push              # もしくは supabase/migrations/*.sql を SQL エディタで実行
npm run dev
```

`purge_expired_data()`（保存期間の削除）は関数を定義してあるだけで、**スケジュール登録は
別途必要**です。手順は `supabase/migrations/*_retention.sql` のコメントを参照。

## SNS シェア（OGP）

チャットや SNS に URL を貼ったときのカードは、`next/og` で毎回サーバ描画している
（画像アセットを持たない＝文言を変えてもデザイナー往復が要らない）。

- 絵づくりは `src/features/og/card.tsx` 一箇所。各 `opengraph-image.tsx` は
  「ラベル・見出し・説明」を渡すだけ。
- 見出し（`og:title`）と説明は、各ページの `metadata.title` / `description` が
  そのまま流れ込む。ページ側で `openGraph` オブジェクトは**定義しないこと**
  （定義するとルートの `siteName` / `type` / `locale` が丸ごと消える）。詳細は
  `src/app/layout.tsx` のコメント。
- `/p/<slug>` と `/p/<slug>/results` は、お題をカード画像にも焼き込む。DB が引けなくても
  汎用カードに倒して画像は必ず出す（`ogPollTitle`）。
- 日本語は `assets/fonts/` のサブセットフォントで描く。`next.config.ts` の
  `outputFileTracingIncludes` で本番バンドルに同梱している（外すと本番だけ 500）。
- 独自ドメインが決まったら `NEXT_PUBLIC_SITE_URL` を設定する（`src/lib/siteUrl.ts`）。
  未設定でも Vercel の環境変数から自動で決まる。

確認は `npm run dev` して、`curl -o og.png localhost:3000/opengraph-image` で PNG を
直接叩くのが早い。

### テスト

```bash
npm test          # 集計・行順・締切ロジックの受け入れテスト（node --test）
npm run typecheck # tsc --noEmit
npm run build     # next build
```

## いまの範囲

できていること：作成（締切の予約は任意）→ 参加（順位付けドラッグUI・受付中は上書き再投票）→
締切（予約した時刻での自動締切／管理URLからの手動締切）→ 勝者ヒーロー＋開票リプレイつき結果 →
16:9 プレゼンモード、1ブラウザ1票、原子的な受理と締切、集計スナップショット、参加QR、
`/demo` の開票デモ、L1 アビューズ対策のうち **Cookie ゲート**（`src/lib/voter.ts`）と
**IP レート制限**（`src/server/rateLimit.ts`）。

まだ：**Turnstile（captcha）は未実装**（DB 列 `require_captcha` と seam はあるが、有効な
poll は投票を明示的に拒否する）、日程調整モードなどの派生案。

なお Cookie ゲートもレート制限も**決定的な対策ではありません**（Cookie jar を持ち IP を
分散すれば通ります）。「1人1票」を本当に要求する用途には使えない点は変わりません。

## セキュリティ

脆弱性を見つけた場合は、公開 Issue ではなく
[`SECURITY.md`](SECURITY.md) に記載した非公開窓口からご報告ください。

## ライセンス

このプロジェクトのソースコードは
[GNU Affero General Public License v3.0](LICENSE) の下で公開されています。

AGPL-3.0 は、改変した版をネットワーク越しに利用者へ提供する場合、その利用者に対して
ソースコードを取得する機会を提供することを求めます（第13条）。フォークして自前で
ホストする場合は、画面のどこか（フッター等）に自分のソースコードへのリンクを置いてください。

### 同梱している第三者の素材

コード以外の同梱物は AGPL-3.0 ではなく、それぞれのライセンスに従います。

| 対象 | ライセンス | 詳細 |
| --- | --- | --- |
| `assets/fonts/NotoSansJP-Bold-subset.ttf` | SIL Open Font License 1.1 | [`assets/fonts/OFL.txt`](assets/fonts/OFL.txt) |
| `public/samples/*.webp` | Unsplash License | [`public/samples/CREDITS.md`](public/samples/CREDITS.md) |
