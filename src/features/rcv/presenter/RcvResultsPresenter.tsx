"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Heart, ListNumbers, Sparkle, Trophy } from "@phosphor-icons/react";
import type { RcvTallyResult } from "@/features/rcv/tally";
import { DEFAULT_RCV_RESULTS_CONFIG, type RcvResultsConfig } from "./config";
import { orderRcvRows } from "./rowOrder";
import { BrandMark } from "@/components/Brand";

/**
 * RCV開票結果の投影プレゼンテーション（16:9・スクリーン/プロジェクタ向け）。
 * 移植元アプリの features/rcv-results/RcvResultsPresenter.tsx の移植。
 * スライドは 開会 → ラウンド1..N（除外発表→票移動の2フェーズ）→ 決定 → 比較。
 *
 * - 進行はキーボード: ← → Space（進む/戻る）・Home（最初へ）・P（自動再生の切替）。
 *   汎用ツール化にあたり クリック/タップでも進める ようにした（会場にキーボードが
 *   無いカジュアル利用のため。演出の再生中に送ると、次へは行かず演出を最終状態まで
 *   飛ばす Keynote 流: 1回目=スキップ、2回目=次へ）。
 * - 画面に出る数字はすべて単一の tallyRcv 出力（props.tally）から導出する。
 * - 16:9カードは container-type + cqw で任意サイズに追従する（幅800px〜4Kで比率不変）。
 *
 * party で確定済みの設計判断（変更しないこと）:
 * - 移動中の票はイエロー＋黒1.5px内枠（赤は警告感、薄色は大会場で視認性が落ちるため不可）
 * - チャート最下部に「順位切れ」グレー行、過半数破線は有効票の縮小に追従して左へ動く
 * - 比較スライドの死票定義は「当選者に届いた票」ベース
 * - 行は「その時点の表示票数」の降順で常に並べ替える。DOMの並びとkeyは S.order のまま
 *   固定し、translateY だけを遷移させて行を滑らせる。
 * - 総ラウンド数「/ N」は表示しない（何巡で決着するかのネタバレ防止）。
 */

export type RcvPresenterOption = { id: string; label: string };

type Props = {
  /** お題（poll.title）。ヘッダーのテーマピルと開会スライドに出る。 */
  title: string;
  options: RcvPresenterOption[];
  tally: RcvTallyResult;
  config?: Partial<RcvResultsConfig>;
  /** デモモード（/demo）。全スライドに「サンプルデータ」バッジを重ねる。 */
  demo?: boolean;
};

const EASE = "cubic-bezier(.2,.6,.2,1)";
/** 「決定」スタンプのアニメーション時間（ms）。globals.css の rcvp-stamp（.45s）と揃える。 */
const STAMP_MS = 450;
/** 見出し・スタンプ用の日本語ディスプレイ書体（Noto Sans JP 900 で極太を再現）。 */
const JP_DISPLAY: React.CSSProperties = {
  fontFamily: "var(--tm-font-jp-display)",
  fontWeight: 900,
};
/** バーの最大幅（%）。過半数ラインの位置計算にも同じ係数を使う。 */
const BAR_MAX_PCT = 88;
/** 本文の左右パディングを除いた内容幅のうち、バー領域が占める幅（cqw）。 */
const BAR_AREA_CQW = 59; // 88(内容) - 15(候補名) - 12(票数) - 2(gap)
/** 候補行の縦ストライド（行高2.7cqw + 行間0.8cqw）。並べ替えの translateY に使う。 */
const ROW_STRIDE_CQW = 3.5;

const fmt = (v: number) => v.toLocaleString();

type Confetto = {
  kind: "heart" | "piece";
  style: React.CSSProperties;
  color?: string;
};

/** 紙吹雪46片（ティール/黄/白＋ハート）。擬似乱数は添字から決定的に導出する。 */
function buildConfetti(): Confetto[] {
  const colors = [
    "var(--tm-teal)",
    "var(--tm-teal-soft)",
    "var(--tm-yellow)",
    "var(--tm-white)",
  ];
  const arr: Confetto[] = [];
  for (let i = 0; i < 46; i++) {
    const left = ((i * 37 + 13) % 100) + "%";
    const dur = 3.4 + ((i * 53) % 27) / 10;
    const delay = -(((i * 71) % 60) / 10);
    const animation = `rcvp-fall ${dur}s linear ${delay}s infinite`;
    if (i % 8 === 0) {
      arr.push({
        kind: "heart",
        color: i % 2 ? "var(--tm-teal)" : "var(--tm-teal-soft)",
        style: {
          position: "absolute",
          top: "-4cqw",
          left,
          fontSize: `${1.4 + (i % 3) * 0.5}cqw`,
          animation,
          opacity: 0.9,
          zIndex: 1,
          pointerEvents: "none",
        },
      });
    } else {
      arr.push({
        kind: "piece",
        style: {
          position: "absolute",
          top: "-4cqw",
          left,
          width: `${0.7 + ((i * 29) % 8) / 10}cqw`,
          height: `${1.1 + ((i * 17) % 9) / 10}cqw`,
          background: colors[i % colors.length],
          borderRadius: i % 3 === 0 ? "50%" : ".2cqw",
          animation,
          opacity: 0.95,
          zIndex: 1,
          pointerEvents: "none",
        },
      });
    }
  }
  return arr;
}

