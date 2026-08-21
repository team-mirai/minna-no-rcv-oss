/**
 * RCV結果発表の候補行を、画面に見えている票数と生存順で並べる。
 * （移植元アプリの features/rcv-results/rowOrder.ts の移植）
 *
 * 同票なら、より後のラウンドまで残る候補を上に置く。これにより、同票の候補が
 * 実際に除外されるときも「下にいる候補から先に除外される」という見え方を保つ。
 * elimRound が無い候補は集計終了時まで生存するため、除外予定の候補より上に置く。
 *
 * タイブレークはフェーズやラウンドに依らず常に同じ（票数→生存順→基本順）。
 * 基準をフェーズ間で切り替えると、切り替わりの瞬間に票数の変わっていない行が
 * 跳ねて見えるため、切替オプションは持たない（R1開票前の扱いは呼び出し側が
 * 「これから見せる票数」を渡すことで揃える）。
 */
export function orderRcvRows(
  baseOrder: readonly string[],
  displayedVotes: Readonly<Record<string, number>>,
  elimRound: Readonly<Record<string, number>>
): string[] {
  const baseIndex = new Map(baseOrder.map((id, i) => [id, i]));

  return [...baseOrder].sort((a, b) => {
    const votesA = displayedVotes[a] ?? 0;
    const votesB = displayedVotes[b] ?? 0;
    if (votesA !== votesB) return votesB - votesA;

    const elimA = elimRound[a];
    const elimB = elimRound[b];
    if (elimA == null && elimB != null) return -1;
    if (elimA != null && elimB == null) return 1;
    if (elimA != null && elimB != null && elimA !== elimB) return elimB - elimA;

    return (baseIndex.get(a) ?? 0) - (baseIndex.get(b) ?? 0);
  });
}
