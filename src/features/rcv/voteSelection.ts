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