function Confetti() {
  const pieces = useMemo(() => buildConfetti(), []);
  return (
    <>
      {pieces.map((cf, i) =>
        cf.kind === "heart" ? (
          <Heart key={i} weight="fill" size="1em" style={{ ...cf.style, color: cf.color }} />
        ) : (
          <span key={i} style={cf.style} />
        )
      )}
    </>
  );
}

export function RcvResultsPresenter({ title, options, tally, config, demo }: Props) {
  const cfg: RcvResultsConfig = { ...DEFAULT_RCV_RESULTS_CONFIG, ...config };
  const labelOf = useMemo(() => new Map(options.map((o) => [o.id, o.label])), [options]);
  const name = useCallback((id: string | null) => (id ? (labelOf.get(id) ?? id) : ""), [labelOf]);

  const S = tally;
  const R = S.rounds.length;
  const tot = 3 + R; // 開会・R1..Rn・決定・比較

  // skipped: 演出を最終状態まで飛ばした印。トランジションを外して一瞬で完成形を出す。
  const [view, setView] = useState({ step: 0, phase: 0, winnerShown: false, skipped: false });
  const [playing, setPlaying] = useState(false);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const winnerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // ラウンド演出（除外発表→票移動→決定スタンプ）の再生中フラグ。再生中に送ると
  // 次へは行かず演出を飛ばす（押した分が先読みされて連続再生されると非直感的なため）。
  const animatingRef = useRef(false);
  const animEndTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setStep = useCallback(
    (n: number) => {
      const step = Math.max(0, Math.min(n, tot - 1));
      clearTimeout(phaseTimer.current);
      clearTimeout(winnerTimer.current);
      clearTimeout(animEndTimer.current);
      animatingRef.current = false;
      setView({ step, phase: 0, winnerShown: false, skipped: false });
      const ri = step - 1;
      if (ri >= 0 && ri < R) {
        // 除外発表（phase 0）→ 票移動（phase 1）の2フェーズ。R1は発表が無いので短く。
        const dwell = ri === 0 ? cfg.round1DwellMs : cfg.elimDwellMs;
        phaseTimer.current = setTimeout(() => setView((s) => ({ ...s, phase: 1 })), dwell);
        let animMs = dwell + cfg.barSpeedSec * 1000;
        if (S.rounds[ri].winner) {
          winnerTimer.current = setTimeout(
            () => setView((s) => ({ ...s, winnerShown: true })),
            animMs + cfg.winnerStampDelayMs
          );
          animMs += cfg.winnerStampDelayMs + STAMP_MS;
        }
        animatingRef.current = true;
        animEndTimer.current = setTimeout(() => {
          animatingRef.current = false;
        }, animMs);
      }
    },
    [tot, R, S, cfg.round1DwellMs, cfg.elimDwellMs, cfg.barSpeedSec, cfg.winnerStampDelayMs]
  );

  // 再生中のラウンド演出を最終状態（票移動完了・決定スタンプまで）へ一気に飛ばす。
  const skipAnim = useCallback(() => {
    clearTimeout(phaseTimer.current);
    clearTimeout(winnerTimer.current);
    clearTimeout(animEndTimer.current);
    animatingRef.current = false;
    setView((s) => {
      const ri = s.step - 1;
      const winner = ri >= 0 && ri < R ? !!S.rounds[ri].winner : false;
      return { ...s, phase: 1, winnerShown: winner, skipped: true };
    });
  }, [R, S]);

  // 最新の view をイベントハンドラから参照するための ref（effect 内で同期する）。
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // 進む（クリック/タップ/Space/→ 共通）。Keynote流: 演出中は先読みせずスキップ扱い。
  const advance = useCallback(() => {
    if (animatingRef.current) skipAnim();
    else setStep(viewRef.current.step + 1);
  }, [skipAnim, setStep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        advance();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setStep(viewRef.current.step - 1); // 戻るのは演出中でも普通に効く
      } else if (e.key === "Home") {
        e.preventDefault();
        setPlaying(false);
        setStep(0);
      } else if (e.key === "p" || e.key === "P") {
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, setStep]);

  // アンマウント時にラウンド演出のタイマーを確実に止める。
  useEffect(
    () => () => {
      clearTimeout(phaseTimer.current);
      clearTimeout(winnerTimer.current);
      clearTimeout(animEndTimer.current);
    },
    []
  );

  // 自動再生: スライドが進むたびに次を予約。最終スライドで停止する。
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (viewRef.current.step >= tot - 1) {
        setPlaying(false);
        return;
      }
      setStep(viewRef.current.step + 1);
    }, cfg.autoIntervalMs);
    return () => clearTimeout(t);
  }, [playing, view.step, tot, cfg.autoIntervalMs, setStep]);

  const { step, phase, winnerShown, skipped } = view;
  const isOpenFest = step === 0;
  const isClosing = step === 1 + R;
  const isCompare = step === tot - 1;
  const ri = step - 1;
  const isRound = ri >= 0 && ri < R;
  // デモ中は右上をサンプルバッジに譲る（お題は開会スライドに出る）
  const showTopicPill = (isRound || isCompare) && !demo;

  const barDur = cfg.barSpeedSec;
  const maxV = Math.max(1, S.maxV);
  const W = (v: number) => (v / maxV) * BAR_MAX_PCT;

  const last = S.rounds[R - 1];
  const winnerId = last.winner;
  const winVotes = winnerId ? (last.snap[winnerId] ?? 0) : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={advance}
    >
      <div
        data-screen-label="RCV結果発表"
        style={{
          width: "min(100vw, calc(100vh * 16 / 9))",
          aspectRatio: "16 / 9",
          background: "var(--tm-white)",
          containerType: "inline-size",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          color: "var(--tm-fg)",
          fontFamily: "var(--tm-font-jp)",
          letterSpacing: "var(--tm-track-body)",
          userSelect: "none",
        }}
      >
        {/* サンプルバッジ。開会・決定スライドは全面被せ（zIndex 5）でヘッダーが隠れるため、
            さらに上（zIndex 10）の固定オーバーレイとして全スライドに出し続ける。 */}
        {demo && (
          <span
            style={{
              position: "absolute",
              top: "2.2cqw",
              right: "6cqw",
              zIndex: 10,
              background: "var(--tm-yellow)",
              color: "var(--tm-black)",
              boxShadow: "inset 0 0 0 1.5px var(--tm-black)",
              borderRadius: ".7cqw",
              padding: ".55cqw 1.7cqw",
              fontSize: "1.4cqw",
              ...JP_DISPLAY,
              letterSpacing: ".04em",
              whiteSpace: "nowrap",
            }}
          >
            <span className="tm-optical-rise">サンプルデータ（デモ）</span>
          </span>
        )}
        {/* ── ヘッダー（ブランドロックアップ＋テーマピル）───────────────── */}
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "2.2cqw 6cqw 0",
          }}
        >
          <div
            style={{ flex: "none", display: "flex", alignItems: "center", gap: "1.1cqw", whiteSpace: "nowrap" }}
          >
            <BrandMark style={{ width: "3.6cqw", height: "3.6cqw" }} />
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
              <b style={{ ...JP_DISPLAY, fontSize: "1.8cqw", letterSpacing: ".04em" }}>
                みんなのRCV
              </b>
              <span
                style={{
                  fontFamily: "var(--tm-font-latin)",
                  fontSize: "0.95cqw",
                  fontWeight: 600,
                  letterSpacing: ".22em",
                  color: "var(--tm-teal-hover)",
                  marginTop: "0.5cqw",
                }}
              >
                RANKED CHOICE VOTING
              </span>
            </span>
          </div>
          {showTopicPill && (
            <span
              style={{
                flex: "0 1 auto",
                minWidth: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: ".7cqw",
                border: "1px solid var(--tm-teal-hover)",
                color: "var(--tm-teal-deep)",
                borderRadius: 9999,
                padding: ".5cqw 1.5cqw",
                fontSize: "1.25cqw",
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <ListNumbers size="1em" style={{ fontSize: "1.4cqw", flex: "none" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
            </span>
          )}
        </div>

        {/* ── 本文 ─────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 6cqw",
          }}
        >
          {isOpenFest && <OpeningSlide title={title} />}
          {isRound && (
            <RoundSlide
              S={S}
              ri={ri}
              phase={phase}
              winnerShown={winnerShown}
              skipped={skipped}
              barDur={barDur}
              W={W}
              name={name}
            />
          )}
          {isClosing && (
            <ClosingSlide
              cfg={cfg}
              winnerName={name(winnerId)}
              finalRows={S.order
                .filter((id) => (last.snap[id] ?? 0) > 0)
                .sort((a, b) => (last.snap[b] ?? 0) - (last.snap[a] ?? 0))
                .slice(0, 3)
                .map((id, i) => ({ pos: i + 1, name: name(id), count: fmt(last.snap[id] ?? 0) }))}
            />
          )}
          {isCompare && (
            <CompareSlide
              winR1Pct={Math.round(((winnerId ? (S.rounds[0].snap[winnerId] ?? 0) : 0) / Math.max(1, S.total)) * 100)}
              winFinalPct={Math.round((winVotes / Math.max(1, S.total)) * 100)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 開会（ミント全面＋紙吹雪のお祭り演出） ───────────────────────────── */
function OpeningSlide({ title }: { title: string }) {
  return (
    <div
      data-screen-label="RCV結果発表 オープニング"
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--tm-teal-100)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2.4cqw",
        textAlign: "center",
        zIndex: 5,
        animation: "tm-rise .5s ease",
      }}
    >
      <Confetti />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.4cqw",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.1cqw", color: "var(--tm-teal-hover)" }}>
          <Sparkle weight="fill" size="1em" style={{ fontSize: "1.7cqw", animation: "tm-pulse 1.6s ease-in-out infinite" }} />
          <span style={{ fontFamily: "var(--tm-font-latin)", fontSize: "1.35cqw", letterSpacing: ".34em", fontWeight: 600 }}>
            RANKED CHOICE VOTING
          </span>
          <Sparkle weight="fill" size="1em" style={{ fontSize: "1.7cqw", animation: "tm-pulse 1.6s ease-in-out .8s infinite" }} />
        </div>
        <b style={{ ...JP_DISPLAY, fontSize: "7cqw", lineHeight: 1.08, letterSpacing: ".02em" }}>
          結果発表
        </b>
        <div style={{ width: "15cqw", height: ".6cqw", background: "var(--tm-teal-soft)", borderRadius: 9999 }} />
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 2,
          background: "var(--tm-white)",
          borderRadius: 9999,
          boxShadow: "var(--tm-shadow-card)",
          padding: "1.5cqw 3.4cqw",
          display: "flex",
          alignItems: "center",
          gap: "1.2cqw",
        }}
      >
        <ListNumbers size="1em" style={{ fontSize: "2.4cqw", color: "var(--tm-teal)" }} />
        <b className="tm-optical-rise" style={{ ...JP_DISPLAY, fontSize: "2.3cqw", letterSpacing: ".03em" }}>
          {title}
        </b>
      </div>
      <span style={{ position: "relative", zIndex: 2, fontSize: "1.25cqw", color: "var(--tm-teal-deep)" }}>
        クリック / スペースキーで進みます（← で戻る・P で自動再生）
      </span>
    </div>
  );
}

