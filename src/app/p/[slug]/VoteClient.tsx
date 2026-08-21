"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { submitBallotAction } from "@/app/actions";
import type { PollOption, SubmitResult } from "@/server/polls";
import { Modal } from "@/components/Modal";
import { BallotDoneArt } from "@/components/BallotDoneArt";
import { tapHaptic } from "@/lib/haptics";
import {
  ArrowRight,
  ChartBar,
  Check,
  DotsSixVertical,
  ListNumbers,
  PencilSimple,
  Plus,
  X,
} from "@phosphor-icons/react";

/**
 * 「あなたの投票」ミント箱の外枠＋見出し。rank / done の各フェーズはこの中に入る。
 * 移植元アプリの RcvBoard の VoteBox と同じ意匠。
 */
function VoteBox({ children }: { children: ReactNode }) {
  return (
    <div className="bg-tm-teal-100 rounded-[12px] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-tm-teal-200 pb-2.5">
        <ListNumbers size={21} />
        <b className="text-[17px] tracking-[0.04em]">あなたの投票</b>
      </div>
      {children}
    </div>
  );
}

type Props = {
  slug: string;
  options: PollOption[];
  /** このブラウザの送信済み順位（サーバが voter_key で解決）。非 null なら投票済み画面から開く */
  submittedRankings: string[] | null;
  /** 受付中に途中経過（結果ページ）を見られる poll か。done 画面のリンク出し分けに使う */
  showLiveCount: boolean;
};

type Phase = "rank" | "done";

/* ── ドラッグ並べ替え（移植元アプリの RcvBoard の機構をそのまま移植）────
 * Pointer Events ＋ setPointerCapture。ライブラリは足さない。
 *
 * カード全体がつかめる。ただしタッチはページスクロールと競合するため、
 * カード面は「長押し（HOLD_MS）で持ち上げ」：持ち上げるまでは touch-action を
 * 制限せず普通にスクロールでき、持ち上げた後だけ touchmove を preventDefault で
 * 止める。⠿ ハンドルだけは touch-action:none で即時につかめる。マウスは常に即時。
 */

/** 行の描画に必要な最小のドラッグ状態。計測値など機構の実体は dragRef が持つ。 */
type DragState = {
  id: string;
  /** ドラッグ開始時の order 上の位置 */
  startIndex: number;
  /** いま落とすとどこに入るか（開始時の各行中点との比較で導出） */
  targetIndex: number;
  /** つかんだカードの translateY（px・指の移動＋自動スクロール分） */
  offset: number;
  /** 空いた場所へ他の行が退避する移動量（px・つかんだ行の高さ＋行間） */
  shiftBy: number;
  /** 離した後、確定位置へ滑り込むアニメーション中 */
  settling: boolean;
};

type DragMeta = {
  pointerId: number;
  startY: number;
  startIndex: number;
  targetIndex: number;
  /** ドラッグ開始時点の各行の中心Y・高さ（order 順。ドラッグ中 order は不変） */
  rects: { center: number; height: number }[];
  gap: number;
  scroller: HTMLElement | null;
  startScrollTop: number;
};

/** 指がビューポート上下端に近づいたら送るスクロール量（pointermove 駆動・慣性なし） */
const AUTOSCROLL_ZONE = 72;
const AUTOSCROLL_STEP = 10;
/** 離した後に確定位置へ滑り込む時間。CSS transition と一致させる */
const SETTLE_MS = 150;
/** タッチでカード面から持ち上げるまでの長押し時間（スクロールとの弁別） */
const HOLD_MS = 200;
/** 長押し判定中にこれ以上動いたらスクロール意図とみなして持ち上げを中止（px） */
const TOUCH_SLOP = 8;

function findScrollParent(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) return n;
  }
  return (document.scrollingElement as HTMLElement | null) ?? null;
}

/** start→target へ移動したときの、つかんだカードの最終 translateY（間の行の高さ＋行間の和） */
function settleOffset(meta: DragMeta, target: number): number {
  let sum = 0;
  if (target > meta.startIndex) {
    for (let j = meta.startIndex + 1; j <= target; j++) sum += meta.rects[j].height + meta.gap;
  } else {
    for (let j = target; j < meta.startIndex; j++) sum -= meta.rects[j].height + meta.gap;
  }
  return sum;
}

