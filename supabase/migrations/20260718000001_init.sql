-- みんなのRCV — 初期スキーマ
--
-- 設計方針（docs/design.md §5 / §7）:
-- - poll ごとに完全独立。「いま開催中の投票はどれか」のようなグローバル状態を一切
--   持たない（汎用ツールとしての本質的単純化）。
-- - アカウントレス。参加は /p/<slug>、管理は /p/<slug>/manage?key=<admin_key>。
-- - フル BFF。アプリは service_role でのみ読み書きする（anon 直叩きは無い）。
--   念のため全テーブルで RLS を有効化し、ポリシーを置かない＝ anon/authenticated は
--   デフォルト拒否（service_role は RLS をバイパスする）。

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ── poll: 1 つの投票（お題）─────────────────────────────
create table poll (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,          -- 参加 URL 用の短い公開ID
  title            text not null,
  description      text,
  status           text not null default 'open'
                     check (status in ('open', 'closed')),
  -- 予約締切（任意）。到達後は submit_ballot が受理を拒否する（DB 時計が唯一の正）。
  close_at         timestamptz,
  require_captcha  boolean not null default false, -- L1: Turnstile を要求する
  show_live_count  boolean not null default true,  -- 受付中に途中経過を見せてよいか
  admin_key_hash   text not null,                  -- 管理キーの HMAC（生キーは保存しない）
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── poll_option: 選択肢 ─────────────────────────────────
create table poll_option (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references poll(id) on delete cascade,
  label       text not null,
  color       text,
  sort_order  int  not null default 0
);
create index poll_option_poll_idx on poll_option(poll_id, sort_order);

-- ── ballot: 1 ブラウザ(voter_key) = 1 票 ────────────────────────
-- rankings は option_id の配列（先頭が第1希望）。受付中は上書き再投票でき、最後が有効。
-- PK (poll_id, voter_key) が「1人1票」を DB レベルで保証する。
create table ballot (
  poll_id     uuid not null references poll(id) on delete cascade,
  voter_key   text not null,
  rankings    uuid[] not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (poll_id, voter_key)
);

-- ── poll_result: 締切後の集計スナップショット（不変）────────────────
-- tallyRcv（features/rcv/tally.ts）の出力を丸ごと保存する。締切後の不変データにのみ
-- 実行するので冪等（同じ入力なら同じ結果）。
create table poll_result (
  poll_id       uuid primary key references poll(id) on delete cascade,
  result        jsonb not null,
  ballot_count  int   not null,
  computed_at   timestamptz not null default now()
);

-- ── submit_log: 追記専用（荒らし発生時の事後フィルタ・変更履歴の保険）──────
-- 受理/拒否を問わず全送信試行を残す。ballot には最後の1票しか残らないため、後から
-- 異常票を除外して全票再計算する材料になる。
create table submit_log (
  id            bigint generated always as identity primary key,
  poll_id       uuid,
  voter_key     text,
  rankings      jsonb,
  result        text not null,
  verification  text,            -- 'none' | 'turnstile' | 'fail_open'
  ip_hash       text,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index submit_log_poll_idx on submit_log(poll_id, created_at);

-- ── updated_at 自動更新トリガー ───────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger poll_set_updated_at
  before update on poll
  for each row execute function set_updated_at();

-- ballot の updated_at は submit_ballot が明示更新するのでトリガー不要。

-- ── RLS: 全テーブルでポリシー無しの有効化（service_role のみアクセス可）──────
alter table poll         enable row level security;
alter table poll_option  enable row level security;
alter table ballot       enable row level security;
alter table poll_result  enable row level security;
alter table submit_log   enable row level security;
