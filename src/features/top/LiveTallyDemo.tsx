import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle, MonitorPlay, Smiley, User } from "@phosphor-icons/react/dist/ssr";

/**
 * トップページ FV の「ライブ開票デモ」カード。
 *
 * 見た目の正: デザイン案「みんなのRCVトップ v3 背景つき」。
 * 卒業旅行の行き先を10人で決める18秒ループで、RCV の肝である
 * 「過半数が出るまで最下位を除外して票を次順位へ移す」を言葉より先に見せる。
 *
 * 全て CSS keyframes（globals.css の `tp-*`）で動くので Client Component にする
 * 必要がない。タイムラインは 18s を 100% とした比率で書かれているため、尺を変える
 * ときは DURATION だけを直せばキャプションとバーがずれない。
 */

const DURATION = "18s";

/** 行ピッチ = サムネ 44px + 行間 10px。tp-row-up / tp-row-down の 54px と対応する。 */
const ROW_PITCH = 54;
/** サムネ(44) + gap(10) = 54px が左オフセット、右の得票数欄(30) + gap(10) を引いて描く。 */
const MAJORITY_LINE = "calc(54px + (100% - 94px) * 0.88)";

const VOTERS = 10;

/**
 * tp-* アニメーションの shorthand を組み立てる。
 *
 * fill-mode に `both` を必ず付けるのが肝。バーの幅や行の位置は keyframes の中にしか
 * 書いていないので、fill-mode なしだと prefers-reduced-motion で
 * `animation-duration: .001ms / iteration-count: 1` に潰されたときに base スタイル
 * （＝バー幅100%・行の入れ替えなし）へ戻ってしまい、票数と食い違う嘘の絵になる。
 * `both` なら 100% のキーフレーム＝開票が終わった状態で止まるので、
 * アニメーションを止めた人にも「箱根が過半数で1位」という正しい結果が残る。
 */
function anim(name: string, extra?: string, delay?: string): React.CSSProperties {
  // shorthand の時間値は「1つめ=duration / 2つめ=delay」。animationDelay を別プロパティで
  // 足すと React に shorthand との併用を警告されるので、ここで組み込んでしまう。
  return {
    animation: `${name} ${DURATION} ${extra ?? ""} ${delay ?? ""} infinite both`.replace(/\s+/g, " "),
  };
}

/** 投票済みチェックが順に立ち、終盤に笑顔へ変わる参加者アイコン。 */
function VoterDot({ index }: { index: number }) {
  return (
    <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full border border-tm-gray-250 bg-tm-gray-50">
      <User size={13} className="text-tm-gray-500" style={anim("tp-face-out")} />
      <Smiley
        size={15}
        weight="bold"
        className="absolute text-tm-teal-hover opacity-0"
        style={anim("tp-face-in")}
      />
      <span
        className="absolute -right-[3px] -top-[3px] inline-flex h-[11px] w-[11px] items-center justify-center rounded-full bg-tm-teal"
        style={anim("tp-cast", undefined, `${(index * 0.18).toFixed(2)}s`)}
      >
        <Check size={7} weight="bold" className="text-white" />
      </span>
    </span>
  );
}

/** 除外された候補の行（沖縄・高原）。名前に取り消し線が入り、票数が「除外」タグに変わる。 */
function EliminatedRow({
  src,
  name,
  votes,
  barAnim,
  rowAnim,
  tagAnim,
  swapOutAnim,
  swapInAnim,
}: {
  src: string;
  name: string;
  votes: string;
  barAnim: string;
  rowAnim: string;
  tagAnim: string;
  swapOutAnim: string;
  swapInAnim: string;
}) {
  return (
    <div className="flex items-center gap-2.5 bg-white" style={anim(rowAnim)}>
      <Image src={src} alt="" width={44} height={44} className="h-11 w-11 flex-none rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <div className="relative mb-1 text-[12px] font-extrabold">
          <span style={anim(swapOutAnim)}>{name}</span>
          <span
            className="absolute left-0 top-0 text-tm-gray-400 line-through opacity-0"
            style={anim(swapInAnim)}
          >
            {name}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-tm-gray-100">
          <div className="h-full rounded-full bg-tm-teal" style={anim(barAnim, "ease-in-out")} />
        </div>
      </div>
      <span className="relative w-[30px] flex-none whitespace-nowrap">
        <span
          className="font-[family-name:var(--tm-font-latin)] text-[11px] font-bold"
          style={anim(swapOutAnim)}
        >
          {votes}
        </span>
        <span
          className="absolute left-0 top-px rounded-full bg-tm-black px-[7px] py-[1.5px] text-[8.5px] font-bold text-white opacity-0"
          style={anim(tagAnim)}
        >
          除外
        </span>
      </span>
    </div>
  );
}

