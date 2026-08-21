-- 関数の search_path を定義時に固定する（Supabase advisors: function_search_path_mutable）
--
-- search_path を固定しない関数は、本体の中の修飾なしの名前（submit_log, poll, …）を
-- 「定義したとき」ではなく「呼ばれたときのセッションの探索順」で解決する。つまり
-- どのテーブルを読み書きするかが呼び出し側の環境に依存する。
--
-- このアプリでは権限昇格には繋がらない（4 つとも SECURITY INVOKER = 呼んだ人の権限で
-- 動くので、名前をすり替えても攻撃者は自分の持つ権限以上を得られない。public への
-- CREATE も postgres 以外は持たない）。固定するのは次の一点のため:
--
--   pg_temp（一時テーブルのスキーマ）は search_path に明示的に書かれていないと暗黙に
--   先頭で探索される。一時テーブルの作成権限は anon / authenticated / service_role の
--   すべてが持つので、同一セッションに create temp table submit_log (...) があると
--   purge_expired_data() はそちらを消して本物のログに触れないまま正常終了しうる。
--   規約 §4 の保存期間を守る唯一の仕組みが静かに空振りするのは避けたい。
--
-- pg_temp を明示的に「最後」に置くことで、この暗黙の先頭探索が無効になる。

alter function public.set_updated_at()                     set search_path = public, pg_temp;
alter function public.submit_ballot(uuid, text, uuid[])    set search_path = public, pg_temp;
alter function public.close_poll(uuid)                     set search_path = public, pg_temp;
alter function public.purge_expired_data(int, int)         set search_path = public, pg_temp;

-- 以降に関数を足すときは、定義側に set search_path = public, pg_temp を直接書くこと
-- （ここに alter を積み増していくと、定義と設定が離れて追いにくくなる）。
