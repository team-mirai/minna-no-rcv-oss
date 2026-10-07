"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowCounterClockwise, CaretLeft, CaretRight, Pause, Play } from "@phosphor-icons/react";
import type { RcvTallyResult } from "@/features/rcv/tally";
import { orderRcvRows } from "@/features/rcv/presenter/rowOrder";

/**
 * 開票のドラマを再生するモバイル向けリプレイ。
 *
 * 16:9投影用の RcvResultsPresenter と同じ設計判断（除外発表→票移動の2フェーズ、
 * 移動票はイエロー＋黒1.5px内枠、順位切れ行、過半数破線の追従、行は表示票数の降順で
 * translateY 並べ替え、総ラウンド数のネタバレ禁止）を、px 基準の縦積みレイアウトに
 * 落とした兄弟実装。数字はすべて同一の tallyRcv 出力から導出する。
 *
 * 初期表示では最終状態を固定して RcvReplayCover を重ね、押すとラウンド1から再生する。
 */

type Props = {
  options: Array<{ id: string; label: string }>;
  tally: RcvTallyResult;
  /** false でカード枠（枠線・白背景・余白）を外す。モーダル内など既に面がある場所用。 */
  framed?: boolean;
};

/** 最終結果のグラフに重ねる再生カバー。 */
export function RcvReplayCover({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="rcv-replay-cover"
      onClick={onClick}
      className="absolute inset-0 z-20 flex w-full flex-col items-center justify-center gap-3 rounded-[16px] bg-white/65 px-4 py-9 backdrop-blur-[2px] transition-[background-color,transform] duration-150 ease-out hover:bg-white/75 active:scale-[0.96]"
    >
      <span className="grid h-[54px] w-[54px] place-items-center rounded-full bg-tm-teal text-white shadow-[var(--tm-shadow-card)]">
        <Play size={24} weight="fill" className="ml-0.5" />
      </span>
      <b className="text-[16px] tracking-[0.04em]" style={JP_DISPLAY}>
        開票のドラマをリプレイ
      </b>
      <span className="text-[13px] leading-[1.7] text-tm-teal-deep">
        最下位の除外と票の移動を、ラウンドごとに再生します
      </span>
    </button>
  );
}

const EASE = "cubic-bezier(.2,.6,.2,1)";
const BAR_SEC = 0.9;
const ELIM_DWELL_MS = 1600;
const ROUND1_DWELL_MS = 140;
const AUTO_INTERVAL_MS = 4200;
const WINNER_STAMP_DELAY_MS = 450;
const STAMP_MS = 450;
/** 候補行の高さ・行間（px）。並べ替えの translateY に使う。 */
const ROW_H = 30;
const ROW_GAP = 8;
const ROW_STRIDE = ROW_H + ROW_GAP;
/** バーの最大幅（%）。過半数ラインの位置計算にも同じ係数を使う。 */
const BAR_MAX_PCT = 94;

const fmt = (v: number) => v.toLocaleString();

const JP_DISPLAY: React.CSSProperties = {
  fontFamily: "var(--tm-font-jp-display)",
  fontWeight: 900,
};

