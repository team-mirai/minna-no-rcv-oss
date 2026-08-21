-- データ保存期間の実装（利用規約 §4「保存期間」に対応）
--
-- 規約に保存期間を書く以上、実際に消す仕組みが要る（書きっぱなしだと空手形になる）。
-- ここでは削除処理を関数として定義するだけで、スケジュール登録は別途行う（下記の手順）。
--
--   ・送信ログ（submit_log）        : 90 日
--   ・投票データ（poll とその子）    : 最終更新から 1 年
--     poll を削除すると poll_option / ballot / poll_result は
--     on delete cascade で一緒に消える（20260718000001_init.sql）。
--
-- 期間は環境変数ではなく、この関数の既定引数を唯一の正とする（規約の文言と 1 対 1 で
-- 対応させ、ズレたときにどちらが正か迷わないようにするため）。変更するときは規約も直す。

create or replace function purge_expired_data(
  p_log_days    int default 90,
  p_poll_days   int default 365
) returns table (deleted_logs bigint, deleted_polls bigint)
language plpgsql
as $$
declare
  v_logs  bigint;
  v_polls bigint;
begin
  delete from submit_log
   where created_at < now() - make_interval(days => p_log_days);
  get diagnostics v_logs = row_count;

  -- updated_at は poll_set_updated_at トリガーで維持される。締切後に触られない poll は
  -- 締切時刻が最終更新になるので「開催から 1 年」ではなく「最後に動いてから 1 年」。
  delete from poll
   where updated_at < now() - make_interval(days => p_poll_days);
  get diagnostics v_polls = row_count;

  return query select v_logs, v_polls;
end;
$$;

revoke all on function purge_expired_data(int, int) from public;
grant execute on function purge_expired_data(int, int) to service_role;

-- ── スケジュール登録（どちらか一方を必ず行うこと）─────────────────────────────
--
-- A) Supabase の pg_cron を使う（推奨・アプリ側の変更不要）
--      Dashboard → Database → Extensions で pg_cron を有効化してから、SQL エディタで:
--
--        select cron.schedule(
--          'purge-expired-data',
--          '17 3 * * *',                       -- 毎日 03:17 UTC（＝12:17 JST）
--          $$ select purge_expired_data(); $$
--        );
--
--      登録の確認: select * from cron.job;
--      解除:       select cron.unschedule('purge-expired-data');
--
-- B) Vercel Cron から Route Handler 経由で叩く
--      vercel.json に crons を足し、service_role で rpc('purge_expired_data') を呼ぶ
--      Route Handler を用意する（CRON_SECRET による認証を忘れないこと）。
--
-- どちらも入れないと、利用規約に書いた保存期間が守られない状態になる。
