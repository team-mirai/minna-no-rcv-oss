"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowClockwise,
  ChartBar,
  CheckCircle,
  Heart,
  LinkSimple,
  MonitorPlay,
  Sparkle,
  Trophy,
  Users,
} from "@phosphor-icons/react";
import type { PollOption } from "@/server/polls";
import type { RcvTallyResult } from "@/features/rcv/tally";
import { RcvReplay } from "@/features/rcv/replay/RcvReplay";

const fmt = (v: number) => v.toLocaleString();

const JP_DISPLAY: React.CSSProperties = {
  fontFamily: "var(--tm-font-jp-display)",
  fontWeight: 900,
};

type Props = {
  slug: string;
  title: string;
  options: PollOption[];
  result: RcvTallyResult;
  ballotCount: number;
  /** false = 締切後の確定スナップショット、true = 受付中の途中経過（暫定）。 */
  live: boolean;
};

/* ── 紙吹雪（勝者ヒーロー用・px基準・決定的擬似乱数） ──── */
function buildConfetti() {
  const colors = ["var(--tm-teal)", "var(--tm-teal-soft)", "var(--tm-yellow)", "var(--tm-white)"];
  const arr: Array<{ heart: boolean; color: string; style: React.CSSProperties }> = [];
  for (let i = 0; i < 34; i++) {
    const left = ((i * 37 + 13) % 100) + "%";
    const dur = 3.4 + ((i * 53) % 27) / 10;
    const delay = -(((i * 71) % 60) / 10);
    arr.push({
      heart: i % 8 === 0,
      color: i % 2 ? "var(--tm-teal)" : "var(--tm-teal-soft)",
      style: {
        position: "absolute",
        top: -24,
        left,
        width: 6 + ((i * 29) % 8),
        height: 10 + ((i * 17) % 9),
        background: i % 8 === 0 ? undefined : colors[i % colors.length],
        borderRadius: i % 3 === 0 ? "50%" : 2,
        animation: `tm-fall ${dur}s linear ${delay}s infinite`,
        opacity: 0.95,
        pointerEvents: "none",
        fontSize: 12 + (i % 3) * 4,
        zIndex: 1,
      },
    });
  }
  return arr;
}

