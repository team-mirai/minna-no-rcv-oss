// RCV結果発表のデモ用サンプルデータ（/demo）。
// トップページの「卒業旅行、どこ行く？」と同じ事例を、本番と同じ tallyRcv に通す。
// 1位票では富士山が最多だが、最下位候補の票が次順位の箱根へ移り、順位が逆転する。

export const DEMO_RCV_TITLE = "卒業旅行、どこ行く？";

export const DEMO_RCV_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "demo-fuji", label: "弾丸富士山" },
  { id: "demo-hakone", label: "箱根温泉" },
  { id: "demo-okinawa", label: "沖縄ビーチ" },
  { id: "demo-camp", label: "高原キャンプ" },
];

export const DEMO_RCV_LOT_SEED = "graduation-trip-demo";

const [FUJI, HAKONE, OKINAWA, CAMP] = DEMO_RCV_OPTIONS.map((o) => o.id);

// 計10票。
// R1: 富士山4 / 箱根3 / 沖縄2 / 高原1（過半数6）
// R2: 高原の1票が箱根へ移動 → 富士山4 / 箱根4 / 沖縄2
// R3: 沖縄の2票も箱根へ移動 → 箱根6 / 富士山4。箱根が逆転して決定。
const GROUPS: Array<[ranking: string[], count: number]> = [
  [[FUJI, HAKONE, OKINAWA, CAMP], 4],
  [[HAKONE, FUJI, OKINAWA, CAMP], 3],
  [[OKINAWA, HAKONE, FUJI, CAMP], 2],
  [[CAMP, HAKONE, FUJI, OKINAWA], 1],
];

export function demoRcvBallots(): string[][] {
  return GROUPS.flatMap(([ranking, count]) =>
    Array.from({ length: count }, () => [...ranking])
  );
}