/* ── ラウンド（除外発表→票移動の2フェーズ・過半数ライン・順位切れ行） ──── */
function RoundSlide({
  S,
  ri,
  phase,
  winnerShown,
  skipped,
  barDur,
  W,
  name,
}: {
  S: RcvTallyResult;
  ri: number;
  phase: number;
  winnerShown: boolean;
  /** 演出スキップ後。トランジション無しで最終状態を即座に描く。 */
  skipped: boolean;
  barDur: number;
  W: (v: number) => number;
  name: (id: string | null) => string;
}) {
  const round = S.rounds[ri];
  const prev = ri > 0 ? S.rounds[ri - 1] : null;
  const prevSnap = prev ? prev.snap : {};
  const p1 = phase >= 1;
  const trans = skipped ? undefined : `width ${barDur}s ${EASE}`;
  const majorityShown = p1 ? round.majority : prev ? prev.majority : round.majority;

  // 過半数ライン: 候補名列(15cqw)+gap(1cqw) から右のバー領域内での位置。
  const maxV = Math.max(1, S.maxV);
  const lineLeft = 15 + 1 + BAR_AREA_CQW * ((majorityShown / maxV) * (BAR_MAX_PCT / 100));
  const lineTrans = skipped ? undefined : `left ${barDur}s ${EASE}`;

  const chip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 9999,
    padding: ".14cqw .75cqw",
    fontSize: "1.1cqw",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };

  // 進行キャプション（除外発表→票移動→過半数到達）。
  let roundKicker: string;
  let roundNote: React.ReactNode;
  const elimName = name(round.elim);
  // 同数最下位だった候補の並び。キャプションは2行に収める必要があるので3件を超えたら畳む。
  const tiedNames = round.tiedWith.map((id) => `「${name(id)}」`);
  const tiedLabel =
    tiedNames.length > 3
      ? `${tiedNames.slice(0, 2).join("")}ほか${tiedNames.length - 2}件`
      : tiedNames.join("");
  if (round.winner && winnerShown) {
    roundKicker = "過半数に到達";
    roundNote = `「${name(round.winner)}」が有効票の過半数（${fmt(round.majority)}票）に到達しました。これで決定です。`;
  } else if (ri === 0) {
    roundKicker = "“1位”票の集計";
    roundNote = round.winner
      ? `みなさんの投票用紙の“1位”を集計しました。`
      : `みなさんの投票用紙の“1位”を集計しました。過半数（有効票の50%超＝${fmt(round.majority)}票）に届いた候補はまだありません。ここから、最下位の候補を1つずつ除外していきます。`;
  } else if (!p1) {
    // 同数だった事実と、それをどう解いたか（前ラウンド比較 / くじ）は必ず出す。
    // 順位切れ行と同じで、扱いを隠さないのが本ツールの誠実さの要。
    if (round.tiebreak === "lot") {
      roundKicker = "最下位が同数（くじ）";
      roundNote = `最下位が${tiedLabel}の同数で、第1ラウンドまで遡っても同数でした。事前に確定したくじ順で「${elimName}」（${fmt(round.moved)}票）を除外します（くじ順は投票開始前に確定）。`;
    } else if (round.tiebreak === "backward") {
      roundKicker = "最下位が同数";
      roundNote = `最下位が${tiedLabel}の同数のため、前のラウンドの票数を遡って比べ、少なかった「${elimName}」（${fmt(round.moved)}票）を除外します。`;
    } else {
      roundKicker = "最下位の除外";
      roundNote = `最下位の「${elimName}」（${fmt(round.moved)}票）を除外します。それぞれの投票用紙の“次の順位”へ票を移します。`;
    }
  } else {
    roundKicker = "票の移動";
    const moved = `「${elimName}」の${fmt(round.moved)}票のうち、${fmt(round.moved - round.toEx)}票が次の順位の候補へ移りました（黄色い部分）。`;
    const exPart =
      round.toEx > 0
        ? `${fmt(round.toEx)}票は次の順位が書かれておらず「順位切れ」になり、過半数ラインが少し左へ動きました。`
        : "";
    roundNote = moved + exPart;
  }

  // 順位切れ行の値。
  const exBefore = prev ? prev.exhausted : 0;
  const exNow = round.exhausted;
  const toEx = round.toEx;

  // 行の縦位置 = その時点で画面に見えている票数の降順（バー・票数表示と同じ値で並べる）。
  const dispVotes = (id: string): number => {
    const elimIdx = S.elimRound[id];
    if (elimIdx != null && elimIdx < ri) return -1;
    if (round.elim === id) return p1 ? 0 : (prevSnap[id] ?? 0);
    if (ri === 0) return round.snap[id] ?? 0;
    return p1 ? (round.snap[id] ?? 0) : (prevSnap[id] ?? 0);
  };
  const displayedVotes = Object.fromEntries(S.order.map((id) => [id, dispVotes(id)]));
  const rowPos = new Map(
    orderRcvRows(S.order, displayedVotes, S.elimRound).map((id, i) => [id, i])
  );

  return (
    <div data-screen-label="RCV集計ラウンド" style={{ display: "flex", flexDirection: "column", gap: "1.4cqw" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "1.6cqw" }}>
        {/* 総ラウンド数は出さない（何巡目で決着するかのネタバレ防止）。 */}
        <b style={{ ...JP_DISPLAY, fontSize: "2.7cqw", letterSpacing: ".02em" }}>
          ラウンド <span style={{ fontFamily: "var(--tm-font-latin)" }}>{ri + 1}</span>
        </b>
        <span style={{ fontSize: "1.35cqw", color: "var(--tm-gray-500)" }}>{roundKicker}</span>
      </div>

      <div style={{ position: "relative", paddingTop: "2.2cqw" }}>
        {/* 過半数ライン（有効票の縮小に追従して左へ動く） */}
        <div
          style={{
            position: "absolute",
            top: "1.5cqw",
            bottom: ".2cqw",
            left: `${lineLeft}cqw`,
            transition: lineTrans,
            borderLeft: "2px dashed var(--tm-gray-300)",
            zIndex: 3,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "-0.5cqw",
            left: `${lineLeft}cqw`,
            transition: lineTrans,
            transform: "translateX(-50%)",
            fontSize: "1.1cqw",
            color: "var(--tm-gray-500)",
            zIndex: 3,
            whiteSpace: "nowrap",
          }}
        >
          過半数 {fmt(majorityShown)} 票（有効票）
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: ".8cqw" }}>
          {/* 候補行。DOM順とkeyは S.order 固定のまま、translateY だけを遷移させて並べ替える。 */}
          <div style={{ position: "relative", height: `${S.order.length * ROW_STRIDE_CQW - 0.8}cqw` }}>
          {S.order.map((id) => {
            const v = round.snap[id] ?? 0;
            const before = prevSnap[id] ?? 0;
            const delta = round.transfers[id] ?? 0;
            const elimIdx = S.elimRound[id];
            const ghost = elimIdx != null && elimIdx < ri;
            const elimNow = round.elim === id;
            const isWin = round.winner === id && winnerShown;

            let baseW: number;
            if (ghost) baseW = 0;
            else if (elimNow) baseW = p1 ? 0 : W(before);
            else if (ri === 0) baseW = p1 ? W(v) : 0;
            else baseW = W(before);
            const gainW = p1 && !elimNow && !ghost ? W(delta) : 0;

            let tag = "";
            let tagStyle: React.CSSProperties = { display: "none" };
            if (ghost) {
              tag = `R${elimIdx}で除外`;
              tagStyle = { fontSize: "1.1cqw", color: "var(--tm-gray-300)", whiteSpace: "nowrap" };
            } else if (elimNow && !p1) {
              // 同数を解いて選ばれた除外なら、行のタグでもその旨を出す。
              tag = round.tiebreak ? (round.tiebreak === "lot" ? "同数・くじで除外" : "同数・除外") : "最下位・除外";
              tagStyle = { ...chip, background: "var(--tm-black)", color: "var(--tm-white)" };
            } else if (elimNow && p1) {
              tag = "→ 次の順位へ";
              tagStyle = { fontSize: "1.15cqw", fontWeight: 700, color: "var(--tm-fg)", whiteSpace: "nowrap" };
            } else if (isWin) {
              tag = "決定";
              tagStyle = {
                ...chip,
                background: "var(--tm-teal)",
                color: "var(--tm-white)",
                fontSize: "1.2cqw",
                letterSpacing: ".1em",
                animation: "rcvp-stamp .45s cubic-bezier(.15,.85,.25,1) both",
              };
            } else if (ri > 0 && delta > 0) {
              tag = `+${fmt(delta)}`;
              tagStyle = {
                ...chip,
                border: "1.5px solid var(--tm-black)",
                background: "var(--tm-yellow)",
                color: "var(--tm-black)",
                fontFamily: "var(--tm-font-latin)",
                opacity: p1 ? 1 : 0,
                transition: skipped ? undefined : `opacity .5s ease ${barDur * 0.55}s`,
              };
            }

            let count = "";
            if (ghost) count = "";
            else if (elimNow) count = p1 ? `−${fmt(round.moved)}` : fmt(before);
            else count = fmt(p1 ? v : ri === 0 ? 0 : before);
            if (ri === 0 && !p1) count = "";

            return (
              <div
                key={id}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  transform: `translateY(${(rowPos.get(id) ?? 0) * ROW_STRIDE_CQW}cqw)`,
                  transition: skipped ? undefined : `transform ${barDur}s ${EASE}`,
                  // 行同士がすれ違う瞬間にバーが透けて重ならないよう不透明にする。
                  background: "var(--tm-white)",
                  display: "flex",
                  alignItems: "center",
                  gap: "1cqw",
                  height: "2.7cqw",
                }}
              >
                <span
                  style={{
                    flex: "none",
                    width: "15cqw",
                    textAlign: "right",
                    fontSize: "1.4cqw",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    ...(ghost
                      ? { color: "var(--tm-gray-300)", textDecoration: "line-through", fontWeight: 500 }
                      : elimNow && p1
                        ? { color: "var(--tm-gray-400)", textDecoration: "line-through", fontWeight: 600 }
                        : isWin
                          ? { color: "var(--tm-teal-deep)", fontWeight: 700 }
                          : { color: "var(--tm-fg)", fontWeight: 600 }),
                  }}
                >
                  {name(id)}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "2cqw",
                    background: "var(--tm-gray-100)",
                    borderRadius: 9999,
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  {/* 基礎バー。除外中はイエロー＋黒1.5px内枠（薄色・赤は不採用の確定判断） */}
                  <div
                    style={{
                      height: "100%",
                      flex: "none",
                      width: `${baseW}%`,
                      transition: trans,
                      background: elimNow ? "var(--tm-yellow)" : isWin ? "var(--tm-teal-deep)" : "var(--tm-teal)",
                      borderRadius: "9999px 0 0 9999px",
                      ...(elimNow ? { boxShadow: "inset 0 0 0 1.5px var(--tm-black)" } : null),
                    }}
                  />
                  {/* 今ラウンドで移ってきた票（イエロー＋黒縁） */}
                  <div
                    style={{
                      height: "100%",
                      flex: "none",
                      width: `${gainW}%`,
                      transition: trans,
                      background: "var(--tm-yellow)",
                      boxShadow: "inset 0 0 0 1.5px var(--tm-black)",
                    }}
                  />
                </div>
                <div
                  style={{
                    width: "12cqw",
                    flex: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: ".6cqw",
                  }}
                >
                  <span style={tagStyle}>{tag}</span>
                  <span
                    style={{
                      fontFamily: "var(--tm-font-latin)",
                      fontSize: "1.55cqw",
                      fontWeight: 600,
                      color:
                        elimNow && p1
                          ? "var(--tm-fg)"
                          : ghost
                            ? "var(--tm-gray-400)"
                            : isWin
                              ? "var(--tm-teal-deep)"
                              : "var(--tm-fg)",
                    }}
                  >
                    {count}
                  </span>
                </div>
              </div>
            );
          })}
          </div>

          {/* 順位切れ（死票）行。扱いを隠さないのが本ツールの誠実さの要。 */}
          <div
            style={{
              borderTop: "1px dashed var(--tm-gray-250)",
              marginTop: ".4cqw",
              paddingTop: "1cqw",
              display: "flex",
              alignItems: "center",
              gap: "1cqw",
              height: "2.7cqw",
            }}
          >
            <span
              style={{
                flex: "none",
                width: "15cqw",
                textAlign: "right",
                fontSize: "1.35cqw",
                fontWeight: 600,
                color: "var(--tm-gray-500)",
              }}
            >
              順位切れ
            </span>
            <div
              style={{
                flex: 1,
                height: "2cqw",
                background: "var(--tm-gray-100)",
                borderRadius: 9999,
                overflow: "hidden",
                display: "flex",
              }}
            >
              <div
                style={{
                  height: "100%",
                  flex: "none",
                  width: `${W(exBefore)}%`,
                  transition: trans,
                  background: "var(--tm-gray-300)",
                  borderRadius: "9999px 0 0 9999px",
                }}
              />
              <div
                style={{
                  height: "100%",
                  flex: "none",
                  width: `${p1 && toEx > 0 ? W(toEx) : 0}%`,
                  transition: trans,
                  background: "var(--tm-gray-500)",
                }}
              />
            </div>
            <div
              style={{
                width: "12cqw",
                flex: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: ".6cqw",
              }}
            >
              {ri > 0 && toEx > 0 && (
                <span
                  style={{
                    ...chip,
                    border: "1.5px solid var(--tm-gray-400)",
                    background: "var(--tm-white)",
                    color: "var(--tm-gray-600)",
                    fontFamily: "var(--tm-font-latin)",
                    opacity: p1 ? 1 : 0,
                    transition: skipped ? undefined : `opacity .5s ease ${barDur * 0.55}s`,
                  }}
                >
                  +{fmt(toEx)}
                </span>
              )}
              <span style={{ fontFamily: "var(--tm-font-latin)", fontSize: "1.55cqw", fontWeight: 600, color: "var(--tm-gray-500)" }}>
                {ri === 0 && !p1 ? "" : fmt(p1 ? exNow : exBefore)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 進行キャプションは1〜2行で変動する。高さを2行分に固定しないと、行数が変わる
          たびスライド全体（縦センタリング）ごとチャートが上下にガタつく。 */}
      <div style={{ height: "5.1cqw", display: "flex", alignItems: "flex-start" }}>
        <span style={{ fontSize: "1.5cqw", lineHeight: 1.7, color: "var(--tm-gray-700)" }}>{roundNote}</span>
      </div>
    </div>
  );
}

