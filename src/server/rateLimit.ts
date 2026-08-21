import "server-only";
import { admin } from "@/lib/supabase";

/**
 * DB ベースの固定窓レート制限（L1 アビューズ対策）。
 *
 * - Redis 等を足さず、既存テーブルの直近行数を count して判定する
 *   （サーバレスでもインスタンス間で一貫する。メモリに依らない）
 * - 厳密な原子性は求めない。境界での多少のすり抜けは許容し、桁違いの荒らしだけ止める
 * - count に失敗したときは fail-open（可用性優先）。submit_log に試行が残るので事後追跡は可能
 *
 * 注意: 投票側の窓は submit_log の行数で数えるため、拒否した試行は submit_log に
 * 積まない（積むと荒らし自身がログを無限に膨らませられる）。窓は自然に減衰する。
 */

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

// 既定値の根拠:
// - 作成: 人間の主催者が 10 分に 5 件以上作ることはまず無い。日次上限は事後掃除の量の上限
// - 投票: イベント会場の NAT では多人数が同一 IP になり得るため、1 分あたりはかなり緩めに取る
//   （それでも単一マシンからの機械的な flood は桁が違うので止まる）
const createPer10Min = () => intEnv("RATE_LIMIT_CREATE_PER_10MIN", 5);
const createPerDay = () => intEnv("RATE_LIMIT_CREATE_PER_DAY", 30);
const submitPerMin = () => intEnv("RATE_LIMIT_SUBMIT_PER_MIN", 120);

async function countSince(
  table: "poll" | "submit_log",
  ipCol: "created_ip_hash" | "ip_hash",
  ipHash: string,
  windowMs: number
): Promise<number | null> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await admin()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(ipCol, ipHash)
    .gte("created_at", since);
  if (error) {
    console.error(`rate limit count failed (${table}):`, error.message);
    return null; // fail-open
  }
  return count ?? 0;
}

/** poll 作成のレート制限。true = 許可。ipHash が取れない環境（ローカル等）は許可。 */
export async function allowCreate(ipHash: string | null): Promise<boolean> {
  if (!ipHash) return true;
  const [m10, d1] = await Promise.all([
    countSince("poll", "created_ip_hash", ipHash, 10 * 60 * 1000),
    countSince("poll", "created_ip_hash", ipHash, 24 * 60 * 60 * 1000),
  ]);
  if (m10 === null || d1 === null) return true;
  return m10 < createPer10Min() && d1 < createPerDay();
}

/** 投票送信のレート制限。true = 許可。 */
export async function allowSubmit(ipHash: string | null): Promise<boolean> {
  if (!ipHash) return true;
  const n = await countSince("submit_log", "ip_hash", ipHash, 60 * 1000);
  if (n === null) return true;
  return n < submitPerMin();
}
