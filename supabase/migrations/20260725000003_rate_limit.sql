-- L1 アビューズ対策: レート制限用の列とインデックス
--
-- 一般公開に伴う最低限の守り（荒らしの大量作成・大量送信の抑止）。
-- 方式: 新しいインフラ（Redis 等）を足さず、既存テーブルの直近行数を数える
--       DB ベースの固定窓レート制限（src/server/rateLimit.ts）。
--       厳密な原子性は不要（境界の多少のすり抜けは許容し、桁違いの荒らしだけ止める）。

-- 作成レート制限: 「同一 IP が直近 N 分に作った poll 数」を数えるための列とインデックス。
-- IP は平文で保存せず HMAC(APP_SECRET) のハッシュ（submit_log.ip_hash と同じ方式）。
alter table poll add column if not exists created_ip_hash text;
create index if not exists poll_created_ip_idx on poll (created_ip_hash, created_at);

-- 投票レート制限: 「同一 IP の直近 N 秒の送信試行数」を submit_log で数える。
create index if not exists submit_log_ip_idx on submit_log (ip_hash, created_at);