/* ── 決定（ミント全面＋紙吹雪＋決定スタンプ） ─────────────────────────── */
function ClosingSlide({
  cfg,
  winnerName,
  finalRows,
}: {
  cfg: RcvResultsConfig;
  winnerName: string;
  finalRows: Array<{ pos: number; name: string; count: string }>;
}) {
  return (
    <div
      data-screen-label="RCV結果 決定"
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--tm-teal-100)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.9cqw",
        textAlign: "center",
        zIndex: 5,
        animation: "tm-rise .5s ease",
      }}
    >
      <Confetti />
      <div
        style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: ".9cqw" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.1cqw", color: "var(--tm-teal-hover)" }}>
          <Sparkle weight="fill" size="1em" style={{ fontSize: "1.7cqw", animation: "tm-pulse 1.6s ease-in-out infinite" }} />
          <span style={{ fontFamily: "var(--tm-font-latin)", fontSize: "1.35cqw", letterSpacing: ".34em", fontWeight: 600 }}>
            RESULT
          </span>
          <Sparkle weight="fill" size="1em" style={{ fontSize: "1.7cqw", animation: "tm-pulse 1.6s ease-in-out .8s infinite" }} />
        </div>
        <b style={{ ...JP_DISPLAY, fontSize: "2.3cqw", letterSpacing: ".06em", color: "var(--tm-teal-deep)" }}>
          {cfg.closingKicker}
        </b>
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 2,
          alignSelf: "center",
          background: "var(--tm-white)",
          borderRadius: "2cqw",
          boxShadow: "var(--tm-shadow-elev)",
          padding: "2.8cqw 5.5cqw",
          display: "flex",
          alignItems: "center",
          gap: "2.2cqw",
        }}
      >
        <span
          style={{
            flex: "none",
            width: "5.6cqw",
            height: "5.6cqw",
            borderRadius: "50%",
            background: "var(--tm-teal-100)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Trophy weight="fill" size="1em" style={{ fontSize: "3cqw", color: "var(--tm-teal)" }} />
        </span>
        <b style={{ ...JP_DISPLAY, fontSize: "6.6cqw", lineHeight: 1.08, letterSpacing: ".02em" }}>
          {winnerName}
        </b>
        <span
          style={{
            background: "var(--tm-teal)",
            color: "var(--tm-white)",
            ...JP_DISPLAY,
            fontSize: "3.2cqw",
            letterSpacing: ".16em",
            padding: ".5cqw 2.2cqw",
            borderRadius: "1.1cqw",
            animation: "rcvp-stamp .45s cubic-bezier(.15,.85,.25,1) .3s both",
          }}
        >
          <span className="tm-optical-rise">決定</span>
        </span>
      </div>
      <div style={{ position: "relative", zIndex: 2, display: "flex", gap: "1.2cqw", flexWrap: "wrap", justifyContent: "center" }}>
        {finalRows.map((fr) => (
          <div
            key={fr.pos}
            style={{
              background: "var(--tm-white)",
              borderRadius: 9999,
              padding: ".8cqw 2.1cqw",
              display: "flex",
              gap: ".9cqw",
              alignItems: "baseline",
              boxShadow: "var(--tm-shadow-card)",
            }}
          >
            <span style={{ fontFamily: "var(--tm-font-latin)", fontSize: "1.35cqw", fontWeight: 700, color: "var(--tm-teal-deep)" }}>
              {fr.pos}
            </span>
            <b className="tm-optical-rise" style={{ fontSize: "1.45cqw", ...JP_DISPLAY }}>
              {fr.name}
            </b>
            <span style={{ fontFamily: "var(--tm-font-latin)", fontSize: "1.25cqw", color: "var(--tm-gray-500)" }}>
              {fr.count}票
            </span>
          </div>
        ))}
      </div>
      <span style={{ position: "relative", zIndex: 2, fontSize: "1.5cqw", color: "var(--tm-teal-deep)", lineHeight: 1.7 }}>
        {cfg.closingNote}
      </span>
    </div>
  );
}

