export type SelectionFocusTarget =
  | { kind: "candidate"; id: string }
  | { kind: "submit" };

export function getPostSelectionFocusTarget(
  poolIds: string[],
  selectedId: string
): SelectionFocusTarget {
  const selectedIndex = poolIds.indexOf(selectedId);
  const remainingIds = poolIds.filter((id) => id !== selectedId);
  if (remainingIds.length === 0 || selectedIndex < 0) return { kind: "submit" };

  return {
    kind: "candidate",
    id: remainingIds[Math.min(selectedIndex, remainingIds.length - 1)],
  };
}

export function getSelectionAnnouncement(label: string, rank: number): string {
  return `${label}を${rank}位に追加しました`;
}

export function getRankChangeAnnouncement(label: string, rank: number): string {
  return `${label}を${rank}位に移動しました`;
}

export function moveRankedOption(
  order: string[],
  id: string,
  delta: -1 | 1
): { order: string[]; rank: number } | null {
  const currentIndex = order.indexOf(id);
  const targetIndex = currentIndex + delta;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= order.length) return null;

  const nextOrder = order.slice();
  nextOrder[currentIndex] = nextOrder[targetIndex];
  nextOrder[targetIndex] = id;
  return { order: nextOrder, rank: targetIndex + 1 };
}
