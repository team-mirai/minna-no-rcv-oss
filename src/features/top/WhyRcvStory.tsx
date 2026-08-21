import { Smiley, SmileySad, User } from "@phosphor-icons/react/dist/ssr";

/**
 * トップページ セカンドビュー「Why RCV?」。
 *
 * 見た目・原稿の正: デザイン案「みんなのRCVトップ v3 背景つき」。
 * FV のライブ開票デモと同じ「10人の卒業旅行」を題材に、
 *   ① 希望はこう割れた → ② ふつうの多数決だと → ③ 同じ10人が RCV で決めると
 * の順で、票割れが起きる仕組みと RCV がそれをどう解くかを説明する。
 *
 * 数字は FV のデモと同一（富士山4・温泉3・ビーチ2・高原1／過半数6票）。
 * 片方を変えるときはもう片方も必ず合わせる。
 */

/** 「◯人」を表す顔アイコンのグリッド。tone で派閥を色分けする。 */
function PeopleGrid({ count, tone }: { count: number; tone: "teal" | "gray" }) {
  const teal = tone === "teal";
  return (
    <div className="grid w-[74px] flex-none grid-cols-[repeat(3,22px)] justify-start gap-[3px]">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white border ${
            teal ? "border-tm-teal-200" : "border-tm-gray-250"
          }`}
        >
          <User size={12} className={teal ? "text-tm-teal-deep" : "text-tm-gray-500"} />
        </span>
      ))}
    </div>
  );
}

function StepHeading({
  n,
  title,
  tone,
}: {
  n: number;
  title: string;
  tone: "teal" | "gray";
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        className={`inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-extrabold text-white ${
          tone === "teal" ? "bg-tm-teal" : "bg-tm-gray-400"
        }`}
      >
        {n}
      </span>
      <span className="font-[family-name:var(--tm-font-jp-display)] text-[14px] font-black">
        {title}
      </span>
    </div>
  );
}

/** ②「ふつうの多数決だと…」の棒グラフ1行。 */
function PluralityBar({
  label,
  width,
  votes,
  lead = false,
}: {
  label: string;
  width: string;
  votes: string;
  lead?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-[70px] flex-none whitespace-nowrap text-[11px] ${
          lead ? "font-extrabold" : "font-bold text-tm-gray-500"
        }`}
      >
        {label}
      </span>
      <div className="h-[13px] flex-1 rounded-full bg-tm-gray-100">
        <div
          className={`h-full rounded-full ${lead ? "bg-tm-gray-400" : "bg-tm-gray-250"}`}
          style={{ width }}
        />
      </div>
      <span
        className={`flex-none whitespace-nowrap text-[10px] font-bold ${
          lead
            ? "text-tm-red"
            : "font-[family-name:var(--tm-font-latin)] text-tm-gray-400"
        }`}
      >
        {votes}
      </span>
    </div>
  );
}

/** ③ の RCV ラウンド1行。 */
function Round({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="flex-none whitespace-nowrap rounded-full bg-tm-teal-100 px-[9px] py-[3px] font-[family-name:var(--tm-font-latin)] text-[10px] font-bold text-tm-teal-deep">
        {tag}
      </span>
      <span className="text-[12px] leading-[1.7] text-tm-gray-600">{children}</span>
    </div>
  );
}

