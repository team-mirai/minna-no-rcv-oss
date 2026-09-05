/**
 * RCV（優先順位付投票）の即時決選（instant-runoff）集計。
 *
 * 純粋関数・決定的。UI から完全に分離する。画面に出る数字はすべてこの結果から
 * 導出する（ハードコード禁止）。移植元アプリの実装（features/rcv-results/
 * tally.ts）をそのまま移植した、このプロジェクトの中核ロジック。
 *
 * 集計規則:
 * - 過半数 = floor(そのラウンドの有効票 / 2) + 1。分母は「総票数 − 順位切れ累計」で
 *   ラウンドごとに再計算する（順位切れが出ると縮む）。
 * - 除外票のうち、後続順位に生存候補がない票は「順位切れ（exhausted）」として累積し、
 *   以降のラウンドでは数えない。
 *   ※投票 UI は部分順位を許可する（1 つ以上で OK）ため、実データでも順位切れは
 *     普通に発生する。
 * - 同数最下位のタイブレークは FairVote モデル法典の backward-looking 方式:
 *   直前ラウンドの票数を比較し、同数なら更に前のラウンドへ遡る。第1ラウンドまで
 *   同数なら「くじ（by lot）」。くじは lotSeed から事前に確定する決定的順序で引く
 *   （再現・監査可能にするため）。lotSeed は通常 poll_id を渡す。
 * - 同数だった事実とその解消方法は tiedWith / tiebreak に必ず記録する。順位切れと
 *   同じで、扱いを隠さないのが本ツールの誠実さの要なので、表示側で開示する。
 */

export type RcvBallot = string[]; // option_id を順位順に（先頭が第1希望）

export type RcvRound = {
  /** 全候補の得票スナップショット（除外済み候補は 0）。 */
  snap: Record<string, number>;
  /** このラウンドの過半数ライン = floor(有効票/2)+1。有効票 = total − exhausted。 */
  majority: number;
  /** このラウンドの冒頭で除外された候補（第1ラウンドは null）。 */
  elim: string | null;
  /**
   * 除外の時点で最下位に並んでいた候補すべて（除外された候補自身を含む）。
   * 同数ではなかったラウンド・第1ラウンドは空配列。
   */
  tiedWith: string[];
  /**
   * 同数最下位をどう解消したか。"backward" = 前のラウンドまで遡った票数比較で決着、
   * "lot" = 第1ラウンドまで同数だったのでくじ。同数でなければ null。
   */
  tiebreak: "backward" | "lot" | null;
  /** 除外候補が持っていた票数（= 移動する票の総数）。 */
  moved: number;
  /** 除外票の移動先ごとの票数（移動先候補id → 票数）。 */
  transfers: Record<string, number>;
  /** このラウンドで新たに順位切れになった票数。 */
  toEx: number;
  /** 順位切れの累計。 */
  exhausted: number;
  /** 過半数到達（または最後の1候補）で決定した候補。未決着のラウンドは null。 */
  winner: string | null;
};

export type RcvTallyResult = {
  rounds: RcvRound[];
  /** 有効票（1件以上の順位が書かれた票）の総数。 */
  total: number;
  /** 候補の基本順 = 第1ラウンドの得票降順。表示側は現在票数・生存順で並べ替え、最後の安定化にこれを使う。 */
  order: string[];
  /** 候補id → 除外されたラウンド番号（1-origin。rounds[n].elim === id なら n）。 */
  elimRound: Record<string, number>;
  /** 全ラウンドを通じた候補得票の最大値（バーのスケール用）。 */
  maxV: number;
};

export type TallyRcvOptions = {
  /** くじ順を決めるシード（通常は poll_id）。同じシードなら常に同じくじ順。 */
  lotSeed?: string;
};

/** FNV-1a 32bit。くじ順の決定的導出にのみ使う（暗号用途ではない）。 */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 除外候補と、その決め方（同数だったか / どう解消したか）。 */
type Elimination = {
  elim: string;
  tiedWith: string[];
  tiebreak: "backward" | "lot" | null;
};

/**
 * 同数最下位のタイブレーク。backward-looking（直前ラウンドから遡って票数比較）→
 * それでも同数なら lotOrder（事前確定のくじ順）が最小の候補を除外する。
 * 同数だった候補と解消方法も併せて返す（表示側で開示するため）。
 */
function pickElimination(
  tiedAtMin: string[],
  rounds: RcvRound[],
  lotOrder: Map<string, number>
): Elimination {
  if (tiedAtMin.length === 1) {
    return { elim: tiedAtMin[0], tiedWith: [], tiebreak: null };
  }
  let tied = tiedAtMin;
  for (let i = rounds.length - 2; i >= 0 && tied.length > 1; i--) {
    const snap = rounds[i].snap;
    const min = Math.min(...tied.map((c) => snap[c] ?? 0));
    tied = tied.filter((c) => (snap[c] ?? 0) === min);
  }
  if (tied.length > 1) {
    tied = [...tied].sort((a, b) => (lotOrder.get(a) ?? 0) - (lotOrder.get(b) ?? 0));
    return { elim: tied[0], tiedWith: [...tiedAtMin], tiebreak: "lot" };
  }
  return { elim: tied[0], tiedWith: [...tiedAtMin], tiebreak: "backward" };
}