export function RcvReplay({ options, tally, framed = true }: Props) {
  const labelOf = useMemo(() => new Map(options.map((o) => [o.id, o.label])), [options]);
  const name = useCallback((id: string | null) => (id ? (labelOf.get(id) ?? id) : ""), [labelOf]);

  const S = tally;
  const R = S.rounds.length;

  // 再生前は最終状態を見せたまま、上に再生カバーを重ねる。
  const [started, setStarted] = useState(false);
  const [view, setView] = useState(() => ({
    ri: Math.max(0, R - 1),
    phase: 1,
    winnerShown: true,
    skipped: true,
  }));
  const [playing, setPlaying] = useState(false);
  const [roundProgress, setRoundProgress] = useState(1);
  const roundProgressRef = useRef(1);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const winnerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animEndTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animatingRef = useRef(false);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const setRound = useCallback(
    (n: number) => {
      const ri = Math.max(0, Math.min(n, R - 1));
      clearTimeout(phaseTimer.current);
      clearTimeout(winnerTimer.current);
      clearTimeout(animEndTimer.current);
      animatingRef.current = false;
      roundProgressRef.current = 0;
      setRoundProgress(0);
      setView({ ri, phase: 0, winnerShown: false, skipped: false });
      const dwell = ri === 0 ? ROUND1_DWELL_MS : ELIM_DWELL_MS;
      phaseTimer.current = setTimeout(() => setView((s) => ({ ...s, phase: 1 })), dwell);
      let animMs = dwell + BAR_SEC * 1000;
      if (S.rounds[ri].winner) {
        winnerTimer.current = setTimeout(
          () => setView((s) => ({ ...s, winnerShown: true })),
          animMs + WINNER_STAMP_DELAY_MS
        );
        animMs += WINNER_STAMP_DELAY_MS + STAMP_MS;
      }
      animatingRef.current = true;
      animEndTimer.current = setTimeout(() => {
        animatingRef.current = false;
      }, animMs);
    },
    [R, S]
  );

  const skipAnim = useCallback(() => {
    clearTimeout(phaseTimer.current);
    clearTimeout(winnerTimer.current);
    clearTimeout(animEndTimer.current);
    animatingRef.current = false;
    setView((s) => ({
      ...s,
      phase: 1,
      winnerShown: !!S.rounds[s.ri].winner,
      skipped: true,
    }));
  }, [S]);

  // Keynote流: 演出中の「次へ」は先読みせず、演出のスキップとして扱う。
  const advance = useCallback(() => {
    if (animatingRef.current) {
      skipAnim();
      return;
    }
    if (viewRef.current.ri < R - 1) setRound(viewRef.current.ri + 1);
  }, [R, setRound, skipAnim]);

  const start = useCallback(() => {
    setStarted(true);
    setRound(0);
    setPlaying(true);
  }, [setRound]);

  // 自動再生: 一時停止後は残り時間から再開する。
  useEffect(() => {
    if (!playing || !started) return;
    const remaining = Math.max(0, (1 - roundProgressRef.current) * AUTO_INTERVAL_MS);
    const t = setTimeout(() => {
      if (viewRef.current.ri >= R - 1) {
        roundProgressRef.current = 1;
        setRoundProgress(1);
        setPlaying(false);
        return;
      }
      setRound(viewRef.current.ri + 1);
    }, remaining);
    return () => clearTimeout(t);
  }, [playing, started, view.ri, R, setRound]);

  // 動画プレイヤーと同じように、再生中は進捗を連続的に見せる。
  useEffect(() => {
    if (!playing || !started) return;
    const from = roundProgressRef.current;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(1, from + (now - startedAt) / AUTO_INTERVAL_MS);
      roundProgressRef.current = next;
      setRoundProgress(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, started, view.ri]);

  useEffect(
    () => () => {
      clearTimeout(phaseTimer.current);
      clearTimeout(winnerTimer.current);
      clearTimeout(animEndTimer.current);
    },
    []
  );

  const { ri, phase, winnerShown, skipped } = view;
  const round = S.rounds[ri];
  const prev = ri > 0 ? S.rounds[ri - 1] : null;
  const prevSnap = prev ? prev.snap : {};
  const p1 = phase >= 1;
  const trans = skipped ? undefined : `width ${BAR_SEC}s ${EASE}`;
  const maxV = Math.max(1, S.maxV);
  const W = (v: number) => (v / maxV) * BAR_MAX_PCT;
  const majorityShown = p1 ? round.majority : prev ? prev.majority : round.majority;
  const linePct = (majorityShown / maxV) * BAR_MAX_PCT;
  const lineTrans = skipped ? undefined : `left ${BAR_SEC}s ${EASE}`;

  // 進行キャプション。
  let caption: string;
  const elimName = name(round.elim);
  // 同数最下位だった候補の並び。多すぎるとキャプションが伸びるので3件を超えたら畳む。
  const tiedNames = round.tiedWith.map((id) => `「${name(id)}」`);
  const tiedLabel =
    tiedNames.length > 3
      ? `${tiedNames.slice(0, 2).join("")}ほか${tiedNames.length - 2}件`
      : tiedNames.join("");
  if (round.winner && winnerShown) {
    caption = `「${name(round.winner)}」が有効票の過半数（${fmt(round.majority)}票）に到達。決定です。`;
  } else if (ri === 0) {
    caption = round.winner
      ? "投票用紙の“1位”を集計しました。"
      : `“1位”票を集計しました。過半数（${fmt(round.majority)}票）に届いた候補はまだありません。最下位を1つずつ除外していきます。`;
  } else if (!p1) {
    // 同数だった事実と、それをどう解いたか（前ラウンド比較 / くじ）は必ず出す。
    // 順位切れと同じで、扱いを隠さないのが本ツールの誠実さの要。
    if (round.tiebreak === "lot") {
      caption = `最下位が${tiedLabel}の同数で、第1ラウンドまで遡っても同数でした。事前に確定したくじ順で「${elimName}」（${fmt(round.moved)}票）を除外します。`;
    } else if (round.tiebreak === "backward") {
      caption = `最下位が${tiedLabel}の同数のため、前のラウンドの票数を遡って比べ、少なかった「${elimName}」（${fmt(round.moved)}票）を除外します。`;
    } else {
      caption = `最下位の「${elimName}」（${fmt(round.moved)}票）を除外。票を“次の順位”へ移します。`;
    }
  } else {
    caption =
      `「${elimName}」の${fmt(round.moved)}票のうち${fmt(round.moved - round.toEx)}票が次の順位へ移りました（黄色）。` +
      (round.toEx > 0 ? `${fmt(round.toEx)}票は順位切れになりました。` : "");
  }

  // 行の縦位置 = その時点で画面に見えている票数の降順（Presenter と同じ規則）。
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

  const exBefore = prev ? prev.exhausted : 0;
  const progressPct = started ? ((ri + roundProgress) / Math.max(1, R)) * 100 : 100;

  return (
    <div
      data-testid="rcv-replay"
      className={`relative flex flex-col gap-3 rounded-[16px] ${
        framed ? "bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)]" : ""
      }`}
    >
      {/* ヘッダー行: ラウンド番号＋動画プレイヤー型の操作。 */}
      <div className="flex items-center justify-between gap-2">
        <b className="text-[17px]" style={JP_DISPLAY}>
          {started ? (
            <>
              ラウンド{" "}
              <span className="font-[family-name:var(--tm-font-latin)] tabular-nums">
                {ri + 1}/{R}
              </span>
            </>
          ) : (
            "最終結果"
          )}
        </b>
        {started && (
          <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="前のラウンド"
            disabled={ri === 0}
            onClick={() => {
              setPlaying(false);
              setRound(ri - 1);
            }}
            className="grid size-10 place-items-center rounded-full text-tm-gray-600 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-[background-color,transform] hover:bg-tm-teal-100 active:scale-[0.96] disabled:opacity-30"
          >
            <CaretLeft size={16} weight="bold" />
          </button>
          <button
            type="button"
            aria-label={playing ? "一時停止" : ri >= R - 1 ? "最初から再生" : "再生"}
            onClick={() => {
              if (playing) {
                setPlaying(false);
                return;
              }
              if (ri >= R - 1 && roundProgressRef.current >= 0.99) setRound(0);
              setPlaying(true);
            }}
            className="grid size-10 place-items-center rounded-full bg-tm-teal text-white shadow-[var(--tm-shadow-card)] transition-[background-color,transform] hover:bg-tm-teal-hover active:scale-[0.96]"
          >
            {playing ? <Pause size={17} weight="fill" /> : <Play size={17} weight="fill" className="ml-0.5" />}
          </button>
          <button
            type="button"
            aria-label="次のラウンド（演出中はスキップ）"
            disabled={ri >= R - 1 && !animatingRef.current}
            onClick={() => {
              setPlaying(false);
              advance();
            }}
            className="grid size-10 place-items-center rounded-full text-tm-gray-600 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-[background-color,transform] hover:bg-tm-teal-100 active:scale-[0.96] disabled:opacity-30"
          >
            <CaretRight size={16} weight="bold" />
          </button>
          <button
            type="button"
            aria-label="最初から"
            onClick={() => {
              setPlaying(false);
              setRound(0);
              setPlaying(true);
            }}
            className="ml-0.5 grid size-10 place-items-center rounded-full text-tm-teal-deep shadow-[0_0_0_1px_rgba(15,132,114,0.35)] transition-[background-color,transform] hover:bg-tm-teal-100 active:scale-[0.96]"
          >
            <ArrowCounterClockwise size={17} weight="bold" />
          </button>
        </div>
        )}
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-tm-gray-100"
        role="progressbar"
        aria-label="リプレイの進行状況"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPct)}
      >
        <div
          className="h-full rounded-full bg-tm-teal transition-[width] duration-100 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* チャート */}
      <div className="relative pt-6">
        {/* 過半数ライン（バー領域＝右カラム内で追従）。行の name 列(84px)+gap(8px) を除いた領域 */}
        <div className="absolute inset-0 left-[92px] right-[56px] pointer-events-none">
          <div
            className="absolute top-4 bottom-0 z-[3] border-l-2 border-dashed border-tm-gray-300"
            style={{ left: `${linePct}%`, transition: lineTrans }}
          />
          <div
            className="absolute top-[-4px] z-[3] whitespace-nowrap text-[10.5px] text-tm-gray-500"
            style={{ left: `${linePct}%`, transform: "translateX(-50%)", transition: lineTrans }}
          >
            過半数 {fmt(majorityShown)}票
          </div>
        </div>

        {/* 候補行。DOM順とkeyは S.order 固定のまま、translateY だけを遷移させて並べ替える */}
        <div className="relative" style={{ height: S.order.length * ROW_STRIDE - ROW_GAP }}>
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

            let count = "";
            if (ghost) count = "";
            else if (elimNow) count = p1 ? `−${fmt(round.moved)}` : fmt(before);
            else count = fmt(p1 ? v : ri === 0 ? 0 : before);
            if (ri === 0 && !p1) count = "";

            return (
              <div
                key={id}
                className="absolute left-0 right-0 top-0 flex items-center gap-2 bg-white"
                style={{
                  height: ROW_H,
                  transform: `translateY(${(rowPos.get(id) ?? 0) * ROW_STRIDE}px)`,
                  transition: skipped ? undefined : `transform ${BAR_SEC}s ${EASE}`,
                }}
              >
                <span
                  className={`w-[84px] flex-none truncate text-right text-[12.5px] ${
                    ghost
                      ? "font-medium text-tm-gray-300 line-through"
                      : elimNow && p1
                        ? "font-semibold text-tm-gray-400 line-through"
                        : isWin
                          ? "font-bold text-tm-teal-deep"
                          : "font-semibold text-tm-black"
                  }`}
                >
                  {name(id)}
                </span>
                <div className="flex h-[16px] flex-1 overflow-hidden rounded-full bg-tm-gray-100">
                  <div
                    className="h-full flex-none rounded-l-full"
                    style={{
                      width: `${baseW}%`,
                      transition: trans,
                      background: elimNow
                        ? "var(--tm-yellow)"
                        : isWin
                          ? "var(--tm-teal-deep)"
                          : "var(--tm-teal)",
                      ...(elimNow ? { boxShadow: "inset 0 0 0 1.5px var(--tm-black)" } : null),
                    }}
                  />
                  <div
                    className="h-full flex-none"
                    style={{
                      width: `${gainW}%`,
                      transition: trans,
                      background: "var(--tm-yellow)",
                      boxShadow: "inset 0 0 0 1.5px var(--tm-black)",
                    }}
                  />
                </div>
                <span className="relative w-[48px] flex-none text-right">
                  {isWin && (
                    <span
                      className="absolute -top-4 right-0 z-[4] rounded-[4px] bg-tm-teal px-1.5 text-[10px] font-bold tracking-[0.1em] text-white"
                      style={{ animation: "tm-verdict-stamp .45s cubic-bezier(.15,.85,.25,1) both" }}
                    >
                      決定
                    </span>
                  )}
                  <span
                    className={`font-[family-name:var(--tm-font-latin)] text-[13px] font-semibold ${
                      ghost ? "text-tm-gray-400" : isWin ? "text-tm-teal-deep" : "text-tm-black"
                    }`}
                  >
                    {count}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {/* 順位切れ（死票）行。扱いを隠さない。 */}
        <div className="mt-2 flex items-center gap-2 border-t border-dashed border-tm-gray-250 pt-2.5" style={{ height: ROW_H + 10 }}>
          <span className="w-[84px] flex-none text-right text-[12px] font-semibold text-tm-gray-500">
            順位切れ
          </span>
          <div className="flex h-[16px] flex-1 overflow-hidden rounded-full bg-tm-gray-100">
            <div
              className="h-full flex-none rounded-l-full bg-tm-gray-300"
              style={{ width: `${W(exBefore)}%`, transition: trans }}
            />
            <div
              className="h-full flex-none bg-tm-gray-500"
              style={{ width: `${p1 && round.toEx > 0 ? W(round.toEx) : 0}%`, transition: trans }}
            />
          </div>
          <span className="w-[48px] flex-none text-right font-[family-name:var(--tm-font-latin)] text-[13px] font-semibold text-tm-gray-500">
            {ri === 0 && !p1 ? "" : fmt(p1 ? round.exhausted : exBefore)}
          </span>
        </div>
      </div>

      {/* 進行キャプション（高さ固定でガタつき防止） */}
      <div className="flex min-h-[44px] items-start">
        <span className="text-[13px] leading-[1.7] text-tm-gray-700">{caption}</span>
      </div>

      {/* くじが実際に使われた回だけ、順番が事前確定であることを添える。 */}
      {round.tiebreak === "lot" && (
        <p className="-mt-1 text-[11.5px] leading-[1.6] text-tm-gray-500">
          くじ順は投票開始前に確定しています（投票の内容では変わりません）。
        </p>
      )}

      {!started && <RcvReplayCover onClick={start} />}
    </div>
  );
}