/** 6人ぶんの表情アイコン＋まとめ文。②は困り顔、③は笑顔。 */
function Verdict({
  happy,
  children,
}: {
  happy: boolean;
  children: React.ReactNode;
}) {
  const Icon = happy ? Smiley : SmileySad;
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 ${
        happy ? "bg-tm-teal-100" : "bg-tm-gray-50"
      }`}
    >
      <div className="grid flex-none grid-cols-[repeat(3,18px)] gap-0.5 pt-0.5">
        {Array.from({ length: 6 }, (_, i) => (
          <Icon key={i} size={18} className={happy ? "text-tm-teal-hover" : "text-tm-gray-400"} />
        ))}
      </div>
      <div className="text-[12px] leading-[1.8] text-tm-gray-600">{children}</div>
    </div>
  );
}

export function WhyRcvStory() {
  return (
    <section className="bg-white px-6 pb-10 pt-9">
      <div className="mb-1.5 font-[family-name:var(--tm-font-latin)] text-[12px] font-semibold tracking-[0.12em] text-tm-teal-hover">
        Why RCV?
      </div>
      <h2 className="m-0 font-[family-name:var(--tm-font-jp-display)] text-[22px] font-black leading-[1.5] tracking-[0.04em]">
        「1位票だけ」だとなにが起きる？
      </h2>
      <p className="mb-[22px] mt-2.5 text-[13px] leading-[1.9] text-tm-gray-600">
        10人の卒業旅行で考えてみます。
      </p>

      <div className="flex flex-col gap-4">
        {/* ① 希望はこう割れた */}
        <div className="rounded-xl border border-tm-gray-150 p-4">
          <StepHeading n={1} title="希望はこう割れた" tone="teal" />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5 rounded-lg bg-tm-teal-100 px-3 py-2.5">
              <PeopleGrid count={6} tone="teal" />
              <div>
                <div className="text-[12.5px] font-extrabold">
                  のんびり派 <span className="font-[family-name:var(--tm-font-latin)]">6</span>
                  人「ゆったりしたいな」
                </div>
                <div className="text-[11px] leading-[1.7] text-tm-gray-500">
                  でも1位票は、温泉3・ビーチ2・高原1に分散
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg bg-tm-gray-50 px-3 py-2.5">
              <PeopleGrid count={4} tone="gray" />
              <div>
                <div className="text-[12.5px] font-extrabold">
                  ガチ登山派 <span className="font-[family-name:var(--tm-font-latin)]">4</span>
                  人「弾丸で富士山！」
                </div>
                <div className="text-[11px] leading-[1.7] text-tm-gray-500">
                  4人全員が、迷わず富士山に1位票
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ② ふつうの多数決だと… */}
        <div className="rounded-xl border border-tm-gray-150 p-4">
          <StepHeading n={2} title="ふつうの多数決だと…" tone="gray" />
          <div className="mb-3 flex flex-col gap-[7px]">
            <PluralityBar label="弾丸富士山" width="42%" votes="4票で決定！？" lead />
            <PluralityBar label="箱根温泉" width="32%" votes="3票" />
            <PluralityBar label="沖縄ビーチ" width="21%" votes="2票" />
            <PluralityBar label="高原キャンプ" width="10%" votes="1票" />
          </div>
          <Verdict happy={false}>
            ゆったりしたかった<b>多数派の6人</b>の気持ちは、票が割れたせいで結果に残らない。
            <b>10人中4人</b>しか望んでいない案に決定——これが多数決の欠陥です。
          </Verdict>
        </div>

        {/* ③ 同じ10人が、RCVで決めると… */}
        <div className="rounded-xl border-[1.5px] border-tm-teal bg-white p-4">
          <StepHeading n={3} title="同じ10人が、RCVで決めると…" tone="teal" />
          <div className="mb-3 flex flex-col gap-2.5">
            <Round tag="R1">
              富士山4・温泉3・ビーチ2・高原1。<b>過半数（6票）なし</b>で決まらない
            </Round>
            <Round tag="R2">
              最下位の高原を除外。その1票は<b>第2希望の温泉へ</b>（温泉4）
            </Round>
            <Round tag="R3">
              ビーチを除外、2票も温泉へ。<b>温泉6票＝過半数で決定！</b>
            </Round>
          </div>
          <Verdict happy>
            のんびり派6人の「ゆったりしたい」という気持ちが、票割れを越えて結果に反映される。
            1位じゃなかった人も<b>「2番目に行きたい場所」</b>に。
          </Verdict>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-tm-teal-100 px-5 py-[18px]">
        <div className="font-[family-name:var(--tm-font-jp-display)] text-[14.5px] font-black leading-[1.8]">
          「いちばん強く推された案」ではなく、
          <br />
          「いちばん<span className="tm-mint-underline">広く納得できる案</span>」が選ばれる。
        </div>
        <div className="mt-1.5 text-[12px] text-tm-gray-600">
          それが RCV（優先順位付投票）です。
        </div>
      </div>
    </section>
  );
}