/**
 * 実況キャプション。1周のどこにいるかを言葉で補う。
 * 1枚目だけは 0% から見えているので opacity-0 を付けない（他は keyframes が
 * 立ち上げるまで隠す）。done は最後の「決着」コマ。
 */
function Caption({
  n,
  text,
  animName,
  done = false,
}: {
  n?: number;
  text: string;
  animName: string;
  done?: boolean;
}) {
  const hiddenAtStart = animName !== "tp-cap1";
  return (
    <span
      className={[
        "absolute inset-0 flex items-center gap-[9px] px-3.5 leading-[1.5]",
        done ? "text-[13px] font-black text-tm-teal-deep" : "text-[12.5px] font-extrabold text-tm-black",
        hiddenAtStart ? "opacity-0" : "",
      ].join(" ")}
      style={anim(animName)}
    >
      {done ? (
        <CheckCircle size={15} weight="bold" />
      ) : (
        <span className="inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-tm-teal-deep text-[10px] font-extrabold text-white">
          {n}
        </span>
      )}
      {text}
    </span>
  );
}

export function LiveTallyDemo() {
  return (
    <div className="mb-[22px] overflow-hidden rounded-lg border border-tm-black bg-white">
      {/* ── カードヘッダー：お題と受付ステータス ──── */}
      <div className="flex items-center justify-between border-b border-tm-gray-100 px-4 py-[11px]">
        <span className="font-[family-name:var(--tm-font-jp-display)] text-[13px] font-black">
          卒業旅行、どこ行く？
        </span>
        <span className="inline-flex items-center gap-[5px] rounded-full bg-tm-teal-100 px-2.5 py-1 text-[10px] font-bold text-tm-teal-deep">
          <span className="h-1.5 w-1.5 flex-none rounded-full bg-tm-teal" />
          開票中
        </span>
      </div>

      {/* ── 参加者 ──── */}
      <div className="flex items-center gap-2.5 px-4 pt-3">
        <span className="flex-none text-[10.5px] font-bold text-tm-gray-500">
          {VOTERS}人が投票
        </span>
        <div className="flex gap-[3px]">
          {Array.from({ length: VOTERS }, (_, i) => (
            <VoterDot key={i} index={i} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pb-2 pt-3.5">
        {/* ── 開票の本体（order で下に置き、キャプションを上に出す） ──── */}
        <div className="relative flex flex-col gap-2.5 pt-4">
          {/* 過半数ライン */}
          <span
            className="pointer-events-none absolute bottom-0 top-[13px] z-[3] border-l-2 border-dashed border-tm-gray-300"
            style={{ left: MAJORITY_LINE }}
          />
          <span
            className="absolute top-0 z-[3] -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-tm-gray-500"
            style={{ left: MAJORITY_LINE }}
          >
            過半数 6票
          </span>

          {/* 弾丸富士山：1位票では最多だが過半数に届かず、最後に2位へ落ちる */}
          <div className="flex items-center gap-2.5 bg-white" style={anim("tp-row-down")}>
            <Image
              src="/samples/fuji.webp"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 flex-none rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-[12px] font-extrabold">弾丸富士山</div>
              <div className="h-3 overflow-hidden rounded-full bg-tm-gray-100">
                <div
                  className="h-full rounded-full bg-tm-teal"
                  style={anim("tp-bar-a", "ease-in-out")}
                />
              </div>
            </div>
            <span className="w-[30px] flex-none whitespace-nowrap font-[family-name:var(--tm-font-latin)] text-[11px] font-bold">
              4票
            </span>
          </div>

          {/* 箱根温泉：移動票を2回受け取って過半数に到達し、1位へ上がる */}
          <div
            className="relative z-[2] flex items-center gap-2.5 bg-white"
            style={anim("tp-row-up")}
          >
            <Image
              src="/samples/onsen.webp"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 flex-none rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-1.5 text-[12px] font-extrabold">
                <span>箱根温泉</span>
                <span
                  className="rounded-full bg-tm-teal px-[7px] py-[1.5px] text-[8.5px] font-bold text-white opacity-0"
                  style={anim("tp-cap4")}
                >
                  決定
                </span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-tm-gray-100">
                <div
                  className="h-full flex-none rounded-full bg-tm-teal"
                  style={anim("tp-bar-b", "ease-in-out")}
                />
                {/* 他候補から移ってきた票（黄＋黒枠は party 系の「移動票」表現） */}
                <div
                  className="h-full w-0 flex-none rounded-r-full bg-tm-yellow shadow-[inset_0_0_0_1.5px_var(--tm-black)]"
                  style={anim("tp-bar-gain", "ease-in-out")}
                />
              </div>
            </div>
            <span className="relative w-[30px] flex-none whitespace-nowrap font-[family-name:var(--tm-font-latin)] text-[11px] font-bold">
              <span
                className="absolute -top-px right-[34px] whitespace-nowrap rounded-full bg-tm-yellow px-1.5 py-px text-[9px] font-bold text-tm-black opacity-0 shadow-[inset_0_0_0_1.5px_var(--tm-black)]"
                style={anim("tp-chip1")}
              >
                +1
              </span>
              <span
                className="absolute -top-px right-[34px] whitespace-nowrap rounded-full bg-tm-yellow px-1.5 py-px text-[9px] font-bold text-tm-black opacity-0 shadow-[inset_0_0_0_1.5px_var(--tm-black)]"
                style={anim("tp-chip2")}
              >
                +2
              </span>
              <span style={anim("tp-hk-a")}>3票</span>
              <span className="absolute left-0 top-0 opacity-0" style={anim("tp-hk-b")}>
                4票
              </span>
              <span
                className="absolute left-0 top-0 text-tm-teal-deep opacity-0"
                style={anim("tp-hk-c")}
              >
                6票
              </span>
            </span>
          </div>

          <EliminatedRow
            src="/samples/beach.webp"
            name="沖縄ビーチ"
            votes="2票"
            barAnim="tp-bar-c"
            rowAnim="tp-row-c"
            tagAnim="tp-tag-c"
            swapOutAnim="tp-swap-out"
            swapInAnim="tp-swap-in"
          />
          <EliminatedRow
            src="/samples/camp.webp"
            name="高原キャンプ"
            votes="1票"
            barAnim="tp-bar-d"
            rowAnim="tp-row-d"
            tagAnim="tp-tag-d"
            swapOutAnim="tp-swap-out-d"
            swapInAnim="tp-swap-in-d"
          />
        </div>

        {/* ── 実況キャプション（order:-1 で開票の上に置く） ──── */}
        <div
          className="relative order-first overflow-hidden rounded-lg border-[1.5px] border-tm-teal-deep bg-tm-teal-100"
          style={{ height: ROW_PITCH }}
        >
          <Caption n={1} animName="tp-cap1" text={`${VOTERS}人が、行きたい順に順位をつけて投票`} />
          <Caption n={2} animName="tp-cap2" text="このままなら富士山。でも過半数（6票）には届かない" />
          <Caption
            n={3}
            animName="tp-cap3a"
            text="まだ過半数未達。最下位の「高原」を除外、1票は次の希望「箱根」へ"
          />
          <Caption
            n={4}
            animName="tp-cap3b"
            text="まだ過半数未達。「沖縄」も除外、2票も「箱根」へ移動"
          />
          <Caption done animName="tp-cap4" text="過半数！「箱根温泉」が納得の1位に" />
        </div>
      </div>
    </div>
  );
}

/** FV の CTA。デモカードの直下に置く前提のスタイル。 */
export function HeroCta() {
  return (
    <>
      <div className="flex flex-col gap-2.5">
        <Link
          href="/new"
          className="flex items-center justify-center gap-2 rounded-full border border-tm-black bg-tm-teal px-4 py-[15px] text-[15px] font-extrabold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-tm-teal-hover active:scale-[0.97]"
        >
          投票をつくる（無料・30秒）
          <ArrowRight size={16} weight="bold" />
        </Link>
        <Link
          href="/demo"
          className="flex items-center justify-center gap-2 rounded-full border border-tm-black bg-white px-4 py-[13px] text-[13.5px] font-extrabold text-tm-black transition-colors hover:bg-tm-gray-50"
        >
          <MonitorPlay size={17} className="text-tm-teal-hover" />
          開票発表のデモを見る
        </Link>
      </div>
      <div className="mt-2.5 text-center text-[11px] tracking-[0.04em] text-tm-gray-600">
        参加者もログイン不要。URLを配るだけで始まります。
      </div>
    </>
  );
}