export function tallyRcv(
  ballots: RcvBallot[],
  optionIds: string[],
  opts: TallyRcvOptions = {}
): RcvTallyResult {
  const ids = [...optionIds];
  const valid = new Set(ids);
  // 有効票 = 対象トピックの候補idを1つ以上含む票。未知idは順位から無視する。
  const cleaned = ballots
    .map((b) => b.filter((id) => valid.has(id)))
    .filter((b) => b.length > 0);
  const total = cleaned.length;

  // くじ順（by lot）: lotSeed から決定的に導出。hash 同値は id 辞書順で安定化。
  const seed = opts.lotSeed ?? "";
  const lotOrder = new Map(
    [...ids]
      .sort((a, b) => {
        const ha = fnv1a(`${seed}:${a}`);
        const hb = fnv1a(`${seed}:${b}`);
        return ha !== hb ? ha - hb : a < b ? -1 : 1;
      })
      .map((id, i) => [id, i])
  );

  // 候補が無い・有効票が無い場合は未決着の単一ラウンドを返す（呼び側で total>0 を確認する）。
  if (ids.length === 0 || total === 0) {
    const snap: Record<string, number> = {};
    for (const id of ids) snap[id] = 0;
    return {
      rounds: [
        {
          snap,
          majority: 1,
          elim: null,
          tiedWith: [],
          tiebreak: null,
          moved: 0,
          transfers: {},
          toEx: 0,
          exhausted: 0,
          winner: null,
        },
      ],
      total,
      order: ids,
      elimRound: {},
      maxV: 0,
    };
  }

  // 各票の「現在の順位ポインタ」。-1 は順位切れ。
  const cursors = cleaned.map(() => 0);
  const alive = new Set(ids);

  const count = (): Record<string, number> => {
    const c: Record<string, number> = {};
    for (const id of ids) c[id] = 0;
    cleaned.forEach((b, i) => {
      const cur = cursors[i];
      if (cur >= 0) c[b[cur]] += 1;
    });
    return c;
  };

  let exhausted = 0;
  const rounds: RcvRound[] = [
    {
      snap: count(),
      majority: Math.floor(total / 2) + 1,
      elim: null,
      tiedWith: [],
      tiebreak: null,
      moved: 0,
      transfers: {},
      toEx: 0,
      exhausted: 0,
      winner: null,
    },
  ];
  const elimRound: Record<string, number> = {};

  // 候補数が上限（各ラウンドで必ず1候補減る）なので ids.length 回で必ず止まる。
  for (let guard = 0; guard < ids.length + 1; guard++) {
    const rec = rounds[rounds.length - 1];
    const aliveArr = [...alive];
    const top = aliveArr.reduce((a, b) => (rec.snap[a] >= rec.snap[b] ? a : b));
    if (rec.snap[top] >= rec.majority || alive.size === 1) {
      rec.winner = top;
      break;
    }

    const minVotes = Math.min(...aliveArr.map((c) => rec.snap[c]));
    const tiedAtMin = aliveArr.filter((c) => rec.snap[c] === minVotes);
    const { elim, tiedWith, tiebreak } = pickElimination(tiedAtMin, rounds, lotOrder);
    const moved = rec.snap[elim];
    alive.delete(elim);
    elimRound[elim] = rounds.length;

    const transfers: Record<string, number> = {};
    let toEx = 0;
    cleaned.forEach((b, i) => {
      const cur = cursors[i];
      if (cur < 0 || b[cur] !== elim) return;
      let k = cur + 1;
      while (k < b.length && !alive.has(b[k])) k++;
      if (k < b.length) {
        cursors[i] = k;
        transfers[b[k]] = (transfers[b[k]] ?? 0) + 1;
      } else {
        cursors[i] = -1;
        toEx++;
      }
    });
    exhausted += toEx;

    rounds.push({
      snap: count(),
      majority: Math.floor((total - exhausted) / 2) + 1,
      elim,
      tiedWith,
      tiebreak,
      moved,
      transfers,
      toEx,
      exhausted,
      winner: null,
    });
  }

  let maxV = 0;
  for (const r of rounds) for (const id of ids) maxV = Math.max(maxV, r.snap[id]);

  const r1 = rounds[0].snap;
  const order = [...ids].sort((a, b) => r1[b] - r1[a]);

  return { rounds, total, order, elimRound, maxV };
}
