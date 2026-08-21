-- みんなのRCV — 投票受理と締切の原子的 RPC
--
-- 満たしたい性質は 2 つ。
--   ・締切がコミットした後の票は、絶対に入らない
--   ・結果は締切後の不変データから計算され、何度計算しても同じになる
--
-- 素直に書くと submit は「status を SELECT → options を SELECT → upsert」の
-- 3 往復・3 トランザクションになり、検証した瞬間と書き込む瞬間の間に締切が入り得る。
-- この 2 つの関数は、その隙間を DB の行ロックだけで構造的に潰す
-- （advisory lock も Redis も要らない。行ロックでこのドメインには十分）。

-- ── submit_ballot: 投票受理（1 tx で完結）───────────────────────────────────
-- 戻り値（text の結果コード）:
--   'ok'                受理（新規または上書き再投票）
--   'poll_not_found'    poll_id が存在しない
--   'poll_closed'       締切済み（status=closed）または close_at 到達
--   'invalid_rankings'  空 / 重複あり / 選択肢数超過 / この poll に属さない option を含む
create or replace function submit_ballot(
  p_poll_id   uuid,
  p_voter_key text,
  p_rankings  uuid[]
) returns text
language plpgsql
as $$
declare
  v_status        text;
  v_close_at      timestamptz;
  v_option_count  int;
  v_ranked        int := coalesce(cardinality(p_rankings), 0);
  v_distinct      int;
  v_unknown       int;
begin
  -- poll 行を共有ロック（FOR SHARE）で読む。
  -- ・並行する submit 同士は FOR SHARE 同士なのでブロックし合わない（高並行に耐える）。
  -- ・close_poll の UPDATE（FOR NO KEY UPDATE 相当）とは競合するので、締切は進行中の
  --   受理がコミットするまで待たされ、締切コミット後の受理は status=closed を見て弾かれる。
  select status, close_at
    into v_status, v_close_at
    from poll
   where id = p_poll_id
   for share;

  if not found then
    return 'poll_not_found';
  end if;
  if v_status <> 'open' then
    return 'poll_closed';
  end if;
  if v_close_at is not null and now() >= v_close_at then
    return 'poll_closed';
  end if;

  -- rankings 検証: 1 件以上・重複なし・全て この poll の option・選択肢数以内
  if v_ranked = 0 then
    return 'invalid_rankings';
  end if;

  select count(distinct e) into v_distinct from unnest(p_rankings) as e;
  if v_distinct <> v_ranked then
    return 'invalid_rankings';
  end if;

  select count(*) into v_option_count from poll_option where poll_id = p_poll_id;
  if v_ranked > v_option_count then
    return 'invalid_rankings';
  end if;

  select count(*) into v_unknown
    from unnest(p_rankings) as e
   where not exists (
     select 1 from poll_option o where o.poll_id = p_poll_id and o.id = e
   );
  if v_unknown > 0 then
    return 'invalid_rankings';
  end if;

  -- 1 ブラウザ 1 票の upsert（受付中は last-write-wins）。同一 tx なので受理は原子的。
  insert into ballot (poll_id, voter_key, rankings, created_at, updated_at)
  values (p_poll_id, p_voter_key, p_rankings, now(), now())
  on conflict (poll_id, voter_key)
  do update set rankings = excluded.rankings, updated_at = now();

  return 'ok';
end;
$$;

-- ── close_poll: 締切（受理と直列化）─────────────────────────────────────────
-- UPDATE が poll 行の排他ロックを取るので、進行中の submit_ballot（FOR SHARE）が
-- コミットするのを待ってから status を closed にする。これがコミットした後の
-- submit_ballot は FOR SHARE で closed を読んで受理を拒否する＝「締切後に票が入らない」
-- 保証。既に closed なら 0 行更新で false を返す（冪等）。
create or replace function close_poll(p_poll_id uuid) returns boolean
language plpgsql
as $$
declare
  v_updated int;
begin
  update poll
     set status = 'closed'
   where id = p_poll_id
     and status = 'open';
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- ── 権限: service_role だけが実行できる（フル BFF）──────────────────────────
revoke all on function submit_ballot(uuid, text, uuid[]) from public;
revoke all on function close_poll(uuid)                  from public;
grant execute on function submit_ballot(uuid, text, uuid[]) to service_role;
grant execute on function close_poll(uuid)                 to service_role;