/* ── 比較（もし“1位票だけ”で決めていたら？） ─────────────────────────── */
function CompareSlide({ winR1Pct, winFinalPct }: { winR1Pct: number; winFinalPct: number }) {
  return (
    <div
      data-screen-label="RCV比較（1位票だけとの比較）"
      style={{ display: "flex", flexDirection: "column", gap: "2.8cqw", animation: "tm-rise .4s ease" }}
    >
      <b style={{ ...JP_DISPLAY, fontSize: "3.8cqw", lineHeight: 1.15, letterSpacing: ".02em" }}>
        もし、“1位票だけ”で決めていたら？
      </b>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.3cqw" }}>
        <span style={{ fontSize: "1.35cqw", fontWeight: 700, color: "var(--tm-gray-600)" }}>当選者に届いた票の割合</span>
        <div style={{ display: "flex", alignItems: "center", gap: "1.6cqw" }}>
          <span
            style={{
              flex: "none",
              width: "12cqw",
              textAlign: "right",
              fontSize: "1.6cqw",
              ...JP_DISPLAY,
              color: "var(--tm-gray-500)",
            }}
          >
            1位票だけ
          </span>
          <div style={{ flex: 1, height: "3cqw", background: "var(--tm-gray-100)", borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${winR1Pct}%`, background: "var(--tm-gray-400)", borderRadius: "9999px 0 0 9999px" }} />
          </div>
          <span style={{ flex: "none", width: "15cqw", display: "flex", alignItems: "baseline", gap: ".5cqw" }}>
            <span style={{ fontFamily: "var(--tm-font-latin)", fontSize: "4cqw", fontWeight: 700, lineHeight: 1, color: "var(--tm-gray-500)" }}>
              {winR1Pct}
              <span style={{ fontSize: "2cqw" }}>%</span>
            </span>
            <span style={{ fontSize: "1.5cqw", fontWeight: 700, color: "var(--tm-gray-500)" }}>のみ</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.6cqw" }}>
          <span
            style={{
              flex: "none",
              width: "12cqw",
              textAlign: "right",
              fontSize: "1.6cqw",
              ...JP_DISPLAY,
              color: "var(--tm-teal-deep)",
            }}
          >
            RCV
          </span>
          <div style={{ flex: 1, height: "3cqw", background: "var(--tm-gray-100)", borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${winFinalPct}%`, background: "var(--tm-teal)", borderRadius: "9999px 0 0 9999px" }} />
          </div>
          <span style={{ flex: "none", width: "15cqw", display: "flex", alignItems: "baseline", gap: ".5cqw" }}>
            <span style={{ fontFamily: "var(--tm-font-latin)", fontSize: "4cqw", fontWeight: 700, lineHeight: 1, color: "var(--tm-teal-deep)" }}>
              {winFinalPct}
              <span style={{ fontSize: "2cqw" }}>%</span>
            </span>
            <span style={{ fontSize: "1.5cqw", fontWeight: 700, color: "var(--tm-teal-deep)" }}>が届く</span>
          </span>
        </div>
      </div>

      <div
        style={{
          background: "var(--tm-teal-100)",
          borderRadius: "1.3cqw",
          padding: "1.9cqw 2.4cqw",
          display: "flex",
          flexDirection: "column",
          gap: "1.2cqw",
        }}
      >
        <b style={{ fontSize: "1.4cqw", color: "var(--tm-teal-hover)", letterSpacing: ".08em" }}>この差が意味すること</b>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.1cqw" }}>
          <CheckCircle size="1em" style={{ fontSize: "2.3cqw", color: "var(--tm-teal-hover)", flex: "none", transform: "translateY(.4cqw)" }} />
          <span style={{ display: "flex", flexDirection: "column", gap: ".4cqw" }}>
            <b style={{ ...JP_DISPLAY, fontSize: "2.2cqw", lineHeight: 1.4, letterSpacing: ".02em" }}>より多くの参加者の意思が、結果に反映される</b>
            <span style={{ fontSize: "1.65cqw", lineHeight: 1.7, color: "var(--tm-gray-700)" }}>
              1位に入れた候補が敗退しても票は無効にならず、次の順位の候補の票として数えられ続けます。
            </span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.1cqw" }}>
          <CheckCircle size="1em" style={{ fontSize: "2.3cqw", color: "var(--tm-teal-hover)", flex: "none", transform: "translateY(.4cqw)" }} />
          <span style={{ display: "flex", flexDirection: "column", gap: ".4cqw" }}>
            <b style={{ ...JP_DISPLAY, fontSize: "2.2cqw", lineHeight: 1.4, letterSpacing: ".02em" }}>一部の強い支持だけでは、当選できない</b>
            <span style={{ fontSize: "1.65cqw", lineHeight: 1.7, color: "var(--tm-gray-700)" }}>
              当選には有効票の過半数が必要なため、幅広く「2位でもいい」と支持される候補が選ばれます。
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