/**
 * RCV の投票 UI。順位付け → 投票済み確認 の2フェーズをページ直置きで行い、
 * 送信成功の直後だけ受付完了ポップアップ（投票箱アニメ）を重ねる。
 * 投票は1ブラウザ1票。受付中は「順位を変更する」で done → rank に戻り、何度でも
 * 上書き再投票できる（最後の送信が有効）。
 */
export default function VoteClient({ slug, options, submittedRankings, showLiveCount }: Props) {
  const router = useRouter();
  // 送信済みなら「投票済み」画面（done）で開く（受付中はそこから再編集できる）。
  const [phase, setPhase] = useState<Phase>(submittedRankings ? "done" : "rank");
  // 順位（option_id の配列・先頭が1位）。選択肢のタップで1位から積んでいく＝最初は空。
  const [order, setOrder] = useState<string[]>(() => submittedRankings ?? []);
  // このブラウザの受理済み順位（送信成功のたびに更新）。非 null なら再編集モード。
  const [lastSubmitted, setLastSubmitted] = useState<string[] | null>(submittedRankings);
  // 直前の操作で送信したか（new=初回送信 / updated=順位変更 / null=再訪問の表示のみ）
  const [justSubmitted, setJustSubmitted] = useState<"new" | "updated" | null>(null);
  // 送信成功の直後だけ開く受付完了ポップアップ（投票箱アニメ）。閉じると done 画面が残る。
  const [doneOpen, setDoneOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const poolItems = useMemo(() => options.filter((o) => !order.includes(o.id)), [options, order]);
  const hasChanges =
    !lastSubmitted ||
    order.length !== lastSubmitted.length ||
    order.some((id, i) => id !== lastSubmitted[i]);
  // 部分順位可：1つ以上で送信できる。編集時は実際に順位が変わった場合だけ再送信を許可する。
  const canSubmit = order.length > 0 && hasChanges;

  // ── ドラッグ並べ替え ────
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragMeta | null>(null); // pointermove/up が読む真実（state の遅延に依存しない）
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const settleTimer = useRef<number | null>(null);
  // タッチ長押しの待機状態（HOLD_MS 経過で持ち上げ、SLOP 超過や離指でスクロールに譲る）
  const pendingTouch = useRef<{
    pointerId: number;
    id: string;
    el: HTMLElement;
    startX: number;
    startY: number;
    timer: number;
  } | null>(null);
  // 持ち上げ中だけ有効な touchmove ブロッカ（ページスクロール抑止）の解除関数
  const releaseTouchBlock = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => {
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      if (pendingTouch.current) window.clearTimeout(pendingTouch.current.timer);
      releaseTouchBlock.current?.();
    };
  }, []);

  const beginDrag = useCallback(
    (el: HTMLElement, pointerId: number, baseY: number, id: string, blockTouchScroll: boolean) => {
      if (dragRef.current || settleTimer.current !== null || submitting) return;
      const startIndex = order.indexOf(id);
      if (startIndex < 0) return;
      const rows = order.map((oid) => rowRefs.current.get(oid));
      if (rows.some((r) => !r)) return;
      const boxes = rows.map((r) => r!.getBoundingClientRect());
      const rects = boxes.map((b) => ({ center: b.top + b.height / 2, height: b.height }));
      const gap = boxes.length > 1 ? Math.max(0, boxes[1].top - boxes[0].bottom) : 0;
      const scroller = findScrollParent(rows[startIndex]!);
      try {
        el.setPointerCapture(pointerId);
      } catch {
        /* capture 不可でもカード上の move/up で並べ替え自体は動く */
      }
      if (blockTouchScroll) {
        // カード面は touch-action を制限しない（持ち上げ前はスクロール可）ため、
        // 持ち上げた後のスクロールはここで止める。passive:false が必須。
        const prevent = (ev: TouchEvent) => ev.preventDefault();
        window.addEventListener("touchmove", prevent, { passive: false });
        releaseTouchBlock.current = () => window.removeEventListener("touchmove", prevent);
      }
      dragRef.current = {
        pointerId,
        startY: baseY,
        startIndex,
        targetIndex: startIndex,
        rects,
        gap,
        scroller,
        startScrollTop: scroller?.scrollTop ?? 0,
      };
      setDrag({
        id,
        startIndex,
        targetIndex: startIndex,
        offset: 0,
        shiftBy: rects[startIndex].height + gap,
        settling: false,
      });
    },
    [order, submitting]
  );
  // 長押しタイマーから呼ぶ用（発火時点の最新 order を見る）
  const beginDragLatest = useRef(beginDrag);
  useEffect(() => {
    beginDragLatest.current = beginDrag;
  });

  const cancelPendingTouch = useCallback(() => {
    if (!pendingTouch.current) return;
    window.clearTimeout(pendingTouch.current.timer);
    pendingTouch.current = null;
  }, []);

  /** カード面の pointerdown：マウスは即時持ち上げ、タッチは長押しで持ち上げ */
  const onRowPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>, id: string) => {
      if (dragRef.current || settleTimer.current !== null) return;
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return; // ✕ボタンは除外
      if (e.pointerType === "touch") {
        cancelPendingTouch();
        const el = e.currentTarget;
        const timer = window.setTimeout(() => {
          const p = pendingTouch.current;
          pendingTouch.current = null;
          if (p) beginDragLatest.current(p.el, p.pointerId, p.startY, p.id, true);
        }, HOLD_MS);
        pendingTouch.current = {
          pointerId: e.pointerId,
          id,
          el,
          startX: e.clientX,
          startY: e.clientY,
          timer,
        };
      } else {
        e.preventDefault(); // ラベル文字のドラッグ選択を抑止
        beginDrag(e.currentTarget, e.pointerId, e.clientY, id, false);
      }
    },
    [beginDrag, cancelPendingTouch]
  );

  /** ⠿ ハンドルの pointerdown：touch-action:none なのでタッチでも即時に持ち上げ */
  const onHandlePointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>, id: string) => {
      e.stopPropagation(); // カード面の長押し判定と二重処理しない
      beginDrag(e.currentTarget, e.pointerId, e.clientY, id, e.pointerType === "touch");
    },
    [beginDrag]
  );

  const moveDrag = useCallback((e: PointerEvent<HTMLElement>) => {
    const meta = dragRef.current;
    if (!meta || e.pointerId !== meta.pointerId) return;
    // 端に近づいたら親スクローラを送る（pointermove 駆動＝指が止まれば止まる・慣性なし）
    if (meta.scroller) {
      if (e.clientY < AUTOSCROLL_ZONE) meta.scroller.scrollTop -= AUTOSCROLL_STEP;
      else if (e.clientY > window.innerHeight - AUTOSCROLL_ZONE) {
        meta.scroller.scrollTop += AUTOSCROLL_STEP;
      }
    }
    // スクロールで中身が動いた分も含めて「開始時座標系での移動量」に直す
    const scrollDelta = (meta.scroller?.scrollTop ?? meta.startScrollTop) - meta.startScrollTop;
    const offset = e.clientY - meta.startY + scrollDelta;
    const center = meta.rects[meta.startIndex].center + offset;
    let target = meta.startIndex;
    if (offset < 0) {
      for (let j = meta.startIndex - 1; j >= 0; j--) if (center < meta.rects[j].center) target = j;
    } else {
      for (let j = meta.startIndex + 1; j < meta.rects.length; j++) {
        if (center > meta.rects[j].center) target = j;
      }
    }
    meta.targetIndex = target;
    setDrag((prev) =>
      prev && !prev.settling ? { ...prev, offset, targetIndex: target } : prev
    );
  }, []);

  const endDrag = useCallback((e: PointerEvent<HTMLElement>) => {
    const meta = dragRef.current;
    if (!meta || e.pointerId !== meta.pointerId) return;
    dragRef.current = null;
    releaseTouchBlock.current?.();
    releaseTouchBlock.current = null;
    const { startIndex, targetIndex } = meta;
    // つかんだカードを確定位置へ滑り込ませてから order を確定（着地の飛びを見せない）
    setDrag((prev) =>
      prev ? { ...prev, targetIndex, offset: settleOffset(meta, targetIndex), settling: true } : prev
    );
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null;
      setDrag(null);
      if (targetIndex !== startIndex) {
        setOrder((prev) => {
          const next = prev.slice();
          const [moved] = next.splice(startIndex, 1);
          next.splice(targetIndex, 0, moved);
          return next;
        });
      }
    }, SETTLE_MS);
  }, []);

  /** カード面の pointermove：長押し待機中は SLOP 判定、持ち上げ後はドラッグ追従 */
  const onRowPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const p = pendingTouch.current;
      if (p && e.pointerId === p.pointerId) {
        // 長押し前に指が滑った＝スクロール意図。持ち上げを中止してブラウザに譲る
        if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > TOUCH_SLOP) {
          cancelPendingTouch();
        }
        return;
      }
      moveDrag(e);
    },
    [cancelPendingTouch, moveDrag]
  );

  /** カード面の pointerup / pointercancel */
  const onRowPointerEnd = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const p = pendingTouch.current;
      if (p && e.pointerId === p.pointerId) {
        cancelPendingTouch(); // 長押し前に離した＝ただのタップ。何もしない
        return;
      }
      endDrag(e);
    },
    [cancelPendingTouch, endDrag]
  );

  const add = useCallback((id: string) => {
    tapHaptic();
    setOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);
  const remove = useCallback((id: string) => {
    // ドラッグ・settle 中の取り消しは index がずれるので受け付けない
    if (dragRef.current || settleTimer.current !== null) return;
    setOrder((prev) => prev.filter((x) => x !== id));
  }, []);

  // ドラッグの代替（キーボード・支援技術）：ハンドルにフォーカスして ↑↓ で1つずつ移動
  const keyMove = useCallback((e: KeyboardEvent<HTMLElement>, id: string) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const delta = e.key === "ArrowUp" ? -1 : 1;
    setOrder((prev) => {
      const i = prev.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      next[i] = next[j];
      next[j] = id;
      return next;
    });
  }, []);

  /** ドラッグ中、つかんでいない行が空きを作るために退避する量（px） */
  const rowShift = (d: DragState, index: number): number => {
    if (d.startIndex < d.targetIndex && index > d.startIndex && index <= d.targetIndex) {
      return -d.shiftBy;
    }
    if (d.startIndex > d.targetIndex && index >= d.targetIndex && index < d.startIndex) {
      return d.shiftBy;
    }
    return 0;
  };

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      // 初回送信は voter_key の Cookie がまだ無いので cookie_issued が返る（サーバは
      // Cookie を発行するだけで受理しない）。Cookie が乗った状態で 1 回だけ送り直す。
      // Cookie を保存できない環境では 2 回目も cookie_issued になり、その旨を案内する。
      let { result } = await submitBallotAction(slug, order);
      if (result === "cookie_issued") {
        ({ result } = await submitBallotAction(slug, order));
      }
      const r: SubmitResult = result;
      if (r === "ok") {
        // 再投票は upsert（最後の送信が有効）なので、2回目以降も正常系 ok で返る。
        tapHaptic(16);
        setJustSubmitted(lastSubmitted ? "updated" : "new");
        setLastSubmitted([...order]);
        setPhase("done");
        setDoneOpen(true);
      } else if (r === "poll_closed") {
        setError("この投票は締め切られました。結果ページへ移動します…");
        setTimeout(() => router.push(`/p/${slug}/results`), 1200);
      } else if (r === "captcha_required") {
        setError("この投票は人間確認が必要な設定ですが、確認機能が未対応のため送信できません。");
      } else if (r === "poll_not_found") {
        setError("投票が見つかりませんでした。URLをご確認ください。");
      } else if (r === "cookie_issued") {
        setError(
          "Cookieを保存できないため投票を受け付けられませんでした。プライベートブラウズやCookieのブロック設定をご確認のうえ、もう一度お試しください。"
        );
      } else if (r === "rate_limited") {
        setError("送信が集中しています。少し時間をおいてから、もう一度お試しください。");
      } else {
        setError("送信できませんでした。もう一度お試しください。");
      }
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  }, [slug, order, lastSubmitted, router]);

  // done →「順位を変更する」→ rank。order は受理済み順位のまま＝そこから編集を始める。
  const startEdit = useCallback(() => {
    setJustSubmitted(null);
    setError(null);
    setPhase("rank");
  }, []);

  // 編集をやめて受理済みの順位（lastSubmitted）へ戻す。未送信の並べ替えは破棄。
  const cancelEdit = useCallback(() => {
    if (!lastSubmitted) return;
    setOrder([...lastSubmitted]);
    setError(null);
    setPhase("done");
  }, [lastSubmitted]);

  if (phase === "done") {
    return (
      <VoteBox>
        <div className="bg-white rounded-[10px] px-3.5 py-3 flex flex-col gap-2">
          {order.map((id, i) => (
            <div key={id} className="flex items-center gap-2.5">
              <span className="w-8 flex-none text-[15px] font-bold text-tm-teal-deep">
                <span className="font-[family-name:var(--tm-font-latin)]">{i + 1}</span>位
              </span>
              <b className="text-[15px] font-bold leading-[1.5]">{optById.get(id)?.label}</b>
            </div>
          ))}
        </div>
        {justSubmitted && (
          <div className="flex">
            <span className="inline-flex items-center gap-1 rounded-full border border-tm-teal-hover bg-white px-[11px] py-[3px] text-[13px] font-semibold text-tm-teal-deep">
              <Check size={12} weight="bold" />
              {justSubmitted === "updated" ? "変更を受け付けました" : "受け付けました"}
            </span>
          </div>
        )}
        {/* 受付中は何度でも上書き再投票できる（最後の送信が有効） */}
        <button
          type="button"
          onClick={startEdit}
          className="flex items-center justify-center gap-2 rounded-full border border-tm-teal-hover bg-white px-4 py-3 text-[15px] font-bold tracking-[0.04em] text-tm-teal-deep transition-[background-color,color,border-color,transform] duration-150 ease-out hover:border-tm-teal hover:bg-tm-teal hover:text-white active:scale-[0.96]"
        >
          <PencilSimple size={16} />
          順位を変更する
        </button>
        {showLiveCount && (
          <a
            href={`/p/${slug}/results`}
            className="flex items-center justify-center gap-2 rounded-full px-4 py-1 text-[13.5px] font-semibold text-tm-teal-deep underline underline-offset-2 no-underline hover:underline"
          >
            <ChartBar size={15} />
            途中経過を見る
          </a>
        )}
        {/* 受付完了ポップアップ（投票箱アイソメアニメ）。送信成功の直後だけ開き、
            閉じるとこの done 画面（受理済み順位＋チップ）がそのまま残る。 */}
        <Modal
          open={doneOpen}
          onClose={() => setDoneOpen(false)}
          ariaLabel="受付完了"
          variant="center"
          panelClassName="px-[18px] pt-[26px] pb-5"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <BallotDoneArt />
            <b className="text-[18px] tracking-[0.04em]">
              {justSubmitted === "updated" ? "順位の変更を受け付けました" : "投票を受け付けました"}
            </b>
            <div className="self-stretch bg-tm-teal-100 rounded-[10px] px-4 py-2.5 flex flex-col gap-1.5 text-left">
              {(lastSubmitted ?? []).map((id, i) => (
                <div key={id} className="flex items-center gap-2.5">
                  <span className="w-8 flex-none text-[14px] font-bold text-tm-teal-deep">
                    <span className="font-[family-name:var(--tm-font-latin)]">{i + 1}</span>位
                  </span>
                  <b className="text-[15px] leading-[1.5]">{optById.get(id)?.label}</b>
                </div>
              ))}
            </div>
            <span className="text-[13px] text-tm-fg-muted leading-relaxed">
              受付中は、再投票により順位を変更できます
            </span>
            <button
              type="button"
              onClick={() => setDoneOpen(false)}
              className="self-stretch rounded-full bg-tm-teal text-white py-3 text-[16px] font-bold tracking-[0.04em] hover:bg-tm-teal-hover transition-colors"
            >
              OK
            </button>
          </div>
        </Modal>
      </VoteBox>
    );
  }

  // phase === "rank"
  return (
    <VoteBox>
      <b className="text-pretty text-[14px] leading-[1.7] text-tm-teal-deep">
        {lastSubmitted
          ? "送信済みの順位を編集できます"
          : "いいと思う順にタップしてください"}
      </b>

      <div className="flex flex-col gap-2">
        <b className="text-[13px] text-tm-teal-deep">
          選択肢 <span className="font-normal text-tm-teal-deep/70">（1つ以上）</span>
        </b>
        <div className="flex flex-wrap gap-2">
          {poolItems.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => add(o.id)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-tm-teal-hover bg-white px-3.5 py-2 text-[13px] font-bold text-tm-teal-deep transition-[background-color,color,border-color,transform] duration-150 ease-out hover:border-tm-teal hover:bg-tm-teal hover:text-white active:scale-[0.96]"
            >
              <Plus size={12} />
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <b className="text-[13px] text-tm-teal-deep">
          あなたの順位{" "}
          <span className="text-[12px] font-normal text-tm-teal-deep/70">
            （ドラッグで並べ替え・
            <X size={11} className="inline align-[-1px]" weight="bold" />
            で取り消し）
          </span>
        </b>
        {order.length === 0 ? (
          <div className="border border-dashed border-tm-gray-300 bg-white rounded-[10px] px-3.5 py-[13px] text-center text-[13px] leading-relaxed text-tm-gray-500">
            まだ選ばれていません
          </div>
        ) : (
          <div className="flex flex-col gap-1.5" role="list">
            {order.map((id, i) => {
              const o = optById.get(id);
              const isDragged = drag?.id === id;
              const shift = drag && !isDragged ? rowShift(drag, i) : 0;
              return (
                <div
                  key={id}
                  role="listitem"
                  ref={(el) => {
                    if (el) rowRefs.current.set(id, el);
                    else rowRefs.current.delete(id);
                  }}
                  onPointerDown={(e) => onRowPointerDown(e, id)}
                  onPointerMove={onRowPointerMove}
                  onPointerUp={onRowPointerEnd}
                  onPointerCancel={onRowPointerEnd}
                  className={`bg-white rounded-[10px] flex items-center gap-1.5 pl-1.5 pr-1.5 py-1.5 select-none cursor-grab ${
                    isDragged
                      ? "relative z-10 shadow-[0_10px_22px_rgba(0,0,0,0.18)] ring-1 ring-tm-teal-hover cursor-grabbing"
                      : ""
                  }`}
                  style={
                    isDragged
                      ? {
                          transform: `translateY(${drag.offset}px) scale(1.02)`,
                          transition: drag.settling
                            ? `transform ${SETTLE_MS}ms ease`
                            : "none",
                        }
                      : drag
                        ? {
                            transform: shift ? `translateY(${shift}px)` : undefined,
                            transition: `transform ${SETTLE_MS}ms ease`,
                          }
                        : undefined
                  }
                >
                  <button
                    type="button"
                    aria-label={`${o?.label ?? ""}（現在${i + 1}位）を移動。上下矢印キーでも動かせます`}
                    onPointerDown={(e) => onHandlePointerDown(e, id)}
                    onKeyDown={(e) => keyMove(e, id)}
                    className="flex size-11 flex-none touch-none select-none items-center justify-center rounded-[8px] text-tm-gray-400 cursor-grab active:cursor-grabbing hover:bg-tm-teal-100 hover:text-tm-teal-deep"
                  >
                    <DotsSixVertical size={20} weight="bold" />
                  </button>
                  <span className="w-8 flex-none text-[15px] font-bold text-tm-teal-deep">
                    <span className="font-[family-name:var(--tm-font-latin)]">{i + 1}</span>位
                  </span>
                  <b className="flex-1 text-[15px] font-bold leading-[1.5]">{o?.label}</b>
                  <button
                    type="button"
                    data-no-drag
                    aria-label={`${o?.label ?? ""}を順位から外す`}
                    disabled={drag !== null}
                    onClick={() => remove(id)}
                    className="flex size-11 flex-none items-center justify-center rounded-[8px] text-tm-gray-400 hover:bg-red-50 hover:text-tm-red"
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-[10px] bg-red-50 px-3 py-2 text-center text-[13px] text-tm-red ring-1 ring-inset ring-red-200 m-0">
          {error}
        </p>
      )}

      <div className="border-t border-tm-teal-200 pt-3 flex flex-col gap-2.5">
        <button
          type="button"
          // drag 中（settle 含む）は無効化：並べ替え確定前の order を送らない
          disabled={!canSubmit || submitting || drag !== null}
          onClick={submit}
          className="flex items-center justify-center gap-2 rounded-full bg-tm-teal px-4 py-3.5 text-[16px] font-bold tracking-[0.04em] text-white transition-[background-color,transform] duration-150 ease-out hover:bg-tm-teal-hover active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
        >
          {submitting ? "送信中…" : lastSubmitted ? "この順位に変更する" : "この順位で投票する"}
          {!submitting && <ArrowRight size={18} />}
        </button>
        {lastSubmitted && (
          <button
            type="button"
            disabled={submitting || drag !== null}
            onClick={cancelEdit}
            className="min-h-11 self-center rounded-full px-3 text-[13.5px] font-semibold text-tm-teal-deep underline underline-offset-2 transition-[color,transform] duration-150 ease-out hover:text-tm-teal active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
          >
            変更をやめる（送信済みの内容に戻す）
          </button>
        )}
        {(order.length === 0 || (lastSubmitted && !hasChanges)) && (
          <span className="text-pretty text-[13px] leading-[1.7] text-tm-fg-muted">
            {order.length === 0
              ? "選択肢を1つ以上入れると投票できます。"
              : "順位を変更すると送信できます。"}
          </span>
        )}
      </div>
    </VoteBox>
  );
}