function Confetti() {
  const pieces = useMemo(() => buildConfetti(), []);
  const [phase, setPhase] = useState<"visible" | "fading" | "hidden">("visible");

  useEffect(() => {
    const fadeTimer = setTimeout(() => setPhase("fading"), 2600);
    const stopTimer = setTimeout(() => setPhase("hidden"), 3200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(stopTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      {pieces.map((cf, i) =>
        cf.heart ? (
          <Heart key={i} weight="fill" size="1em" style={{ ...cf.style, color: cf.color, background: "none" }} />
        ) : (
          <span key={i} style={cf.style} />
        )
      )}
    </div>
  );
}

/** X 公式ブランドキット配布のロゴ形状。色はガイドラインどおり黒／白のみ。 */
function XLogo({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 1200 1227"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ── 共有ボタン（URLコピー / X） ──── */
function ShareRow({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href.replace(/#.*$/, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard 不可の環境は無視（URLバーから手動コピーできる） */
    }
  }, []);
  const shareX = useCallback(() => {
    const url = window.location.href.replace(/#.*$/, "");
    const text = `「${title}」の結果が出ました！ #みんなのRCV`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener"
    );
  }, [title]);
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-full border border-tm-teal-hover bg-white px-4 py-2.5 text-[13.5px] font-bold text-tm-teal-deep transition-colors hover:border-tm-teal hover:bg-tm-teal hover:text-white"
      >
        <LinkSimple size={15} />
        {copied ? "コピーしました！" : "結果のURLをコピー"}
      </button>
      <button
        type="button"
        onClick={shareX}
        className="inline-flex items-center gap-1.5 rounded-full border border-tm-black bg-white px-4 py-2.5 text-[13.5px] font-bold text-tm-black transition-colors hover:bg-tm-black hover:text-white"
      >
        <XLogo />
        Xでシェア
      </button>
    </div>
  );
}

/**
 * 途中経過の選択肢名（92px 固定幅）。長い選択肢は truncate されて全文を読む手段が無いので、
 * はみ出しているときだけ hover / タップで全文をツールチップ表示する。
 * hover は Tailwind の hover バリアント（`@media (hover: hover)`）任せにして、
 * タップ端末で :hover が貼り付いたままになるのを避け、タップは open state で明示的に扱う。
 */
function LiveOptionName({ label }: { label: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [label]);

  // 画面のどこかを触ったら閉じる（自分のボタンは onPointerDown で伝播を止めている）。
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span className="relative w-[92px] flex-none">
      <button
        ref={ref}
        type="button"
        disabled={!overflowing}
        aria-expanded={overflowing ? open : undefined}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((v) => !v)}
        className="peer block w-full cursor-pointer truncate text-right text-[13px] font-semibold disabled:cursor-default"
      >
        {label}
      </button>
      {overflowing && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-0 top-full z-[5] mt-1 w-max max-w-[min(260px,66vw)] rounded-[8px] bg-tm-black px-2.5 py-1.5 text-left text-[12.5px] font-semibold leading-[1.6] text-white shadow-[var(--tm-shadow-elev)] ${
            open ? "block" : "hidden peer-hover:block peer-focus-visible:block"
          }`}
        >
          {label}
        </span>
      )}
    </span>
  );
}

export default function ResultsView({ slug, title, options, result, ballotCount, live }: Props) {
  const router = useRouter();
  const labelOf = useMemo(() => new Map(options.map((o) => [o.id, o.label])), [options]);
  const name = useCallback(
    (id: string | null) => (id ? (labelOf.get(id) ?? id) : ""),
    [labelOf]
  );

  const S = result;
  const last = S.rounds[S.rounds.length - 1];
  const winnerId = last.winner;
  const winVotes = winnerId ? (last.snap[winnerId] ?? 0) : 0;
  const winR1 = winnerId ? (S.rounds[0].snap[winnerId] ?? 0) : 0;
  const winR1Pct = Math.round((winR1 / Math.max(1, S.total)) * 100);
  const winFinalPct = Math.round((winVotes / Math.max(1, S.total)) * 100);
  // 最終ラウンドの有効票 = 総票数 − 順位切れ累計（過半数ラインの分母そのもの）。
  // 部分順位を許すので順位切れが出る＝分母が縮む。勝者票を総票数比の%だけで見せると
  // 「過半数なのに49%」に読めてしまうため、ヒーローでは分母（有効票）を明示する。
  const finalValid = S.total - last.exhausted;
  // 最後の1候補で決着した極端なケース（全票が順位切れ等）では過半数表記を避ける。
  const byMajority = finalValid > 0 && winVotes >= last.majority;

  // ── 受付中の途中経過（暫定・15秒ごとに自動更新）────
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [live, router]);

  if (live) {
    // 途中経過は“1位票のいま”だけを見せる（IRVの確定演出は締切後の楽しみに取っておく）。
    const r1 = S.rounds[0].snap;
    const rows = [...S.order].sort((a, b) => (r1[b] ?? 0) - (r1[a] ?? 0));
    const maxV = Math.max(1, ...rows.map((id) => r1[id] ?? 0));
    return (
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2">
          <b className="text-[22px] leading-[1.4] tracking-[0.02em]" style={JP_DISPLAY}>
            {title}
          </b>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-[5px] rounded-full bg-tm-teal-100 px-3 py-1 text-[13px] font-semibold text-tm-teal-deep">
              <ArrowClockwise size={14} />
              途中経過（受付中・15秒ごとに更新）
            </span>
            <span className="inline-flex items-center gap-[5px] text-[13.5px] text-tm-fg-muted">
              <Users size={14} className="text-tm-teal-hover" />
              {fmt(ballotCount)}人が投票
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 rounded-[16px] border border-tm-border-soft bg-white p-4">
          <b className="text-[13px] text-tm-fg-muted">“1位”票のいま（暫定）</b>
          {rows.map((id) => {
            const v = r1[id] ?? 0;
            return (
              <div key={id} className="flex items-center gap-2">
                <LiveOptionName label={name(id)} />
                <div className="h-[16px] flex-1 overflow-hidden rounded-full bg-tm-gray-100">
                  <div
                    className="h-full rounded-full bg-tm-teal"
                    style={{ width: `${(v / maxV) * 100}%`, transition: "width .6s cubic-bezier(.2,.6,.2,1)" }}
                  />
                </div>
                <span className="w-[44px] flex-none text-right font-[family-name:var(--tm-font-latin)] text-[13.5px] font-semibold">
                  {fmt(v)}
                </span>
              </div>
            );
          })}
          <span className="text-[12.5px] leading-[1.7] text-tm-fg-muted">
            順位の移し替え（RCVの決選）は締切後に確定します。最終結果は“1位票のいま”と入れ替わることがあります。
          </span>
        </div>

        <a
          href={`/p/${slug}`}
          className="flex items-center justify-center gap-2 rounded-full border border-tm-teal-hover bg-white px-4 py-3 text-[15px] font-bold text-tm-teal-deep transition-colors hover:border-tm-teal hover:bg-tm-teal hover:text-white"
        >
          投票ページへ戻る
        </a>
      </div>
    );
  }

  // ── 確定結果 ────
  // 最終順位は、勝者 → 決着時の生存候補 → 後に除外された候補、の順で導出する。
  // 除外済み候補は最終 snap が 0 になるため、snap だけでは2・3位を復元できない。
  const placements = [...S.order].sort((a, b) => {
    if (a === winnerId) return -1;
    if (b === winnerId) return 1;
    const elimA = S.elimRound[a];
    const elimB = S.elimRound[b];
    if (elimA == null && elimB != null) return -1;
    if (elimA != null && elimB == null) return 1;
    if (elimA != null && elimB != null && elimA !== elimB) return elimB - elimA;
    return (last.snap[b] ?? 0) - (last.snap[a] ?? 0);
  });
  const runnersUp = placements.filter((id) => id !== winnerId).slice(0, 2);

  return (
    <div className="flex flex-col gap-3.5">
      {/* 勝者ヒーロー（ミント全面＋紙吹雪＋決定スタンプ） */}
      <div
        data-testid="result-hero"
        className="relative flex flex-col items-center gap-3 overflow-hidden rounded-[18px] bg-tm-teal-100 px-4 py-7 text-center [animation:tm-rise_.5s_ease]"
      >
        <Confetti />
        <div className="relative z-[2] flex items-center gap-2 text-tm-teal-hover">
          <Sparkle weight="fill" size={15} style={{ animation: "tm-pulse 1.6s ease-in-out infinite" }} />
          <span className="font-[family-name:var(--tm-font-latin)] text-[12px] font-semibold tracking-[0.34em]">
            RESULT
          </span>
          <Sparkle weight="fill" size={15} style={{ animation: "tm-pulse 1.6s ease-in-out .8s infinite" }} />
        </div>
        <b className="relative z-[2] text-[14px] tracking-[0.06em] text-tm-teal-deep" style={JP_DISPLAY}>
          {title}
        </b>
        <div className="relative z-[2] flex flex-wrap items-center justify-center gap-3 rounded-[18px] bg-white px-6 py-4 shadow-[var(--tm-shadow-elev)]">
          <span className="rounded-full bg-tm-yellow px-3 py-1 font-[family-name:var(--tm-font-latin)] text-[13px] font-bold text-tm-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]">
            1位
          </span>
          <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-tm-teal-100">
            <Trophy weight="fill" size={24} className="text-tm-teal" />
          </span>
          <b className="text-[28px] leading-[1.15] tracking-[0.02em]" style={JP_DISPLAY}>
            {name(winnerId)}
          </b>
          <span
            className="rounded-[8px] bg-tm-teal px-3 py-0.5 text-[17px] tracking-[0.16em] text-white"
            style={{ ...JP_DISPLAY, animation: "tm-verdict-stamp .45s cubic-bezier(.15,.85,.25,1) .3s both" }}
          >
            <span className="tm-optical-rise">決定</span>
          </span>
        </div>
        {runnersUp.length > 0 && (
          <div
            className={`relative z-[2] grid w-full max-w-[390px] gap-2 ${
              runnersUp.length === 1 ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {runnersUp.map((id, i) => (
              <div
                key={id}
                className="flex min-w-0 items-center gap-2 rounded-[12px] bg-white px-3.5 py-2.5 text-left shadow-[var(--tm-shadow-card)]"
              >
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-tm-teal-100 font-[family-name:var(--tm-font-latin)] text-[12px] font-bold text-tm-teal-deep">
                  {i + 2}
                </span>
                <b className="min-w-0 truncate text-[13px]" style={JP_DISPLAY}>
                  {name(id)}
                </b>
              </div>
            ))}
          </div>
        )}
        <span className="relative z-[2] flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[13px] text-tm-teal-deep">
          <span className="inline-flex items-center gap-[5px] whitespace-nowrap">
            <Users size={14} />
            {fmt(ballotCount)}人が投票
          </span>
          <span className="whitespace-nowrap">
            {byMajority
              ? `有効票${fmt(finalValid)}票の過半数${fmt(winVotes)}票で決定`
              : `有効票の${winFinalPct}%が当選者に届きました`}
          </span>
        </span>
      </div>

      {/* 開票のドラマ（ラウンドごとのリプレイ） */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-0.5">
          <ChartBar size={18} className="text-tm-teal-hover" />
          <b className="text-[15px] tracking-[0.04em]">開票のようす</b>
        </div>
        <RcvReplay options={options.map((o) => ({ id: o.id, label: o.label }))} tally={S} />
      </div>

      {/* 比較（もし“1位票だけ”で決めていたら？） */}
      <div className="flex flex-col gap-3 rounded-[16px] bg-tm-teal-100 px-4 py-4">
        <b className="text-[15px] leading-[1.5]" style={JP_DISPLAY}>
          もし、“1位票だけ”で決めていたら？
        </b>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-[70px] flex-none text-right text-[12.5px] font-bold text-tm-gray-500" style={JP_DISPLAY}>
              1位票だけ
            </span>
            <div className="h-[18px] flex-1 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-l-full bg-tm-gray-400" style={{ width: `${winR1Pct}%` }} />
            </div>
            <span className="w-[88px] flex-none whitespace-nowrap text-[13px] font-bold text-tm-gray-500">
              <span className="font-[family-name:var(--tm-font-latin)] text-[19px] leading-none">{winR1Pct}</span>% のみ
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-[70px] flex-none text-right text-[12.5px] font-bold text-tm-teal-deep" style={JP_DISPLAY}>
              RCV
            </span>
            <div className="h-[18px] flex-1 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-l-full bg-tm-teal" style={{ width: `${winFinalPct}%` }} />
            </div>
            <span className="w-[88px] flex-none whitespace-nowrap text-[13px] font-bold text-tm-teal-deep">
              <span className="font-[family-name:var(--tm-font-latin)] text-[19px] leading-none">{winFinalPct}</span>% が届く
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <CheckCircle size={18} className="mt-0.5 flex-none text-tm-teal-hover" />
          <span className="text-[13px] leading-[1.75] text-tm-gray-700">
            1位に入れた候補が敗退しても票は無効にならず、次の順位の候補の票として数えられ続けます。より多くの参加者の意思が結果に反映されます。
          </span>
        </div>
      </div>

      {/* プレゼンを主導線にし、共有操作は画面最下部へまとめる。 */}
      <div id="result-actions" data-testid="result-actions" className="flex flex-col gap-2.5 scroll-mt-20">
        <a
          href={`/p/${slug}/present`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-full bg-tm-teal px-4 py-3.5 text-[15px] font-bold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-tm-teal-hover active:scale-[0.96]"
        >
          <MonitorPlay size={18} />
          プレゼンモードで発表する
        </a>
        <ShareRow title={title} />
      </div>
    </div>
  );
}
